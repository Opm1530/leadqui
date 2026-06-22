"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendDemandDigest = sendDemandDigest;
exports.startDemandDigest = startDemandDigest;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = __importDefault(require("./prisma"));
const companySettings_1 = require("./companySettings");
// Envia o resumo diário de demandas em aberto para o WhatsApp de alertas.
async function sendDemandDigest() {
    try {
        const settings = await (0, companySettings_1.getCompanySettings)();
        const s = settings;
        if (!s?.evolution_api_url || !s?.notification_phone || !s?.notification_instance)
            return;
        const abertas = await prisma_1.default.demand.findMany({
            where: { status: { in: ["NOVA", "EM_ANDAMENTO"] } },
            include: { client: { select: { name: true } } },
            orderBy: { created_at: "asc" },
        });
        if (!abertas.length)
            return;
        // Agrupa por cliente
        const porCliente = {};
        for (const d of abertas) {
            const nome = d.client?.name || "Sem cliente";
            (porCliente[nome] = porCliente[nome] || []).push(`• ${d.summary}${d.status === "EM_ANDAMENTO" ? " _(em andamento)_" : ""}`);
        }
        let msg = `☀️ *Bom dia! Demandas em aberto (${abertas.length})*\n`;
        for (const [cliente, itens] of Object.entries(porCliente)) {
            msg += `\n*${cliente}*\n${itens.join("\n")}\n`;
        }
        msg += `\n_Veja tudo na Caixa de Demandas._`;
        await axios_1.default.post(`${s.evolution_api_url.replace(/\/$/, "")}/message/sendText/${s.notification_instance}`, { number: s.notification_phone, text: msg }, { headers: { apikey: s.evolution_api_key || "", "Content-Type": "application/json" }, timeout: 8000 });
        console.log(`[Demandas] Resumo diário enviado (${abertas.length} demandas).`);
    }
    catch (e) {
        console.warn("[Demandas] erro no resumo diário:", e.message);
    }
}
// Agendador simples: verifica de hora em hora; às 9h (horário do servidor)
// dispara o resumo, no máximo uma vez por dia.
let lastSentDay = "";
function startDemandDigest() {
    const tick = () => {
        // Usa horário de São Paulo (o container roda em UTC)
        const now = new Date();
        const hour = Number(new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false,
        }).format(now)) % 24;
        const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
        if (hour === 9 && lastSentDay !== day) {
            lastSentDay = day;
            sendDemandDigest();
        }
    };
    tick();
    setInterval(tick, 30 * 60 * 1000); // a cada 30 min (garante pegar a janela das 9h)
}
//# sourceMappingURL=demandDigest.js.map