import { Outlet } from "react-router-dom";
import { SessionProvider } from "./context/SessionContext";
import { ProjectProvider } from "./context/ProjectContext";

const Providers = () => {
  return (
    <SessionProvider>
      <ProjectProvider>
        <Outlet />
      </ProjectProvider>
    </SessionProvider>
  );
};

export default Providers;
