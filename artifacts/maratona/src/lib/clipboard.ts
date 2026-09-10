/**
 * Cópia para a área de transferência com fallback e resultado verificável.
 *
 * `navigator.clipboard.writeText` falha (rejeita a Promise) quando a página não
 * está em foco, quando o navegador nega permissão ou em contextos sem HTTPS.
 * Chamar sem `await` esconde a falha e a UI mostra "Copiado!" com a área de
 * transferência vazia — foi o relato de "às vezes não copia". Aqui a chamada é
 * aguardada; se falhar, tenta o fallback clássico (textarea + execCommand) e
 * devolve `false` quando nada funcionou, para o chamador avisar o usuário.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // cai no fallback abaixo
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Mensagem padrão para quando a cópia automática não for possível. */
export const COPY_FAILED_TOAST = {
  title: "Não foi possível copiar automaticamente",
  description: "Selecione o texto na tela e copie manualmente (Ctrl+C).",
  variant: "destructive" as const,
};
