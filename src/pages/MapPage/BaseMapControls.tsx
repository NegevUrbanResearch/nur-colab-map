import { useNavigate } from "react-router-dom";
import supabase from "../../supabase";
import L from "leaflet";

interface BaseMapControlsProps {
  mapRef: React.MutableRefObject<L.Map | null>;
  drawControlRef: React.MutableRefObject<L.Control.Draw | null>;
  featureCount: number;
}

const BaseMapControls = ({ mapRef, drawControlRef, featureCount }: BaseMapControlsProps) => {
  const navigate = useNavigate();

  const disableAllModes = () => {
    if (!mapRef.current || !drawControlRef.current) return;
    
    const drawControl = drawControlRef.current;
    const drawToolbar = (drawControl as any)._toolbars?.draw;
    const editToolbar = (drawControl as any)._toolbars?.edit;
    
    if (drawToolbar && drawToolbar._modes) {
      Object.values(drawToolbar._modes).forEach((mode: any) => {
        if (mode.handler && mode.handler.enabled()) {
          mode.handler.disable();
        }
      });
    }
    
    if (editToolbar && editToolbar._modes) {
      Object.values(editToolbar._modes).forEach((mode: any) => {
        if (mode.handler && mode.handler.enabled()) {
          mode.handler.disable();
        }
      });
    }
  };

  const handleDrawTool = (tool: "polygon" | "polyline" | "marker") => {
    if (!mapRef.current || !drawControlRef.current) return;
    
    disableAllModes();
    
    const drawControl = drawControlRef.current;
    const toolbar = (drawControl as any)._toolbars?.draw;
    
    if (toolbar && toolbar._modes) {
      if (tool === "polygon" && toolbar._modes.polygon) {
        toolbar._modes.polygon.handler.enable();
      } else if (tool === "polyline" && toolbar._modes.polyline) {
        toolbar._modes.polyline.handler.enable();
      } else if (tool === "marker" && toolbar._modes.marker) {
        toolbar._modes.marker.handler.enable();
      }
    }
  };

  const handleEditMode = () => {
    if (!mapRef.current || !drawControlRef.current) return;
    
    disableAllModes();
    
    const drawControl = drawControlRef.current;
    const toolbar = (drawControl as any)._toolbars?.edit;
    
    if (toolbar && toolbar._modes && toolbar._modes.edit) {
      toolbar._modes.edit.handler.enable();
    }
  };

  const handleDeleteMode = () => {
    if (!mapRef.current || !drawControlRef.current) return;
    
    disableAllModes();
    
    const drawControl = drawControlRef.current;
    const toolbar = (drawControl as any)._toolbars?.edit;
    
    if (toolbar && toolbar._modes && toolbar._modes.remove) {
      toolbar._modes.remove.handler.enable();
    }
  };

  const handleHome = () => {
    navigate("/projects-page");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="base-map-controls">
      <button
        className="base-map-control-btn"
        onClick={() => handleDrawTool("polygon")}
        title="Polygon"
      >
        ⬟
      </button>
      <button
        className="base-map-control-btn"
        onClick={() => handleDrawTool("polyline")}
        title="Line"
      >
        ╱
      </button>
      <button
        className="base-map-control-btn"
        onClick={() => handleDrawTool("marker")}
        title="Point"
      >
        +
      </button>
      <button
        className="base-map-control-btn"
        onClick={handleEditMode}
        title="Edit"
      >
        ✏
      </button>
      <button
        className="base-map-control-btn"
        onClick={handleDeleteMode}
        title="Delete"
      >
        ×
      </button>
      <div className="base-map-controls-divider"></div>
      <button
        className="base-map-control-btn"
        onClick={handleHome}
        title="Projects"
      >
        ⌂
      </button>
      <button
        className="base-map-control-btn"
        onClick={handleSignOut}
        title="Sign Out"
      >
        ⏻
      </button>
    </div>
  );
};

export default BaseMapControls;
