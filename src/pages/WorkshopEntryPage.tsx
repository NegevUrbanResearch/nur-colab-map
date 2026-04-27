import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabase";
import {
  ensureMemorialSitesProjectForUser,
  ensureWorkshopPinkProjectForUser,
} from "../supabase/projects";

const WorkshopEntryPage = () => {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const bootstrapWorkshopUser = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          throw sessionError;
        }

        let session = data.session;

        if (!session) {
          const { data: anonymousData, error: anonymousError } =
            await supabase.auth.signInAnonymously();
          if (anonymousError) {
            throw anonymousError;
          }
          session = anonymousData.session;
        }

        if (!session?.user?.id) {
          throw new Error("Workshop session did not include a user");
        }

        await ensureMemorialSitesProjectForUser(session.user.id);
        await ensureWorkshopPinkProjectForUser(session.user.id);

        if (isMounted) {
          navigate("/map-page");
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const fallbackMessage =
          error instanceof Error ? error.message : "אירעה שגיאה לא צפויה";
        setErrorMessage(`לא הצלחנו להיכנס לסדנה: ${fallbackMessage}`);
      }
    };

    bootstrapWorkshopUser();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <main>
      <section className="main-container">
        <h1 className="header-text">טוען גישת סדנה...</h1>
        {errorMessage && <p>{errorMessage}</p>}
      </section>
    </main>
  );
};

export default WorkshopEntryPage;
