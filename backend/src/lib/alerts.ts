import prisma from "./prisma";

// Percentual de saldo a partir do qual avisa "saldo baixo" de tráfego.
const LOW_PCT = 0.2; // 20%
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const SEV_RANK: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };

export interface AlertItem {
  id: string;
  type: string;
  severity: string;
  title: string;
  message?: string | null;
  client_id?: string | null;
  link?: string | null;
  dynamic: boolean;
  created_at: string;
}

// Alertas AO VIVO: saldo baixo / verba estourada no mês corrente.
export async function computeTrafficAlerts(): Promise<AlertItem[]> {
  const month = monthNow();
  const budgets = await (prisma as any).trafficBudget.findMany({
    where: { month, amount: { gt: 0 } },
    include: { client: { select: { id: true, name: true, status: true } } },
  });
  const PLAT: Record<string, string> = { META: "Meta Ads", GOOGLE: "Google Ads", TIKTOK: "TikTok Ads" };
  const out: AlertItem[] = [];
  for (const b of budgets) {
    if (b.client?.status && b.client.status !== "ATIVO") continue;
    const platform = b.platform || "META";
    const checks = await (prisma as any).trafficCheck.findMany({ where: { client_id: b.client_id, month, platform }, select: { spend: true } });
    const gasto = checks.reduce((s: number, c: any) => s + (c.spend || 0), 0);
    const saldo = b.amount - gasto;
    const pct = saldo / b.amount;
    const nome = b.client?.name || "Cliente";
    const plat = PLAT[platform] || platform;
    if (saldo < 0) {
      out.push({
        id: `traffic:${b.client_id}:${month}:${platform}`, type: "TRAFFIC_LOW_BALANCE", severity: "CRITICAL",
        title: `Verba estourada — ${nome} (${plat})`, message: `Gasto ${brl(gasto)} de ${brl(b.amount)} · saldo ${brl(saldo)}`,
        client_id: b.client_id, link: `/cliente/${b.client_id}`, dynamic: true, created_at: new Date().toISOString(),
      });
    } else if (pct <= LOW_PCT) {
      out.push({
        id: `traffic:${b.client_id}:${month}:${platform}`, type: "TRAFFIC_LOW_BALANCE", severity: "WARNING",
        title: `Saldo baixo — ${nome} (${plat})`, message: `Restam ${brl(saldo)} de ${brl(b.amount)} (${Math.round(pct * 100)}%)`,
        client_id: b.client_id, link: `/cliente/${b.client_id}`, dynamic: true, created_at: new Date().toISOString(),
      });
    }
  }
  return out;
}

// Lista final: persistidos (não resolvidos) + ao vivo, ordenados por severidade e data.
export async function listAlerts(): Promise<AlertItem[]> {
  const persisted = await (prisma as any).alert.findMany({ where: { resolved: false }, orderBy: { created_at: "desc" } });
  const dynamic = await computeTrafficAlerts();
  const all: AlertItem[] = [
    ...dynamic,
    ...persisted.map((p: any) => ({ ...p, dynamic: false, created_at: new Date(p.created_at).toISOString() })),
  ];
  all.sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9) || (b.created_at.localeCompare(a.created_at)));
  return all;
}

// Cria um alerta persistido (usado por eventos: falha, campanha bloqueada, etc.).
export async function createAlert(data: {
  type: string; severity?: string; title: string; message?: string; client_id?: string | null; link?: string | null;
}) {
  return (prisma as any).alert.create({ data: { severity: "WARNING", ...data } });
}
