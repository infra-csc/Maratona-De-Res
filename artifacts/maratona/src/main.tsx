import { createRoot } from "react-dom/client";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

setAuthTokenGetter(() => localStorage.getItem("maratona_token"));

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";
setBaseUrl(apiBase);

// SSO automático vindo do portal NORTE
const _params = new URLSearchParams(window.location.search);
const _ssoToken = _params.get("portal_sso");
if (_ssoToken) {
  fetch(`${apiBase}/auth/portal-sso`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: _ssoToken }),
  })
    .then(r => r.ok ? r.json() : null)
    .then((data: { token: string; user: unknown } | null) => {
      if (data?.token && data?.user) {
        localStorage.setItem("maratona_token", data.token);
        localStorage.setItem("maratona_user", JSON.stringify(data.user));
      }
      _params.delete("portal_sso");
      _params.delete("portal_return");
      const newUrl = window.location.pathname + (_params.toString() ? "?" + _params.toString() : "");
      window.history.replaceState({}, "", newUrl);
    })
    .catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
