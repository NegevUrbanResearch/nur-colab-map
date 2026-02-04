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
  const defaultLineLayerRef = useRef<L.GeoJSON | null>(null);
  const defaultLinePathsRef = useRef<[number, number][][]>([]);
  const integratedLayersRef = useRef<L.Layer[]>([]);
  const [nodes, setNodes] = useState<PinkLineNode[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingNode, setPendingNode] = useState<{ lat: number; lng: number } | null>(null);
  const [defaultLineLoaded, setDefaultLineLoaded] = useState(false);

  useEffect(() => {
    if (!project) return;

    setDefaultLineLoaded(false);
    defaultLinePathsRef.current = [];
    defaultLineLayerRef.current = null;

    // Clean up existing map first
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;

    // Clear any remaining Leaflet state from the container
    if ((mapContainer as any)._leaflet_id) {
      delete (mapContainer as any)._leaflet_id;
    }
    mapContainer.innerHTML = "";

    // Initialize the new map
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
          defaultLineLayerRef.current = L.geoJSON(geojson, {
            style: { color: "#FF69B4", weight: 5, opacity: 0.9 },
          });
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
      integratedLayersRef.current.forEach((layer) => mapRef.current?.removeLayer(layer));
      integratedLayersRef.current = [];
      defaultLineLayerRef.current?.clearLayers();
      defaultLineLayerRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      if (routeLineRef.current) {
        routeLineRef.current.remove();
        routeLineRef.current = null;
      }
    };
  }, [project]);

  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach((marker) => {
      mapRef.current?.removeLayer(marker);
    });
    markersRef.current.clear();

    integratedLayersRef.current.forEach((layer) => mapRef.current?.removeLayer(layer));
    integratedLayersRef.current = [];
    if (routeLineRef.current) {
      mapRef.current.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    const basePaths = defaultLinePathsRef.current;
    const hasBase = basePaths.length > 0;

    if (nodes.length > 0) {
      if (hasBase) {
        defaultLineLayerRef.current && mapRef.current?.removeLayer(defaultLineLayerRef.current);
        const userPoints = nodes.map((n) => [n.lat, n.lng] as [number, number]);
        const { solid, dashed } = buildIntegratedRoute(basePaths, userPoints);
        const map = mapRef.current!;
        const solidStyle = { color: "#FF69B4", weight: 5, opacity: 0.9 };
        const dashedStyle = { color: "#FF69B4", weight: 5, opacity: 0.9, dashArray: "10, 10" };
        solid.forEach((pts) => {
          const layer = L.polyline(pts as L.LatLngExpression[], solidStyle).addTo(map);
          integratedLayersRef.current.push(layer);
        });
        dashed.forEach((pts) => {
          const layer = L.polyline(pts as L.LatLngExpression[], dashedStyle).addTo(map);
          integratedLayersRef.current.push(layer);
        });
      } else if (nodes.length > 1) {
        const optimizedRoute = optimizeRoute(nodes);
        const routeCoords = optimizedRoute.map((node) => [node.lat, node.lng] as L.LatLngExpression);
        routeLineRef.current = L.polyline(routeCoords, {
          color: "#FF69B4",
          weight: 6,
          opacity: 0.8,
          dashArray: "10, 10",
        }).addTo(mapRef.current!);
      }
    } else {
      if (defaultLineLayerRef.current && hasBase) {
        mapRef.current?.addLayer(defaultLineLayerRef.current);
      }
    }

    if (nodes.length === 0) return;

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
      }).addTo(mapRef.current!);

      marker.on("click", () => {
        handleRemoveNode(node.id);
      });

      markersRef.current.set(node.id, marker);
    });
  }, [nodes, defaultLineLoaded]);

  const handleRemoveNode = async (nodeId: string) => {
    try {
      await deletePinkLineNode(nodeId);
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      const marker = markersRef.current.get(nodeId);
      if (marker) {
        mapRef.current?.removeLayer(marker);
        markersRef.current.delete(nodeId);
      }
    } catch (error) {
      console.error("Failed to delete node:", error);
      alert("Failed to delete node. Please try again.");
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
    if (!pendingNode || !project) return;
    const newNode = await createPinkLineNode(project.id, pendingNode.lat, pendingNode.lng, name || null, description || null);
    if (newNode) {
      setNodes((prev) => [...prev, newNode]);
    }
    setPendingNode(null);
  };

  const handleClear = async () => {
    if (!project) return;

    const unsubmittedNodes = nodes.filter((n) => !n.submissionId);
    try {
      for (const node of unsubmittedNodes) {
        await deletePinkLineNode(node.id);
      }
      setNodes(nodes.filter((n) => n.submissionId !== null));
      markersRef.current.forEach((marker) => {
        mapRef.current?.removeLayer(marker);
      });
      markersRef.current.clear();
      if (routeLineRef.current) {
        mapRef.current?.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }
    } catch (error) {
      console.error("Failed to clear nodes:", error);
      alert("Failed to clear nodes. Please try again.");
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
