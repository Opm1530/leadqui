import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, KeyRound, Mail, AlertCircle, Globe, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ClientAccessModalProps {
  client: any;
  open: boolean;
  onClose: () => void;
}

const ClientAccessModal = ({ client, open, onClose }: ClientAccessModalProps) => {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loginUrl = `${window.location.origin}/`;
  const hasAccess = client?.email && client?.initial_password;

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
            <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <AlertCircle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-orange-400">Sem acesso configurado</p>
                <p className="text-xs text-orange-400/70 mt-0.5">
                  Este cliente não tem e-mail ou senha definidos. Edite o cliente para criar as credenciais de acesso.
                </p>
              </div>
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
