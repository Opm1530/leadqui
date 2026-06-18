import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, RefreshCw, Loader2, LayoutTemplate } from "lucide-react";
import api from "@/lib/api";

const DEFAULT_SERVICES = [
  "Gestão de Tráfego",
  "Social Media",
  "CRM",
  "Automação",
  "Design",
  "Landing Page",
];

interface ConvertLeadModalProps {
  lead: any;
  open: boolean;
  onClose: () => void;
  onConverted: () => void;
  userId: string;
}

const ConvertLeadModal = ({ lead, open, onClose, onConverted }: ConvertLeadModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [monthlyValue, setMonthlyValue] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [duration, setDuration] = useState("12");
  const [responsible, setResponsible] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("none");

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let pass = "";
    for (let i = 0; i < 10; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
    setPassword(pass);
  };

  const [isUniqueJob, setIsUniqueJob] = useState(false);
  const [uniqueJobName, setUniqueJobName] = useState("");

  useEffect(() => {
    api.get("/api/templates").then(d => setTemplates(d.templates || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (lead) {
      setCompanyName(lead.nome || "");
      setEmail(lead.email || "");
      generatePassword();
      // Pré-carrega a proposta cadastrada no lead, se houver
      let svcs: string[] = [];
      try { svcs = lead.servicos_propostos ? JSON.parse(lead.servicos_propostos) : []; } catch {}
      setSelectedServices(Array.isArray(svcs) ? svcs : []);
      setMonthlyValue(lead.valor_proposto != null ? String(lead.valor_proposto) : "");
      setDuration(lead.duracao_proposta != null ? String(lead.duracao_proposta) : "12");
      setResponsible(lead.responsavel_proposto || "");
      setIsUniqueJob(false);
      setUniqueJobName("");
      setSelectedTemplate("none");
    }
  }, [lead]);

  const handleConvert = async () => {
    if (!companyName || !monthlyValue || !startDate || !responsible) {
      toast({ title: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }
    if (isUniqueJob && !uniqueJobName) {
      toast({ title: "Informe o nome do serviço único.", variant: "destructive" });
      return;
    }
    if (!email || !password) {
      toast({ title: "E-mail e senha são obrigatórios para criar o acesso.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/clients", {
        name: companyName,
        email,
        origin_lead_id: lead.id,
        initial_password: password,
        status: "ATIVO",
        isUniqueJob,
        uniqueJobName,
        template_id: selectedTemplate !== "none" ? selectedTemplate : undefined,
        contract: {
          value: monthlyValue,
          start_date: startDate,
          duration: isUniqueJob ? "0" : duration,
          responsible,
        },
        services: isUniqueJob ? [] : selectedServices,
      });

      toast({ title: "Lead convertido em Cliente!", description: `Acesso criado para ${email}` });
      onConverted();
      onClose();
    } catch (error: any) {
      toast({ title: "Erro ao converter", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (service: string) => {
    setSelectedServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle>Converter Lead em Cliente</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Tipo de Contrato */}
          <div className="flex p-1 bg-secondary/50 rounded-xl border border-border">
             <button 
               onClick={() => setIsUniqueJob(false)}
               className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${!isUniqueJob ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground'}`}
             >
               RECORRÊNCIA (MENSAL)
             </button>
             <button 
               onClick={() => setIsUniqueJob(true)}
               className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${isUniqueJob ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground'}`}
             >
               JOB ÚNICO (PONTUAL)
             </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Nome da Empresa *</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="bg-secondary border-border" />
            </div>
            
            {isUniqueJob && (
               <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-widest">O que será entregue? *</Label>
                  <Input 
                    value={uniqueJobName} 
                    onChange={(e) => setUniqueJobName(e.target.value)} 
                    placeholder="Ex: Desenvolvimento de Site, Identidade Visual..."
                    className="bg-secondary border-border border-orange-500/30" 
                  />
               </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                {isUniqueJob ? "Valor do Job (R$) *" : "Valor Mensal (R$) *"}
              </Label>
              <Input type="number" value={monthlyValue} onChange={(e) => setMonthlyValue(e.target.value)} className="bg-secondary border-border" />
            </div>
            
            <div className="space-y-1.5">
              {!isUniqueJob ? (
                <>
                  <Label className="text-xs text-muted-foreground uppercase tracking-widest">Duração (meses)</Label>
                  <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="bg-secondary border-border" />
                </>
              ) : (
                <>
                  <Label className="text-xs text-muted-foreground uppercase tracking-widest">Data Prevista *</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-secondary border-border" />
                </>
              )}
            </div>

            {!isUniqueJob && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Data de Início *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-secondary border-border" />
              </div>
            )}
            
            <div className={`space-y-1.5 ${isUniqueJob ? 'col-span-1' : ''}`}>
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Responsável Interno *</Label>
              <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>

          {!isUniqueJob && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Serviços Contratados</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-secondary/50 rounded-lg border border-border/50">
                {DEFAULT_SERVICES.map((service) => (
                  <div key={service} className="flex items-center space-x-2">
                    <Checkbox id={`svc-${service}`} checked={selectedServices.includes(service)} onCheckedChange={() => toggleService(service)} />
                    <label htmlFor={`svc-${service}`} className="text-xs font-medium text-foreground cursor-pointer">{service}</label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Template de Onboarding */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <LayoutTemplate className="w-3.5 h-3.5 text-blue-400" />
              Template de Onboarding
            </Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Selecionar template..." />
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
                ✓ As tarefas deste template serão criadas automaticamente ao confirmar.
              </p>
            )}
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground/60">
                Nenhum template criado ainda. Crie em Tasqui → Templates.
              </p>
            )}
          </div>

          <hr className="border-border/50" />

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-primary/80 uppercase tracking-widest">Acesso ao Sistema</h4>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">E-mail de Acesso *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@empresa.com" className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Senha Inicial *</Label>
              <div className="flex gap-2">
                <Input value={password} onChange={(e) => setPassword(e.target.value)} className="bg-secondary border-border font-mono" />
                <button type="button" onClick={generatePassword} title="Gerar nova senha" className="p-2 rounded-md bg-secondary border border-border hover:bg-secondary/80 transition-colors text-muted-foreground">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <KeyRound className="w-3 h-3" /> Anote a senha — ela não será exibida novamente.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 bg-card pt-2 border-t border-border mt-4">
          <Button variant="outline" onClick={onClose} disabled={loading} className="border-border">Cancelar</Button>
          <Button onClick={handleConvert} disabled={loading} className="gradient-button px-6">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Convertendo...</> : "Converter em Cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConvertLeadModal;
