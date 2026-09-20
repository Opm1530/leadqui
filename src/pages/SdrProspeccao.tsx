import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, Loader2, Sparkles, Save } from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Field = ({ label, hint, value, onChange, rows = 2 }: { label: string; hint?: string; value: string; onChange: (v: string) => void; rows?: number }) => (
  <div className="space-y-1">
    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
    {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
      className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50" />
  </div>
);

const SdrProspeccao = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pb, setPb] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Testar mensagem
  const [testNome, setTestNome] = useState("");
  const [testCidade, setTestCidade] = useState("");
  const [preview, setPreview] = useState("");
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    api.get("/api/sdr/playbook").then(d => setPb(d.playbook)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const set = (k: string, v: any) => setPb((p: any) => ({ ...p, [k]: v }));

  const salvar = async () => {
    setSaving(true);
    try { const d = await api.put("/api/sdr/playbook", pb); setPb(d.playbook); toast({ title: "Playbook salva!" }); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const testar = async () => {
    setPreviewing(true); setPreview("");
    try {
      const d = await api.post("/api/sdr/preview", { nome: testNome || undefined, cidade: testCidade || undefined });
      setPreview(d.message || "");
    } catch (e: any) { toast({ title: "Erro ao gerar", description: e.message, variant: "destructive" }); }
    finally { setPreviewing(false); }
  };

  if (loading || !pb) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-6 py-6">
      <button onClick={() => navigate("/hub")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" /> Voltar ao Hub
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Prospecção IA <span className="text-xs font-normal text-muted-foreground">· SDR</span></h1>
          <p className="text-sm text-muted-foreground">Configure o cérebro do seu SDR e teste a voz das mensagens.</p>
        </div>
      </div>

      {/* Status */}
      <div className="glass-card p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Agente {pb.active ? "ativo" : "em rascunho"}</p>
          <p className="text-xs text-muted-foreground">No modo copiloto, nada é enviado sem a sua aprovação.</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-muted-foreground">Ativar</span>
          <input type="checkbox" checked={!!pb.active} onChange={e => set("active", e.target.checked)} className="w-4 h-4" />
        </label>
      </div>

      {/* Playbook */}
      <div className="glass-card p-5 space-y-4">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Sparkles className="w-4 h-4 text-fuchsia-400" /> Playbook</h2>
        <Field label="Cliente ideal (ICP)" hint="Quem o SDR vai prospectar." value={pb.icp || ""} onChange={v => set("icp", v)} />
        <Field label="Oferta" hint="O que você vende pra esse cliente." value={pb.offer || ""} onChange={v => set("offer", v)} />
        <Field label="Tom de voz" value={pb.tone || ""} onChange={v => set("tone", v)} />
        <Field label="Perguntas de qualificação" hint="O que a IA busca descobrir ao longo da conversa." value={pb.qualifying || ""} onChange={v => set("qualifying", v)} rows={3} />
        <Field label="Diretrizes do 1º contato" value={pb.first_msg_guidance || ""} onChange={v => set("first_msg_guidance", v)} rows={2} />
        <Field label="Diretrizes de follow-up" value={pb.followup_guidance || ""} onChange={v => set("followup_guidance", v)} rows={2} />
        <Field label="Objetivo" value={pb.goal || ""} onChange={v => set("goal", v)} />
        <div className="flex items-end gap-4">
          <div className="w-40">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Novos contatos/dia</label>
            <Input type="number" min={1} max={200} value={pb.daily_limit} onChange={e => set("daily_limit", e.target.value)} className="bg-secondary border-border mt-1" />
          </div>
          <Button onClick={salvar} disabled={saving} className="gradient-button gap-2 ml-auto">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar playbook
          </Button>
        </div>
      </div>

      {/* Testar mensagem */}
      <div className="glass-card p-5 space-y-3 mt-4">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Bot className="w-4 h-4 text-fuchsia-400" /> Testar a voz do SDR</h2>
        <p className="text-xs text-muted-foreground">Gera uma mensagem de 1º contato de exemplo com a playbook atual. (Salve antes pra usar as mudanças.)</p>
        <div className="flex flex-wrap gap-2">
          <Input value={testNome} onChange={e => setTestNome(e.target.value)} placeholder="Nome do restaurante (opcional)" className="flex-1 min-w-[180px] bg-secondary border-border" />
          <Input value={testCidade} onChange={e => setTestCidade(e.target.value)} placeholder="Cidade (opcional)" className="w-40 bg-secondary border-border" />
          <Button onClick={testar} disabled={previewing} variant="outline" className="border-border gap-2">
            {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Gerar
          </Button>
        </div>
        {preview && (
          <div className="rounded-xl bg-[#0b141a] border border-emerald-900/40 p-4">
            <div className="max-w-[85%] rounded-lg rounded-tl-none bg-[#202c33] px-3 py-2 text-sm text-gray-100 whitespace-pre-wrap">{preview}</div>
            <p className="text-[10px] text-muted-foreground mt-2">Prévia de como a mensagem chegaria no WhatsApp.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SdrProspeccao;
