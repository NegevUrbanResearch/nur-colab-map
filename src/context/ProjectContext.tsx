import { createContext, useContext, useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Project, loadProjectById } from "../supabase/projects";

const ProjectContext = createContext<{
  project: Project | null;
  projectId: string | null;
  isLoading: boolean;
}>({
  project: null,
  projectId: null,
  isLoading: true,
});

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
};

type Props = { children: React.ReactNode };
export const ProjectProvider = ({ children }: Props) => {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId");
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) {
        setProject(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await loadProjectById(projectId);
        setProject(data);
      } catch (error) {
        console.error("Failed to load project:", error);
        setProject(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  return (
    <ProjectContext.Provider value={{ project, projectId, isLoading }}>
      {children}
    </ProjectContext.Provider>
  );
};
