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
    // Só os parâmetros do SSO saem da URL: o caminho e os demais parâmetros
    // (ex.: /evaluations?evento=123, o evento que o portal mandou abrir) ficam.
    params.delete("portal_sso");
    params.delete("portal_return");
    const newUrl =
      window.location.pathname +
      (params.toString() ? "?" + params.toString() : "") +
      window.location.hash;
    window.history.replaceState({}, "", newUrl);
  }

  // Link do portal com evento (/evaluations?evento=ID): guarda o destino SEMPRE
  // — sem sessão, ou com a sessão vencida (o token ainda está no navegador, a
  // API responde 401 e o app manda para o login), a tela de login perderia o
  // evento. A tela de Avaliações consome o destino ao abrir (pages/evaluations.tsx).
  try {
    if (/\/evaluations$/.test(window.location.pathname) && new URLSearchParams(window.location.search).get("evento")) {
      sessionStorage.setItem("maratona_destino", window.location.pathname + window.location.search);
    }
  } catch {
    // sem storage (modo privado restrito): segue sem retomar o destino
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

init();
