// Rate limiting de login — conta apenas TENTATIVAS QUE FALHARAM.
// Logins bem-sucedidos zeram o contador (não punem quem troca de conta).
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILURES = 15;
const WINDOW_MS = 15 * 60 * 1000;

export function isLoginBlocked(ip: string): boolean {
  const e = attempts.get(ip);
  return !!(e && Date.now() < e.resetAt && e.count >= MAX_FAILURES);
}

export function registerLoginFailure(ip: string): void {
  const now = Date.now();
  const e = attempts.get(ip);
  if (e && now < e.resetAt) e.count++;
  else attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
}

export function registerLoginSuccess(ip: string): void {
  attempts.delete(ip);
}
