import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useProject } from "../../context/ProjectContext";
import {
  batchCreateMemorialSites,
  PendingSite,
  MemorialFeatureType,
} from "../../supabase/memorialSites";
import supabase from "../../supabase";
import MemorialSiteForm from "./MemorialSiteForm";
import localMemorialIconUrl from "../../assets/memorial-sites/local-memorial-site.png";
import regionalMemorialIconUrl from "../../assets/memorial-sites/regional-memorial-site.png";

const NAME_CENTRAL = "מה שם האתר?";
const WHY_CENTRAL = "למה לדעתך אנדרטה מרכזית אזורית צריכה להיות כאן?";
const NAME_LOCAL = "מה שם האתר?";
const WHY_LOCAL = "למה צריכה להיות כאן אנדרטה?";

const MemorialSitesMapPage = () => {
  const { project } = useProject();
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  const [centralSite, setCentralSite] = useState<PendingSite | null>(null);
  const [localSites, setLocalSites] = useState<PendingSite[]>([]);
  const [formTarget, setFormTarget] = useState<{
    lat: number;
    lng: number;
    type: MemorialFeatureType;
  } | null>(null);
  const [activeType, setActiveType] = useState<MemorialFeatureType>("local");
  const [showInfo, setShowInfo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ central: number; local: number } | null>(null);

  const activeTypeRef = useRef<MemorialFeatureType>("local");
  const dragTypeRef = useRef<MemorialFeatureType | null>(null);

  useEffect(() => {
    activeTypeRef.current = activeType;
  }, [activeType]);

  // Initialize map once
  useEffect(() => {
    if (!project) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;
    if ((mapContainer as any)._leaflet_id) delete (mapContainer as any)._leaflet_id;
    mapContainer.innerHTML = "";

    mapRef.current = L.map("map", { zoomControl: false }).setView([31.42, 34.49], 13);
    L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg", {
      maxZoom: 19,
    }).addTo(mapRef.current);

    L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);

    mapRef.current.on("click", (e: L.LeafletMouseEvent) => {
      setFormTarget({ lat: e.latlng.lat, lng: e.latlng.lng, type: activeTypeRef.current });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
    };
  }, [project]);

  // Sync markers with local state
  const syncMarkers = useCallback(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    const placeSite = (site: PendingSite, isCentral: boolean) => {
      const icon = L.icon({
        iconUrl: isCentral ? regionalMemorialIconUrl : localMemorialIconUrl,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20],
      });
      const marker = L.marker([site.lat, site.lng], { icon }).addTo(mapRef.current!);
      marker.on("click", () => {
        if (confirm(isCentral ? "למחוק אנדרטה מרכזית?" : "למחוק אנדרטה מקומית?")) {
          if (isCentral) setCentralSite(null);
          else setLocalSites((prev) => prev.filter((s) => s.tempId !== site.tempId));
        }
      });
      markersRef.current.set(site.tempId, marker);
    };

    if (centralSite) placeSite(centralSite, true);
    localSites.forEach((s) => placeSite(s, false));
  }, [centralSite, localSites]);

  useEffect(() => {
    syncMarkers();
  }, [syncMarkers]);

  // Form completed — add site to local state
  const handleFormSubmit = (name: string, description: string) => {
    if (!formTarget) return;
    const site: PendingSite = {
      tempId: crypto.randomUUID(),
      name: name || null,
      description: description || null,
      lat: formTarget.lat,
      lng: formTarget.lng,
      feature_type: formTarget.type,
    };
    if (formTarget.type === "central") setCentralSite(site);
    else setLocalSites((prev) => [...prev, site]);
    setFormTarget(null);
  };

  // Clear all — local only
  const handleClearAll = () => {
    if ((centralSite || localSites.length > 0) && !confirm("למחוק את כל הסימונים?")) return;
    setCentralSite(null);
    setLocalSites([]);
  };

  // Submit — batch save to Supabase, then reset
  const handleSubmit = async () => {
    if (!project) return;
    const all: PendingSite[] = [];
    if (centralSite) all.push(centralSite);
    all.push(...localSites);
    if (all.length === 0) {
      alert("לא סומנו אתרים. סמנו לפחות אתר אחד לפני הגשה.");
      return;
    }
    setSubmitting(true);
    try {
      await batchCreateMemorialSites(project.id, all);
      const counts = { central: centralSite ? 1 : 0, local: localSites.length };
      setCentralSite(null);
      setLocalSites([]);
      setSubmitted(counts);
      setTimeout(() => setSubmitted(null), 2000);
    } catch (err) {
      alert("שגיאה בשמירת הנתונים. נסו שוב.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDragStart = (type: MemorialFeatureType) => (e: React.DragEvent) => {
    dragTypeRef.current = type;
    setActiveType(type);
    e.dataTransfer.effectAllowed = "copy";
    const img = e.currentTarget.querySelector("img");
    if (img) e.dataTransfer.setDragImage(img, 20, 20);
  };

  const handleMapDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!mapRef.current || !dragTypeRef.current) return;
    const rect = (e.target as HTMLElement).closest("#map")?.getBoundingClientRect();
    if (!rect) return;
    const point = L.point(e.clientX - rect.left, e.clientY - rect.top);
    const latlng = mapRef.current.containerPointToLatLng(point);
    setFormTarget({ lat: latlng.lat, lng: latlng.lng, type: dragTypeRef.current });
    dragTypeRef.current = null;
  };

  const handleMapDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleSelectType = (type: MemorialFeatureType) => {
    if (type === "central" && centralSite) {
      if (!confirm("כבר יש אנדרטה מרכזית. להחליף?")) return;
    }
    setActiveType(type);
  };

  return (
    <>
      <div
        key={project?.id ?? "no-project"}
        id="map"
        style={{ height: "100vh", width: "100%" }}
        onDrop={handleMapDrop}
        onDragOver={handleMapDragOver}
      />

      {formTarget && (
        <MemorialSiteForm
          nameQuestion={formTarget.type === "central" ? NAME_CENTRAL : NAME_LOCAL}
          descriptionQuestion={formTarget.type === "central" ? WHY_CENTRAL : WHY_LOCAL}
          onSubmit={handleFormSubmit}
          onCancel={() => setFormTarget(null)}
        />
      )}

      {/* Left control panel — nav only */}
      <div className="base-map-controls memorial-nav-controls">
        <button
          className="base-map-control-btn"
          onClick={() => navigate("/projects-page")}
          title="דף הבית"
        >
          ⌂
        </button>
        <button
          className="base-map-control-btn"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate("/");
          }}
          title="התנתק"
        >
          ⏻
        </button>
      </div>

      {/* Top toolbar */}
      <div className="memorial-toolbar" dir="rtl">
        <button
          type="button"
          className={`memorial-toolbar-section ${activeType === "central" ? "memorial-toolbar-active" : ""}`}
          onClick={() => handleSelectType("central")}
        >
          <div
            className="memorial-toolbar-drag-item"
            draggable
            onDragStart={handleDragStart("central")}
          >
            <img src={regionalMemorialIconUrl} alt="" className="memorial-toolbar-icon" />
          </div>
          <div className="memorial-toolbar-item-text">
            <span className="memorial-toolbar-item-label">אנדרטה מרכזית אזורית</span>
            <span className="memorial-toolbar-item-value">
              {centralSite ? centralSite.name || "—" : "ניתן לבחור אחת בלבד"}
            </span>
          </div>
        </button>

        <div className="memorial-toolbar-divider" />

        <button
          type="button"
          className={`memorial-toolbar-section ${activeType === "local" ? "memorial-toolbar-active" : ""}`}
          onClick={() => handleSelectType("local")}
        >
          <div
            className="memorial-toolbar-drag-item"
            draggable
            onDragStart={handleDragStart("local")}
          >
            <img src={localMemorialIconUrl} alt="" className="memorial-toolbar-icon" />
          </div>
          <div className="memorial-toolbar-item-text">
            <span className="memorial-toolbar-item-label">אנדרטות מקומיות ({localSites.length})</span>
            <span className="memorial-toolbar-item-value">
              גרור למפה או לחץ להוספה
            </span>
          </div>
        </button>

        <div className="memorial-toolbar-divider" />

        <div className="memorial-toolbar-actions">
          <button
            type="button"
            className="memorial-toolbar-text-btn"
            onClick={() => setShowInfo(true)}
          >
            ?
          </button>
          <button
            type="button"
            className="memorial-toolbar-text-btn memorial-toolbar-text-btn-danger"
            onClick={handleClearAll}
          >
            נקה הכל
          </button>
          <button
            type="button"
            className="memorial-toolbar-text-btn memorial-toolbar-text-btn-submit"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "..." : "להגיש"}
          </button>
        </div>
      </div>

      {/* Submitted confirmation toast */}
      {submitted && (
        <div className="memorial-submitted-toast" dir="rtl">
          <span className="memorial-submitted-check">&#10003;</span>
          <span className="memorial-submitted-text">הוגש בהצלחה</span>
          <span className="memorial-submitted-detail">
            {submitted.central} מרכזית, {submitted.local} מקומיות
          </span>
        </div>
      )}

      {/* Info overlay */}
      {showInfo && (
        <div className="memorial-info-overlay" onClick={() => setShowInfo(false)}>
          <div className="memorial-info-panel" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="memorial-info-header">
              <span className="memorial-info-title">אתרי הנצחה — מדריך</span>
              <button
                type="button"
                className="memorial-info-close"
                onClick={() => setShowInfo(false)}
              >
                ×
              </button>
            </div>
            <div className="memorial-info-body">
              <div className="memorial-info-row">
                <img src={regionalMemorialIconUrl} alt="" className="memorial-info-icon" />
                <div>
                  <strong>אנדרטה מרכזית אזורית</strong>
                  <p>
                    אתר הנצחה משותף לכל הישובים באזור. מיקום משמעותי שמייצג את
                    הזיכרון הקולקטיבי של כל הקהילות. ניתן לבחור
                    <strong> אחת בלבד</strong> — בחירה חדשה תחליף את הקודמת.
                  </p>
                </div>
              </div>
              <div className="memorial-info-row">
                <img src={localMemorialIconUrl} alt="" className="memorial-info-icon" />
                <div>
                  <strong>אנדרטות מקומיות</strong>
                  <p>
                    אתרי הנצחה בתוך הישוב או בסביבתו הקרובה. מקומות בעלי
                    משמעות אישית וקהילתית. ניתן להוסיף כמה שרוצים.
                  </p>
                </div>
              </div>
              <div className="memorial-info-row">
                <div className="memorial-info-icon-placeholder">?</div>
                <div>
                  <strong>איך להוסיף?</strong>
                  <p>
                    בחרו סוג אנדרטה בסרגל למעלה (הסוג הפעיל מסומן בזוהר),
                    ואז לחצו על המפה במיקום הרצוי. אפשר גם לגרור את הסמל
                    ישירות אל המפה. לחיצה על סמן קיים תאפשר למחוק אותו.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MemorialSitesMapPage;
