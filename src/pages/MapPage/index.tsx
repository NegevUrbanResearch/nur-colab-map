import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PinkLineNodeForm from "./PinkLineNodeForm";
import MemorialSiteForm from "./MemorialSiteForm";
import localMemorialIconUrl from "../../assets/memorial-sites/local-memorial-site.png";
import regionalMemorialIconUrl from "../../assets/memorial-sites/regional-memorial-site.png";
import { optimizeRoute } from "../../utils/routeOptimizer";
import { buildIntegratedRoute, parseDefaultLinePaths } from "../../utils/pinkLineRoute";
import { ensureMemorialSitesProjectForUser, loadProjects } from "../../supabase/projects";
import { PendingSite } from "../../supabase/memorialSites";
import {
  listSubmissionBatchSummariesForWorkspace,
  loadSubmissionBatchMapDetail,
  type SubmissionBatchSummary,
} from "../../supabase/submissionBatches";
import { submitUnifiedFeatures } from "../../supabase/unifiedSubmission";
import supabase from "../../supabase";

const MEMORIAL_PROJECT_ID = "33333333-3333-3333-3333-333333333333";
const APP_BASE_URL = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
const DEFAULT_PINK_LINE_URL = `${APP_BASE_URL}line-layer/pink-line-wgs84.geojson`;
const FAVICON_URL = `${APP_BASE_URL}favicon.ico`;

type ActiveProject = "pink" | "memorial";
type SubmitScope = "pink" | "memorial" | "everything";
type SubmitEditDisposition = "overwrite" | "saveAsNew";

interface PendingPinkNode {
  tempId: string;
  name: string | null;
  description: string | null;
  lat: number;
  lng: number;
}

const MapPage = () => {
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLayersRef = useRef<L.Polyline[]>([]);
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

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitScope, setSubmitScope] = useState<SubmitScope>("everything");
  const [submitting, setSubmitting] = useState(false);
  const [submittedSummary, setSubmittedSummary] = useState<string | null>(null);
  const [defaultLineLoaded, setDefaultLineLoaded] = useState(false);

  const [submissionBatches, setSubmissionBatches] = useState<SubmissionBatchSummary[]>([]);
  const [submissionBatchesLoading, setSubmissionBatchesLoading] = useState(false);
  const [submissionBatchesError, setSubmissionBatchesError] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [submissionNameInput, setSubmissionNameInput] = useState("");
  const [loadingSubmissionDetail, setLoadingSubmissionDetail] = useState(false);
  const [submitEditDisposition, setSubmitEditDisposition] = useState<SubmitEditDisposition>("overwrite");

  const submissionDetailLoadSeqRef = useRef(0);
  const selectedSubmissionIdRef = useRef<string | null>(null);
  const submissionNameInputRef = useRef("");

  const [memorialDragPlacementEnabled, setMemorialDragPlacementEnabled] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setMemorialDragPlacementEnabled(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const defaultLinePathsRef = useRef<[number, number][][]>([]);
  const pendingPinkMarkerRef = useRef<L.Marker | null>(null);
  const pendingMemorialMarkerRef = useRef<L.Marker | null>(null);
  const centralSiteRef = useRef<PendingSite | null>(null);

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
          setBootError("Pink Line project is not available for your user.");
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
    if (!showSubmitModal) return;
    if (selectedSubmissionId) setSubmitEditDisposition("overwrite");
  }, [showSubmitModal, selectedSubmissionId]);

  useEffect(() => {
    if (isBootstrapping || bootError) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    routeLayersRef.current = [];

    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;
    if ((mapContainer as any)._leaflet_id) delete (mapContainer as any)._leaflet_id;
    mapContainer.innerHTML = "";

    mapRef.current = L.map("map", { zoomControl: false }).setView([31.42, 34.49], 13);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri",
    }).addTo(mapRef.current);
    L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);

    mapRef.current.on("click", (e: L.LeafletMouseEvent) => {
      if (activeProjectRef.current === "pink") {
        setPendingPinkTarget({ lat: e.latlng.lat, lng: e.latlng.lng });
        return;
      }
      if (activeMemorialTypeRef.current === "central" && centralSiteRef.current) {
        if (!confirm("ניתן לבחור רק אנדרטה מרכזית אחת. האם להחליף את הקיימת?")) {
          return;
        }
        setCentralSite(null);
      }
      setPendingMemorialTarget({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        type: activeMemorialTypeRef.current,
      });
    });

    fetch(DEFAULT_PINK_LINE_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch pink line GeoJSON (${res.status})`);
        return res.json();
      })
      .then((geojson: GeoJSON.FeatureCollection) => {
        defaultLinePathsRef.current = parseDefaultLinePaths(geojson);
        setDefaultLineLoaded(true);
      })
      .catch((err) => console.error("Failed to load default pink line:", err));

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      routeLayersRef.current = [];
    };
  }, [isBootstrapping, bootError]);

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

    if (defaultLineLoaded && defaultLinePathsRef.current.length > 0) {
      const userPoints = pinkNodes.map((n) => [n.lat, n.lng] as [number, number]);
      const { solid, dashed, removed } = buildIntegratedRoute(defaultLinePathsRef.current, userPoints);
      const solidStyle: L.PolylineOptions = { color: "#FF69B4", weight: 5, opacity: 0.9 };
      const dashedStyle: L.PolylineOptions = {
        color: "#FF69B4",
        weight: 5,
        opacity: 0.9,
        dashArray: "10, 10",
      };
      const removedStyle: L.PolylineOptions = { color: "#FF69B4", weight: 5, opacity: 0.6 };

      for (const points of removed) {
        routeLayersRef.current.push(L.polyline(points as L.LatLngExpression[], removedStyle).addTo(map));
      }
      for (const points of solid) {
        routeLayersRef.current.push(L.polyline(points as L.LatLngExpression[], solidStyle).addTo(map));
      }
      for (const points of dashed) {
        routeLayersRef.current.push(L.polyline(points as L.LatLngExpression[], dashedStyle).addTo(map));
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
          icon: L.divIcon({
            className: "pink-line-node-marker",
            html: `<div class="pink-line-node">${nodeOrder.get(node.tempId) || 1}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
        }).addTo(map);

        marker.on("click", () => {
          if (confirm("Remove this pink line point?")) {
            setPinkNodes((prev) => prev.filter((n) => n.tempId !== node.tempId));
          }
        });

        markersRef.current.set(node.tempId, marker);
      });
    }

    const placeMemorial = (site: PendingSite, isCentral: boolean) => {
      const icon = L.icon({
        iconUrl: isCentral ? regionalMemorialIconUrl : localMemorialIconUrl,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20],
      });
      const marker = L.marker([site.lat, site.lng], { icon }).addTo(map);
      marker.on("click", () => {
        if (confirm(isCentral ? "למחוק אנדרטה מרכזית?" : "למחוק אנדרטה מקומית?")) {
          if (isCentral) {
            setCentralSite(null);
          } else {
            setLocalSites((prev) => prev.filter((s) => s.tempId !== site.tempId));
          }
        }
      });
      markersRef.current.set(site.tempId, marker);
    };

    if (centralSite) placeMemorial(centralSite, true);
    localSites.forEach((site) => placeMemorial(site, false));
  }, [pinkNodes, centralSite, localSites, defaultLineLoaded]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (pendingPinkMarkerRef.current) {
      try { mapRef.current.removeLayer(pendingPinkMarkerRef.current); } catch (_) {}
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
      try { mapRef.current.removeLayer(pendingMemorialMarkerRef.current); } catch (_) {}
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

  const submissionSelectRows = useMemo(() => {
    const rows = submissionBatches.map((b) => ({ id: b.submissionId, label: b.name }));
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

  const closeAllForms = () => {
    setPendingPinkTarget(null);
    setPendingMemorialTarget(null);
  };
  const isEntryModalOpen = Boolean(pendingPinkTarget || pendingMemorialTarget);

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
        setCentralSite(null);
      }

      setPendingMemorialTarget({ lat: latlng.lat, lng: latlng.lng, type });
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const handleClearPink = () => {
    if (pinkNodes.length === 0) return;
    if (!confirm("למחוק את כל נקודות הקו הוורוד?")) return;
    setPinkNodes([]);
  };

  const handleClearMemorial = () => {
    const hasAnyMemorial = Boolean(centralSite) || localSites.length > 0;
    if (!hasAnyMemorial) return;
    if (!confirm("למחוק את כל אתרי ההנצחה שסומנו?")) return;
    setCentralSite(null);
    setLocalSites([]);
  };

  const submitSelection = async () => {
    let includePink = submitScope === "pink" || submitScope === "everything";
    let includeMemorial = submitScope === "memorial" || submitScope === "everything";
    if (lockFullWorkspaceOverwrite) {
      includePink = true;
      includeMemorial = true;
    }
    if (!includePink && !includeMemorial) return;

    const submissionDisplayName = submissionNameInput.trim();
    if (!submissionDisplayName) return;

    const memorialRows = [...(centralSite ? [centralSite] : []), ...localSites];
    const mapWorkspaceProjects = { pinkProjectId, memorialProjectId };

    setSubmitting(true);
    try {
      const useOverwrite = isEditingExistingSubmission && submitEditDisposition === "overwrite";

      if (useOverwrite) {
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
          memorialSites: memorialRows,
        });
      } else {
        const submissionId = crypto.randomUUID();
        await submitUnifiedFeatures({
          submissionId,
          submissionName: submissionDisplayName,
          pinkProjectId,
          memorialProjectId,
          includePink,
          includeMemorial,
          pinkNodes,
          memorialSites: memorialRows,
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
            submissionNameInputRef.current = detail.name;
            setSubmissionNameInput(detail.name);
            selectedSubmissionIdRef.current = detail.submissionId;
            setSelectedSubmissionId(detail.submissionId);
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
          }
        }
      } else {
        if (includePink) setPinkNodes([]);
        if (includeMemorial) {
          setCentralSite(null);
          setLocalSites([]);
        }
      }

      setShowSubmitModal(false);

      const submittedParts = [
        includePink ? `${pinkNodes.length} נקודות שביל` : null,
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
      <div id="map" style={{ height: "100vh", width: "100%" }} />

      {pendingPinkTarget && (
        <PinkLineNodeForm
          onSubmit={(name, description) => {
            setPinkNodes((prev) => [
              ...prev,
              {
                tempId: crypto.randomUUID(),
                name: name || null,
                description: description || null,
                lat: pendingPinkTarget.lat,
                lng: pendingPinkTarget.lng,
              },
            ]);
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
              setCentralSite(site);
            } else {
              setLocalSites((prev) => [...prev, site]);
            }
            setPendingMemorialTarget(null);
          }}
          onCancel={() => setPendingMemorialTarget(null)}
        />
      )}

      {activeProject === "pink" && !isEntryModalOpen && (
        <div className="pink-toolbar" dir="rtl">
          <div className="pink-toolbar-section">
            <div className="pink-toolbar-item-text">
              <span className="pink-toolbar-title">לחץ על המפה כדי להוסיף נקודות</span>
              <span className="pink-toolbar-count">{pinkNodes.length} נקודות</span>
            </div>
          </div>
          <div className="pink-toolbar-divider" />
          <div className="pink-toolbar-actions">
            <button
              type="button"
              dir="rtl"
              onClick={() => {
                if (!hasPink && !hasMemorial) return;
                setShowSubmitModal(true);
              }}
              className={`pink-toolbar-action pink-toolbar-action-primary ${!hasPink && !hasMemorial ? "toolbar-action-blocked" : ""}`}
            >
              הגשה
            </button>
            <button
              type="button"
              dir="rtl"
              onClick={handleClearPink}
              className={`pink-toolbar-action pink-toolbar-action-secondary ${pinkNodes.length === 0 ? "toolbar-action-blocked" : ""}`}
            >
              נקה הכל
            </button>
          </div>
        </div>
      )}

      {activeProject === "memorial" && !isEntryModalOpen && (
        <div
          className={`memorial-toolbar${memorialDragPlacementEnabled ? "" : " memorial-toolbar--tap-only"}`}
          dir="rtl"
        >
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

          <div className="memorial-toolbar-divider" />

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

          <div className="memorial-toolbar-divider" />

          <div className="memorial-toolbar-actions">
            <button
              type="button"
              dir="rtl"
              className={`memorial-toolbar-action-btn memorial-toolbar-action-btn-primary ${!hasPink && !hasMemorial ? "toolbar-action-blocked" : ""}`}
              onClick={() => {
                if (!hasPink && !hasMemorial) return;
                setShowSubmitModal(true);
              }}
            >
              הגשה
            </button>
            <button
              type="button"
              dir="rtl"
              className={`memorial-toolbar-action-btn memorial-toolbar-action-btn-secondary ${!hasMemorial ? "toolbar-action-blocked" : ""}`}
              onClick={handleClearMemorial}
            >
              נקה הכל
            </button>
          </div>
        </div>
      )}

      <div className="base-map-controls">
        <div className="base-map-controls-mobile-stack" dir="rtl">
          <div className="base-map-submissions-selector hook-base-map-submissions" dir="rtl">
            <label className="base-map-submissions-label" htmlFor="map-submission-select">
              הגשות
            </label>
            <select
              id="map-submission-select"
              className="base-map-submission-select base-map-control-btn project-switch-btn"
              value={selectedSubmissionId ?? ""}
              onChange={(e) => void handleSubmissionSelectChange(e)}
              disabled={submissionBatchesLoading || loadingSubmissionDetail}
              aria-busy={loadingSubmissionDetail || submissionBatchesLoading}
            >
              <option value="">הגשה חדשה</option>
              {submissionSelectRows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
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
              title="שביל תקומה"
            >
              שביל תקומה
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
                      <span className="unified-submit-segment-title">שביל תקומה</span>
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
                      <span className="unified-submit-segment-title">שביל + אתרים</span>
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
