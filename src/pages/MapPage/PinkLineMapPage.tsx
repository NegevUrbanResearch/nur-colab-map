import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useProject } from "../../context/ProjectContext";
import { createPinkLineNode, loadPinkLineNodes, submitPinkLineRoute, deletePinkLineNode } from "../../supabase/pinkLine";
import { optimizeRoute } from "../../utils/routeOptimizer";
import { parseDefaultLinePaths, buildIntegratedRoute } from "../../utils/pinkLineRoute";
import supabase from "../../supabase";
import PinkLineNodeForm from "./PinkLineNodeForm";

const DEFAULT_PINK_LINE_URL = "/line-layer/pink-line-wgs84.geojson";

interface PinkLineNode {
  id: string;
  lat: number;
  lng: number;
  submissionId: string | null;
}

const PinkLineMapPage = () => {
  const { project } = useProject();
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLineRef = useRef<L.Polyline | null>(null);
  const defaultLinePathsRef = useRef<[number, number][][]>([]);
  // Single list of all route polylines on the map (solid + dashed)
  const routeLayersRef = useRef<L.Polyline[]>([]);
  const [nodes, setNodes] = useState<PinkLineNode[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingNode, setPendingNode] = useState<{ lat: number; lng: number } | null>(null);
  const [defaultLineLoaded, setDefaultLineLoaded] = useState(false);
  const busyRef = useRef(false);

  // Nuke every route polyline from the map. Called before every re-render.
  const clearAllRouteLayers = (map: L.Map) => {
    const count = routeLayersRef.current.length;
    for (const layer of routeLayersRef.current) {
      try { map.removeLayer(layer); } catch (_) { /* already gone */ }
    }
    routeLayersRef.current = [];
    if (routeLineRef.current) {
      try { map.removeLayer(routeLineRef.current); } catch (_) { /* already gone */ }
      routeLineRef.current = null;
    }
    console.log(`[PinkLine] Cleared ${count} route layers`);
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

      L.tileLayer(
        "https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg",
        {
          maxZoom: 19,
        }
      ).addTo(mapRef.current);

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
          signOutButton.innerHTML = "⏻";
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

      fetch(DEFAULT_PINK_LINE_URL)
        .then((res) => res.json())
        .then((geojson: GeoJSON.FeatureCollection) => {
          if (!mapRef.current) return;
          defaultLinePathsRef.current = parseDefaultLinePaths(geojson);
          console.log(`[PinkLine] Base line loaded: ${defaultLinePathsRef.current.length} paths`);
          setDefaultLineLoaded(true);
        })
        .catch((err) => console.error("Failed to load default pink line:", err));

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

    const basePaths = defaultLinePathsRef.current;
    const hasBase = basePaths.length > 0;

    // Step 3: Rebuild route via buildIntegratedRoute (handles both 0 and >0 nodes)
    if (hasBase) {
      const userPoints = nodes.map((n) => [n.lat, n.lng] as [number, number]);
      const { solid, dashed } = buildIntegratedRoute(basePaths, userPoints);
      console.log(`[PinkLine] Rendering ${solid.length} solid + ${dashed.length} dashed segments for ${nodes.length} nodes`);

      const solidStyle: L.PolylineOptions = { color: "#FF69B4", weight: 5, opacity: 0.9 };
      const dashedStyle: L.PolylineOptions = { color: "#FF69B4", weight: 5, opacity: 0.9, dashArray: "10, 10" };

      for (const pts of solid) {
        const layer = L.polyline(pts as L.LatLngExpression[], solidStyle).addTo(map);
        routeLayersRef.current.push(layer);
      }
      for (const pts of dashed) {
        const layer = L.polyline(pts as L.LatLngExpression[], dashedStyle).addTo(map);
        routeLayersRef.current.push(layer);
      }
    } else if (nodes.length > 1) {
      const optimizedRoute = optimizeRoute(nodes);
      const routeCoords = optimizedRoute.map((node) => [node.lat, node.lng] as L.LatLngExpression);
      routeLineRef.current = L.polyline(routeCoords, {
        color: "#FF69B4",
        weight: 6,
        opacity: 0.8,
        dashArray: "10, 10",
      }).addTo(map);
    }

    // Step 4: Double-check — count pink layers actually on the map
    let pinkLayerCount = 0;
    map.eachLayer((layer) => {
      if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        pinkLayerCount++;
      }
    });
    const expectedCount = routeLayersRef.current.length + (routeLineRef.current ? 1 : 0);
    if (pinkLayerCount !== expectedCount) {
      console.warn(`[PinkLine] LAYER MISMATCH: ${pinkLayerCount} polylines on map, expected ${expectedCount}. Forcing cleanup.`);
      map.eachLayer((layer) => {
        if (layer instanceof L.Polyline && !(layer instanceof L.Polygon) &&
            !routeLayersRef.current.includes(layer as L.Polyline) &&
            layer !== routeLineRef.current) {
          map.removeLayer(layer);
          console.warn(`[PinkLine] Removed orphan polyline layer`);
        }
      });
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
  }, [nodes, defaultLineLoaded]);

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

    setIsSubmitting(true);
    try {
      const unsubmittedNodes = nodes.filter((n) => !n.submissionId);
      if (unsubmittedNodes.length > 0) {
        await submitPinkLineRoute(project.id, unsubmittedNodes.map((n) => n.id));
        const updatedNodes = await loadPinkLineNodes(project.id);
        setNodes(updatedNodes);
        alert(`Route submitted successfully! ${unsubmittedNodes.length} point${unsubmittedNodes.length !== 1 ? "s" : ""} saved.`);
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
