import prisma from "./prisma";
import { startGoogleMapsExtraction } from "./extractionService";
import { enrollLeads } from "./sdrEnroll";

const INTERVAL: Record<string, number> = { DAILY: 24 * 3600 * 1000, WEEKLY: 7 * 24 * 3600 * 1000 };
const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

async function runSchedule(sch: any): Promise<void> {
  const ownerId = sch.user_id;
  const cidades: string[] = (sch.cidades && sch.cidades.length) ? sch.cidades : [""];

  // Roda a busca em cada cidade
  for (const cidade of cidades) {
    const ext = await prisma.extraction.create({
      data: {
        user_id: ownerId, tipo: "GOOGLE_MAPS" as any,
        parametros: JSON.stringify({ categoria: sch.categoria, cidade, quantidade: sch.quantidade }),
        status: "PENDENTE", total_leads: 0,
      },
    });
    try {
      await startGoogleMapsExtraction(ext.id, ownerId, { categoria: sch.categoria, cidade: cidade || undefined, quantidade: sch.quantidade, tag_id: sch.tag_id || undefined });
    } catch (e: any) {
      console.warn(`[Extração auto] falha em "${sch.categoria} / ${cidade}":`, e.message);
    }
  }

  // Enfileira novos leads no SDR (respeitando o limite diário de geração)
  if (sch.auto_sdr) {
    const pb = await (prisma as any).sdrPlaybook.findUnique({ where: { user_id: ownerId } });
    if (pb?.active) {
      const generatedToday = await (prisma as any).sdrDraft.count({ where: { kind: "FIRST_CONTACT", created_at: { gte: todayStart() } } });
      const budget = Math.max(0, (pb.daily_limit || 10) - generatedToday);
      if (budget > 0) {
        const cands = await prisma.lead.findMany({
          where: { telefone: { not: null }, sdr_conversation: null, origem: "GOOGLE_MAPS" } as any,
          orderBy: { created_at: "desc" }, take: budget, select: { id: true },
        });
        await enrollLeads(cands.map(c => c.id), budget).catch(() => {});
      }
    }
  }

  const interval = INTERVAL[sch.frequency] || INTERVAL.DAILY;
  await (prisma as any).extractionSchedule.update({
    where: { id: sch.id },
    data: { last_run_at: new Date(), next_run_at: new Date(Date.now() + interval) },
  });
}

async function tick(): Promise<void> {
  try {
    const now = new Date();
    const due = await (prisma as any).extractionSchedule.findMany({
      where: { active: true, OR: [{ next_run_at: null }, { next_run_at: { lte: now } }] },
      take: 10,
    });
    for (const sch of due) {
      try { await runSchedule(sch); } catch (e: any) { console.warn("[Extração auto] erro:", e.message); }
    }
  } catch (e: any) {
    console.warn("[Extração auto] tick erro:", e.message);
  }
}

// Dispara uma regra específica agora (usado pelo botão "Rodar agora").
export async function runScheduleById(id: string): Promise<void> {
  const sch = await (prisma as any).extractionSchedule.findUnique({ where: { id } });
  if (sch) await runSchedule(sch);
}

export function startExtractionScheduler(): void {
  setInterval(tick, 30 * 60 * 1000); // a cada 30 min
  setTimeout(tick, 2 * 60 * 1000);   // primeira passada 2 min após subir
}
