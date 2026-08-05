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
 * Default password for auto-provisioned colaborador logins: the CPF digits
 * themselves. The login page sends the raw CPF as the password, so provisioning
 * must use the same value.
 */
export function defaultPasswordForCpf(cpfDigits: string): string {
  return cpfDigits;
}
