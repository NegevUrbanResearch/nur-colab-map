import { useEffect } from "react";
import { useSession } from "../context/SessionContext";
import SignInPage from "./auth/SignInPage";
import ProjectsPage from "./ProjectsPage";
import bg from "../assests/mh-bg.jpeg";
import nurLogo from "../assests/nur-logo.png";

const HomePage = () => {
  const { session } = useSession();

  // print current user email on initial load
  useEffect(() => {
    console.log("Current User:", session || "None");
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
          {!session ? <SignInPage /> : <ProjectsPage />}
        </section>
      </main>
    </div>
  );
};

export default HomePage;
