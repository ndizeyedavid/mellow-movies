import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

function hideSplash() {
  const el = document.getElementById("loading");
  if (!el) return;
  el.classList.add("fade-out");
  setTimeout(() => el.remove(), 380);
}

// Remove splash as soon as React has painted the first frame
requestAnimationFrame(() => requestAnimationFrame(hideSplash));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
