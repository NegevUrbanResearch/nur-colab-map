import { useState } from "react";
import L from "leaflet";
import { useMap } from "./hooks/useMap";
import { useProject } from "../../context/ProjectContext";
import PinkLineMapPage from "./PinkLineMapPage";
import BaseMapControls from "./BaseMapControls";
import ShapeNameInput from "./ShapeNameInput";

const MapPage = () => {
  const { project, isLoading } = useProject();
  const [pendingLayer, setPendingLayer] = useState<{ layer: L.Layer; callback: (name: string | null, description: string | null) => void } | null>(null);

  const projectMeta = project?.project_meta;
  let mapInitCenter: L.LatLngExpression = [31.42, 34.49];

  if (projectMeta) {
    try {
      const geojson = projectMeta;
      if (geojson.type === "Polygon" && geojson.coordinates.length > 0) {
        const coords = geojson.coordinates[0];
        const latSum = coords.reduce(
          (sum: number, coord: number[]) => sum + coord[1],
          0
        );
        const lngSum = coords.reduce(
          (sum: number, coord: number[]) => sum + coord[0],
          0
        );
        const lat = latSum / coords.length;
        const lng = lngSum / coords.length;
        mapInitCenter = [lat, lng];
      }
    } catch (error) {
      console.error("Failed to parse project_meta as GeoJSON:", error);
    }
  }

  const handleShapeCreated = (layer: L.Layer, callback: (name: string | null, description: string | null) => void) => {
    setPendingLayer({ layer, callback });
  };

  const handleShapeNameSubmit = (name: string | null, description: string | null) => {
    if (pendingLayer) {
      pendingLayer.callback(name, description);
      setPendingLayer(null);
    }
  };

  const handleShapeNameCancel = () => {
    if (pendingLayer) {
      pendingLayer.callback(null, null);
      setPendingLayer(null);
    }
  };

  const { mapRef, drawControlRef, featureCount } = useMap({ 
    center: mapInitCenter,
    enabled: !isLoading && project?.name !== "Pink Line",
    onShapeCreated: handleShapeCreated
  });

  if (isLoading) {
    return <div>Loading project...</div>;
  }

  if (project?.name === "Pink Line") {
    return <PinkLineMapPage />;
  }

  return (
    <>
      <div key={project?.id || "no-project"} id="map" style={{ height: "100vh", width: "100%" }}></div>
      <BaseMapControls mapRef={mapRef} drawControlRef={drawControlRef} featureCount={featureCount} />
      {pendingLayer && (
        <ShapeNameInput
          onSubmit={handleShapeNameSubmit}
          onCancel={handleShapeNameCancel}
        />
      )}
    </>
  );
};

export default MapPage;
