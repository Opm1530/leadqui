import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Loader2, Users, ShieldCheck, KeyRound, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

const genPassword = () => Math.random().toString(36).slice(-4) + Math.random().toString(36).slice(-4).toUpperCase() + "!" + Math.floor(Math.random() * 90 + 10);

const ClientTeam = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: genPassword(), is_admin: false });

  const load = () => api.get("/api/client-users").then(d => setUsers(d.users || [])).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const abrirNovo = () => { setForm({ name: "", email: "", password: genPassword(), is_admin: false }); setModal(true); };

  const criar = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) { toast({ title: "Preencha nome, e-mail e senha.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await api.post("/api/client-users", { name: form.name.trim(), email: form.email.trim(), password: form.password, is_admin: form.is_admin });
      toast({ title: "Usuário criado!", description: `Acesso criado para ${form.email.trim()}` });
      setModal(false); await load();
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const toggleAdmin = async (u: any) => {
    if (u.id === user?.id) { toast({ title: "Você não pode mudar o seu próprio acesso.", variant: "destructive" }); return; }
    setUsers(p => p.map(x => x.id === u.id ? { ...x, is_client_admin: !x.is_client_admin } : x));
    await api.patch(`/api/client-users/${u.id}`, { is_admin: !u.is_client_admin }).catch(() => load());
  };

  const resetarSenha = async (u: any) => {
    const nova = genPassword();
    await api.patch(`/api/client-users/${u.id}`, { password: nova }).catch(() => null);
    toast({ title: `Nova senha de ${u.name}`, description: nova });
  };

  const excluir = async (u: any) => {
    if (!confirm(`Excluir o usuário "${u.name}"? Ele perde o acesso imediatamente.`)) return;
    setUsers(p => p.filter(x => x.id !== u.id));
    await api.delete(`/api/client-users/${u.id}`).catch(() => load());
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate("/hub")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Hub
        </button>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Equipe</h1>
              <p className="text-sm text-muted-foreground">Gerencie quem tem acesso ao seu CRM.</p>
            </div>
          </div>
          <Button onClick={abrirNovo}><Plus className="w-4 h-4 mr-1" /> Novo usuário</Button>
        </div>

        <div className="glass-card divide-y divide-border">
          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">Nenhum usuário ainda.</p>
          ) : users.map(u => (
            <div key={u.id} className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-foreground shrink-0">
                {u.name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">{u.name}</span>
                  {u.is_client_admin && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Admin</span>}
                  {u.id === user?.id && <span className="text-[10px] text-muted-foreground">(você)</span>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <button onClick={() => toggleAdmin(u)} disabled={u.id === user?.id} title="Alternar admin" className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-violet-400 disabled:opacity-30"><ShieldCheck className="w-4 h-4" /></button>
              <button onClick={() => resetarSenha(u)} title="Gerar nova senha" className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground"><KeyRound className="w-4 h-4" /></button>
              <button onClick={() => excluir(u)} disabled={u.id === user?.id} title="Excluir" className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-red-400 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" autoFocus />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">E-mail de acesso</label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="pessoa@empresa.com" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Senha inicial</label>
              <div className="flex gap-2">
                <Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="font-mono" />
                <button type="button" onClick={() => setForm({ ...form, password: genPassword() })} className="p-2 rounded-md bg-secondary border border-border hover:bg-secondary/80 text-muted-foreground"><RefreshCw className="w-4 h-4" /></button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><KeyRound className="w-3 h-3" /> Anote a senha — não será exibida de novo.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={form.is_admin} onCheckedChange={(v) => setForm({ ...form, is_admin: !!v })} />
              <span className="text-sm text-foreground">Administrador (pode gerenciar a equipe)</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={criar} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar usuário"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientTeam;
