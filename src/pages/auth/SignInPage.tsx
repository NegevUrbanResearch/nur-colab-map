import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useSession } from "../../context/SessionContext";
import supabase from "../../supabase";

const SignInPage = () => {
  // ==============================
  // Hooks must be called before any conditional returns
  const { session } = useSession();
  const [status, setStatus] = useState("");
  const [formValues, setFormValues] = useState({
    email: "",
    password: "",
  });

  // If user is already logged in, redirect to protected page
  // This logic is being repeated in SignIn and SignUp..
  if (session) return <Navigate to="/map-page" />;
  // maybe we can create a wrapper component for these pages
  // just like the ./router/AuthProtectedRoute.tsx? up to you.
  // ==============================

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues({ ...formValues, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("Logging in...");
    const { error } = await supabase.auth.signInWithPassword({
      email: formValues.email,
      password: formValues.password,
    });
    if (error) {
      alert(error.message);
    }
    setStatus("");
  };
  return (
    <form className="user-form" onSubmit={handleSubmit}>
      <input
        name="email"
        onChange={handleInputChange}
        type="email"
        placeholder="Email"
      />
      <input
        name="password"
        onChange={handleInputChange}
        type="password"
        placeholder="Password"
      />
      <button type="submit">Login</button>
      {/* add this back if we allow new signups */}
      {/* <Link className="auth-link" to="/auth/sign-up">
          Don't have an account? Sign Up
        </Link> */}
      {status && <p>{status}</p>}
    </form>
  );
};

export default SignInPage;
