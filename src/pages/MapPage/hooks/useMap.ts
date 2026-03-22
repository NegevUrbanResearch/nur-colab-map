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
  isHebrew?: boolean;
}

interface UseMapReturn {
  mapRef: React.MutableRefObject<L.Map | null>;
  drawControlRef: React.MutableRefObject<L.Control.Draw | null>;
  featureCount: number;
}

export const useMap = ({ center, enabled = true, onShapeCreated, isHebrew }: UseMapProps): UseMapReturn => {
  const mapRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const pendingLayersRef = useRef<Set<L.Layer>>(new Set());
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

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution:
        "Tiles &copy; Esri",
    }).addTo(mapRef.current);

      drawnItemsRef.current = new L.FeatureGroup();
      mapRef.current.addLayer(drawnItemsRef.current);

      if (isHebrew) {
        L.drawLocal.draw.toolbar.actions.title = "בטל ציור";
        L.drawLocal.draw.toolbar.actions.text = "ביטול";
        L.drawLocal.draw.toolbar.finish.title = "סיים ציור";
        L.drawLocal.draw.toolbar.finish.text = "סיום";
        L.drawLocal.draw.toolbar.undo.title = "מחק נקודה אחרונה";
        L.drawLocal.draw.toolbar.undo.text = "מחק אחרון";
        L.drawLocal.draw.handlers.polygon.tooltip.start = "לחצו כדי להתחיל לצייר צורה";
        L.drawLocal.draw.handlers.polygon.tooltip.cont = "לחצו כדי להמשיך לצייר";
        L.drawLocal.draw.handlers.polygon.tooltip.end = "לחצו על הנקודה הראשונה כדי לסגור את הצורה";
        L.drawLocal.draw.handlers.polyline.tooltip.start = "לחצו כדי להתחיל לצייר קו";
        L.drawLocal.draw.handlers.polyline.tooltip.cont = "לחצו כדי להמשיך לצייר";
        L.drawLocal.draw.handlers.polyline.tooltip.end = "לחצו על הנקודה האחרונה כדי לסיים";
        L.drawLocal.draw.handlers.marker.tooltip.start = "לחצו על המפה כדי להוסיף נקודה";
        L.drawLocal.edit.toolbar.actions.save.title = "שמור שינויים";
        L.drawLocal.edit.toolbar.actions.save.text = "שמור";
        L.drawLocal.edit.toolbar.actions.cancel.title = "בטל שינויים";
        L.drawLocal.edit.toolbar.actions.cancel.text = "ביטול";
        L.drawLocal.edit.toolbar.actions.clearAll.title = "נקה הכל";
        L.drawLocal.edit.toolbar.actions.clearAll.text = "נקה הכל";
        L.drawLocal.edit.toolbar.buttons.edit = "ערוך שכבות";
        L.drawLocal.edit.toolbar.buttons.editDisabled = "אין שכבות לעריכה";
        L.drawLocal.edit.toolbar.buttons.remove = "מחק שכבות";
        L.drawLocal.edit.toolbar.buttons.removeDisabled = "אין שכבות למחיקה";
      }

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

      mapRef.current.on(L.Draw.Event.CREATED, (event) => {
        const createdEvent = event as DrawEvents.Created;
        const layer = createdEvent.layer;
        
        if (onShapeCreated && "toGeoJSON" in layer) {
          pendingLayersRef.current.add(layer);
          if (drawnItemsRef.current) {
            if (!drawnItemsRef.current.hasLayer(layer)) {
              drawnItemsRef.current.addLayer(layer);
            }
            updateFeatureCount();
          }
          
          onShapeCreated(layer, async (shapeName: string | null, description: string | null) => {
            if (shapeName || description) {
              if (drawnItemsRef.current && !drawnItemsRef.current.hasLayer(layer)) {
                drawnItemsRef.current.addLayer(layer);
              }
              const geojson = (layer as L.Polygon).toGeoJSON().geometry;
              const newFeature = await createGeometry(shapeName, description, geojson);
              if (newFeature) {
                layer.featureId = newFeature.id;
                const displayName = newFeature.name || (isHebrew ? "ללא שם" : "Unnamed");
                layer.bindTooltip(displayName);
              }
              pendingLayersRef.current.delete(layer);
            } else {
              if (drawnItemsRef.current) {
                drawnItemsRef.current.removeLayer(layer);
                updateFeatureCount();
              }
              pendingLayersRef.current.delete(layer);
            }
          });
        } else {
          drawnItemsRef.current?.addLayer(layer);
          updateFeatureCount();
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
        const pendingLayers = Array.from(pendingLayersRef.current);
        drawnItemsRef.current.clearLayers();
        pendingLayers.forEach(layer => {
          if (drawnItemsRef.current) {
            drawnItemsRef.current.addLayer(layer);
          }
        });
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
            const displayName = feature.name || (isHebrew ? "ללא שם" : "Unnamed");
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
  }, [center, enabled, isHebrew]);

  return { mapRef, drawControlRef, featureCount };
};
