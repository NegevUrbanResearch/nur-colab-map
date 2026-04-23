import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PinkLineNodeForm from "./PinkLineNodeForm";
import PinkRouteFetchingBanner from "./PinkRouteFetchingBanner";
import MemorialSiteForm from "./MemorialSiteForm";
import MarkerActionPopover, { type MarkerActionPopoverTarget } from "./MarkerActionPopover";
import localMemorialIconUrl from "../../assets/memorial-sites/local-memorial-site.png";
import regionalMemorialIconUrl from "../../assets/memorial-sites/regional-memorial-site.png";
import { optimizeRoute } from "../../utils/routeOptimizer";
import {
  buildIntegratedRouteWithGoogleDetours,
  IntegratedRoute,
  flattenIntegratedRouteForPersistence,
  parseDefaultLinePaths,
} from "../../utils/pinkLineRoute";
import { serializeIntegratedRouteToColabBundle } from "../../utils/colabRouteGeometryExport";
import { addDetourPaintToMap } from "../../map/pinkDetourLeaflet";
import { routeLineStylesForDisplayColor } from "./mapLineStyles";
import {
  isAllowedSubmissionDisplayColor,
  listPickableSubmissionDisplayColors,
  normalizeSubmissionDisplayColorHex,
  secondaryHexForPrimaryNormalized,
  SUBMISSION_DISPLAY_COLOR_PALETTE,
} from "../../submission/submissionDisplayColor";
import { ensureMemorialSitesProjectForUser, loadProjects } from "../../supabase/projects";
import { PendingSite } from "../../supabase/memorialSites";
import {
  listSubmissionBatchSummariesForWorkspace,
  loadSubmissionBatchMapDetail,
  type SubmissionBatchSummary,
} from "../../supabase/submissionBatches";
import { submitUnifiedFeatures } from "../../supabase/unifiedSubmission";
import supabase from "../../supabase";
import { computeRouteViaEdgeFunction } from "../../services/googleRoutes";
import { getCoreLayerUrls } from "../../map/layers/coreLayers";
import { buildLayerRegistry } from "../../map/layers/layerRegistry";
import { createBasemapTileLayer } from "../../map/layers/basemaps";
import { buildLegendModel } from "../../map/layers/legend/buildLegendModel";
import { buildLayerTileRows } from "../../map/layers/layerNameUtils";
import type { LayerRegistry } from "../../map/layers/types";
import { addParkingLotsLayer } from "../../utils/parkingLayer";
import { useLayerPackState } from "./useLayerPackState";
import LayerPacksSheet from "./LayerPacksSheet";
import LayerPackStrip from "./LayerPackStrip";
import LayerTilesGrid from "./LayerTilesGrid";
import LegendTray, { type LegendTraySection } from "./LegendTray";
import {
  applyEditAction,
  canRedo,
  canUndo,
  createEmptyEditHistory,
  redoOne,
  undoOne,
  type EditAction,
  type EditableMapState,
  type PendingPinkNode,
} from "./editHistory";

const MEMORIAL_PROJECT_ID = "33333333-3333-3333-3333-333333333333";
const APP_BASE_URL = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
const { heritageAxis: HERITAGE_AXIS_URL, parkingLots: PARKING_LOTS_URL, parkingIcon: PARKING_ICON_URL } =
  getCoreLayerUrls();
const FAVICON_URL = `${APP_BASE_URL}favicon.ico`;

/** Reposition at or above this distance (meters) commits a move and suppresses the post-drag click-delete confirm. */
const MARKER_REPOSITION_EPSILON_METERS = 2;

function normalizedAllowedSubmissionDisplayColor(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  if (!isAllowedSubmissionDisplayColor(t)) return null;
  return normalizeSubmissionDisplayColorHex(t)!;
}

type ActiveProject = "pink" | "memorial";
type SubmitScope = "pink" | "memorial" | "everything";
type SubmitEditDisposition = "overwrite" | "saveAsNew";

function flattenSegmentsForPersistence(route: IntegratedRoute): Array<[number, number]> {
  return flattenIntegratedRouteForPersistence(route);
}

const MapPage = () => {
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const baseMapLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLayersRef = useRef<L.Layer[]>([]);
  const activeProjectRef = useRef<ActiveProject>("pink");
  const activeMemorialTypeRef = useRef<"central" | "local">("local");

  const [activeProject, setActiveProject] = useState<ActiveProject>("pink");
  const [activeMemorialType, setActiveMemorialType] = useState<"central" | "local">("local");

  const [pinkProjectId, setPinkProjectId] = useState<string | null>(null);
  const [memorialProjectId, setMemorialProjectId] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  const [pendingPinkTarget, setPendingPinkTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingMemorialTarget, setPendingMemorialTarget] = useState<{
    lat: number;
    lng: number;
    type: "central" | "local";
  } | null>(null);

  const [pinkNodes, setPinkNodes] = useState<PendingPinkNode[]>([]);
  const [centralSite, setCentralSite] = useState<PendingSite | null>(null);
  const [localSites, setLocalSites] = useState<PendingSite[]>([]);
  const [editHistory, setEditHistory] = useState(createEmptyEditHistory);

  const [markerActionPopover, setMarkerActionPopover] = useState<MarkerActionPopoverTarget | null>(null);
  const [editingPinkTempId, setEditingPinkTempId] = useState<string | null>(null);
  const [editingMemorial, setEditingMemorial] = useState<{
    tempId: string;
    scope: "central" | "local";
  } | null>(null);

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitScope, setSubmitScope] = useState<SubmitScope>("everything");
  const [submitting, setSubmitting] = useState(false);
  const [submittedSummary, setSubmittedSummary] = useState<string | null>(null);
  const [defaultLineLoaded, setDefaultLineLoaded] = useState(false);
  const [integratedPinkRoute, setIntegratedPinkRoute] = useState<IntegratedRoute | null>(null);
  const [pinkRouteForPersistence, setPinkRouteForPersistence] = useState<Array<[number, number]>>([]);
  const [pinkRouteError, setPinkRouteError] = useState<string | null>(null);
  const [isFetchingPinkRoute, setIsFetchingPinkRoute] = useState(false);

  const pinkUserPointsKey = useMemo(
    () => JSON.stringify(pinkNodes.map((n) => [n.lat, n.lng])),
    [pinkNodes]
  );

  const [submissionBatches, setSubmissionBatches] = useState<SubmissionBatchSummary[]>([]);
  const [submissionBatchesLoading, setSubmissionBatchesLoading] = useState(false);
  const [submissionBatchesError, setSubmissionBatchesError] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [submissionNameInput, setSubmissionNameInput] = useState("");
  const [loadingSubmissionDetail, setLoadingSubmissionDetail] = useState(false);
  const [submissionDisplayColor, setSubmissionDisplayColor] = useState<string | null>(null);
  const [submitEditDisposition, setSubmitEditDisposition] = useState<SubmitEditDisposition>("overwrite");
  const [submissionColorPopoverOpen, setSubmissionColorPopoverOpen] = useState(false);

  const submissionDetailLoadSeqRef = useRef(0);
  const selectedSubmissionIdRef = useRef<string | null>(null);
  const submissionNameInputRef = useRef("");
  const submissionColorAtLoadRef = useRef<string | null>(null);
  const submitModalWasOpenRef = useRef(false);

  const [memorialDragPlacementEnabled, setMemorialDragPlacementEnabled] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setMemorialDragPlacementEnabled(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const [layerRegistry, setLayerRegistry] = useState<LayerRegistry | null>(null);
  const [layerSheetOpen, setLayerSheetOpen] = useState(false);
  const [legendTrayOpen, setLegendTrayOpen] = useState(false);
  const [narrowMapDock, setNarrowMapDock] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const sync = () => setNarrowMapDock(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let cancel = false;
    buildLayerRegistry()
      .then((r) => {
        if (!cancel) setLayerRegistry(r);
      })
      .catch((err) => {
        console.error("Failed to load layer registry:", err);
        if (!cancel) setLayerRegistry(null);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const {
    basemap,
    setBasemap,
    focusedPackId,
    setFocusedPackId,
    getPackState,
    activeCountForPack,
    totalActiveLayerCount,
    togglePack,
    toggleLayer,
    toggleLayerGroup,
    isLayerOn,
    layerOnByKey,
  } = useLayerPackState(layerRegistry);

  const legendTraySections = useMemo((): LegendTraySection[] => {
    if (!layerRegistry) return [];
    const model = buildLegendModel(layerRegistry, layerOnByKey);
    return model.groups.map((g) => ({
      id: g.packId,
      title: g.packName,
      rows: g.rows,
    }));
  }, [layerRegistry, layerOnByKey]);

  const focusedLayerPack = useMemo(() => {
    if (!layerRegistry || !focusedPackId) return null;
    return layerRegistry.packs.find((p) => p.id === focusedPackId) ?? null;
  }, [layerRegistry, focusedPackId]);

  const focusedPackTileRows = useMemo(() => {
    if (!focusedLayerPack) return [];
    return buildLayerTileRows(focusedLayerPack.id, focusedLayerPack.manifest.layers);
  }, [focusedLayerPack]);

  const cycleBasemap = useCallback(() => {
    setBasemap((b) => (b === "satellite" ? "osm" : "satellite"));
  }, [setBasemap]);

  const openLayerSheet = useCallback(() => {
    setLegendTrayOpen(false);
    setLayerSheetOpen(true);
  }, []);

  const toggleLegendTray = useCallback(() => {
    setLegendTrayOpen((prev) => {
      const next = !prev;
      if (next) setLayerSheetOpen(false);
      return next;
    });
  }, []);

  const defaultLinePathsRef = useRef<[number, number][][]>([]);
  const pendingPinkMarkerRef = useRef<L.Marker | null>(null);
  const pendingMemorialMarkerRef = useRef<L.Marker | null>(null);
  const parkingLayerRef = useRef<L.LayerGroup | null>(null);
  const centralSiteRef = useRef<PendingSite | null>(null);
  /** One-shot: outside dismiss used pointerdown on the map; ignore the subsequent Leaflet map `click` for placement. */
  const suppressNextMapClickPlacementRef = useRef(false);
  const popoverDismissSuppressTimerRef = useRef<number | null>(null);
  const submissionColorPopoverRef = useRef<HTMLDivElement | null>(null);
  const submissionColorSwatchTriggerRef = useRef<HTMLButtonElement | null>(null);
  const submissionColorPopoverPanelId = useId();
  const markerActionPopoverRef = useRef<MarkerActionPopoverTarget | null>(null);
  const pinkNodesRef = useRef<PendingPinkNode[]>(pinkNodes);
  const localSitesRef = useRef<PendingSite[]>(localSites);

  useLayoutEffect(() => {
    markerActionPopoverRef.current = markerActionPopover;
    pinkNodesRef.current = pinkNodes;
    localSitesRef.current = localSites;
  }, [markerActionPopover, pinkNodes, localSites]);

  useEffect(() => {
    activeProjectRef.current = activeProject;
  }, [activeProject]);

  useEffect(() => {
    activeMemorialTypeRef.current = activeMemorialType;
  }, [activeMemorialType]);

  useEffect(() => {
    centralSiteRef.current = centralSite;
  }, [centralSite]);

  useLayoutEffect(() => {
    selectedSubmissionIdRef.current = selectedSubmissionId;
  }, [selectedSubmissionId]);

  useLayoutEffect(() => {
    submissionNameInputRef.current = submissionNameInput;
  }, [submissionNameInput]);

  const applyLocalAction = useCallback((action: EditAction) => {
    const state = { pinkNodes, centralSite, localSites };
    const applied = applyEditAction(state, editHistory, action);
    setPinkNodes(applied.state.pinkNodes);
    setCentralSite(applied.state.centralSite);
    setLocalSites(applied.state.localSites);
    setEditHistory(applied.history);
  }, [pinkNodes, centralSite, localSites, editHistory]);

  const handleUndo = useCallback(() => {
    const state = { pinkNodes, centralSite, localSites };
    const undone = undoOne(state, editHistory);
    setPinkNodes(undone.state.pinkNodes);
    setCentralSite(undone.state.centralSite);
    setLocalSites(undone.state.localSites);
    setEditHistory(undone.history);
  }, [pinkNodes, centralSite, localSites, editHistory]);

  const handleRedo = useCallback(() => {
    const state = { pinkNodes, centralSite, localSites };
    const redone = redoOne(state, editHistory);
    setPinkNodes(redone.state.pinkNodes);
    setCentralSite(redone.state.centralSite);
    setLocalSites(redone.state.localSites);
    setEditHistory(redone.history);
  }, [pinkNodes, centralSite, localSites, editHistory]);

  const applyLocalActionRef = useRef<(action: EditAction) => void>(() => {});
  useLayoutEffect(() => {
    applyLocalActionRef.current = applyLocalAction;
  }, [applyLocalAction]);

  const handleMarkerActionPopoverClose = useCallback((ev: PointerEvent) => {
    const map = mapRef.current;
    if (map?.getContainer().contains(ev.target as Node)) {
      suppressNextMapClickPlacementRef.current = true;
      if (popoverDismissSuppressTimerRef.current != null) {
        window.clearTimeout(popoverDismissSuppressTimerRef.current);
      }
      popoverDismissSuppressTimerRef.current = window.setTimeout(() => {
        popoverDismissSuppressTimerRef.current = null;
        suppressNextMapClickPlacementRef.current = false;
      }, 550);
    }
    setMarkerActionPopover(null);
  }, []);

  const suppressMapClickAfterPopoverDismiss = useCallback((ev: PointerEvent) => {
    const map = mapRef.current;
    if (map?.getContainer().contains(ev.target as Node)) {
      suppressNextMapClickPlacementRef.current = true;
      if (popoverDismissSuppressTimerRef.current != null) {
        window.clearTimeout(popoverDismissSuppressTimerRef.current);
      }
      popoverDismissSuppressTimerRef.current = window.setTimeout(() => {
        popoverDismissSuppressTimerRef.current = null;
        suppressNextMapClickPlacementRef.current = false;
      }, 550);
    }
  }, []);

  const dismissSubmissionColorPopover = useCallback(
    (ev: PointerEvent | null) => {
      setSubmissionColorPopoverOpen(false);
      if (ev) suppressMapClickAfterPopoverDismiss(ev);
      queueMicrotask(() => submissionColorSwatchTriggerRef.current?.focus());
    },
    [suppressMapClickAfterPopoverDismiss]
  );

  const handleMarkerActionPopoverEdit = useCallback(() => {
    const t = markerActionPopoverRef.current;
    if (!t) return;
    setMarkerActionPopover(null);
    if (t.kind === "pink") {
      setEditingPinkTempId(t.tempId);
      return;
    }
    setEditingMemorial({ tempId: t.tempId, scope: t.memorialScope });
  }, []);

  const handleMarkerActionPopoverDelete = useCallback(() => {
    const t = markerActionPopoverRef.current;
    if (!t) return;
    setMarkerActionPopover(null);
    if (t.kind === "pink") {
      const nodes = pinkNodesRef.current;
      const index = nodes.findIndex((n) => n.tempId === t.tempId);
      if (index < 0) return;
      const current = nodes[index];
      if (!current) return;
      applyLocalActionRef.current({
        kind: "pink:remove",
        node: { ...current },
        index,
      });
      return;
    }
    if (t.memorialScope === "central") {
      const current = centralSiteRef.current;
      if (!current || current.tempId !== t.tempId) return;
      applyLocalActionRef.current({
        kind: "memorial:removeCentral",
        previous: { ...current },
      });
      return;
    }
    const sites = localSitesRef.current;
    const index = sites.findIndex((s) => s.tempId === t.tempId);
    if (index < 0) return;
    const current = sites[index];
    if (!current) return;
    applyLocalActionRef.current({
      kind: "memorial:removeLocal",
      site: { ...current },
      index,
    });
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setIsBootstrapping(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          navigate("/");
          return;
        }

        await ensureMemorialSitesProjectForUser(user.id);
        const projects = await loadProjects();

        const pinkProject = projects.find((p) => p.name.toLowerCase().includes("pink"));
        const memorialProject = projects.find((p) => p.id === MEMORIAL_PROJECT_ID);

        setPinkProjectId(pinkProject?.id ?? null);
        setMemorialProjectId(memorialProject?.id ?? null);

        if (!pinkProject) {
          setBootError("פרויקט ציר המורשת אינו זמין למשתמש שלך.");
        }
      } catch (error) {
        console.error("Failed to bootstrap unified map:", error);
        setBootError("Failed to initialize the unified workspace.");
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrap();
  }, [navigate]);

  const refreshSubmissionBatchesList = useCallback(async () => {
    try {
      const list = await listSubmissionBatchSummariesForWorkspace({
        pinkProjectId,
        memorialProjectId,
      });
      setSubmissionBatches(list);
      setSubmissionBatchesError(null);
    } catch (err) {
      console.error("Failed to refresh submission batches:", err);
      setSubmissionBatchesError("טעינת הגשות נכשלה");
    }
  }, [pinkProjectId, memorialProjectId]);

  useEffect(() => {
    if (isBootstrapping || bootError) return;
    let cancelled = false;
    (async () => {
      setSubmissionBatchesLoading(true);
      setSubmissionBatchesError(null);
      try {
        const list = await listSubmissionBatchSummariesForWorkspace({
          pinkProjectId,
          memorialProjectId,
        });
        if (!cancelled) setSubmissionBatches(list);
      } catch (err) {
        console.error("Failed to load submission batches:", err);
        if (!cancelled) {
          setSubmissionBatchesError("טעינת הגשות נכשלה");
          setSubmissionBatches([]);
        }
      } finally {
        if (!cancelled) setSubmissionBatchesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isBootstrapping, bootError, pinkProjectId, memorialProjectId]);

  useEffect(() => {
    if (isBootstrapping || bootError) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    routeLayersRef.current = [];

    const markersRegistry = markersRef.current;

    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;
    const mapEl = mapContainer as HTMLElement & { _leaflet_id?: number };
    if (mapEl._leaflet_id != null) delete mapEl._leaflet_id;
    mapContainer.innerHTML = "";

    mapRef.current = L.map("map", { zoomControl: false }).setView([31.42, 34.49], 13);
    const mapInstance = mapRef.current;
    const baseTile = createBasemapTileLayer("satellite").addTo(mapRef.current);
    baseMapLayerRef.current = baseTile;
    L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);

    mapRef.current.on("click", (e: L.LeafletMouseEvent) => {
      if (suppressNextMapClickPlacementRef.current) {
        suppressNextMapClickPlacementRef.current = false;
        if (popoverDismissSuppressTimerRef.current != null) {
          window.clearTimeout(popoverDismissSuppressTimerRef.current);
          popoverDismissSuppressTimerRef.current = null;
        }
        return;
      }
      if (activeProjectRef.current === "pink") {
        setPendingPinkTarget({ lat: e.latlng.lat, lng: e.latlng.lng });
        return;
      }
      if (activeMemorialTypeRef.current === "central" && centralSiteRef.current) {
        if (!confirm("ניתן לבחור רק אנדרטה מרכזית אחת. האם להחליף את הקיימת?")) {
          return;
        }
        const prev = centralSiteRef.current;
        applyLocalActionRef.current({ kind: "memorial:removeCentral", previous: prev });
      }
      setPendingMemorialTarget({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        type: activeMemorialTypeRef.current,
      });
    });

    fetch(HERITAGE_AXIS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch heritage axis GeoJSON (${res.status})`);
        return res.json();
      })
      .then((geojson: GeoJSON.FeatureCollection) => {
        defaultLinePathsRef.current = parseDefaultLinePaths(geojson);
        setDefaultLineLoaded(true);
      })
      .catch((err) => console.error("Failed to load heritage axis line:", err));

    addParkingLotsLayer(mapInstance, PARKING_LOTS_URL, PARKING_ICON_URL, () => mapRef.current === mapInstance)
      .then((group) => {
        if (group) parkingLayerRef.current = group;
      })
      .catch((err) => console.error("Failed to load parking lots:", err));

    return () => {
      if (popoverDismissSuppressTimerRef.current != null) {
        window.clearTimeout(popoverDismissSuppressTimerRef.current);
        popoverDismissSuppressTimerRef.current = null;
      }
      parkingLayerRef.current = null;
      baseMapLayerRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRegistry.forEach((marker) => marker.remove());
      markersRegistry.clear();
      routeLayersRef.current = [];
    };
  }, [isBootstrapping, bootError]);

  useEffect(() => {
    if (isBootstrapping || bootError) return;
    const map = mapRef.current;
    const cur = baseMapLayerRef.current;
    if (!map || !cur) return;
    map.removeLayer(cur);
    const next = createBasemapTileLayer(basemap);
    next.addTo(map);
    baseMapLayerRef.current = next;
  }, [basemap, isBootstrapping, bootError]);

  useEffect(() => {
    let cancelled = false;

    const rebuildPinkRoute = async () => {
      if (!defaultLineLoaded || defaultLinePathsRef.current.length === 0) {
        setIsFetchingPinkRoute(false);
        setIntegratedPinkRoute(null);
        setPinkRouteForPersistence([]);
        setPinkRouteError(null);
        return;
      }

      const userPoints = JSON.parse(pinkUserPointsKey) as [number, number][];
      const willCallGoogle = userPoints.length > 0;
      if (!willCallGoogle) {
        setIsFetchingPinkRoute(false);
      }

      try {
        if (willCallGoogle) {
          setIsFetchingPinkRoute(true);
        }
        const route = await buildIntegratedRouteWithGoogleDetours(defaultLinePathsRef.current, userPoints, {
          computeRoute: async (waypoints) => {
            const computed = await computeRouteViaEdgeFunction(waypoints);
            return computed.points;
          },
        });

        if (cancelled) return;
        setIntegratedPinkRoute(route);
        setPinkRouteForPersistence(flattenSegmentsForPersistence(route));
        setPinkRouteError(null);
      } catch (error) {
        console.error("Failed to build Google-routed pink line:", error);
        if (cancelled) return;
        setIntegratedPinkRoute(null);
        setPinkRouteForPersistence([]);
        setPinkRouteError("Failed to compute route using Google Routes. Please adjust points and try again.");
      } finally {
        if (!cancelled && willCallGoogle) {
          setIsFetchingPinkRoute(false);
        }
      }
    };

    rebuildPinkRoute();

    return () => {
      cancelled = true;
    };
  }, [pinkUserPointsKey, defaultLineLoaded, pinkProjectId]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    routeLayersRef.current.forEach((layer) => {
      try {
        map.removeLayer(layer);
      } catch (_) {
        // no-op
      }
    });
    routeLayersRef.current = [];

    const trimmedDisplayColor = submissionDisplayColor?.trim() ?? "";
    const validDisplayHex =
      trimmedDisplayColor && isAllowedSubmissionDisplayColor(trimmedDisplayColor)
        ? normalizeSubmissionDisplayColorHex(trimmedDisplayColor)!
        : null;
    const pinkNodeFill = validDisplayHex ?? "#ff69b4";

    if (integratedPinkRoute) {
      const { solid, dashed, removed } = integratedPinkRoute;
      const {
        solid: solidStyle,
        old: removedStyle,
        proposed: dashedStyle,
        proposedSecondary: dashedSecondaryStyle,
        oldHalo: removedHaloStyle,
        proposedHalo: dashedHaloStyle,
      } = routeLineStylesForDisplayColor(submissionDisplayColor);
      const showPinkDetours = pinkNodes.length > 0;

      for (const points of solid) {
        routeLayersRef.current.push(L.polyline(points as L.LatLngExpression[], solidStyle).addTo(map));
      }
      if (showPinkDetours) {
        for (const points of removed) {
          routeLayersRef.current.push(L.polyline(points as L.LatLngExpression[], removedHaloStyle).addTo(map));
          routeLayersRef.current.push(L.polyline(points as L.LatLngExpression[], removedStyle).addTo(map));
        }
      }
      if (showPinkDetours) {
        if (integratedPinkRoute.detourPaint && integratedPinkRoute.detourPaint.length > 0) {
          addDetourPaintToMap(
            map,
            integratedPinkRoute.detourPaint,
            dashedStyle,
            routeLayersRef.current,
            dashedHaloStyle,
            dashedSecondaryStyle
          );
        } else {
          for (const points of dashed) {
            routeLayersRef.current.push(L.polyline(points as L.LatLngExpression[], dashedHaloStyle).addTo(map));
            if (dashedSecondaryStyle) {
              routeLayersRef.current.push(
                L.polyline(points as L.LatLngExpression[], dashedSecondaryStyle).addTo(map)
              );
            }
            routeLayersRef.current.push(L.polyline(points as L.LatLngExpression[], dashedStyle).addTo(map));
          }
        }
      }
    }

    if (pinkNodes.length > 0) {
      const optimized = pinkNodes.length > 1
        ? optimizeRoute(
            pinkNodes.map((n) => ({
              id: n.tempId,
              lat: n.lat,
              lng: n.lng,
            }))
          )
        : pinkNodes.map((n) => ({ id: n.tempId, lat: n.lat, lng: n.lng }));
      const nodeOrder = new Map(optimized.map((n, index) => [n.id, index + 1]));

      pinkNodes.forEach((node) => {
        const marker = L.marker([node.lat, node.lng], {
          draggable: true,
          icon: L.divIcon({
            className: "pink-line-node-marker",
            html: `<div class="pink-line-node" style="background-color: ${pinkNodeFill}; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.45);">${nodeOrder.get(node.tempId) || 1}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
        }).addTo(map);

        let dragStartLatLng: L.LatLng | null = null;
        let suppressNextDeleteClick = false;
        marker.on("dragstart", () => {
          dragStartLatLng = marker.getLatLng();
        });
        marker.on("dragend", () => {
          const end = marker.getLatLng();
          const origin = dragStartLatLng ?? L.latLng(node.lat, node.lng);
          dragStartLatLng = null;
          const distM = origin.distanceTo(end);
          if (distM >= MARKER_REPOSITION_EPSILON_METERS) {
            suppressNextDeleteClick = true;
            applyLocalActionRef.current({
              kind: "pink:move",
              tempId: node.tempId,
              from: { lat: origin.lat, lng: origin.lng },
              to: { lat: end.lat, lng: end.lng },
            });
          } else {
            marker.setLatLng(origin);
          }
        });

        marker.on("click", () => {
          if (suppressNextDeleteClick) {
            suppressNextDeleteClick = false;
            return;
          }
          setMarkerActionPopover({ kind: "pink", tempId: node.tempId });
        });

        markersRef.current.set(node.tempId, marker);
      });
    }

    const placeMemorial = (site: PendingSite, isCentral: boolean) => {
      const iconUrl = isCentral ? regionalMemorialIconUrl : localMemorialIconUrl;
      const icon =
        validDisplayHex != null
          ? L.divIcon({
              className: "memorial-marker-accent-icon",
              html: `<div class="memorial-marker-accent-shell" style="--mem-accent:${validDisplayHex}"><img src="${iconUrl}" alt="" width="36" height="36" class="memorial-marker-accent-img" draggable="false" /></div>`,
              iconSize: [44, 44],
              iconAnchor: [22, 22],
              popupAnchor: [0, -20],
            })
          : L.icon({
              iconUrl,
              iconSize: [40, 40],
              iconAnchor: [20, 20],
              popupAnchor: [0, -20],
            });
      const marker = L.marker([site.lat, site.lng], { icon, draggable: true }).addTo(map);
      let dragStartLatLng: L.LatLng | null = null;
      let suppressNextDeleteClick = false;
      marker.on("dragstart", () => {
        dragStartLatLng = marker.getLatLng();
      });
      marker.on("dragend", () => {
        const end = marker.getLatLng();
        const origin = dragStartLatLng ?? L.latLng(site.lat, site.lng);
        dragStartLatLng = null;
        const distM = origin.distanceTo(end);
        if (distM < MARKER_REPOSITION_EPSILON_METERS) {
          marker.setLatLng(origin);
          return;
        }
        suppressNextDeleteClick = true;
        if (isCentral) {
          applyLocalActionRef.current({
            kind: "memorial:setCentral",
            site: { ...site, lat: end.lat, lng: end.lng },
            previous: { ...site },
          });
        } else {
          applyLocalActionRef.current({
            kind: "memorial:moveLocal",
            tempId: site.tempId,
            from: { lat: origin.lat, lng: origin.lng },
            to: { lat: end.lat, lng: end.lng },
          });
        }
      });
      marker.on("click", () => {
        if (suppressNextDeleteClick) {
          suppressNextDeleteClick = false;
          return;
        }
        setMarkerActionPopover({
          kind: "memorial",
          tempId: site.tempId,
          memorialScope: isCentral ? "central" : "local",
        });
      });
      markersRef.current.set(site.tempId, marker);
    };

    if (centralSite) placeMemorial(centralSite, true);
    localSites.forEach((site) => placeMemorial(site, false));
  }, [pinkNodes, centralSite, localSites, defaultLineLoaded, integratedPinkRoute, submissionDisplayColor]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (pendingPinkMarkerRef.current) {
      try {
        mapRef.current.removeLayer(pendingPinkMarkerRef.current);
      } catch {
        void 0;
      }
      pendingPinkMarkerRef.current = null;
    }
    if (pendingPinkTarget) {
      pendingPinkMarkerRef.current = L.marker([pendingPinkTarget.lat, pendingPinkTarget.lng], {
        icon: L.divIcon({
          className: "pink-line-node-marker",
          html: `<div class="pink-line-node">+</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      }).addTo(mapRef.current);
    }
  }, [pendingPinkTarget]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (pendingMemorialMarkerRef.current) {
      try {
        mapRef.current.removeLayer(pendingMemorialMarkerRef.current);
      } catch {
        void 0;
      }
      pendingMemorialMarkerRef.current = null;
    }
    if (pendingMemorialTarget) {
      const iconUrl = pendingMemorialTarget.type === "central" ? regionalMemorialIconUrl : localMemorialIconUrl;
      pendingMemorialMarkerRef.current = L.marker([pendingMemorialTarget.lat, pendingMemorialTarget.lng], {
        icon: L.icon({
          iconUrl,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          popupAnchor: [0, -20],
        }),
      }).addTo(mapRef.current);
    }
  }, [pendingMemorialTarget]);

  const hasPink = pinkNodes.length > 0;
  const hasMemorial = useMemo(() => Boolean(centralSite) || localSites.length > 0, [centralSite, localSites.length]);

  /** Globally assigned batch colors (deduped). Swatches disabled when in this set unless “self” (source / current overwrite batch). */
  const usedDisplayColorSet = useMemo(() => {
    const s = new Set<string>();
    for (const b of submissionBatches) {
      const t = b.displayColor?.trim();
      if (t) s.add(t.toUpperCase());
    }
    return s;
  }, [submissionBatches]);

  const firstUnusedPaletteColor = useMemo(() => {
    for (const h of SUBMISSION_DISPLAY_COLOR_PALETTE) {
      if (!usedDisplayColorSet.has(h.toUpperCase())) return h;
    }
    return SUBMISSION_DISPLAY_COLOR_PALETTE[0];
  }, [usedDisplayColorSet]);

  type SubmissionSelectRow = { id: string; label: string; displayColor?: string };

  const submissionSelectRows = useMemo((): SubmissionSelectRow[] => {
    const rows: SubmissionSelectRow[] = submissionBatches.map((b) => ({
      id: b.submissionId,
      label: b.name,
      displayColor: b.displayColor,
    }));
    if (selectedSubmissionId && !rows.some((r) => r.id === selectedSubmissionId)) {
      return [
        {
          id: selectedSubmissionId,
          label: submissionNameInput.trim() || `…${selectedSubmissionId.slice(0, 8)}`,
        },
        ...rows,
      ];
    }
    return rows;
  }, [submissionBatches, selectedSubmissionId, submissionNameInput]);

  const isEditingExistingSubmission = selectedSubmissionId !== null;

  const selectedSubmissionStripHex = useMemo(() => {
    const fromState = normalizedAllowedSubmissionDisplayColor(submissionDisplayColor);
    if (fromState) return fromState;
    if (selectedSubmissionId) {
      const batch = submissionBatches.find((b) => b.submissionId === selectedSubmissionId);
      if (batch) return normalizedAllowedSubmissionDisplayColor(batch.displayColor);
    }
    return null;
  }, [submissionDisplayColor, selectedSubmissionId, submissionBatches]);

  const sourceBatchDisplayUpper = useMemo(() => {
    if (selectedSubmissionId == null) return null;
    const raw = submissionBatches.find((b) => b.submissionId === selectedSubmissionId)?.displayColor;
    const t = raw?.trim();
    return t ? t.toUpperCase() : null;
  }, [selectedSubmissionId, submissionBatches]);

  const loadedOverwriteDisplayColorUpper = useMemo(() => {
    if (!isEditingExistingSubmission || submitEditDisposition !== "overwrite" || !selectedSubmissionId) {
      return null;
    }
    const fromBatch = submissionBatches.find((b) => b.submissionId === selectedSubmissionId)?.displayColor?.trim();
    if (fromBatch) return fromBatch.toUpperCase();
    return submissionColorAtLoadRef.current?.toUpperCase() ?? null;
  }, [isEditingExistingSubmission, submitEditDisposition, selectedSubmissionId, submissionBatches]);

  /** Overwrite RPC deletes all workspace rows for this submission; partial scope would wipe the other domain. */
  const lockFullWorkspaceOverwrite =
    isEditingExistingSubmission &&
    submitEditDisposition === "overwrite" &&
    hasPink &&
    hasMemorial;

  const hideSubmitScopePanel =
    showSubmitModal && isEditingExistingSubmission && submitEditDisposition === "overwrite";

  useEffect(() => {
    if (isEditingExistingSubmission && submitEditDisposition === "overwrite") {
      if (hasPink && hasMemorial) {
        setSubmitScope("everything");
      } else if (hasPink) {
        setSubmitScope("pink");
      } else if (hasMemorial) {
        setSubmitScope("memorial");
      }
      return;
    }
    if (!showSubmitModal) return;
    if (hasPink && hasMemorial) {
      setSubmitScope("everything");
    } else if (hasPink) {
      setSubmitScope("pink");
    } else if (hasMemorial) {
      setSubmitScope("memorial");
    }
  }, [
    showSubmitModal,
    hasPink,
    hasMemorial,
    isEditingExistingSubmission,
    submitEditDisposition,
    lockFullWorkspaceOverwrite,
  ]);

  useEffect(() => {
    if (!showSubmitModal) {
      submitModalWasOpenRef.current = false;
      return;
    }
    const justOpened = !submitModalWasOpenRef.current;
    submitModalWasOpenRef.current = true;
    if (!justOpened) return;
    const useOverwrite = isEditingExistingSubmission && submitEditDisposition === "overwrite";
    if (useOverwrite) return;
    // Never auto-pick a pool color when an existing submission is selected; color comes from DB load (or user).
    if (isEditingExistingSubmission) return;
    if (submissionDisplayColor !== null) return;
    setSubmissionDisplayColor(firstUnusedPaletteColor);
  }, [
    showSubmitModal,
    isEditingExistingSubmission,
    submitEditDisposition,
    submissionDisplayColor,
    firstUnusedPaletteColor,
  ]);

  /** Save-as-new: if the paint color is taken by another batch (not the source row), jump to a free palette slot. */
  useEffect(() => {
    if (!showSubmitModal) return;
    if (!isEditingExistingSubmission || submitEditDisposition !== "saveAsNew") return;
    const norm = normalizedAllowedSubmissionDisplayColor(submissionDisplayColor);
    if (norm == null) return;
    const isSelf =
      (sourceBatchDisplayUpper != null && sourceBatchDisplayUpper === norm) ||
      (loadedOverwriteDisplayColorUpper != null && loadedOverwriteDisplayColorUpper === norm);
    if (usedDisplayColorSet.has(norm) && !isSelf) {
      setSubmissionDisplayColor(firstUnusedPaletteColor);
    }
  }, [
    showSubmitModal,
    isEditingExistingSubmission,
    submitEditDisposition,
    submissionDisplayColor,
    usedDisplayColorSet,
    firstUnusedPaletteColor,
    sourceBatchDisplayUpper,
    loadedOverwriteDisplayColorUpper,
  ]);

  useEffect(() => {
    if (showSubmitModal) dismissSubmissionColorPopover(null);
  }, [showSubmitModal, dismissSubmissionColorPopover]);

  useEffect(() => {
    if (!submissionColorPopoverOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissSubmissionColorPopover(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submissionColorPopoverOpen, dismissSubmissionColorPopover]);

  useEffect(() => {
    if (!submissionColorPopoverOpen) return;
    const id = window.requestAnimationFrame(() => {
      submissionColorPopoverRef.current
        ?.querySelector<HTMLElement>(".submission-color-swatch-btn")
        ?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [submissionColorPopoverOpen]);

  useEffect(() => {
    if (!submissionColorPopoverOpen) return;
    const onPointerDown = (ev: PointerEvent) => {
      const panel = submissionColorPopoverRef.current;
      const trigger = submissionColorSwatchTriggerRef.current;
      if (!panel || !trigger) return;
      const t = ev.target;
      if (t instanceof Node && (panel.contains(t) || trigger.contains(t))) return;
      dismissSubmissionColorPopover(ev);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [submissionColorPopoverOpen, dismissSubmissionColorPopover]);

  const renderSubmissionColorSwatchGrid = useCallback(
    (onPick: (normalizedHex: string) => void, opts?: { listAriaLabel?: string }) => {
      const listAriaLabel = opts?.listAriaLabel ?? "בחירת צבע להגשה";
      const selectedNorm = normalizedAllowedSubmissionDisplayColor(submissionDisplayColor);
      const pickable = listPickableSubmissionDisplayColors({
        usedColorsUpper: usedDisplayColorSet,
        selfColorUpper: sourceBatchDisplayUpper,
        loadedOverwriteColorUpper: loadedOverwriteDisplayColorUpper,
      });
      return (
        <div
          role="group"
          aria-label={listAriaLabel}
          className="submission-color-swatch-grid submission-color-swatch-grid--compact"
        >
          {pickable.map((hex) => {
            const isSelected = selectedNorm === hex.toUpperCase();
            return (
              <button
                key={hex}
                type="button"
                className={
                  isSelected
                    ? "submission-color-swatch-btn submission-color-swatch-btn--selected"
                    : "submission-color-swatch-btn"
                }
                title={`${hex}${isSelected ? " (נבחר)" : ""}`}
                aria-pressed={isSelected}
                onClick={() => {
                  const n = normalizeSubmissionDisplayColorHex(hex);
                  if (n) onPick(n);
                }}
              >
                <span
                  className="submission-color-swatch-dot"
                  style={
                    {
                      "--swatch-primary": hex,
                      "--swatch-secondary": secondaryHexForPrimaryNormalized(hex) ?? hex,
                    } as React.CSSProperties
                  }
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      );
    },
    [
      submissionDisplayColor,
      usedDisplayColorSet,
      loadedOverwriteDisplayColorUpper,
      sourceBatchDisplayUpper,
    ]
  );

  const closeAllForms = () => {
    setPendingPinkTarget(null);
    setPendingMemorialTarget(null);
    setMarkerActionPopover(null);
    setEditingPinkTempId(null);
    setEditingMemorial(null);
    dismissSubmissionColorPopover(null);
  };
  const isEntryModalOpen = Boolean(
    pendingPinkTarget ||
      pendingMemorialTarget ||
      editingPinkTempId ||
      editingMemorial
  );

  useEffect(() => {
    if (isEntryModalOpen) {
      setLayerSheetOpen(false);
      setLegendTrayOpen(false);
    }
  }, [isEntryModalOpen]);

  const markerPopoverAnchor = useMemo(() => {
    if (!markerActionPopover) return null;
    if (markerActionPopover.kind === "pink") {
      const n = pinkNodes.find((x) => x.tempId === markerActionPopover.tempId);
      return n ? { lat: n.lat, lng: n.lng } : null;
    }
    if (markerActionPopover.memorialScope === "central") {
      const s = centralSite;
      if (!s || s.tempId !== markerActionPopover.tempId) return null;
      return { lat: s.lat, lng: s.lng };
    }
    const s = localSites.find((x) => x.tempId === markerActionPopover.tempId);
    return s ? { lat: s.lat, lng: s.lng } : null;
  }, [markerActionPopover, pinkNodes, centralSite, localSites]);

  const markerPopoverDetails = useMemo(() => {
    if (!markerActionPopover) return null;
    const nameFallback = "ללא שם";
    const descriptionFallback = "אין תיאור";
    const resolvedName = (v: string | null | undefined) => {
      const t = v?.trim();
      return t ? t : nameFallback;
    };
    const resolvedDescription = (v: string | null | undefined) => {
      const t = v?.trim();
      return t ? t : descriptionFallback;
    };
    if (markerActionPopover.kind === "pink") {
      const n = pinkNodes.find((x) => x.tempId === markerActionPopover.tempId);
      if (!n) return null;
      return {
        kindLabel: "ציר מורשת",
        displayName: resolvedName(n.name),
        displayDescription: resolvedDescription(n.description),
      };
    }
    if (markerActionPopover.memorialScope === "central") {
      const s = centralSite;
      if (!s || s.tempId !== markerActionPopover.tempId) return null;
      return {
        kindLabel: "אנדרטה מרכזית",
        displayName: resolvedName(s.name),
        displayDescription: resolvedDescription(s.description),
      };
    }
    const s = localSites.find((x) => x.tempId === markerActionPopover.tempId);
    if (!s) return null;
    return {
      kindLabel: "אנדרטה מקומית",
      displayName: resolvedName(s.name),
      displayDescription: resolvedDescription(s.description),
    };
  }, [markerActionPopover, pinkNodes, centralSite, localSites]);

  const editingMemorialSite: PendingSite | null = useMemo(() => {
    if (!editingMemorial) return null;
    if (editingMemorial.scope === "central") {
      return centralSite?.tempId === editingMemorial.tempId ? centralSite : null;
    }
    return localSites.find((s) => s.tempId === editingMemorial.tempId) ?? null;
  }, [editingMemorial, centralSite, localSites]);

  useEffect(() => {
    if (markerActionPopover && (!markerPopoverAnchor || !markerPopoverDetails)) {
      setMarkerActionPopover(null);
    }
  }, [markerActionPopover, markerPopoverAnchor, markerPopoverDetails]);

  useEffect(() => {
    if (editingPinkTempId && !pinkNodes.some((n) => n.tempId === editingPinkTempId)) {
      setEditingPinkTempId(null);
    }
  }, [editingPinkTempId, pinkNodes]);

  useEffect(() => {
    if (editingMemorial && !editingMemorialSite) {
      setEditingMemorial(null);
    }
  }, [editingMemorial, editingMemorialSite]);

  const pinkNodeEditForm = useMemo(() => {
    if (!editingPinkTempId) return null;
    const node = pinkNodes.find((n) => n.tempId === editingPinkTempId);
    if (!node) return null;
    return (
      <PinkLineNodeForm
        key={node.tempId}
        mode="edit"
        initialName={node.name ?? ""}
        initialDescription={node.description ?? ""}
        onSubmit={(name, description) => {
          const afterName = name.trim() ? name.trim() : null;
          const afterDesc = description.trim() ? description.trim() : null;
          const before = { name: node.name, description: node.description };
          const after = { name: afterName, description: afterDesc };
          if (before.name === after.name && before.description === after.description) {
            setEditingPinkTempId(null);
            return;
          }
          applyLocalAction({
            kind: "pink:updateMeta",
            tempId: node.tempId,
            before,
            after,
          });
          setEditingPinkTempId(null);
        }}
        onCancel={() => setEditingPinkTempId(null)}
      />
    );
  }, [editingPinkTempId, pinkNodes, applyLocalAction]);

  const memorialSiteEditForm = useMemo(() => {
    if (!editingMemorial || !editingMemorialSite) return null;
    const site = editingMemorialSite;
    const isCentralEdit = editingMemorial.scope === "central";
    return (
      <MemorialSiteForm
        key={`${site.tempId}-edit`}
        mode="edit"
        initialName={site.name ?? ""}
        initialDescription={site.description ?? ""}
        nameQuestion={isCentralEdit ? "מה שם האתר?" : "מה שם האתר?"}
        descriptionQuestion={
          isCentralEdit
            ? "למה לדעתך אנדרטה מרכזית אזורית צריכה להיות כאן?"
            : "למה צריכה להיות כאן אנדרטה?"
        }
        onSubmit={(name, description) => {
          const afterName = name.trim() ? name.trim() : null;
          const afterDesc = description.trim() ? description.trim() : null;
          const before = { name: site.name, description: site.description };
          const after = { name: afterName, description: afterDesc };
          if (before.name === after.name && before.description === after.description) {
            setEditingMemorial(null);
            return;
          }
          applyLocalAction({
            kind: "memorial:updateMeta",
            scope: editingMemorial.scope,
            tempId: site.tempId,
            before,
            after,
          });
          setEditingMemorial(null);
        }}
        onCancel={() => setEditingMemorial(null)}
      />
    );
  }, [editingMemorial, editingMemorialSite, applyLocalAction]);

  const handleSubmissionSelectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "") {
      submissionDetailLoadSeqRef.current += 1;
      selectedSubmissionIdRef.current = null;
      submissionNameInputRef.current = "";
      setSelectedSubmissionId(null);
      setSubmissionNameInput("");
      setLoadingSubmissionDetail(false);
      setPinkNodes([]);
      setCentralSite(null);
      setLocalSites([]);
      setEditHistory(createEmptyEditHistory());
      setSubmissionDisplayColor(null);
      submissionColorAtLoadRef.current = null;
      closeAllForms();
      return;
    }

    const revertId = selectedSubmissionIdRef.current;
    const revertName = submissionNameInputRef.current;
    const revertPinkNodes = pinkNodes;
    const revertCentralSite = centralSite;
    const revertLocalSites = localSites;
    const seq = ++submissionDetailLoadSeqRef.current;

    selectedSubmissionIdRef.current = value;
    submissionNameInputRef.current = "";
    setSelectedSubmissionId(value);
    setSubmissionNameInput("");
    setLoadingSubmissionDetail(true);
    setPinkNodes([]);
    setCentralSite(null);
    setLocalSites([]);
    setEditHistory(createEmptyEditHistory());
    closeAllForms();

    try {
      const detail = await loadSubmissionBatchMapDetail(value, {
        pinkProjectId,
        memorialProjectId,
      });
      if (seq !== submissionDetailLoadSeqRef.current) return;

      setPinkNodes(
        detail.pinkNodes.map((n) => ({
          tempId: n.tempId,
          name: n.name,
          description: n.description,
          lat: n.lat,
          lng: n.lng,
        }))
      );
      setCentralSite(detail.centralSite);
      setLocalSites(detail.localSites);
      selectedSubmissionIdRef.current = detail.submissionId;
      submissionNameInputRef.current = detail.name;
      setSelectedSubmissionId(detail.submissionId);
      setSubmissionNameInput(detail.name);
      const loadedColor = normalizedAllowedSubmissionDisplayColor(detail.displayColor);
      setSubmissionDisplayColor(loadedColor);
      submissionColorAtLoadRef.current = loadedColor;
      closeAllForms();
    } catch (err) {
      if (seq !== submissionDetailLoadSeqRef.current) return;
      console.error("Failed to load submission batch:", err);
      alert("טעינת ההגשה נכשלה");
      selectedSubmissionIdRef.current = revertId;
      submissionNameInputRef.current = revertName;
      setSelectedSubmissionId(revertId);
      setSubmissionNameInput(revertName);
      setPinkNodes(revertPinkNodes);
      setCentralSite(revertCentralSite);
      setLocalSites(revertLocalSites);
      setEditHistory(createEmptyEditHistory());
      const revertBatch = revertId ? submissionBatches.find((b) => b.submissionId === revertId) : undefined;
      const revertColor = normalizedAllowedSubmissionDisplayColor(revertBatch?.displayColor) ?? null;
      setSubmissionDisplayColor(revertColor);
      submissionColorAtLoadRef.current = revertColor;
    } finally {
      if (seq === submissionDetailLoadSeqRef.current) {
        setLoadingSubmissionDetail(false);
      }
    }
  };

  const ghostRef = useRef<HTMLDivElement | null>(null);

  const handleToolbarDragStart = (e: React.PointerEvent, type: "central" | "local") => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    const iconSrc = type === "central" ? regionalMemorialIconUrl : localMemorialIconUrl;

    const onMove = (ev: PointerEvent) => {
      if (!dragging) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (dx * dx + dy * dy < 25) return;
        dragging = true;
        const ghost = document.createElement("div");
        ghost.style.cssText = "position:fixed;pointer-events:none;z-index:10000;opacity:0.85;transform:translate(-50%,-50%)";
        const img = document.createElement("img");
        img.src = iconSrc;
        img.style.cssText = "width:40px;height:40px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4))";
        ghost.appendChild(img);
        document.body.appendChild(ghost);
        ghostRef.current = ghost;
      }
      if (ghostRef.current) {
        ghostRef.current.style.left = `${ev.clientX}px`;
        ghostRef.current.style.top = `${ev.clientY}px`;
      }
    };

    const onUp = (ev: PointerEvent) => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      if (ghostRef.current) {
        ghostRef.current.remove();
        ghostRef.current = null;
      }
      if (!dragging || !mapRef.current) return;

      const mapEl = document.getElementById("map");
      if (!mapEl) return;
      const rect = mapEl.getBoundingClientRect();
      const styles = window.getComputedStyle(mapEl);
      const paddingLeft = parseFloat(styles.paddingLeft) || 0;
      const paddingRight = parseFloat(styles.paddingRight) || 0;
      const paddingTop = parseFloat(styles.paddingTop) || 0;
      const paddingBottom = parseFloat(styles.paddingBottom) || 0;
      const contentWidth = rect.width - paddingLeft - paddingRight;
      const contentHeight = rect.height - paddingTop - paddingBottom;
      const x = ev.clientX - rect.left - paddingLeft;
      const y = ev.clientY - rect.top - paddingTop;
      if (x < 0 || y < 0 || x > contentWidth || y > contentHeight) return;

      const latlng = mapRef.current.containerPointToLatLng([x, y]);

      if (type === "central" && centralSiteRef.current) {
        if (!confirm("ניתן לבחור רק אנדרטה מרכזית אחת. האם להחליף את הקיימת?")) return;
        const prev = centralSiteRef.current;
        applyLocalActionRef.current({ kind: "memorial:removeCentral", previous: prev });
      }

      setPendingMemorialTarget({ lat: latlng.lat, lng: latlng.lng, type });
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  /** Clears pink nodes and/or memorial sites in one event (chains applyEditAction so state stays consistent). */
  const handleClearAllWorkspace = useCallback(() => {
    const beforePink = pinkNodes.map((n) => ({ ...n }));
    const beforeCentral = centralSite ? { ...centralSite } : null;
    const beforeLocal = localSites.map((s) => ({ ...s }));
    const hasP = beforePink.length > 0;
    const hasM = Boolean(beforeCentral) || beforeLocal.length > 0;
    if (!hasP && !hasM) return;

    let message: string;
    if (hasP && hasM) {
      message = "למחוק את כל נקודות ציר המורשת ואת כל אתרי ההנצחה שסומנו?";
    } else if (hasP) {
      message = "למחוק את כל נקודות ציר המורשת?";
    } else {
      message = "למחוק את כל אתרי ההנצחה שסומנו?";
    }
    if (!window.confirm(message)) return;

    const actions: EditAction[] = [];
    if (hasP) actions.push({ kind: "pink:clear", before: beforePink });
    if (hasM) {
      actions.push({
        kind: "memorial:clear",
        beforeCentral,
        beforeLocal,
      });
    }

    let state: EditableMapState = { pinkNodes, centralSite, localSites };
    let history = editHistory;
    for (const action of actions) {
      const applied = applyEditAction(state, history, action);
      state = applied.state;
      history = applied.history;
    }
    setPinkNodes(state.pinkNodes);
    setCentralSite(state.centralSite);
    setLocalSites(state.localSites);
    setEditHistory(history);
  }, [pinkNodes, centralSite, localSites, editHistory]);

  const openSubmitModal = useCallback(() => {
    if (!hasPink && !hasMemorial) return;
    if (selectedSubmissionId) setSubmitEditDisposition("overwrite");
    setShowSubmitModal(true);
  }, [hasPink, hasMemorial, selectedSubmissionId]);

  const submitSelection = async () => {
    let includePink = submitScope === "pink" || submitScope === "everything";
    let includeMemorial = submitScope === "memorial" || submitScope === "everything";
    if (lockFullWorkspaceOverwrite) {
      includePink = true;
      includeMemorial = true;
    }
    if (!includePink && !includeMemorial) return;
    if (includePink && pinkNodes.length > 0 && pinkRouteForPersistence.length < 2) {
      alert(pinkRouteError || "Cannot submit: Google route calculation failed.");
      return;
    }

    const submissionDisplayName = submissionNameInput.trim();
    if (!submissionDisplayName) return;

    const memorialRows = [...(centralSite ? [centralSite] : []), ...localSites];
    const mapWorkspaceProjects = { pinkProjectId, memorialProjectId };

    setSubmitting(true);
    try {
      const colabRouteGeometryBundle =
        includePink && integratedPinkRoute
          ? serializeIntegratedRouteToColabBundle(integratedPinkRoute)
          : null;

      const useOverwrite = isEditingExistingSubmission && submitEditDisposition === "overwrite";

      if (useOverwrite) {
        const currentNorm = normalizedAllowedSubmissionDisplayColor(submissionDisplayColor);
        const loadNorm = submissionColorAtLoadRef.current;
        const colorChanged =
          (currentNorm ?? null) !== (loadNorm ?? null);
        const overwriteColorPayload =
          colorChanged && currentNorm != null ? { submissionDisplayColor: currentNorm } : {};
        await submitUnifiedFeatures({
          mode: "overwrite",
          targetSubmissionId: selectedSubmissionId!,
          submissionName: submissionDisplayName,
          mapWorkspaceProjects,
          pinkProjectId,
          memorialProjectId,
          includePink,
          includeMemorial,
          pinkNodes,
          pinkRoutePoints: includePink ? pinkRouteForPersistence : [],
          memorialSites: memorialRows,
          colabRouteGeometryBundle,
          ...overwriteColorPayload,
        });
      } else {
        const submissionId = crypto.randomUUID();
        const newColorNorm = normalizedAllowedSubmissionDisplayColor(submissionDisplayColor);
        const newColorPayload =
          newColorNorm != null ? { submissionDisplayColor: newColorNorm } : {};
        await submitUnifiedFeatures({
          submissionId,
          submissionName: submissionDisplayName,
          pinkProjectId,
          memorialProjectId,
          includePink,
          includeMemorial,
          pinkNodes,
          pinkRoutePoints: includePink ? pinkRouteForPersistence : [],
          memorialSites: memorialRows,
          colabRouteGeometryBundle,
          ...newColorPayload,
        });
        selectedSubmissionIdRef.current = submissionId;
        setSelectedSubmissionId(submissionId);
      }

      await refreshSubmissionBatchesList();

      const syncSubmissionId = selectedSubmissionIdRef.current;
      const loadSeq = ++submissionDetailLoadSeqRef.current;
      if (syncSubmissionId) {
        try {
          const detail = await loadSubmissionBatchMapDetail(syncSubmissionId, {
            pinkProjectId,
            memorialProjectId,
          });
          if (loadSeq !== submissionDetailLoadSeqRef.current) {
            // User changed selection while loading; do not overwrite their map state.
          } else if (selectedSubmissionIdRef.current !== syncSubmissionId) {
            // Selection no longer matches the submission we synced.
          } else {
            setPinkNodes(
              detail.pinkNodes.map((n) => ({
                tempId: n.tempId,
                name: n.name,
                description: n.description,
                lat: n.lat,
                lng: n.lng,
              }))
            );
            setCentralSite(detail.centralSite);
            setLocalSites(detail.localSites);
            setEditHistory(createEmptyEditHistory());
            submissionNameInputRef.current = detail.name;
            setSubmissionNameInput(detail.name);
            selectedSubmissionIdRef.current = detail.submissionId;
            setSelectedSubmissionId(detail.submissionId);
            const reloadedColor = normalizedAllowedSubmissionDisplayColor(detail.displayColor);
            setSubmissionDisplayColor(reloadedColor);
            submissionColorAtLoadRef.current = reloadedColor;
          }
        } catch (reloadErr) {
          if (
            loadSeq === submissionDetailLoadSeqRef.current &&
            selectedSubmissionIdRef.current === syncSubmissionId
          ) {
            console.error("Failed to reload submission after save:", reloadErr);
            if (includePink) setPinkNodes([]);
            if (includeMemorial) {
              setCentralSite(null);
              setLocalSites([]);
            }
            setEditHistory(createEmptyEditHistory());
            setSubmissionDisplayColor(null);
            submissionColorAtLoadRef.current = null;
          }
        }
      } else {
        if (includePink) setPinkNodes([]);
        if (includeMemorial) {
          setCentralSite(null);
          setLocalSites([]);
        }
        if (includePink || includeMemorial) {
          setEditHistory(createEmptyEditHistory());
        }
      }

      setShowSubmitModal(false);

      const submittedParts = [
        includePink ? `${pinkNodes.length} נקודות ציר מורשת` : null,
        includeMemorial ? `${memorialRows.length} אתרי הנצחה` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      setSubmittedSummary(
        submittedParts
          ? `נשמר בהצלחה: ${submissionDisplayName} (${submittedParts})`
          : `נשמר בהצלחה: ${submissionDisplayName}`
      );
      window.setTimeout(() => setSubmittedSummary(null), 3000);
    } catch (error) {
      console.error("Failed to submit unified features:", error);
      alert("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isBootstrapping) {
    return (
      <div className="main-page-loader" role="status" aria-live="polite" aria-label="Loading map workspace">
        <div className="main-page-loader-panel">
          <div className="main-page-loader-orbit" aria-hidden="true">
              <span className="main-page-loader-core">
                <img src={FAVICON_URL} alt="" className="main-page-loader-logo" />
              </span>
          </div>
          <h1 className="main-page-loader-title">טוען את סביבת המפה</h1>
          <p className="main-page-loader-subtitle">מכין את שכבות הנתונים והכלים שלך...</p>
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div style={{ padding: "24px" }}>
        <p>{bootError}</p>
        <button onClick={() => navigate("/")}>Go back</button>
      </div>
    );
  }

  return (
    <>
      <div
        id="map"
        style={{ height: "100vh", width: "100%" }}
        data-submission-display-color={submissionDisplayColor ?? ""}
      />

      {!pendingPinkTarget &&
        !pendingMemorialTarget &&
        !editingPinkTempId &&
        !editingMemorial &&
        (submitting || isFetchingPinkRoute) && (
          <PinkRouteFetchingBanner variant={submitting ? "submit" : "route"} />
        )}

      {pendingPinkTarget && (
        <PinkLineNodeForm
          onSubmit={(name, description) => {
            applyLocalAction({
              kind: "pink:add",
              node: {
                tempId: crypto.randomUUID(),
                name: name || null,
                description: description || null,
                lat: pendingPinkTarget.lat,
                lng: pendingPinkTarget.lng,
              },
            });
            setPendingPinkTarget(null);
          }}
          onCancel={() => setPendingPinkTarget(null)}
        />
      )}

      {pendingMemorialTarget && (
        <MemorialSiteForm
          nameQuestion={pendingMemorialTarget.type === "central" ? "מה שם האתר?" : "מה שם האתר?"}
          descriptionQuestion={
            pendingMemorialTarget.type === "central"
              ? "למה לדעתך אנדרטה מרכזית אזורית צריכה להיות כאן?"
              : "למה צריכה להיות כאן אנדרטה?"
          }
          onSubmit={(name, description) => {
            const site: PendingSite = {
              tempId: crypto.randomUUID(),
              name: name || null,
              description: description || null,
              lat: pendingMemorialTarget.lat,
              lng: pendingMemorialTarget.lng,
              feature_type: pendingMemorialTarget.type,
            };
            if (pendingMemorialTarget.type === "central") {
              applyLocalAction({
                kind: "memorial:setCentral",
                site,
                previous: centralSite,
              });
            } else {
              applyLocalAction({ kind: "memorial:addLocal", site });
            }
            setPendingMemorialTarget(null);
          }}
          onCancel={() => setPendingMemorialTarget(null)}
        />
      )}

      {markerActionPopover && markerPopoverAnchor && markerPopoverDetails && (
        <MarkerActionPopover
          map={mapRef.current}
          anchor={markerPopoverAnchor}
          kindLabel={markerPopoverDetails.kindLabel}
          displayName={markerPopoverDetails.displayName}
          displayDescription={markerPopoverDetails.displayDescription}
          onClose={handleMarkerActionPopoverClose}
          onEdit={handleMarkerActionPopoverEdit}
          onDelete={handleMarkerActionPopoverDelete}
        />
      )}

      {pinkNodeEditForm}

      {memorialSiteEditForm}

      <LegendTray open={legendTrayOpen} onClose={() => setLegendTrayOpen(false)} sections={legendTraySections} />

      <LayerPacksSheet open={layerSheetOpen} onClose={() => setLayerSheetOpen(false)}>
        {focusedLayerPack ? (
          <LayerTilesGrid
            rows={focusedPackTileRows}
            isLayerOn={(id) => isLayerOn(focusedLayerPack.id, id)}
            onToggleLayer={(id) => toggleLayer(focusedLayerPack.id, id)}
            onToggleLayerGroup={(ids) => toggleLayerGroup(focusedLayerPack.id, ids)}
          />
        ) : (
          <p className="layer-packs-sheet-empty" dir="rtl">
            אין עדיין חבילת שכבות זמינה.
          </p>
        )}
      </LayerPacksSheet>

      {!isEntryModalOpen && (
        <div
          className={
            narrowMapDock ? "map-bottom-fusion map-bottom-fusion--stack" : "map-bottom-fusion map-bottom-fusion--split"
          }
        >
          <LayerPackStrip
            registry={layerRegistry}
            totalActiveLayerCount={totalActiveLayerCount}
            focusedPackId={focusedPackId}
            onSelectPack={setFocusedPackId}
            getPackState={getPackState}
            activeCountForPack={activeCountForPack}
            onTogglePack={togglePack}
            onOpenLayerSheet={openLayerSheet}
            onToggleLegend={toggleLegendTray}
            basemap={basemap}
            onCycleBasemap={cycleBasemap}
          />

      {activeProject === "pink" && (
        <div className="pink-toolbar" dir="rtl">
          <div className="map-toolbar-body map-toolbar-body--pink" dir="ltr">
            <div className="map-toolbar-row map-toolbar-row--history">
              <div className="map-history-actions" dir="rtl" role="group" aria-label="היסטוריית עריכה">
                <button
                  type="button"
                  className="map-history-btn map-history-btn-undo"
                  onClick={handleUndo}
                  disabled={!canUndo(editHistory)}
                  title="בטל"
                >
                  <span className="map-history-btn-icon" aria-hidden="true">
                    ↶
                  </span>
                  <span>בטל</span>
                </button>
                <button
                  type="button"
                  className="map-history-btn map-history-btn-redo"
                  onClick={handleRedo}
                  disabled={!canRedo(editHistory)}
                  title="בצע שוב"
                >
                  <span className="map-history-btn-icon" aria-hidden="true">
                    ↷
                  </span>
                  <span>בצע שוב</span>
                </button>
              </div>
            </div>
            <div className="map-toolbar-row map-toolbar-row--main" dir="rtl">
              <div className="pink-toolbar-section">
                <div className="pink-toolbar-item-text">
                  <span className="pink-toolbar-title">לחץ על המפה כדי להוסיף נקודות</span>
                  <span className="pink-toolbar-count">{pinkNodes.length} נקודות</span>
                  {pinkRouteError && (
                    <span className="pink-toolbar-count" style={{ color: "#b00020", fontWeight: 600 }}>
                      {pinkRouteError}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="map-toolbar-row map-toolbar-row--submit">
              <div className="map-toolbar-submit-stack" role="group" aria-label="הגשה וניקוי" dir="rtl">
                <button
                  type="button"
                  dir="rtl"
                  onClick={openSubmitModal}
                  className={`pink-toolbar-action pink-toolbar-action-primary ${!hasPink && !hasMemorial ? "toolbar-action-blocked" : ""}`}
                >
                  הגשה
                </button>
                <button
                  type="button"
                  dir="rtl"
                  onClick={handleClearAllWorkspace}
                  className={`pink-toolbar-action pink-toolbar-action-secondary ${!hasPink && !hasMemorial ? "toolbar-action-blocked" : ""}`}
                >
                  נקה הכל
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeProject === "memorial" && (
        <div
          className={`memorial-toolbar${memorialDragPlacementEnabled ? "" : " memorial-toolbar--tap-only"}`}
          dir="rtl"
        >
          <div className="map-toolbar-body map-toolbar-body--memorial" dir="ltr">
            <div className="map-toolbar-row map-toolbar-row--history">
              <div className="map-history-actions" dir="rtl" role="group" aria-label="היסטוריית עריכה">
                <button
                  type="button"
                  className="map-history-btn map-history-btn-undo"
                  onClick={handleUndo}
                  disabled={!canUndo(editHistory)}
                  title="בטל"
                >
                  <span className="map-history-btn-icon" aria-hidden="true">
                    ↶
                  </span>
                  <span>בטל</span>
                </button>
                <button
                  type="button"
                  className="map-history-btn map-history-btn-redo"
                  onClick={handleRedo}
                  disabled={!canRedo(editHistory)}
                  title="בצע שוב"
                >
                  <span className="map-history-btn-icon" aria-hidden="true">
                    ↷
                  </span>
                  <span>בצע שוב</span>
                </button>
              </div>
            </div>
            <div className="map-toolbar-row map-toolbar-row--main map-toolbar-memorial-selectors" dir="rtl">
              <button
                type="button"
                className={`memorial-toolbar-section ${activeMemorialType === "central" ? "memorial-toolbar-active" : ""}`}
                onClick={() => setActiveMemorialType("central")}
                onPointerDown={
                  memorialDragPlacementEnabled ? (ev) => handleToolbarDragStart(ev, "central") : undefined
                }
              >
                <div className="memorial-toolbar-drag-item">
                  <img src={regionalMemorialIconUrl} alt="" className="memorial-toolbar-icon" draggable={false} />
                </div>
                <div className="memorial-toolbar-item-text">
                  <span className="memorial-toolbar-item-label">אנדרטה מרכזית אזורית</span>
                  <span className="memorial-toolbar-item-value">
                    {centralSite
                      ? centralSite.name || "—"
                      : memorialDragPlacementEnabled
                        ? "גררו למפה או לחצו"
                        : "לחצו על המפה"}
                  </span>
                </div>
              </button>

              <div className="memorial-toolbar-divider memorial-toolbar-divider--inline" />

              <button
                type="button"
                className={`memorial-toolbar-section ${activeMemorialType === "local" ? "memorial-toolbar-active" : ""}`}
                onClick={() => setActiveMemorialType("local")}
                onPointerDown={memorialDragPlacementEnabled ? (ev) => handleToolbarDragStart(ev, "local") : undefined}
              >
                <div className="memorial-toolbar-drag-item">
                  <img src={localMemorialIconUrl} alt="" className="memorial-toolbar-icon" draggable={false} />
                </div>
                <div className="memorial-toolbar-item-text">
                  <span className="memorial-toolbar-item-label">אנדרטות מקומיות ({localSites.length})</span>
                  <span className="memorial-toolbar-item-value">
                    {memorialDragPlacementEnabled ? "גררו למפה או לחצו" : "לחצו על המפה"}
                  </span>
                </div>
              </button>
            </div>
            <div className="map-toolbar-row map-toolbar-row--submit">
              <div className="map-toolbar-submit-stack" role="group" aria-label="הגשה וניקוי" dir="rtl">
                <button
                  type="button"
                  dir="rtl"
                  className={`memorial-toolbar-action-btn memorial-toolbar-action-btn-primary ${!hasPink && !hasMemorial ? "toolbar-action-blocked" : ""}`}
                  onClick={openSubmitModal}
                >
                  הגשה
                </button>
                <button
                  type="button"
                  dir="rtl"
                  className={`memorial-toolbar-action-btn memorial-toolbar-action-btn-secondary ${!hasPink && !hasMemorial ? "toolbar-action-blocked" : ""}`}
                  onClick={handleClearAllWorkspace}
                >
                  נקה הכל
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        </div>
      )}

      <div className="base-map-controls">
        <div className="base-map-controls-mobile-stack" dir="rtl">
          <div className="base-map-submissions-selector hook-base-map-submissions" dir="rtl">
            <div
              className="base-map-submission-select-row"
              dir="rtl"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <div className="base-map-submission-color-anchor">
                <button
                  ref={submissionColorSwatchTriggerRef}
                  type="button"
                  className="base-map-submission-color-trigger"
                  title="בחירת צבע להגשה"
                  aria-label="בחירת צבע להגשה"
                  aria-haspopup="dialog"
                  aria-expanded={submissionColorPopoverOpen}
                  aria-controls={submissionColorPopoverOpen ? submissionColorPopoverPanelId : undefined}
                  onClick={() => setSubmissionColorPopoverOpen((o) => !o)}
                >
                  <span
                    className="base-map-submission-color-trigger-dot"
                    style={
                      {
                        "--swatch-primary": selectedSubmissionStripHex ?? "#ff69b4",
                        "--swatch-secondary":
                          secondaryHexForPrimaryNormalized(
                            selectedSubmissionStripHex ?? "#ff69b4"
                          ) ??
                          (selectedSubmissionStripHex ?? "#ff69b4"),
                      } as CSSProperties
                    }
                    aria-hidden="true"
                  />
                </button>
                {submissionColorPopoverOpen && (
                  <div
                    ref={submissionColorPopoverRef}
                    id={submissionColorPopoverPanelId}
                    className="base-map-submission-color-popover"
                    role="dialog"
                    aria-label="בחירת צבע להגשה"
                    dir="rtl"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {renderSubmissionColorSwatchGrid((hex) => {
                      setSubmissionDisplayColor(hex);
                      dismissSubmissionColorPopover(null);
                    })}
                  </div>
                )}
              </div>
              <select
                id="map-submission-select"
                className="base-map-submission-select base-map-control-btn project-switch-btn"
                style={{ flex: 1, minWidth: 0 }}
                value={selectedSubmissionId ?? ""}
                onChange={(e) => void handleSubmissionSelectChange(e)}
                disabled={submissionBatchesLoading || loadingSubmissionDetail}
                aria-label="בחירת הגשה מהרשימה"
                aria-busy={loadingSubmissionDetail || submissionBatchesLoading}
              >
                <option value="">הגשה חדשה</option>
                {submissionSelectRows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            {submissionBatchesLoading && (
              <span className="base-map-submissions-status" aria-live="polite">
                טוען רשימה…
              </span>
            )}
            {loadingSubmissionDetail && (
              <span className="base-map-submissions-status" aria-live="polite">
                טוען הגשה…
              </span>
            )}
            {submissionBatchesError && !submissionBatchesLoading && (
              <span className="base-map-submissions-error" role="alert">
                {submissionBatchesError}
              </span>
            )}
          </div>
          <div className="base-map-controls-divider base-map-controls-divider--after-submissions" />
          <div className="base-map-controls-mobile-project-row" dir="rtl">
            <button
              className={`base-map-control-btn project-switch-btn ${activeProject === "pink" ? "project-switch-btn-active" : ""}`}
              onClick={() => {
                closeAllForms();
                setActiveProject("pink");
              }}
              title="ציר מורשת"
            >
              ציר מורשת
            </button>
            <button
              className={`base-map-control-btn project-switch-btn ${activeProject === "memorial" ? "project-switch-btn-active" : ""}`}
              onClick={() => {
                closeAllForms();
                setActiveProject("memorial");
              }}
              title="אתרי הנצחה"
            >
              אתרי הנצחה
            </button>
          </div>
        </div>
        <div className="base-map-controls-divider base-map-controls-divider--before-signout" />
        <button
          dir="rtl"
          className="base-map-control-btn project-switch-btn project-signout-btn"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate("/");
          }}
          title="התנתק"
        >
          התנתק
        </button>
      </div>

      {submittedSummary && <div className="unified-map-toast">{submittedSummary}</div>}

      {showSubmitModal && (
        <div className="unified-submit-overlay" onClick={() => setShowSubmitModal(false)}>
          <div className="unified-submit-modal" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="unified-submit-modal-title">שליחת הגשה</h3>
            <div className="unified-submit-name-field">
              <label className="unified-submit-name-label" htmlFor="unified-submit-name">
                שם ההגשה (חובה)
              </label>
              <input
                id="unified-submit-name"
                type="text"
                className="unified-submit-name-input"
                value={submissionNameInput}
                onChange={(e) => setSubmissionNameInput(e.target.value)}
                placeholder="לדוגמה: מסלול מעודכן"
                autoComplete="off"
              />
              {!submissionNameInput.trim() && (
                <p className="unified-submit-name-hint">יש להזין שם לפני השליחה</p>
              )}
            </div>

            {isEditingExistingSubmission && (
              <div className="unified-submit-panel-group" role="group" aria-labelledby="unified-submit-disposition-label">
                <div className="unified-submit-panel-head">
                  <span id="unified-submit-disposition-label" className="unified-submit-panel-label">
                    איך לשמור
                  </span>
                  <span className="unified-submit-panel-caption">בחרו אם לעדכן את ההגשה הפתוחה או ליצור הגשה חדשה</span>
                </div>
                <div className="unified-submit-card-row">
                  <button
                    type="button"
                    className={`unified-submit-choice-card ${submitEditDisposition === "overwrite" ? "unified-submit-choice-card--active" : ""}`}
                    onClick={() => setSubmitEditDisposition("overwrite")}
                    aria-pressed={submitEditDisposition === "overwrite"}
                  >
                    <span className="unified-submit-choice-card-title">עדכון ההגשה</span>
                    <span className="unified-submit-choice-card-desc">דורס את ההגשה הקיימת</span>
                  </button>
                  <button
                    type="button"
                    className={`unified-submit-choice-card ${submitEditDisposition === "saveAsNew" ? "unified-submit-choice-card--active" : ""}`}
                    onClick={() => setSubmitEditDisposition("saveAsNew")}
                    aria-pressed={submitEditDisposition === "saveAsNew"}
                  >
                    <span className="unified-submit-choice-card-title">הגשה חדשה</span>
                    <span className="unified-submit-choice-card-desc">יוצר הגשה חדשה; ההגשה הקיימת נשארת</span>
                  </button>
                </div>
              </div>
            )}

            <div
              className={`unified-submit-scope-reveal${hideSubmitScopePanel ? " unified-submit-scope-reveal--hidden" : ""}`}
              aria-hidden={hideSubmitScopePanel}
            >
              <div className="unified-submit-scope-reveal__inner">
                <div className="unified-submit-panel-group" role="group" aria-labelledby="unified-submit-scope-label">
                  <div className="unified-submit-panel-head">
                    <span id="unified-submit-scope-label" className="unified-submit-panel-label">
                      מה לכלול בשליחה
                    </span>
                  </div>
                  <div
                    className="unified-submit-segment-group"
                    role="toolbar"
                    aria-label="בחירת טווח שליחה"
                  >
                    <button
                      type="button"
                      className={`unified-submit-segment-btn ${submitScope === "pink" ? "unified-submit-segment-btn--active" : ""}`}
                      disabled={!hasPink}
                      onClick={() => setSubmitScope("pink")}
                      aria-pressed={submitScope === "pink"}
                    >
                      <span className="unified-submit-segment-title">ציר מורשת</span>
                      <span className="unified-submit-segment-meta">{pinkNodes.length} נקודות</span>
                    </button>
                    <button
                      type="button"
                      className={`unified-submit-segment-btn ${submitScope === "memorial" ? "unified-submit-segment-btn--active" : ""}`}
                      disabled={!hasMemorial}
                      onClick={() => setSubmitScope("memorial")}
                      aria-pressed={submitScope === "memorial"}
                    >
                      <span className="unified-submit-segment-title">אתרי הנצחה</span>
                      <span className="unified-submit-segment-meta">
                        {(centralSite ? 1 : 0) + localSites.length} אתרים
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`unified-submit-segment-btn ${submitScope === "everything" ? "unified-submit-segment-btn--active" : ""}`}
                      disabled={!hasPink || !hasMemorial}
                      onClick={() => setSubmitScope("everything")}
                      aria-pressed={submitScope === "everything"}
                    >
                      <span className="unified-submit-segment-title">ציר מורשת + אתרים</span>
                      <span className="unified-submit-segment-meta">אותה הגשה</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="unified-submit-actions">
              <button
                type="button"
                className="unified-submit-action"
                onClick={() => setShowSubmitModal(false)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="unified-submit-action unified-submit-action-primary"
                disabled={submitting || !submissionNameInput.trim()}
                onClick={submitSelection}
              >
                {submitting ? "שולח..." : "שליחה"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MapPage;
