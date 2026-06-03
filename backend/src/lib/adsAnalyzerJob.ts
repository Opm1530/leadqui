import prisma from "./prisma";
import { runAdsAnalysis } from "../routes/techqui";

export function startAdsAnalyzerJob() {
  console.log("[AdsAnalyzer] Job iniciado — roda às 6h e 18h");
  scheduleNext();
}

function scheduleNext() {
  const now = new Date();
  const next = getNextRunTime(now);
  const delay = next.getTime() - now.getTime();
  console.log(`[AdsAnalyzer] Próxima análise em: ${next.toLocaleString("pt-BR")}`);
  setTimeout(async () => {
    await runAllConnections();
    scheduleNext();
  }, delay);
}

function getNextRunTime(from: Date): Date {
  const d = new Date(from);
  const h = d.getHours();
  // Próximo horário: 6h ou 18h
  if (h < 6) {
    d.setHours(6, 0, 0, 0);
  } else if (h < 18) {
    d.setHours(18, 0, 0, 0);
  } else {
    d.setDate(d.getDate() + 1);
    d.setHours(6, 0, 0, 0);
  }
  return d;
}

async function runAllConnections() {
  try {
    const connections = await (prisma as any).clientMetaConnection.findMany({
      where: { ad_account_id: { not: null }, access_token: { not: null } },
      include: { client: { include: { user: { select: { id: true } } } } },
    });

    console.log(`[AdsAnalyzer] Analisando ${connections.length} conexão(ões)...`);
    for (const conn of connections) {
      const userId = conn.client?.user?.id;
      if (!userId) continue;
      await runAdsAnalysis(conn.id, userId, "SCHEDULED");
    }
  } catch (err: any) {
    console.error("[AdsAnalyzer] Erro no job:", err.message);
  }
}
