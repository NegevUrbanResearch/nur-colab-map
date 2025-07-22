import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { useEffect, useState } from "react";
import { loadProjects } from "../supabase/projects";
import { Project } from "../supabase/projects";
import supabase from "../supabase";

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
        const data = await loadProjects();
        console.log("Loaded projects:", data);
        setProjects(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchProjects();
    }
  }, [session]);

  return (
    <main>
      {loading && <p>Loading projects...</p>}
      {error && <p>Error loading projects: {error}</p>}
      {!loading && !error && (
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              <button
                onClick={() => {
                  navigate(`/map-page?projectId=${project.id}`, {
                    // Pass the project data to the next page
                    state: { project: project },
                  });
                }}
              >
                {project.name}
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
    </main>
  );
};

export default ProjectsPage;
