import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useProject } from "../../context/ProjectContext";
import {
  createPinkLineNode,
  loadPinkLineNodes,
  submitPinkLineRoute,
  deletePinkLineNode,
} from "../../supabase/pinkLine";
import { optimizeRoute } from "../../utils/routeOptimizer";
import {
  parseDefaultLinePaths,
  buildIntegratedRouteWithGoogleDetours,
  IntegratedRoute,
  flattenIntegratedRouteForPersistence,
} from "../../utils/pinkLineRoute";
import { addDetourPaintToMap } from "../../map/pinkDetourLeaflet";
import { routeLineStylesForDisplayColor } from "./mapLineStyles";
import supabase from "../../supabase";
import PinkLineNodeForm from "./PinkLineNodeForm";
import PinkRouteFetchingBanner from "./PinkRouteFetchingBanner";
import { computeRouteViaEdgeFunction } from "../../services/googleRoutes";
import { getCoreLayerUrls } from "../../map/layers/coreLayers";
import { addParkingLotsLayer } from "../../utils/parkingLayer";

const { heritageAxis: HERITAGE_AXIS_URL, parkingLots: PARKING_LOTS_URL, parkingIcon: PARKING_ICON_URL } =
  getCoreLayerUrls();

interface PinkLineNode {
  id: string;
  lat: number;
  lng: number;
  submissionId: string | null;
}

function flattenSegmentsForPersistence(route: IntegratedRoute): Array<[number, number]> {
  return flattenIntegratedRouteForPersistence(route);
}

const PinkLineMapPage = () => {
  const { project } = useProject();
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLineRef = useRef<L.Polyline | null>(null);
  const defaultLinePathsRef = useRef<[number, number][][]>([]);
  // Single list of all route polylines on the map (solid + dashed)
  const routeLayersRef = useRef<L.Layer[]>([]);
  const [nodes, setNodes] = useState<PinkLineNode[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingNode, setPendingNode] = useState<{ lat: number; lng: number } | null>(null);
  const [defaultLineLoaded, setDefaultLineLoaded] = useState(false);
  const [integratedRoute, setIntegratedRoute] = useState<IntegratedRoute | null>(null);
  const [routeForPersistence, setRouteForPersistence] = useState<Array<[number, number]>>([]);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isFetchingPinkRoute, setIsFetchingPinkRoute] = useState(false);
  const busyRef = useRef(false);

  const pinkUserPointsKey = useMemo(
    () => JSON.stringify(nodes.map((n) => [n.lat, n.lng])),
    [nodes]
  );
  const pendingMarkerRef = useRef<L.Marker | null>(null);
  const parkingLayerRef = useRef<L.LayerGroup | null>(null);

  // Nuke every route polyline from the map. Called before every re-render.
  const clearAllRouteLayers = (map: L.Map) => {
    for (const layer of routeLayersRef.current) {
      try {
        map.removeLayer(layer);
      } catch (_) {
        /* already gone */
      }
    }
    routeLayersRef.current = [];
    if (routeLineRef.current) {
      try { map.removeLayer(routeLineRef.current); } catch (_) { /* already gone */ }
      routeLineRef.current = null;
    }
  };

  useEffect(() => {
    if (!project) return;

    setDefaultLineLoaded(false);
    defaultLinePathsRef.current = [];

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    routeLayersRef.current = [];
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;

    if ((mapContainer as any)._leaflet_id) {
      delete (mapContainer as any)._leaflet_id;
    }
    mapContainer.innerHTML = "";

    mapRef.current = L.map("map").setView([31.42, 34.49], 13);
    const mapInstance = mapRef.current;

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution:
        "Tiles &copy; Esri",
    }).addTo(mapRef.current);

      const customControls = L.Control.extend({
        onAdd: function () {
          const container = L.DomUtil.create(
            "div",
            "leaflet-bar leaflet-control"
          );

          const homeButton = L.DomUtil.create(
            "a",
            "leaflet-bar-part",
            container
          );
          homeButton.innerHTML = "⌂";
          homeButton.href = "#";
          homeButton.onclick = (e) => {
            e.preventDefault();
            navigate("/projects-page");
          };

          const signOutButton = L.DomUtil.create(
            "a",
            "leaflet-bar-part",
            container
          );
          signOutButton.classList.add("project-switch-btn");
          signOutButton.innerHTML = "התנתק";
          signOutButton.href = "#";
          signOutButton.onclick = async (e) => {
            e.preventDefault();
            await supabase.auth.signOut();
            navigate("/");
          };

          return container;
        },
        onRemove: function () {},
      });

      new customControls({ position: "topleft" }).addTo(mapRef.current);

      fetch(HERITAGE_AXIS_URL)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch heritage axis GeoJSON (${res.status})`);
          }
          return res.json();
        })
        .then((geojson: GeoJSON.FeatureCollection) => {
          if (!mapRef.current) return;
          defaultLinePathsRef.current = parseDefaultLinePaths(geojson);
          setDefaultLineLoaded(true);
        })
        .catch((err) => console.error("Failed to load heritage axis line:", err));

      addParkingLotsLayer(mapInstance, PARKING_LOTS_URL, PARKING_ICON_URL, () => mapRef.current === mapInstance)
        .then((group) => {
          if (group) parkingLayerRef.current = group;
        })
        .catch((err) => console.error("Failed to load parking lots:", err));

      mapRef.current.on("click", (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        setPendingNode({ lat, lng });
      });

      const loadExistingNodes = async () => {
        if (!project) return;
        const existingNodes = await loadPinkLineNodes(project.id);
        setNodes(existingNodes);
      };

      loadExistingNodes();

    return () => {
      parkingLayerRef.current = null;
      if (mapRef.current) {
        clearAllRouteLayers(mapRef.current);
        markersRef.current.forEach((marker) => {
          try { mapRef.current!.removeLayer(marker); } catch (_) {}
        });
        markersRef.current.clear();
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [project]);

  useEffect(() => {
    let cancelled = false;

    const rebuildRoute = async () => {
      const basePaths = defaultLinePathsRef.current;
      if (basePaths.length === 0) {
        setIsFetchingPinkRoute(false);
        setIntegratedRoute(null);
        setRouteForPersistence([]);
        setRouteError(null);
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
        const route = await buildIntegratedRouteWithGoogleDetours(basePaths, userPoints, {
          computeRoute: async (waypoints) => {
            const computed = await computeRouteViaEdgeFunction(waypoints);
            return computed.points;
          },
        });

        if (cancelled) return;
        setIntegratedRoute(route);
        setRouteForPersistence(flattenSegmentsForPersistence(route));
        setRouteError(null);
      } catch (error) {
        console.error("Failed to build Google-routed pink line:", error);
        if (cancelled) return;
        setIntegratedRoute(null);
        setRouteForPersistence([]);
        setRouteError("Failed to compute route using Google Routes. Please adjust points and try again.");
      } finally {
        if (!cancelled && willCallGoogle) {
          setIsFetchingPinkRoute(false);
        }
      }
    };

    rebuildRoute();

    return () => {
      cancelled = true;
    };
  }, [pinkUserPointsKey, defaultLineLoaded, project?.id]);

  // Single rendering effect: clears ALL visuals, then redraws from scratch.
  // Every pink polyline on the map comes from routeLayersRef — nothing else.
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Step 1: Remove every marker
    markersRef.current.forEach((marker) => {
      try { map.removeLayer(marker); } catch (_) {}
    });
    markersRef.current.clear();

    // Step 2: Remove every route polyline
    clearAllRouteLayers(map);

    // Step 3: Draw computed integrated route (heritage axis + detours)
    if (integratedRoute) {
      const { solid, dashed, removed } = integratedRoute;
      const solidStyle: L.PolylineOptions = { color: "#FF69B4", weight: 5, opacity: 0.9 };
      const {
        proposed: dashedStyle,
        proposedSecondary: dashedSecondaryStyle,
        proposedHalo: dashedHaloStyle,
      } = routeLineStylesForDisplayColor(null);
      const removedStyle: L.PolylineOptions = { color: "#FF69B4", weight: 5, opacity: 0.6 };
      const showUserDetours = nodes.length > 0;

      if (showUserDetours) {
        for (const pts of removed) {
          const layer = L.polyline(pts as L.LatLngExpression[], removedStyle).addTo(map);
          routeLayersRef.current.push(layer);
        }
      }
      for (const pts of solid) {
        const layer = L.polyline(pts as L.LatLngExpression[], solidStyle).addTo(map);
        routeLayersRef.current.push(layer);
      }
      if (showUserDetours) {
        if (integratedRoute.detourPaint && integratedRoute.detourPaint.length > 0) {
          addDetourPaintToMap(
            map,
            integratedRoute.detourPaint,
            dashedStyle,
            routeLayersRef.current,
            dashedHaloStyle,
            dashedSecondaryStyle
          );
        } else {
          for (const pts of dashed) {
            routeLayersRef.current.push(L.polyline(pts as L.LatLngExpression[], dashedHaloStyle).addTo(map));
            if (dashedSecondaryStyle) {
              routeLayersRef.current.push(L.polyline(pts as L.LatLngExpression[], dashedSecondaryStyle).addTo(map));
            }
            routeLayersRef.current.push(L.polyline(pts as L.LatLngExpression[], dashedStyle).addTo(map));
          }
        }
      }
    }

    const refSet = new Set(routeLayersRef.current);
    let attached = 0;
    map.eachLayer((layer) => {
      if (refSet.has(layer)) attached++;
    });
    if (attached !== refSet.size) {
      console.warn(
        `[PinkLine] LAYER MISMATCH: ${attached} managed layers still on map, expected ${refSet.size}.`
      );
    }

    if (nodes.length === 0) return;

    // Step 5: Add markers
    const optimizedRoute = nodes.length > 1 ? optimizeRoute(nodes) : nodes;
    const nodeOrderMap = new Map(optimizedRoute.map((node, index) => [node.id, index + 1]));

    nodes.forEach((node) => {
      const order = nodeOrderMap.get(node.id) || 1;
      const marker = L.marker([node.lat, node.lng], {
        icon: L.divIcon({
          className: "pink-line-node-marker",
          html: `<div class="pink-line-node">${order}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      }).addTo(map);

      marker.on("click", () => {
        handleRemoveNode(node.id);
      });

      markersRef.current.set(node.id, marker);
    });
  }, [nodes, defaultLineLoaded, integratedRoute]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (pendingMarkerRef.current) {
      try { mapRef.current.removeLayer(pendingMarkerRef.current); } catch (_) {}
      pendingMarkerRef.current = null;
    }
    if (pendingNode) {
      pendingMarkerRef.current = L.marker([pendingNode.lat, pendingNode.lng], {
        icon: L.divIcon({
          className: "pink-line-node-marker",
          html: `<div class="pink-line-node">+</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      }).addTo(mapRef.current);
    }
  }, [pendingNode]);

  const handleRemoveNode = async (nodeId: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await deletePinkLineNode(nodeId);
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    } catch (error) {
      console.error("Failed to delete node:", error);
      alert("Failed to delete node. Please try again.");
    } finally {
      busyRef.current = false;
    }
  };

  const handleSubmit = async () => {
    if (nodes.length === 0 || !project) return;
    if (routeForPersistence.length < 2) {
      alert(routeError || "Route is not ready. Google Routes failed to compute this path.");
      return;
    }

    setIsSubmitting(true);
    try {
      const unsubmittedNodes = nodes.filter((n) => !n.submissionId);
      if (unsubmittedNodes.length > 0) {
        const submissionId = await submitPinkLineRoute(
          project.id,
          unsubmittedNodes.map((n) => n.id),
          routeForPersistence
        );
        const updatedNodes = await loadPinkLineNodes(project.id);
        setNodes(updatedNodes);
        alert(
          `Route submitted successfully! ${unsubmittedNodes.length} point${
            unsubmittedNodes.length !== 1 ? "s" : ""
          } saved. Submission: ${submissionId.slice(0, 8)}...`
        );
      }
    } catch (error) {
      console.error("Failed to submit route:", error);
      alert("Failed to submit route. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNodeFormSubmit = async (name: string, description: string) => {
    if (!pendingNode || !project || busyRef.current) return;
    busyRef.current = true;
    try {
      const newNode = await createPinkLineNode(project.id, pendingNode.lat, pendingNode.lng, name || null, description || null);
      if (newNode) {
        setNodes((prev) => [...prev, newNode]);
      }
      setPendingNode(null);
    } finally {
      busyRef.current = false;
    }
  };

  const handleClear = async () => {
    if (!project || busyRef.current) return;
    busyRef.current = true;
    try {
      const currentNodes = await loadPinkLineNodes(project.id);
      const unsubmittedNodes = currentNodes.filter((n) => !n.submissionId);
      for (const node of unsubmittedNodes) {
        await deletePinkLineNode(node.id);
      }
      setNodes((prev) => prev.filter((n) => n.submissionId !== null));
    } catch (error) {
      console.error("Failed to clear nodes:", error);
      alert("Failed to clear nodes. Please try again.");
    } finally {
      busyRef.current = false;
    }
  };

  return (
    <>
      <div key={project?.id || "no-project"} id="map" style={{ height: "100vh", width: "100%" }}></div>
      {pendingNode && (
        <PinkLineNodeForm
          onSubmit={handleNodeFormSubmit}
          onCancel={() => setPendingNode(null)}
        />
      )}
      {!pendingNode && (isSubmitting || isFetchingPinkRoute) && (
        <PinkRouteFetchingBanner variant={isSubmitting ? "submit" : "route"} />
      )}
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          background: "white",
          padding: "15px 25px",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          display: "flex",
          gap: "15px",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: "16px", fontWeight: "500" }}>
          לחץ על המפה כדי להוסיף נקודות • {nodes.length} נקודות
        </div>
        {routeError && (
          <div style={{ color: "#b00020", fontSize: "14px", fontWeight: 600 }}>
            {routeError}
          </div>
        )}
        {nodes.length > 0 && (
          <>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                padding: "8px 20px",
                backgroundColor: "#FF69B4",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                fontWeight: "500",
              }}
            >
              {isSubmitting ? "שולח..." : "שלח מסלול"}
            </button>
            <button
              onClick={handleClear}
              style={{
                padding: "8px 20px",
                backgroundColor: "#ccc",
                color: "black",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              נקה הכל
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default PinkLineMapPage;
