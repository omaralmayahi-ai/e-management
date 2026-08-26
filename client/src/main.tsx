import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Safely attempt to attach global Bearer token interceptor without throwing if read-only
try {
  const originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      try {
        const token = typeof localStorage !== "undefined" ? localStorage.getItem("auth_token") : null;
        if (token) {
          const customInit = { ...(init || {}) };
          const headers = new Headers(customInit.headers);
          if (!headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${token}`);
          }
          customInit.headers = headers;
          if (customInit.credentials === undefined) {
            customInit.credentials = "include";
          }
          return originalFetch.call(this, input, customInit);
        }
      } catch {
        // Fallback to original fetch
      }
      return originalFetch.call(this, input, init);
    };
  }
} catch {
  // If window.fetch has only a getter in this environment, safely continue
}

createRoot(document.getElementById("root")!).render(<App />);


