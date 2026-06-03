import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

const DEFAULT_SERVICES = [
  "Gestão de Tráfego",
  "Social Media",
  "CRM",
  "Automação",
  "Design",
  "Landing Page",
];

interface ClientEditModalProps {
  client: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const ClientEditModal = ({ client, open, onClose, onSaved }: ClientEditModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("ATIVO");
  const [monthlyValue, setMonthlyValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [duration, setDuration] = useState("12");
  const [responsible, setResponsible] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  // Preenche o formulário quando o cliente mudar
  useEffect(() => {
    if (client && open) {
      setName(client.name || "");
      setEmail(client.email || "");
      setStatus(client.status || "ATIVO");
      // Preenche contrato se existir (já vem incluso na resposta da API)
      if (client.contract) {
        setMonthlyValue(client.contract.value?.toString() || "");
        setStartDate(client.contract.start_date ? client.contract.start_date.slice(0, 10) : "");
        setDuration(client.contract.duration?.toString() || "12");
        setResponsible(client.contract.responsible || "");
      } else {
        setMonthlyValue("");
        setStartDate("");
        setDuration("12");
        setResponsible("");
      }
      // Preenche serviços
      setSelectedServices((client.services || []).map((s: any) => s.service));
    }
  }, [client, open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await api.put(`/api/clients/${client.id}`, {
        name: name.trim(),
        email: email || null,
        status,
        contract: {
          value: monthlyValue || "0",
          start_date: startDate || new Date().toISOString(),
          duration: duration || "12",
          responsible: responsible || null,
        },
        services: selectedServices,
      });

      toast({ title: "Cliente atualizado!", description: "Dados, contrato e serviços salvos." });
      onSaved();
      onClose();
    } catch (error: any) {
      toast({ title: "Erro na atualização", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (service: string) => {
    setSelectedServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle>Editar Cliente e Contrato</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2 pb-4">
          {/* Dados do Cliente */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Empresa / Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="INATIVO">Inativo</SelectItem>
                  <SelectItem value="INADIMPLENTE">Inadimplente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <hr className="border-border/50" />

          {/* Contrato */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-primary/80 uppercase tracking-widest">Informações do Contrato</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Valor Mensal (R$)</Label>
                <Input type="number" value={monthlyValue} onChange={(e) => setMonthlyValue(e.target.value)} className="bg-secondary border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Duração (Meses)</Label>
                <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="bg-secondary border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Data de Início</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-secondary border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-widest">Resp. Interno</Label>
                <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} className="bg-secondary border-border" />
              </div>
            </div>

            {/* Serviços */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-widest">Serviços Contratados</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-secondary/50 rounded-lg border border-border/50">
                {DEFAULT_SERVICES.map((service) => (
                  <div key={service} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-${service}`}
                      checked={selectedServices.includes(service)}
                      onCheckedChange={() => toggleService(service)}
                    />
                    <label htmlFor={`edit-${service}`} className="text-xs font-medium text-foreground cursor-pointer">
                      {service}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 bg-card pt-2 border-t border-border mt-2">
          <Button variant="outline" onClick={onClose} disabled={loading} className="border-border">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading} className="gradient-button px-6">
            {loading ? "Salvando..." : "Salvar Todas Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClientEditModal;
