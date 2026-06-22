"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dayDate = dayDate;
// Converte uma data vinda de input (YYYY-MM-DD) em Date ancorada ao MEIO-DIA UTC.
// Assim a data exibida nunca "vira o dia" por causa de fuso (UTC-12 a UTC+14).
// Se vier com hora (ISO completo), respeita como está.
function dayDate(input) {
    if (!input)
        return null;
    if (input instanceof Date)
        return input;
    const s = String(input).trim();
    // Apenas data (YYYY-MM-DD) → ancora ao meio-dia UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(s))
        return new Date(`${s}T12:00:00Z`);
    return new Date(s);
}
//# sourceMappingURL=dates.js.map