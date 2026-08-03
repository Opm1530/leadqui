import { PrismaClient } from "@prisma/client";
import { encField } from "./crypto";

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

// Criptografa tokens/segredos sensíveis em repouso (na escrita).
// A descriptografia é feita nos pontos de uso (helpers dec()).
const ENC_FIELDS: Record<string, string[]> = {
  ClientMetaConnection: ["access_token", "page_access_token", "ig_access_token"],
  TechQuiSettings: ["meta_app_secret", "instagram_app_secret"],
};

prisma.$use(async (params, next) => {
  const fields = params.model ? ENC_FIELDS[params.model] : undefined;
  if (fields && ["create", "update", "updateMany", "upsert"].includes(params.action)) {
    const encData = (data: any) => {
      if (!data || typeof data !== "object") return;
      for (const f of fields) {
        if (!(f in data)) continue;
        const v = data[f];
        if (typeof v === "string") data[f] = encField(v);
        else if (v && typeof v === "object" && typeof v.set === "string") v.set = encField(v.set);
      }
    };
    if (params.action === "upsert") {
      encData(params.args?.create);
      encData(params.args?.update);
    } else {
      encData(params.args?.data);
    }
  }
  return next(params);
});

export default prisma;
