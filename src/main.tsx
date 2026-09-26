import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { Account } from "./Account";
import { App, ConnectionError } from "./App";
import "./styles.css";

const root = document.getElementById("root");

if (root === null) throw new Error("Missing application root");

const convexUrl = import.meta.env.VITE_CONVEX_URL;

// Capture the return before Convex Auth consumes and removes the code from the URL.
const search = new URLSearchParams(window.location.search);

const signInReturn = search.has("code") || search.get("metodo") === "google";

let application = (
  <App>
    <ConnectionError />
  </App>
);

if (convexUrl) {
  const convex = new ConvexReactClient(convexUrl);
  application = (
    <ConvexAuthProvider client={convex}>
      <App>
        {["/cuenta", "/admin"].includes(window.location.pathname) ? (
          <Account
            administrator={window.location.pathname === "/admin"}
            signInReturn={signInReturn}
          />
        ) : undefined}
      </App>
    </ConvexAuthProvider>
  );
}

createRoot(root).render(<StrictMode>{application}</StrictMode>);
