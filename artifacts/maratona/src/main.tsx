import { createRoot } from "react-dom/client";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

setAuthTokenGetter(() => localStorage.getItem("maratona_token"));

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";
setBaseUrl(apiBase);

createRoot(document.getElementById("root")!).render(<App />);
