import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useProject } from "../../context/ProjectContext";
import { createPinkLineNode, loadPinkLineNodes, submitPinkLineRoute, deletePinkLineNode } from "../../supabase/pinkLine";
import { optimizeRoute } from "../../utils/routeOptimizer";
import supabase from "../../supabase";

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
  const [nodes, setNodes] = useState<PinkLineNode[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!project) return;

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

      mapRef.current.on("click", async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const newNode = await createPinkLineNode(project.id, lat, lng);
        if (newNode) {
          setNodes((prev) => [...prev, newNode]);
        }
      });

      const loadExistingNodes = async () => {
        if (!project) return;
        const existingNodes = await loadPinkLineNodes(project.id);
        setNodes(existingNodes);
      };

      loadExistingNodes();

    return () => {
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

    if (routeLineRef.current) {
      mapRef.current.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
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

    if (nodes.length > 1) {
      const routeCoords = optimizedRoute.map((node) => [node.lat, node.lng] as L.LatLngExpression);

      routeLineRef.current = L.polyline(routeCoords, {
        color: "#FF69B4",
        weight: 6,
        opacity: 0.8,
        dashArray: "10, 10",
      }).addTo(mapRef.current!);
    }
  }, [nodes]);

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
          Click on the map to add points • {nodes.length} point{nodes.length !== 1 ? "s" : ""} added
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
              {isSubmitting ? "Submitting..." : "Submit Route"}
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
              Clear
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default PinkLineMapPage;
