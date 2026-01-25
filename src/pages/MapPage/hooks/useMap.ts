import { useEffect, useRef, useState } from "react";
import L, { DrawEvents } from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";
import "../../../types/leaflet.d.ts";
import {
  createGeometry,
  deleteGeometry,
  loadGeometries,
  updateGeometry,
  Feature,
} from "../../../supabase/features";

interface UseMapProps {
  center: L.LatLngExpression;
  enabled?: boolean;
  onShapeCreated?: (layer: L.Layer, callback: (name: string | null, description: string | null) => void) => void;
}

interface UseMapReturn {
  mapRef: React.MutableRefObject<L.Map | null>;
  drawControlRef: React.MutableRefObject<L.Control.Draw | null>;
  featureCount: number;
}

export const useMap = ({ center, enabled = true, onShapeCreated }: UseMapProps): UseMapReturn => {
  const mapRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const [featureCount, setFeatureCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    // Clean up existing map first
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      drawnItemsRef.current = null;
    }

    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;

    // Clear any remaining Leaflet state from the container
    if ((mapContainer as any)._leaflet_id) {
      delete (mapContainer as any)._leaflet_id;
    }
    mapContainer.innerHTML = "";

    // Initialize the new map
    mapRef.current = L.map("map").setView(center, 16);

      L.tileLayer(
        "https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg",
        {
          maxZoom: 19,
        }
      ).addTo(mapRef.current);

      drawnItemsRef.current = new L.FeatureGroup();
      mapRef.current.addLayer(drawnItemsRef.current);

      const drawControl = new L.Control.Draw({
        position: "topleft",
        edit: { featureGroup: drawnItemsRef.current },
        draw: {
          polygon: {
            shapeOptions: {
              color: "white",
              weight: 3,
              fillOpacity: 0.1,
            },
          },
          polyline: {},
          rectangle: false,
          circle: false,
          circlemarker: false,
          marker: {
            icon: L.divIcon({
              className: "plus-marker-icon",
              html: "+",
              iconSize: [25, 25],
              iconAnchor: [10, 10],
            }),
          },
        },
      });
      drawControlRef.current = drawControl;
      mapRef.current.addControl(drawControl);
      
      const updateFeatureCount = () => {
        if (drawnItemsRef.current) {
          setFeatureCount(drawnItemsRef.current.getLayers().length);
        }
      };

      mapRef.current.on(L.Draw.Event.CREATED, async (event) => {
        const createdEvent = event as DrawEvents.Created;
        const layer = createdEvent.layer;
        
        if (onShapeCreated && "toGeoJSON" in layer) {
          onShapeCreated(layer, async (shapeName: string | null, description: string | null) => {
            if (shapeName || description) {
              const geojson = (layer as L.Polygon).toGeoJSON().geometry;
              const newFeature = await createGeometry(shapeName, description, geojson);
              if (newFeature) {
                layer.featureId = newFeature.id;
                const displayName = newFeature.name || "Unnamed";
                layer.bindTooltip(displayName);
                drawnItemsRef.current?.addLayer(layer);
                updateFeatureCount();
              }
            } else {
              mapRef.current?.removeLayer(layer);
            }
          });
        }
      });

      mapRef.current.on(L.Draw.Event.EDITED, (event) => {
        const editedEvent = event as DrawEvents.Edited;
        editedEvent.layers.eachLayer(async (layer: L.Layer) => {
          const id = layer.featureId;
          if (id !== undefined && "toGeoJSON" in layer) {
            const geojson = (layer as
              | L.Polygon
              | L.Polyline
              | L.Marker).toGeoJSON().geometry;
            await updateGeometry(id, geojson);
          }
        });
      });

      mapRef.current.on(L.Draw.Event.DELETED, (event) => {
        const deletedEvent = event as DrawEvents.Deleted;
        deletedEvent.layers.eachLayer(async (layer: L.Layer) => {
          const id = layer.featureId;
          if (id !== undefined) {
            await deleteGeometry(id);
          }
        });
        updateFeatureCount();
      });

      loadGeometries().then((features: Feature[]) => {
        if (!mapRef.current || !drawnItemsRef.current) return;
        drawnItemsRef.current.clearLayers();
        features.forEach((feature: Feature) => {
          const options = {
            color: (feature as any).color || "white",
          };
          let layer: L.Layer | undefined;

          if (feature.geom.type === "Polygon") {
            const coords = (feature.geom as any).coordinates[0].map(
              ([lng, lat]: [number, number]) => [lat, lng]
            );
            layer = L.polygon(coords as L.LatLngExpression[], options);
          } else if (feature.geom.type === "LineString") {
            const coords = (feature.geom as any).coordinates.map(
              ([lng, lat]: [number, number]) => [lat, lng]
            );
            layer = L.polyline(coords as L.LatLngExpression[], options);
          } else if (feature.geom.type === "Point") {
            const [lng, lat] = (feature.geom as any).coordinates;
            layer = L.marker([lat, lng]);
            (layer as L.Marker).setIcon(
              L.divIcon({
                className: "plus-marker-icon",
                html: "+",
                iconSize: [25, 25],
                iconAnchor: [10, 10],
              })
            );
          }

          if (layer) {
            layer.featureId = feature.id;
            const displayName = feature.name || "Unnamed";
            layer.bindTooltip(displayName);
            drawnItemsRef.current?.addLayer(layer);
          }
        });
        updateFeatureCount();
      });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        drawnItemsRef.current = null;
        drawControlRef.current = null;
      }
    };
  }, [center, enabled]);

  return { mapRef, drawControlRef, featureCount };
};
