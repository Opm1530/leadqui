"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompanySettingsUserId = getCompanySettingsUserId;
exports.getCompanySettings = getCompanySettings;
const prisma_1 = __importDefault(require("./prisma"));
// Sistema de empresa única: as configurações de API são compartilhadas.
// O registro "dono" é o do primeiro ADMIN criado (admin fundador).
async function getCompanySettingsUserId() {
    const admin = await prisma_1.default.user.findFirst({
        where: { role: "ADMIN" },
        orderBy: { created_at: "asc" },
        select: { id: true },
    });
    return admin?.id ?? null;
}
async function getCompanySettings() {
    const uid = await getCompanySettingsUserId();
    if (!uid)
        return null;
    return prisma_1.default.userSettings.findUnique({ where: { user_id: uid } });
}
//# sourceMappingURL=companySettings.js.map