import L from "leaflet";
import { useMap } from "./hooks/useMap";
import { useProject } from "../../context/ProjectContext";
import PinkLineMapPage from "./PinkLineMapPage";

const MapPage = () => {
  const { project, isLoading } = useProject();

  if (isLoading) {
    return <div>Loading project...</div>;
  }

  if (project?.name === "Pink Line") {
    return <PinkLineMapPage />;
  }

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

  useMap({ center: mapInitCenter });

  return (
    <>
      <div key={project?.id || "no-project"} id="map" style={{ height: "100vh", width: "100%" }}></div>
    </>
  );
};

export default MapPage;
