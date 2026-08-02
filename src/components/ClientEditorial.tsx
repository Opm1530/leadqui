import { useState, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { useRole } from "@/hooks/useRole";
import { CONTENT_STATUS, typeLabel } from "@/lib/editorial";
import EditorialFormModal from "@/components/EditorialFormModal";
import EditorialDetailModal from "@/components/EditorialDetailModal";

interface Props { clientId: string; clientName: string; team?: any[]; }

export default function ClientEditorial({ clientId, clientName, team = [] }: Props) {
  const { isAdmin, role } = useRole();
  const canManage = isAdmin || role === "MANAGER";
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);

  const load = () => api.get(`/api/editorial?clientId=${clientId}`).then(setItems).catch(() => {});
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [clientId]);
  useEffect(() => { if (selected) { const f = items.find(i => i.id === selected.id); if (f) setSelected(f); } }, [items]); // eslint-disable-line

  const clients = [{ id: clientId, name: clientName }];

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-foreground">Editorial de conteúdos</h2>
        {canManage && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} size="sm" className="gradient-button gap-2"><Plus className="w-4 h-4" /> Novo</Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nenhum conteúdo cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {items.map(it => {
            const st = CONTENT_STATUS[it.status] || CONTENT_STATUS.IDEIA;
            return (
              <button key={it.id} onClick={() => setSelected(it)} className="w-full text-left flex items-center gap-3 bg-secondary/40 rounded-lg px-3 py-2 hover:bg-secondary/60 transition">
                <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{it.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{typeLabel(it.content_type)}{it.responsible?.name ? ` · ${it.responsible.name}` : ""}{it.scheduled_date ? ` · ${new Date(it.scheduled_date).toLocaleDateString("pt-BR")}` : ""}</p>
                </div>
                <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.color}`}>{st.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <EditorialFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} clients={clients} team={team} editing={editing} defaultClientId={clientId} />
      <EditorialDetailModal content={selected} isOpen={!!selected} onClose={() => setSelected(null)} onChanged={() => { load(); setSelected(null); }} onEdit={(c) => { setSelected(null); setEditing(c); setFormOpen(true); }} />
    </div>
  );
}
