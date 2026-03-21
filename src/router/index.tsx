import { createBrowserRouter } from "react-router-dom";
import HomePage from "../pages/HomePage.tsx";
import ProjectsPage from "../pages/ProjectsPage.tsx";
import SignInPage from "../pages/auth/SignInPage.tsx";
import SignUpPage from "../pages/auth/SignUpPage.tsx";
import MapPage from "../pages/MapPage/index.tsx";
import NotFoundPage from "../pages/404Page.tsx";
import AuthProtectedRoute from "./AuthProtectedRoute.tsx";
import Providers from "../Providers.tsx";

const router = createBrowserRouter(
  [
    // I recommend you reflect the routes here in the pages folder
    {
      path: "/",
      element: <Providers />,
      children: [
        // Public routes
        {
          path: "/",
          element: <HomePage />,
        },
        {
          path: "/auth/sign-in",
          element: <SignInPage />,
        },
        {
          path: "/auth/sign-up",
          element: <SignUpPage />,
        },
        // Auth Protected routes
        {
          path: "/",
          element: <AuthProtectedRoute />,
          children: [
            {
              path: "/projects-page",
              element: <ProjectsPage />,
            },

            {
              path: "/map-page",
              element: <MapPage />,
            },
          ],
        },
      ],
    },
    {
      path: "*",
      element: <NotFoundPage />,
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  }
);

export default router;
