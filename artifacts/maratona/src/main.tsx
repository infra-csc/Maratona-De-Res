import { createRoot } from "react-dom/client";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

setAuthTokenGetter(() => localStorage.getItem("maratona_token"));

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";
setBaseUrl(apiBase);

async function init() {
  const params = new URLSearchParams(window.location.search);
  const ssoToken = params.get("portal_sso");

  if (ssoToken) {
    try {
      const r = await fetch(`${apiBase}/auth/portal-sso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: ssoToken }),
      });
      if (r.ok) {
        const data: { token: string; user: unknown } = await r.json();
        if (data?.token && data?.user) {
          localStorage.setItem("maratona_token", data.token);
          localStorage.setItem("maratona_user", JSON.stringify(data.user));
        }
      }
    } catch {
      // falha silenciosa — app abre normalmente na tela de login
    }
    params.delete("portal_sso");
    params.delete("portal_return");
    const newUrl =
      window.location.pathname +
      (params.toString() ? "?" + params.toString() : "");
    window.history.replaceState({}, "", newUrl);
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

init();
