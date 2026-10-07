// Tela larga o bastante para a tabela de eventos (9 colunas)? Abaixo disso a
// lista vira cartões. Renderiza UM dos dois (não os dois escondidos por CSS),
// para não duplicar ids de teste, links e botões na página.
import { useEffect, useState } from "react";

const QUERY = "(min-width: 1024px)";

export function useWideScreen(): boolean {
  const [wide, setWide] = useState(() => typeof window === "undefined" || window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setWide(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}
