import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Search, Briefcase, Edit2, Rocket, PlusCircle, KeyRound, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import ClientEditModal from "@/components/ClientEditModal";
import NovaVendaModal from "@/components/NovaVendaModal";
import ClientAccessModal from "@/components/ClientAccessModal";
import api from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  ATIVO: "bg-success/20 text-success",
  INATIVO: "bg-destructive/20 text-destructive",
  INADIMPLENTE: "bg-orange-500/20 text-orange-400",
};

const Clients = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingClient, setEditingClient] = useState<any>(null);
  const [novaVendaClient, setNovaVendaClient] = useState<any>(null);
  const [accessClient, setAccessClient] = useState<any>(null);

  const fetchClients = useCallback(async () => {
    try {
      const data = await api.get("/api/clients");
      setClients(data.clients || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar clientes", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!user) return;
    fetchClients();
  }, [user, fetchClients]);

  const filteredClients = clients.filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (client: any) => {
    const confirmed = confirm(
      `Excluir "${client.name}"?\n\nIsso irá apagar permanentemente:\n• Projetos e tarefas\n• Calendário editorial\n• Campanhas de tráfego\n• Cofre de senhas\n• Conexões Meta\n\nO histórico de pagamentos (faturas) será preservado.\n\nEsta ação não pode ser desfeita.`
    );
    if (!confirmed) return;
    try {
      await api.delete(`/api/clients/${client.id}`);
      toast({ title: "Cliente excluído", description: `"${client.name}" e todos os dados relacionados foram removidos.` });
      fetchClients();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" />
            Gestão de Clientes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Total: <span className="text-primary font-bold">{clients.length}</span> clientes no sistema.
          </p>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome da empresa/cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Briefcase className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            {clients.length === 0
              ? "Nenhum cliente cadastrado ainda. Use o CRM para converter leads em clientes."
              : "Nenhum cliente encontrado com este nome."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente / Empresa</th>
                  <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">E-mail</th>
                  <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contrato</th>
                  <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jobs Únicos</th>
                  <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Serviços Recorrentes</th>
                  <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client, i) => (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{client.name}</span>
                        {client.origin_lead_id && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 opacity-60">
                            <Briefcase className="w-2.5 h-2.5" /> Lead #{client.origin_lead_id.slice(-6)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{client.email || "—"}</td>
                    <td className="p-4">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_COLORS[client.status] || ""}`}>
                        {client.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-semibold text-green-500">
                      {client.contract?.value
                        ? `R$ ${Number(client.contract.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-2">
                         {client.projects?.filter((p: any) => p.type === 'UNICO' && p.status !== 'CONCLUIDO').map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between gap-2 p-1.5 bg-orange-500/10 border border-orange-500/20 rounded group/job">
                               <span className="text-[10px] font-bold text-orange-400 truncate max-w-[100px]">{p.name}</span>
                               <button 
                                 onClick={async () => {
                                    try {
                                      await api.patch(`/api/tasqui/projects/${p.id}`, { status: 'CONCLUIDO' });
                                      toast({ title: "Job Concluído!", description: `O projeto ${p.name} foi finalizado.` });
                                      fetchClients();
                                    } catch (e) {
                                      toast({ title: "Erro", description: "Não foi possível concluir o job.", variant: "destructive" });
                                    }
                                 }}
                                 className="p-1 rounded bg-orange-500 text-white opacity-0 group-hover/job:opacity-100 transition-all hover:scale-110"
                                 title="Marcar como Concluído"
                               >
                                  <Rocket className="w-3 h-3" />
                               </button>
                            </div>
                         ))}
                         {client.projects?.filter((p: any) => p.type === 'UNICO' && p.status !== 'CONCLUIDO').length === 0 && (
                            <span className="text-[10px] text-muted-foreground italic">Nenhum ativo</span>
                         )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {(client.services || []).slice(0, 3).map((s: any) => (
                          <span key={s.id} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase font-bold">
                            {s.service}
                          </span>
                        ))}
                        {(client.services || []).length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{client.services.length - 3}</span>
                        )}
                        {(client.services || []).length === 0 && <span className="text-[10px] text-muted-foreground italic">Sem recorrência</span>}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setNovaVendaClient(client)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-bold transition-colors"
                          title="Nova Venda"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          Nova Venda
                        </button>
                        <button
                          onClick={() => setAccessClient(client)}
                          className="p-2 rounded-md hover:bg-indigo-500/20 transition-colors text-muted-foreground hover:text-indigo-400"
                          title="Ver acesso do cliente"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingClient(client)}
                          className="p-2 rounded-md hover:bg-primary/20 transition-colors text-muted-foreground hover:text-primary"
                          title="Editar Cliente"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(client)}
                          className="p-2 rounded-md hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive"
                          title="Excluir Cliente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ClientEditModal
        client={editingClient}
        open={!!editingClient}
        onClose={() => setEditingClient(null)}
        onSaved={fetchClients}
      />

      <NovaVendaModal
        client={novaVendaClient}
        open={!!novaVendaClient}
        onClose={() => setNovaVendaClient(null)}
        onSaved={fetchClients}
      />

      <ClientAccessModal
        client={accessClient}
        open={!!accessClient}
        onClose={() => setAccessClient(null)}
      />
    </div>
  );
};

export default Clients;
