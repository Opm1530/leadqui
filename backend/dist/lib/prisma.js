"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const crypto_1 = require("./crypto");
const prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});
// Criptografa tokens/segredos sensíveis em repouso (na escrita).
// A descriptografia é feita nos pontos de uso (helpers dec()).
const ENC_FIELDS = {
    ClientMetaConnection: ["access_token", "page_access_token", "ig_access_token"],
    TechQuiSettings: ["meta_app_secret", "instagram_app_secret"],
};
prisma.$use(async (params, next) => {
    const fields = params.model ? ENC_FIELDS[params.model] : undefined;
    if (fields && ["create", "update", "updateMany", "upsert"].includes(params.action)) {
        const encData = (data) => {
            if (!data || typeof data !== "object")
                return;
            for (const f of fields) {
                if (!(f in data))
                    continue;
                const v = data[f];
                if (typeof v === "string")
                    data[f] = (0, crypto_1.encField)(v);
                else if (v && typeof v === "object" && typeof v.set === "string")
                    v.set = (0, crypto_1.encField)(v.set);
            }
        };
        if (params.action === "upsert") {
            encData(params.args?.create);
            encData(params.args?.update);
        }
        else {
            encData(params.args?.data);
        }
    }
    return next(params);
});
exports.default = prisma;
//# sourceMappingURL=prisma.js.map