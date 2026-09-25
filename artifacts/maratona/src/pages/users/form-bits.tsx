import { DANGER_TEXT } from "@/lib/premium-theme";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="text-[11px] font-bold" style={{ color: DANGER_TEXT }}>{message}</p>;
}
