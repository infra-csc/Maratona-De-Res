import { useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Loader2, AlertCircle } from "lucide-react";
import { uploadAudioBlob, fetchAudioObjectUrl } from "@/lib/audio-upload";
import { cn } from "@/lib/utils";

export function AudioPlayer({ objectPath, className }: { objectPath: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setSrc(null);
    setFailed(false);
    fetchAudioObjectUrl(objectPath)
      .then(u => {
        if (cancelled) { URL.revokeObjectURL(u); return; }
        url = u;
        setSrc(u);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [objectPath]);

  if (failed) {
    return (
      <p className={cn("flex items-center gap-1.5 text-[12px] font-semibold text-[var(--status-danger-text)]", className)}>
        <AlertCircle size={12} /> Falha ao carregar o áudio
      </p>
    );
  }
  if (!src) {
    return (
      <p className={cn("flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground", className)} data-testid="audio-loading">
        <Loader2 size={12} className="animate-spin" /> Carregando áudio...
      </p>
    );
  }
  return (
    <audio
      controls
      src={src}
      data-testid="audio-player"
      className={cn("w-full h-10", className)}
    />
  );
}

/**
 * Records an explanatory audio with MediaRecorder and uploads it on stop.
 * `value` is the current objectPath (null = none). `onChange` receives the new
 * objectPath after a successful upload, or null when the user clears it.
 */
export function AudioRecorder({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (objectPath: string | null) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    },
    [],
  );

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setUploading(true);
        try {
          const path = await uploadAudioBlob(blob);
          onChange(path);
        } catch (err) {
          // Mostra o motivo quando a API/armazenamento devolve um — o usuário
          // precisa saber se foi rede, permissão ou tamanho, não só "falhou".
          const reason = err instanceof Error && err.message.trim() ? err.message.trim().replace(/\.$/, "") : null;
          setError(reason ? `Falha ao enviar o áudio: ${reason}. Tente novamente.` : "Falha ao enviar o áudio. Tente novamente.");
        } finally {
          setUploading(false);
          // Libera os blobs gravados — sem isso ficavam retidos em memória até a
          // próxima gravação (ou até desmontar o componente).
          chunksRef.current = [];
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      setError("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
    }
  }

  function stopRecording() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    recorderRef.current?.stop();
    setRecording(false);
  }

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  if (value) {
    return (
      <div className="space-y-2" data-testid="audio-recorded">
        <AudioPlayer objectPath={value} />
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            data-testid="button-rerecord-audio"
            className="font-condensed inline-flex min-h-11 md:min-h-9 items-center gap-1.5 border border-border rounded-lg bg-card text-foreground px-3 text-[13px] font-bold uppercase tracking-[0.06em] transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw size={12} /> Regravar áudio
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!recording ? (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={startRecording}
          data-testid="button-record-audio"
          className="font-condensed inline-flex min-h-11 md:min-h-9 items-center gap-2 border border-border rounded-lg bg-card text-foreground px-3.5 text-[13px] font-bold uppercase tracking-[0.06em] transition-colors duration-150 enabled:hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {uploading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Enviando áudio...
            </>
          ) : (
            <>
              <Mic size={14} /> Gravar áudio
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={stopRecording}
          data-testid="button-stop-audio"
          className="font-condensed inline-flex min-h-11 md:min-h-9 items-center gap-2 border border-destructive rounded-lg bg-destructive px-3.5 text-[13px] font-bold uppercase tracking-[0.06em] text-destructive-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Square size={14} /> Parar ({mmss})<span className="sr-only"> — gravando</span>
        </button>
      )}
      {error && (
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--status-danger-text)]">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}
