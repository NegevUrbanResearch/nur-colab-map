import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import SignInPage from "./auth/SignInPage";
import bg from "../assests/mh-bg.jpeg";
import nurLogo from "../assests/nur-logo.png";

const HomePage = () => {
  const { session } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    console.log("Current User:", session || "None");
    if (session) {
      navigate("/projects-page");
    }
  }, [session, navigate]);

  if (session) {
    return null;
  }

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
          <SignInPage />
        </section>
      </main>
    </div>
  );
};

export default HomePage;
