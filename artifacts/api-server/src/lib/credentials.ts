// Shared rules for CPF-based colaborador login credentials, used by the
// bulk-generation endpoint, employee auto-provisioning, and login lookup.

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

/** Strips CPF formatting, keeping only digits. */
export function normalizeCpf(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function isValidCpfLength(digits: string): boolean {
  return digits.length === 11;
}

/**
 * Default password for auto-provisioned colaborador logins: "Maratona@" plus
 * the last 4 digits of the CPF. Deterministic (so it can be regenerated for
 * support purposes) yet not guessable from public info alone, and every
 * account is forced to change it on first login (mustChangePassword).
 */
export function defaultPasswordForCpf(cpfDigits: string): string {
  const last4 = cpfDigits.slice(-4);
  return `Maratona@${last4}`;
}
