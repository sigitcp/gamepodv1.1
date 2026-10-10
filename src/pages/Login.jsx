import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  handleIncomingRedirect,
  getDefaultSession,
  login,
} from "@inrupt/solid-client-authn-browser";
import { getSolidDataset, getThing } from "@inrupt/solid-client";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [oidcIssuer, setOidcIssuer] = useState(
    "https://pods.solidcommunity.au/"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const session = getDefaultSession();

  useEffect(() => {
    async function checkSession() {
      try {
        await handleIncomingRedirect({
          url: window.location.href,
          restorePreviousSession: true,
        });

        console.log("===== SOLID AUTH DEBUG =====");
        console.log("Current URL:", window.location.href);
        console.log("Is logged in:", session.info.isLoggedIn);
        console.log("WebID:", session.info.webId);
        console.log("Session info:", session.info);
        console.log("============================");

        if (session.info.isLoggedIn) {
          // Check if user has already completed onboarding
          const webId = session.info.webId;
          const baseUrl = webId.split("/profile/")[0] + "/";
          const settingsUrl = `${baseUrl}public/game-rec-data/settings.ttl`;

          try {
            const dataset = await getSolidDataset(settingsUrl, {
              fetch: session.fetch,
            });
            const userThing = getThing(dataset, `${settingsUrl}#user-profile`);
            const redirectTo =
              location.state?.from?.pathname ||
              (userThing ? "/" : "/onboarding");

            if (userThing) {
              console.log(
                "✅ User already onboarded, redirecting to:",
                redirectTo
              );
            } else {
              console.log("🆕 New user, redirecting to:", redirectTo);
            }

            navigate(redirectTo, { replace: true });
          } catch (err) {
            // settings.ttl does not exist yet, meaning it's a new user
            const redirectTo = location.state?.from?.pathname || "/onboarding";
            console.log(
              "🆕 settings.ttl not found, redirecting to:",
              redirectTo
            );
            navigate(redirectTo, { replace: true });
          }
        }
      } catch (err) {
        console.error("Failed to process redirect:", err);
        setError("Failed to connect to Solid Pod. Please try again.");
      }
    }
    checkSession();
  }, [session, navigate, location]);
  const handleLogin = async e => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await login({
        oidcIssuer: oidcIssuer.trim(),
        redirectUrl: `${window.location.origin}/login`, // Return to this page after login
        clientName: "GamePod Recommendation",
      });
    } catch (err) {
      console.error("Login error:", err);
      setError(
        "An error occurred while redirecting to the Solid provider. Please ensure the provider URL is correct."
      );
      setIsLoading(false);
    }
  };

  return (
    <div
      className="container"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "80vh",
      }}>
      <div
        className="panel"
        style={{ maxWidth: "500px", width: "100%", textAlign: "center" }}>
        <h2 style={{ marginBottom: "10px" }}>🔐 Login to GamePod</h2>
        <p className="muted" style={{ marginBottom: "30px" }}>
          Your data is secure and entirely yours. Log in using your Solid WebID
          to get started.
        </p>

        <form
          onSubmit={handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div style={{ textAlign: "left" }}>
            <label
              htmlFor="oidcIssuer"
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
              }}>
              Your Solid Pod Provider URL
            </label>
            <input
              id="oidcIssuer"
              type="url"
              value={oidcIssuer}
              onChange={e => setOidcIssuer(e.target.value)}
              placeholder="https://pods.solidcommunity.au/"
              required
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #ccc",
              }}
            />
          </div>

          {error && (
            <div
              className="error"
              style={{
                padding: "10px",
                borderRadius: "6px",
                textAlign: "left",
              }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="primary-btn"
            disabled={isLoading}
            style={{ marginTop: "10px" }}>
            {isLoading ? "Redirecting to Provider..." : "Login with Solid Pod"}
          </button>
        </form>
      </div>
    </div>
  );
}
