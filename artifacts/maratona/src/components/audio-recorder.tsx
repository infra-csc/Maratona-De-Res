import { useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Loader2, AlertCircle } from "lucide-react";
import { uploadAudioBlob, audioSrc } from "@/lib/audio-upload";
import { cn } from "@/lib/utils";

export function AudioPlayer({ objectPath, className }: { objectPath: string; className?: string }) {
  return (
    <audio
      controls
      preload="none"
      src={audioSrc(objectPath)}
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
        } catch {
          setError("Falha ao enviar o áudio. Tente novamente.");
        } finally {
          setUploading(false);
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
            className="inline-flex items-center gap-1.5 border-2 border-[#191c1e] bg-white px-3 py-1.5 text-[11px] font-bold italic uppercase tracking-wider transition-all hover:bg-[#eceef0]"
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
          className="inline-flex items-center gap-2 border-2 border-[#191c1e] bg-[#ccff00] px-4 py-2 text-xs font-bold italic uppercase tracking-wider transition-all hover:bg-[#b8e600] disabled:cursor-not-allowed disabled:opacity-50"
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
          className="inline-flex items-center gap-2 border-2 border-[#191c1e] bg-[#ba1a1a] px-4 py-2 text-xs font-bold italic uppercase tracking-wider text-white transition-all hover:bg-[#9c1414]"
        >
          <Square size={14} /> Parar ({mmss})
        </button>
      )}
      {error && (
        <p className="flex items-center gap-1.5 text-[11px] font-bold italic uppercase text-[#ba1a1a]">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}
