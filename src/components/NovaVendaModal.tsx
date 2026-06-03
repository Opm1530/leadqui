import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LayoutTemplate, Receipt, Briefcase, Rocket } from "lucide-react";
import api from "@/lib/api";

interface NovaVendaModalProps {
  client: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const NovaVendaModal = ({ client, open, onClose, onSaved }: NovaVendaModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);

  const [isUniqueJob, setIsUniqueJob] = useState(true);
  const [jobName, setJobName] = useState("");
  const [value, setValue] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedTemplate, setSelectedTemplate] = useState("none");

  useEffect(() => {
    api.get("/api/templates").then(d => setTemplates(d.templates || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      setJobName("");
      setValue("");
      setDueDate(new Date().toISOString().split("T")[0]);
      setSelectedTemplate("none");
      setIsUniqueJob(true);
    }
  }, [open]);

  const handleSave = async () => {
    if (!jobName.trim() || !value) {
      toast({ title: "Nome do serviço e valor são obrigatórios.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await api.post(`/api/clients/${client.id}/nova-venda`, {
        isUniqueJob,
        jobName: jobName.trim(),
        value,
        due_date: dueDate,
        template_id: selectedTemplate !== "none" ? selectedTemplate : undefined,
      });

      toast({
        title: "Nova venda registrada!",
        description: `Projeto "${jobName}" criado e fatura gerada para ${client.name}.`,
      });
      onSaved();
      onClose();
    } catch (error: any) {
      toast({ title: "Erro ao registrar venda", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-orange-400" />
            Nova Venda — {client.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Tipo */}
          <div className="flex p-1 bg-secondary/50 rounded-xl border border-border">
            <button
              onClick={() => setIsUniqueJob(true)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${isUniqueJob ? "bg-primary text-white shadow-lg" : "text-muted-foreground"}`}
            >
              JOB ÚNICO (PONTUAL)
            </button>
            <button
              onClick={() => setIsUniqueJob(false)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${!isUniqueJob ? "bg-primary text-white shadow-lg" : "text-muted-foreground"}`}
            >
              RECORRÊNCIA (MENSAL)
            </button>
          </div>

          {/* Nome do serviço */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" />
              {isUniqueJob ? "O que será entregue? *" : "Nome do Serviço *"}
            </Label>
            <Input
              value={jobName}
              onChange={e => setJobName(e.target.value)}
              placeholder={isUniqueJob ? "Ex: Identidade Visual, Site, Vídeo..." : "Ex: Gestão de Tráfego, Social Media..."}
              className="bg-secondary border-border"
              autoFocus
            />
          </div>

          {/* Valor + Data */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" />
                {isUniqueJob ? "Valor do Job (R$) *" : "Valor Mensal (R$) *"}
              </Label>
              <Input
                type="number"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="0,00"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                {isUniqueJob ? "Data de Vencimento" : "Início da Recorrência"}
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="bg-secondary border-border"
              />
            </div>
          </div>

          {/* Template */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <LayoutTemplate className="w-3.5 h-3.5 text-blue-400" />
              Template de Tarefas
            </Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Nenhum — sem tarefas automáticas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum — sem tarefas automáticas</SelectItem>
                {templates.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.items?.length > 0 && ` (${t.items.length} tarefa${t.items.length > 1 ? "s" : ""})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate !== "none" && (
              <p className="text-xs text-blue-400/80">
                ✓ As tarefas do template serão criadas automaticamente no novo projeto.
              </p>
            )}
          </div>

          {/* Resumo */}
          <div className="p-3 rounded-xl bg-secondary/50 border border-border text-xs text-muted-foreground space-y-1">
            <p className="font-bold text-foreground text-sm mb-2">Ao confirmar será criado:</p>
            <p>✓ Projeto <span className="text-foreground font-medium">"{jobName || "..."}"</span> ({isUniqueJob ? "Job Único" : "Recorrente"}) no Tasqui</p>
            {selectedTemplate !== "none" && (
              <p>✓ Tarefas do template aplicadas automaticamente</p>
            )}
            <p>✓ Fatura de <span className="text-green-400 font-bold">
              {value ? `R$ ${parseFloat(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "R$ ..."}
            </span> gerada no CashQui</p>
            {client.status === "INATIVO" && (
              <p>✓ Status do cliente reativado para <span className="text-green-400 font-bold">ATIVO</span></p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading} className="border-border">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading} className="gradient-button px-6 gap-2">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</>
              : <><Rocket className="w-4 h-4" /> Registrar Venda</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NovaVendaModal;
