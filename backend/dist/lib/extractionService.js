"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startInstagramExtraction = exports.startGoogleMapsExtraction = void 0;
const axios_1 = __importDefault(require("axios"));
const openai_1 = __importDefault(require("openai"));
const prisma_1 = __importDefault(require("./prisma"));
const companySettings_1 = require("./companySettings");
const startGoogleMapsExtraction = async (extractionId, userId, params) => {
    const { categoria, cidade, quantidade, tag_id } = params;
    const update = async (data) => {
        await prisma_1.default.extraction.update({ where: { id: extractionId }, data });
    };
    try {
        const settings = await (0, companySettings_1.getCompanySettings)();
        const apiKey = settings?.serper_api_key?.trim();
        if (!apiKey)
            throw new Error("Serper API Key não configurada em Configurações.");
        await update({ status: "EM_ANDAMENTO", step_message: "Iniciando busca no Google Maps..." });
        const totalPages = Math.ceil(quantidade / 10);
        let allPlaces = [];
        for (let page = 1; page <= totalPages; page++) {
            // Verificar cancelamento
            const current = await prisma_1.default.extraction.findUnique({ where: { id: extractionId } });
            if (current?.status === "PARADO")
                return;
            await update({ step_message: `Buscando resultados: página ${page} de ${totalPages}...` });
            try {
                const response = await axios_1.default.post("https://google.serper.dev/places", { q: `${categoria} em ${cidade}`, num: 10, page: page, gl: "br", hl: "pt" }, { headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" } });
                const places = response.data.places || [];
                if (places.length === 0)
                    break;
                allPlaces = allPlaces.concat(places);
                await update({ total_leads: allPlaces.length });
                if (allPlaces.length >= quantidade)
                    break;
            }
            catch (err) {
                console.error("Serper API Error:", err.response?.data || err.message);
                break;
            }
        }
        const places = allPlaces.slice(0, quantidade);
        await update({ step_message: "Processando e salvando leads..." });
        let savedCount = 0;
        for (const place of places) {
            const phoneClean = place.phoneNumber ? String(place.phoneNumber).replace(/\D/g, "") : null;
            // Deduplicação básica (global — leads compartilhados pela empresa)
            const exists = await prisma_1.default.lead.findFirst({
                where: {
                    OR: [
                        { google_place_id: place.placeId || "NONE" },
                        { telefone_limpo: phoneClean || "NONE" },
                        { nome: place.title || "NONE" }
                    ]
                }
            });
            if (exists)
                continue;
            const lead = await prisma_1.default.lead.create({
                data: {
                    user_id: userId,
                    nome: place.title || "Sem nome",
                    telefone: place.phoneNumber || null,
                    telefone_limpo: phoneClean,
                    endereco: place.address || null,
                    cidade: cidade || null,
                    origem: "GOOGLE_MAPS",
                    status: "NOVO",
                    google_place_id: place.placeId || null,
                    website: place.website || null,
                    maps_url: place.url || null,
                }
            });
            if (tag_id) {
                await prisma_1.default.leadTag.create({ data: { lead_id: lead.id, tag_id } }).catch(() => { });
            }
            savedCount++;
        }
        await update({
            status: "CONCLUIDO",
            total_leads: savedCount,
            step_message: `Concluído! ${savedCount} novos leads salvos.`
        });
    }
    catch (error) {
        console.error("Extraction failed:", error);
        await update({ status: "ERRO", erro: error.message });
    }
};
exports.startGoogleMapsExtraction = startGoogleMapsExtraction;
const startInstagramExtraction = async (extractionId, userId, params) => {
    const { hashtag, quantidade, tag_id } = params;
    const update = async (data) => {
        await prisma_1.default.extraction.update({ where: { id: extractionId }, data });
    };
    try {
        const settings = await (0, companySettings_1.getCompanySettings)();
        const apifyKey = settings?.apify_api_key?.trim();
        const openaiKey = settings?.openai_api_key?.trim();
        if (!apifyKey || !openaiKey)
            throw new Error("Configuração ausente: Apify ou OpenAI API Key não encontradas.");
        const openai = new openai_1.default({ apiKey: openaiKey });
        await update({ status: "EM_ANDAMENTO", step_message: "Buscando posts da hashtag..." });
        // Step 1: Get posts
        const postsRes = await axios_1.default.post(`https://api.apify.com/v2/acts/reGe1ST3OBgYZSsZJ/run-sync-get-dataset-items?token=${apifyKey}`, { hashtags: [hashtag], resultsType: "posts", resultsLimit: quantidade }, { headers: { "Content-Type": "application/json" } });
        const usernames = Array.from(new Set((postsRes.data || []).map((p) => p.ownerUsername))).filter(Boolean);
        await update({ step_message: `Encontrados ${usernames.length} perfis. Buscando detalhes...` });
        let savedCount = 0;
        // Process in smaller chunks to avoid timeouts and update progress
        for (let i = 0; i < usernames.length; i += 5) {
            const current = await prisma_1.default.extraction.findUnique({ where: { id: extractionId } });
            if (current?.status === "PARADO")
                return;
            const chunk = usernames.slice(i, i + 5);
            const profileRes = await axios_1.default.post(`https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyKey}`, { usernames: chunk }, { headers: { "Content-Type": "application/json" } });
            for (const profile of (profileRes.data || [])) {
                const bio = profile.biography || "";
                const externalUrls = profile.externalUrls || [];
                // OpenAI extraction
                let contato = "";
                try {
                    const completion = await openai.chat.completions.create({
                        model: "gpt-4o-mini",
                        response_format: { type: "json_object" },
                        messages: [
                            { role: "system", content: "Extraia o WhatsApp (DDI 55) da bio ou links. Retorne JSON: {\"telefone\": \"número_limpo\"} ou {\"telefone\": \"NONE\"}." },
                            { role: "user", content: `Bio: ${bio}\nLinks: ${JSON.stringify(externalUrls)}` }
                        ]
                    });
                    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
                    if (parsed.telefone !== "NONE")
                        contato = String(parsed.telefone).replace(/\D/g, "");
                }
                catch { }
                const exists = await prisma_1.default.lead.findFirst({
                    where: { OR: [{ username: profile.username }, { telefone_limpo: contato || "NONE" }] }
                });
                if (exists)
                    continue;
                const lead = await prisma_1.default.lead.create({
                    data: {
                        user_id: userId,
                        nome: profile.fullName || profile.username,
                        username: profile.username,
                        telefone: contato || "",
                        telefone_limpo: contato || null,
                        origem: "INSTAGRAM",
                        status: "NOVO",
                        perfil_url: `https://www.instagram.com/${profile.username}/`,
                        biografia: bio,
                    }
                });
                if (tag_id)
                    await prisma_1.default.leadTag.create({ data: { lead_id: lead.id, tag_id } }).catch(() => { });
                savedCount++;
            }
            await update({ total_leads: savedCount, step_message: `Processando: ${Math.min(i + 5, usernames.length)} de ${usernames.length}...` });
        }
        await update({ status: "CONCLUIDO", total_leads: savedCount, step_message: `Concluído! ${savedCount} leads salvos.` });
    }
    catch (error) {
        console.error("Instagram Extraction failed:", error);
        await update({ status: "ERRO", erro: error.message });
    }
};
exports.startInstagramExtraction = startInstagramExtraction;
//# sourceMappingURL=extractionService.js.map