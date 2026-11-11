import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/index.css";
import "@/demo/index.css";
import "./shell.css";
import { RaciDemo } from "@/demo/index";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("demo: #root element is missing from index.html");
}

// The whole demo is the packaged RaciDemo component; this page only mounts it.
createRoot(container).render(
  <StrictMode>
    <RaciDemo />
  </StrictMode>,
);
