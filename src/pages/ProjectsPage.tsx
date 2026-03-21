import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { useEffect, useState } from "react";
import { loadProjects, ensureMemorialSitesProjectForUser, Project } from "../supabase/projects";
import supabase from "../supabase";
import bg from "../assests/mh-bg.jpeg";
import nurLogo from "../assests/nur-logo.png";

const ProjectsPage = () => {
  const { session } = useSession();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await ensureMemorialSitesProjectForUser(user.id);
        }
        const data = await loadProjects();
        setProjects(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load projects");
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchProjects();
    }
  }, [session]);

  return (
    <div
      style={{
        backgroundImage: `url(${bg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <main>
        <section className="main-container">
          <img src={nurLogo} alt="Nur Logo" className="nur-logo" />
          {loading && <p>Loading projects...</p>}
          {error && <p>Error loading projects: {error}</p>}
          {!loading && !error && (
            <ul>
              {projects.map((project) => (
                <li key={project.id}>
                  <button
                    onClick={() => {
                      navigate(`/map-page?projectId=${project.id}`, {
                        state: { project: project },
                      });
                    }}
                  >
                    {project.name
                      .split(/[-_]/)
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ")}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/");
            }}
          >
            Sign Out
          </button>
        </section>
      </main>
    </div>
  );
};

export default ProjectsPage;
