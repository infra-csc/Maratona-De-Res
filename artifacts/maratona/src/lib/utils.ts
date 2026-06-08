import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatEventSubtitle(e: { clientName?: string | null; city?: string | null; state?: string | null }): string {
  const place = [e.city, e.state].filter(Boolean).join("/");
  return [e.clientName, place].filter(Boolean).join(" · ");
}
