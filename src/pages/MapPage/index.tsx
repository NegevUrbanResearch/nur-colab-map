import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PinkLineNodeForm from "./PinkLineNodeForm";
import MemorialSiteForm from "./MemorialSiteForm";
import localMemorialIconUrl from "../../assets/memorial-sites/local-memorial-site.png";
import regionalMemorialIconUrl from "../../assets/memorial-sites/regional-memorial-site.png";
import { optimizeRoute } from "../../utils/routeOptimizer";
import { buildIntegratedRoute, parseDefaultLinePaths } from "../../utils/pinkLineRoute";
import { ensureMemorialSitesProjectForUser, loadProjects } from "../../supabase/projects";
import { PendingSite } from "../../supabase/memorialSites";
import { submitUnifiedFeatures } from "../../supabase/unifiedSubmission";
import supabase from "../../supabase";

const MEMORIAL_PROJECT_ID = "33333333-3333-3333-3333-333333333333";
const APP_BASE_URL = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
const DEFAULT_PINK_LINE_URL = `${APP_BASE_URL}line-layer/pink-line-wgs84.geojson`;
const FAVICON_URL = `${APP_BASE_URL}favicon.ico`;

type ActiveProject = "pink" | "memorial";
type SubmitScope = "pink" | "memorial" | "everything";

interface PendingPinkNode {
  tempId: string;
  name: string | null;
  description: string | null;
  lat: number;
  lng: number;
}

const MapPage = () => {
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLayersRef = useRef<L.Polyline[]>([]);
  const activeProjectRef = useRef<ActiveProject>("pink");
  const activeMemorialTypeRef = useRef<"central" | "local">("local");

  const [activeProject, setActiveProject] = useState<ActiveProject>("pink");
  const [activeMemorialType, setActiveMemorialType] = useState<"central" | "local">("local");

  const [pinkProjectId, setPinkProjectId] = useState<string | null>(null);
  const [memorialProjectId, setMemorialProjectId] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  const [pendingPinkTarget, setPendingPinkTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingMemorialTarget, setPendingMemorialTarget] = useState<{
    lat: number;
    lng: number;
    type: "central" | "local";
  } | null>(null);

  const [pinkNodes, setPinkNodes] = useState<PendingPinkNode[]>([]);
  const [centralSite, setCentralSite] = useState<PendingSite | null>(null);
  const [localSites, setLocalSites] = useState<PendingSite[]>([]);

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitScope, setSubmitScope] = useState<SubmitScope>("everything");
  const [submitting, setSubmitting] = useState(false);
  const [submittedSummary, setSubmittedSummary] = useState<string | null>(null);
  const [defaultLineLoaded, setDefaultLineLoaded] = useState(false);

  const defaultLinePathsRef = useRef<[number, number][][]>([]);

  useEffect(() => {
    activeProjectRef.current = activeProject;
  }, [activeProject]);

  useEffect(() => {
    activeMemorialTypeRef.current = activeMemorialType;
  }, [activeMemorialType]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setIsBootstrapping(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          navigate("/");
          return;
        }

        await ensureMemorialSitesProjectForUser(user.id);
        const projects = await loadProjects();

        const pinkProject = projects.find((p) => p.name.toLowerCase().includes("pink"));
        const memorialProject = projects.find((p) => p.id === MEMORIAL_PROJECT_ID);

        setPinkProjectId(pinkProject?.id ?? null);
        setMemorialProjectId(memorialProject?.id ?? null);

        if (!pinkProject) {
          setBootError("Pink Line project is not available for your user.");
        }
      } catch (error) {
        console.error("Failed to bootstrap unified map:", error);
        setBootError("Failed to initialize the unified workspace.");
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrap();
  }, [navigate]);

  useEffect(() => {
    if (isBootstrapping || bootError) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    routeLayersRef.current = [];

    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;
    if ((mapContainer as any)._leaflet_id) delete (mapContainer as any)._leaflet_id;
    mapContainer.innerHTML = "";

    mapRef.current = L.map("map", { zoomControl: false }).setView([31.42, 34.49], 13);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri",
    }).addTo(mapRef.current);
    L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);

    mapRef.current.on("click", (e: L.LeafletMouseEvent) => {
      if (activeProjectRef.current === "pink") {
        setPendingPinkTarget({ lat: e.latlng.lat, lng: e.latlng.lng });
        return;
      }
      setPendingMemorialTarget({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        type: activeMemorialTypeRef.current,
      });
    });

    fetch(DEFAULT_PINK_LINE_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch pink line GeoJSON (${res.status})`);
        return res.json();
      })
      .then((geojson: GeoJSON.FeatureCollection) => {
        defaultLinePathsRef.current = parseDefaultLinePaths(geojson);
        setDefaultLineLoaded(true);
      })
      .catch((err) => console.error("Failed to load default pink line:", err));

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      routeLayersRef.current = [];
    };
  }, [isBootstrapping, bootError]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    routeLayersRef.current.forEach((layer) => {
      try {
        map.removeLayer(layer);
      } catch (_) {
        // no-op
      }
    });
    routeLayersRef.current = [];

    if (defaultLineLoaded && defaultLinePathsRef.current.length > 0) {
      const userPoints = pinkNodes.map((n) => [n.lat, n.lng] as [number, number]);
      const { solid, dashed } = buildIntegratedRoute(defaultLinePathsRef.current, userPoints);
      const solidStyle: L.PolylineOptions = { color: "#FF69B4", weight: 5, opacity: 0.9 };
      const dashedStyle: L.PolylineOptions = {
        color: "#FF69B4",
        weight: 5,
        opacity: 0.9,
        dashArray: "10, 10",
      };

      for (const points of solid) {
        routeLayersRef.current.push(L.polyline(points as L.LatLngExpression[], solidStyle).addTo(map));
      }
      for (const points of dashed) {
        routeLayersRef.current.push(L.polyline(points as L.LatLngExpression[], dashedStyle).addTo(map));
      }
    }

    if (pinkNodes.length > 0) {
      const optimized = pinkNodes.length > 1
        ? optimizeRoute(
            pinkNodes.map((n) => ({
              id: n.tempId,
              lat: n.lat,
              lng: n.lng,
            }))
          )
        : pinkNodes.map((n) => ({ id: n.tempId, lat: n.lat, lng: n.lng }));
      const nodeOrder = new Map(optimized.map((n, index) => [n.id, index + 1]));

      pinkNodes.forEach((node) => {
        const marker = L.marker([node.lat, node.lng], {
          icon: L.divIcon({
            className: "pink-line-node-marker",
            html: `<div class="pink-line-node">${nodeOrder.get(node.tempId) || 1}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
        }).addTo(map);

        marker.on("click", () => {
          if (confirm("Remove this pink line point?")) {
            setPinkNodes((prev) => prev.filter((n) => n.tempId !== node.tempId));
          }
        });

        markersRef.current.set(node.tempId, marker);
      });
    }

    const placeMemorial = (site: PendingSite, isCentral: boolean) => {
      const icon = L.icon({
        iconUrl: isCentral ? regionalMemorialIconUrl : localMemorialIconUrl,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20],
      });
      const marker = L.marker([site.lat, site.lng], { icon }).addTo(map);
      marker.on("click", () => {
        if (confirm(isCentral ? "למחוק אנדרטה מרכזית?" : "למחוק אנדרטה מקומית?")) {
          if (isCentral) {
            setCentralSite(null);
          } else {
            setLocalSites((prev) => prev.filter((s) => s.tempId !== site.tempId));
          }
        }
      });
      markersRef.current.set(site.tempId, marker);
    };

    if (centralSite) placeMemorial(centralSite, true);
    localSites.forEach((site) => placeMemorial(site, false));
  }, [pinkNodes, centralSite, localSites, defaultLineLoaded]);

  const hasPink = pinkNodes.length > 0;
  const hasMemorial = useMemo(() => Boolean(centralSite) || localSites.length > 0, [centralSite, localSites.length]);

  useEffect(() => {
    if (!showSubmitModal) return;
    if (hasPink && hasMemorial) {
      setSubmitScope("everything");
    } else if (hasPink) {
      setSubmitScope("pink");
    } else if (hasMemorial) {
      setSubmitScope("memorial");
    }
  }, [showSubmitModal, hasPink, hasMemorial]);

  const closeAllForms = () => {
    setPendingPinkTarget(null);
    setPendingMemorialTarget(null);
  };
  const isEntryModalOpen = Boolean(pendingPinkTarget || pendingMemorialTarget);

  const handleClearPink = () => {
    if (pinkNodes.length === 0) return;
    if (!confirm("למחוק את כל נקודות הקו הוורוד?")) return;
    setPinkNodes([]);
  };

  const handleClearMemorial = () => {
    const hasAnyMemorial = Boolean(centralSite) || localSites.length > 0;
    if (!hasAnyMemorial) return;
    if (!confirm("למחוק את כל אתרי ההנצחה שסומנו?")) return;
    setCentralSite(null);
    setLocalSites([]);
  };

  const submitSelection = async () => {
    const includePink = submitScope === "pink" || submitScope === "everything";
    const includeMemorial = submitScope === "memorial" || submitScope === "everything";
    if (!includePink && !includeMemorial) return;

    setSubmitting(true);
    try {
      const submissionId = crypto.randomUUID();
      const memorialRows = [...(centralSite ? [centralSite] : []), ...localSites];

      await submitUnifiedFeatures({
        submissionId,
        pinkProjectId,
        memorialProjectId,
        includePink,
        includeMemorial,
        pinkNodes,
        memorialSites: memorialRows,
      });

      if (includePink) setPinkNodes([]);
      if (includeMemorial) {
        setCentralSite(null);
        setLocalSites([]);
      }

      setShowSubmitModal(false);
      const submittedParts = [
        includePink ? `${pinkNodes.length} pink points` : null,
        includeMemorial ? `${memorialRows.length} memorial sites` : null,
      ]
        .filter(Boolean)
        .join(" + ");
      setSubmittedSummary(`Submitted ${submittedParts} (submission id: ${submissionId.slice(0, 8)}...)`);
      window.setTimeout(() => setSubmittedSummary(null), 3000);
    } catch (error) {
      console.error("Failed to submit unified features:", error);
      alert("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isBootstrapping) {
    return (
      <div className="main-page-loader" role="status" aria-live="polite" aria-label="Loading map workspace">
        <div className="main-page-loader-panel">
          <div className="main-page-loader-orbit" aria-hidden="true">
              <span className="main-page-loader-core">
                <img src={FAVICON_URL} alt="" className="main-page-loader-logo" />
              </span>
          </div>
          <h1 className="main-page-loader-title">טוען את סביבת המפה</h1>
          <p className="main-page-loader-subtitle">מכין את שכבות הנתונים והכלים שלך...</p>
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div style={{ padding: "24px" }}>
        <p>{bootError}</p>
        <button onClick={() => navigate("/")}>Go back</button>
      </div>
    );
  }

  return (
    <>
      <div id="map" style={{ height: "100vh", width: "100%" }} />

      {pendingPinkTarget && (
        <PinkLineNodeForm
          onSubmit={(name, description) => {
            setPinkNodes((prev) => [
              ...prev,
              {
                tempId: crypto.randomUUID(),
                name: name || null,
                description: description || null,
                lat: pendingPinkTarget.lat,
                lng: pendingPinkTarget.lng,
              },
            ]);
            setPendingPinkTarget(null);
          }}
          onCancel={() => setPendingPinkTarget(null)}
        />
      )}

      {pendingMemorialTarget && (
        <MemorialSiteForm
          nameQuestion={pendingMemorialTarget.type === "central" ? "מה שם האתר?" : "מה שם האתר?"}
          descriptionQuestion={
            pendingMemorialTarget.type === "central"
              ? "למה לדעתך אנדרטה מרכזית אזורית צריכה להיות כאן?"
              : "למה צריכה להיות כאן אנדרטה?"
          }
          onSubmit={(name, description) => {
            const site: PendingSite = {
              tempId: crypto.randomUUID(),
              name: name || null,
              description: description || null,
              lat: pendingMemorialTarget.lat,
              lng: pendingMemorialTarget.lng,
              feature_type: pendingMemorialTarget.type,
            };
            if (pendingMemorialTarget.type === "central") {
              setCentralSite(site);
            } else {
              setLocalSites((prev) => [...prev, site]);
            }
            setPendingMemorialTarget(null);
          }}
          onCancel={() => setPendingMemorialTarget(null)}
        />
      )}

      {activeProject === "pink" && !isEntryModalOpen && (
        <div className="pink-toolbar" dir="rtl">
          <div className="pink-toolbar-meta">
            <span className="pink-toolbar-title">לחץ על המפה כדי להוסיף נקודות</span>
            <span className="pink-toolbar-count">{pinkNodes.length} נקודות</span>
          </div>
          <div className="pink-toolbar-actions">
            <button
              type="button"
              onClick={() => {
                if (!hasPink && !hasMemorial) return;
                setShowSubmitModal(true);
              }}
              className={`pink-toolbar-action pink-toolbar-action-primary ${!hasPink && !hasMemorial ? "toolbar-action-blocked" : ""}`}
            >
              הגשה
            </button>
            <button
              type="button"
              onClick={handleClearPink}
              className={`pink-toolbar-action pink-toolbar-action-secondary ${pinkNodes.length === 0 ? "toolbar-action-blocked" : ""}`}
            >
              נקה הכל
            </button>
          </div>
        </div>
      )}

      {activeProject === "memorial" && !isEntryModalOpen && (
        <div className="memorial-toolbar" dir="rtl">
          <button
            type="button"
            className={`memorial-toolbar-section ${activeMemorialType === "central" ? "memorial-toolbar-active" : ""}`}
            onClick={() => setActiveMemorialType("central")}
          >
            <div className="memorial-toolbar-drag-item">
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
            className={`memorial-toolbar-section ${activeMemorialType === "local" ? "memorial-toolbar-active" : ""}`}
            onClick={() => setActiveMemorialType("local")}
          >
            <div className="memorial-toolbar-drag-item">
              <img src={localMemorialIconUrl} alt="" className="memorial-toolbar-icon" />
            </div>
            <div className="memorial-toolbar-item-text">
              <span className="memorial-toolbar-item-label">אנדרטות מקומיות ({localSites.length})</span>
              <span className="memorial-toolbar-item-value">לחצו על המפה להוספה</span>
            </div>
          </button>

          <div className="memorial-toolbar-divider" />

          <div className="memorial-toolbar-actions">
            <button
              type="button"
              className={`memorial-toolbar-text-btn memorial-toolbar-text-btn-danger ${!hasMemorial ? "toolbar-action-blocked" : ""}`}
              onClick={handleClearMemorial}
            >
              נקה הכל
            </button>
            <button
              type="button"
              className={`memorial-toolbar-text-btn memorial-toolbar-text-btn-submit ${!hasPink && !hasMemorial ? "toolbar-action-blocked" : ""}`}
              onClick={() => {
                if (!hasPink && !hasMemorial) return;
                setShowSubmitModal(true);
              }}
            >
              הגשה
            </button>
          </div>
        </div>
      )}

      <div className="base-map-controls">
        <button
          className={`base-map-control-btn project-switch-btn ${activeProject === "pink" ? "project-switch-btn-active" : ""}`}
          onClick={() => {
            closeAllForms();
            setActiveProject("pink");
          }}
          title="קו ורוד"
        >
          קו ורוד
        </button>
        <button
          className={`base-map-control-btn project-switch-btn ${activeProject === "memorial" ? "project-switch-btn-active" : ""}`}
          onClick={() => {
            closeAllForms();
            setActiveProject("memorial");
          }}
          title="אתרי הנצחה"
        >
          אתרי הנצחה
        </button>
        <div className="base-map-controls-divider"></div>
        <button
          className="base-map-control-btn project-signout-btn"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate("/");
          }}
          title="התנתק"
        >
          ⏻
        </button>
      </div>

      {submittedSummary && <div className="unified-map-toast">{submittedSummary}</div>}

      {showSubmitModal && (
        <div className="unified-submit-overlay" onClick={() => setShowSubmitModal(false)}>
          <div className="unified-submit-modal" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3>מה לשלוח?</h3>
            <label className="unified-submit-option">
              <input
                type="radio"
                name="submit-scope"
                value="pink"
                checked={submitScope === "pink"}
                disabled={!hasPink}
                onChange={() => setSubmitScope("pink")}
              />
              <span>רק קו ורוד ({pinkNodes.length})</span>
            </label>
            <label className="unified-submit-option">
              <input
                type="radio"
                name="submit-scope"
                value="memorial"
                checked={submitScope === "memorial"}
                disabled={!hasMemorial}
                onChange={() => setSubmitScope("memorial")}
              />
              <span>רק אתרי הנצחה ({(centralSite ? 1 : 0) + localSites.length})</span>
            </label>
            <label className="unified-submit-option">
              <input
                type="radio"
                name="submit-scope"
                value="everything"
                checked={submitScope === "everything"}
                disabled={!hasPink || !hasMemorial}
                onChange={() => setSubmitScope("everything")}
              />
              <span>הכל ביחד (אותו submission id)</span>
            </label>

            <div className="unified-submit-actions">
              <button
                type="button"
                className="unified-submit-action"
                onClick={() => setShowSubmitModal(false)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="unified-submit-action unified-submit-action-primary"
                disabled={submitting}
                onClick={submitSelection}
              >
                {submitting ? "שולח..." : "שליחה"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MapPage;
