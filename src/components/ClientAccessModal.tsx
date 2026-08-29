import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Check, KeyRound, Mail, AlertCircle, Globe, Send, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

interface ClientAccessModalProps {
  client: any;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const genPassword = () => Math.random().toString(36).slice(-4) + Math.random().toString(36).slice(-4).toUpperCase() + "!" + Math.floor(Math.random() * 90 + 10);
const MODULES = [{ id: "CRM", label: "CRM" }, { id: "LEADS", label: "Leads" }, { id: "FORMS", label: "Formulários" }];

const ClientAccessModal = ({ client, open, onClose, onSaved }: ClientAccessModalProps) => {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loginUrl = `${window.location.origin}/`;
  const hasAccess = client?.email && client?.initial_password;

  // Form de criação de acesso (para clientes sem login)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [modules, setModules] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && client) {
      setEmail(client.email || "");
      setPassword(genPassword());
      setModules(client.enabled_modules || []);
    }
  }, [open, client]);

  const criarAcesso = async () => {
    if (!email.trim() || !password) { toast({ title: "Informe e-mail e senha.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await api.put(`/api/clients/${client.id}`, { email: email.trim(), initial_password: password, enabled_modules: modules });
      toast({ title: "Acesso criado!", description: `Login criado para ${email.trim()}` });
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast({ title: "Erro ao criar acesso", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const copy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast({ title: "Copiado para a área de transferência!" });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const copyAll = () => {
    copy(
      `Acesso ao Portal — ${client?.name}\n\nURL: ${loginUrl}\nE-mail: ${client?.email}\nSenha: ${client?.initial_password}`,
      "all"
    );
  };

  const CopyBtn = ({ field, value }: { field: string; value: string }) => (
    <button
      onClick={() => copy(value, field)}
      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
    >
      {copiedField === field
        ? <Check className="w-4 h-4 text-green-400" />
        : <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-primary" />
            </div>
            Acesso do Cliente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground">
            Credenciais de <span className="font-semibold text-foreground">{client?.name}</span> para acessar
            o portal <span className="text-primary font-semibold">ViewQui</span>.
          </p>

          {!hasAccess ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <AlertCircle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <p className="text-xs text-orange-400/80">Este cliente ainda não tem login. Crie o acesso abaixo para liberar o portal e os módulos.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">E-mail de acesso</label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@empresa.com" className="bg-secondary border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Senha inicial</label>
                <div className="flex gap-2">
                  <Input value={password} onChange={e => setPassword(e.target.value)} className="bg-secondary border-border font-mono" />
                  <button type="button" onClick={() => setPassword(genPassword())} title="Gerar senha" className="p-2 rounded-md bg-secondary border border-border hover:bg-secondary/80 text-muted-foreground"><RefreshCw className="w-4 h-4" /></button>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1"><KeyRound className="w-3 h-3" /> Anote a senha — não será exibida de novo.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Módulos liberados</label>
                <div className="grid grid-cols-3 gap-2 p-3 bg-secondary/50 rounded-lg border border-border/50">
                  {MODULES.map(m => (
                    <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={modules.includes(m.id)} onCheckedChange={() => setModules(p => p.includes(m.id) ? p.filter(x => x !== m.id) : [...p, m.id])} />
                      <span className="text-xs text-foreground">{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={criarAcesso} disabled={saving} className="w-full gradient-button">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar acesso do cliente"}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* URL de acesso */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-secondary border border-border">
                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    URL de Acesso
                  </p>
                  <p className="text-sm font-mono text-foreground truncate">{loginUrl}</p>
                </div>
                <CopyBtn field="url" value={loginUrl} />
              </div>

              {/* E-mail */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-secondary border border-border">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    E-mail
                  </p>
                  <p className="text-sm font-mono text-foreground truncate">{client.email}</p>
                </div>
                <CopyBtn field="email" value={client.email} />
              </div>

              {/* Senha */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-secondary border border-border">
                <KeyRound className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Senha Inicial
                  </p>
                  <p className="text-sm font-mono text-foreground">{client.initial_password}</p>
                </div>
                <CopyBtn field="password" value={client.initial_password} />
              </div>

              {/* Copiar tudo */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 mt-2 h-9"
                onClick={copyAll}
              >
                {copiedField === "all"
                  ? <><Check className="w-4 h-4 text-green-400" /> Copiado!</>
                  : <><Send className="w-4 h-4" /> Copiar tudo para enviar ao cliente</>}
              </Button>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
            <AlertCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-400/80 leading-relaxed">
              A senha acima é a cadastrada. Se o cliente alterar a senha no portal,
              ela não será atualizada aqui. Nesse caso, edite o cliente para redefinir.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientAccessModal;
