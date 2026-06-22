import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";
import {
  ClipboardList, ArrowLeft, Loader2, Plus, Trash2, Eye, EyeOff, Store, Lock, Users, CheckSquare, Save, Check,
} from "lucide-react";

interface Cred { label: string; email: string; password: string; vault_id?: string; show?: boolean; }
interface Task { text: string; done: boolean; task_id?: string; }

const Onboarding = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState("");

  const [storeName, setStoreName] = useState("");
  const [storeLink, setStoreLink] = useState("");
  const [audience, setAudience] = useState("");
  const [creds, setCreds] = useState<Cred[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const emptyExtra = {
    drive_url: "", identidade_url: "", investimento: "", concorrentes: "", objetivos: "",
    faturamento: "", produtos: "", influenciadores: "", prazo_reposicao: "", expectativas: "",
  };
  const [extra, setExtra] = useState({ ...emptyExtra });
  const setE = (k: string, v: string) => setExtra(p => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const [ob, cli] = await Promise.all([
          api.get(`/api/onboarding/${clientId}`),
          api.get("/api/clients"),
        ]);
        const c = (cli.clients || []).find((x: any) => x.id === clientId);
        setClientName(c?.name || "Cliente");
        const o = ob.onboarding;
        if (o) {
          setStoreName(o.store_name || ""); setStoreLink(o.store_link || ""); setAudience(o.audience || "");
          setCreds((o.credentials || []).map((c: any) => ({ ...c, show: false })));
          setTasks(o.checklist || []);
          setExtra({
            drive_url: o.drive_url || "", identidade_url: o.identidade_url || "", investimento: o.investimento || "",
            concorrentes: o.concorrentes || "", objetivos: o.objetivos || "", faturamento: o.faturamento || "",
            produtos: o.produtos || "", influenciadores: o.influenciadores || "", prazo_reposicao: o.prazo_reposicao || "",
            expectativas: o.expectativas || "",
          });
        }
      } catch { /* */ } finally { setLoading(false); }
    })();
  }, [clientId]);

  const addCred = () => setCreds((p) => [...p, { label: "", email: "", password: "", show: false }]);
  const setCred = (i: number, k: keyof Cred, v: any) => setCreds((p) => p.map((c, idx) => idx === i ? { ...c, [k]: v } : c));
  const delCred = (i: number) => setCreds((p) => p.filter((_, idx) => idx !== i));

  const addTask = () => { if (!newTask.trim()) return; setTasks((p) => [...p, { text: newTask.trim(), done: false }]); setNewTask(""); };
  const toggleTask = (i: number) => setTasks((p) => p.map((t, idx) => idx === i ? { ...t, done: !t.done } : t));
  const delTask = (i: number) => setTasks((p) => p.filter((_, idx) => idx !== i));

  const salvar = async () => {
    setSaving(true);
    try {
      const d = await api.put(`/api/onboarding/${clientId}`, {
        store_name: storeName, store_link: storeLink, audience,
        credentials: creds.map(({ show, ...c }) => c),
        checklist: tasks,
        ...extra,
      });
      setCreds((d.onboarding.credentials || []).map((c: any) => ({ ...c, show: false })));
      setTasks(d.onboarding.checklist || []);
      const a = d.aplicado;
      toast({
        title: "Onboarding salvo!",
        description: `${a.senhas} senha(s) no Cofre · ${a.tarefas} tarefa(s) criadas · público no Tráfego.`,
      });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-6 py-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Onboarding</h1>
          <p className="text-muted-foreground text-sm">{clientName} · dados coletados vão para os lugares certos</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Dados da loja */}
        <Section icon={Store} title="Dados da loja">
          <FieldRow label="Nome da loja"><Input value={storeName} onChange={(e) => setStoreName(e.target.value)} className="bg-secondary border-border" /></FieldRow>
          <FieldRow label="Link da loja"><Input value={storeLink} onChange={(e) => setStoreLink(e.target.value)} placeholder="https://..." className="bg-secondary border-border" /></FieldRow>
          <FieldRow label="Link da pasta do Drive"><Input value={extra.drive_url} onChange={(e) => setE("drive_url", e.target.value)} placeholder="https://drive.google.com/..." className="bg-secondary border-border" /></FieldRow>
          <FieldRow label="Link da identidade visual"><Input value={extra.identidade_url} onChange={(e) => setE("identidade_url", e.target.value)} placeholder="https://..." className="bg-secondary border-border" /></FieldRow>
        </Section>

        {/* Briefing */}
        <Section icon={ClipboardList} title="Briefing">
          {[
            ["investimento", "Investimento"],
            ["objetivos", "Objetivos"],
            ["concorrentes", "Principais concorrentes ou referências"],
            ["faturamento", "Histórico de faturamento recente"],
            ["produtos", "Produtos mais vendidos"],
            ["influenciadores", "Influenciadores que deram resultado"],
            ["prazo_reposicao", "Prazo de reposição"],
            ["expectativas", "Expectativas vs Realidade"],
          ].map(([key, label]) => (
            <FieldRow key={key} label={label}>
              <Textarea value={(extra as any)[key]} onChange={(e) => setE(key, e.target.value)} rows={2} className="bg-secondary border-border resize-none" />
            </FieldRow>
          ))}
        </Section>

        {/* Credenciais → Cofre */}
        <Section icon={Lock} title="Acessos / Credenciais" hint="vão para o Cofre do cliente">
          <div className="space-y-3">
            {creds.map((c, i) => (
              <div key={i} className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Input value={c.label} onChange={(e) => setCred(i, "label", e.target.value)} placeholder="Nome do acesso (ex: Instagram)" className="bg-secondary border-border h-8 text-sm" />
                  <button onClick={() => delCred(i)} className="ml-2 p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
                <Input value={c.email} onChange={(e) => setCred(i, "email", e.target.value)} placeholder="Email / usuário" className="bg-secondary border-border h-8 text-sm" />
                <div className="flex gap-2">
                  <Input type={c.show ? "text" : "password"} value={c.password} onChange={(e) => setCred(i, "password", e.target.value)} placeholder="Senha" className="bg-secondary border-border h-8 text-sm" disabled={!!c.vault_id} />
                  <button onClick={() => setCred(i, "show", !c.show)} className="px-2 rounded-md bg-secondary border border-border text-muted-foreground">
                    {c.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {c.vault_id && <p className="text-[11px] text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Já está no Cofre</p>}
              </div>
            ))}
          </div>
          <button onClick={addCred} className="mt-2 w-full py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Adicionar acesso
          </button>
        </Section>

        {/* Público → Tráfego */}
        <Section icon={Users} title="Público-alvo" hint="vira anotação no Tráfego">
          <Textarea value={audience} onChange={(e) => setAudience(e.target.value)} rows={4} placeholder="Idade, gênero, região, interesses, comportamento de compra…" className="bg-secondary border-border resize-none" />
        </Section>

        {/* Checklist → Tarefas */}
        <Section icon={CheckSquare} title="Checklist" hint="vira tarefas no quadro do cliente">
          <div className="space-y-2">
            {tasks.map((t, i) => (
              <div key={i} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-2 py-1.5">
                <button onClick={() => toggleTask(i)} className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${t.done ? "bg-green-600 border-green-600" : "border-muted-foreground/40"}`}>
                  {t.done && <Check className="w-3 h-3 text-white" />}
                </button>
                <span className={`flex-1 text-sm ${t.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.text}</span>
                {t.task_id && <span className="text-[10px] text-green-400">no quadro</span>}
                <button onClick={() => delTask(i)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTask(); } }} placeholder="Digite uma tarefa e Enter" className="bg-secondary border-border text-sm" />
            <Button onClick={addTask} className="gradient-button"><Plus className="w-4 h-4" /></Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Itens não marcados como feitos viram tarefas pendentes no quadro do cliente.</p>
        </Section>

        <Button onClick={salvar} disabled={saving} className="w-full gradient-button py-6 text-base gap-2">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Salvar e distribuir dados
        </Button>
      </div>
    </div>
  );
};

const Section = ({ icon: Icon, title, hint, children }: any) => (
  <div className="rounded-2xl border border-border bg-card/40 p-5">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-primary" />
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {hint && <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{hint}</span>}
    </div>
    {children}
  </div>
);

const FieldRow = ({ label, children }: any) => (
  <div className="space-y-1.5 mb-3 last:mb-0">
    <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
    {children}
  </div>
);

export default Onboarding;
