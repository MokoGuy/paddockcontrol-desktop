import React from "react";
import { createRoot } from "react-dom/client";
import { MotionGlobalConfig } from "motion/react";
import "@/index.css";
import App from "@/App";

// Allow Playwright to skip all motion animations for reproducible screenshots
if ("__SKIP_ANIMATIONS" in window) {
    MotionGlobalConfig.skipAnimations = true;
}

const container = document.getElementById("root");

const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
