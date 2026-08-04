"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLoginBlocked = isLoginBlocked;
exports.registerLoginFailure = registerLoginFailure;
exports.registerLoginSuccess = registerLoginSuccess;
// Rate limiting de login — conta apenas TENTATIVAS QUE FALHARAM.
// Logins bem-sucedidos zeram o contador (não punem quem troca de conta).
const attempts = new Map();
const MAX_FAILURES = 15;
const WINDOW_MS = 15 * 60 * 1000;
function isLoginBlocked(ip) {
    const e = attempts.get(ip);
    return !!(e && Date.now() < e.resetAt && e.count >= MAX_FAILURES);
}
function registerLoginFailure(ip) {
    const now = Date.now();
    const e = attempts.get(ip);
    if (e && now < e.resetAt)
        e.count++;
    else
        attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
}
function registerLoginSuccess(ip) {
    attempts.delete(ip);
}
//# sourceMappingURL=authRateLimit.js.map