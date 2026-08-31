import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@/index.css";
import App from "@/App";
import { ThemeProvider } from "@/contexts/ThemeContext";

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    // Force a byte-for-byte check against sw.js on every app startup
    registration.update();
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);