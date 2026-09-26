import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { App, ConnectionError } from "./App";
import "./styles.css";

const root = document.getElementById("root");

if (root === null) throw new Error("Missing application root");

const convexUrl = import.meta.env.VITE_CONVEX_URL;

let application = (
  <App>
    <ConnectionError />
  </App>
);

if (convexUrl) {
  const convex = new ConvexReactClient(convexUrl);
  application = (
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  );
}

createRoot(root).render(<StrictMode>{application}</StrictMode>);
