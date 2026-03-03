import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Edit2, Trash2 } from "lucide-react";
import { auth, db } from "@/integrations/firebase/client";
import { firestoreService } from "@/lib/firestore";
import { collection, query, where, onSnapshot, limit, orderBy } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import TagBadge from "@/components/TagBadge";
import LeadEditModal from "@/components/LeadEditModal";

const statusColors: Record<string, string> = {
  novo: "bg-primary/20 text-primary",
  contatado: "bg-warning/20 text-warning",
  respondeu: "bg-info/20 text-info",
  convertido: "bg-success/20 text-success",
};

const Leads = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [originFilter, setOriginFilter] = useState("todos");
  const [tagFilter, setTagFilter] = useState("todos");
  const [tags, setTags] = useState<any[]>([]);
  const [leadTags, setLeadTags] = useState<Record<string, any[]>>({});
  const [editingLead, setEditingLead] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    const fetchTags = async () => {
      const data = await firestoreService.list("tags", user.uid);
      setTags(data);
    };
    fetchTags();

    setLoading(true);

    // We remove the user_id filter to show all leads in the system.
    const q = query(
      collection(db, "leads"),
      limit(1000)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: (doc.data() as any).created_at?.toDate?.()?.toISOString() || (doc.data() as any).created_at,
        updated_at: (doc.data() as any).updated_at?.toDate?.()?.toISOString() || (doc.data() as any).updated_at,
      }));

      // Sort client-side
      const sortedData = [...data].sort((a, b) => {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });

      console.log(`Leads raw data received: ${data.length} items`);
      setLeads(sortedData);
      setLoading(false);

      // Fetch tags for these leads
      const leadIds = data.map(l => l.id);
      if (leadIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < leadIds.length; i += 30) {
          chunks.push(leadIds.slice(i, i + 30));
        }

        try {
          const lTags = await firestoreService.getLeadTags(leadIds);
          setLeadTags(lTags);
        } catch (err) {
          console.error("Error fetching lead tags:", err);
        }
      }
    }, (error) => {
      console.error("Error fetching leads:", error);
      toast({ title: "Erro ao carregar leads", description: error.message, variant: "destructive" });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]); // Only re-run if user changes. Filter changes are handled client-side below.

  // Client-side search and tag filter
  const filteredLeads = leads.filter((lead) => {
    const lowSearch = searchTerm.toLowerCase();
    // Search term check
    const matchesSearch = !searchTerm ||
      (lead.nome?.toLowerCase().includes(lowSearch)) ||
      (lead.telefone?.toLowerCase().includes(lowSearch)) ||
      (lead.username?.toLowerCase().includes(lowSearch));

    // Tag check
    const matchesTag = tagFilter === "todos" ||
      (leadTags[lead.id] || []).some((t: any) => t.id === tagFilter);

    // Status check (case-insensitive)
    const matchesStatus = statusFilter === "todos" ||
      lead.status?.toLowerCase() === statusFilter.toLowerCase();

    // Origin check (flexible matching)
    const normalizedOriginFilter = originFilter === "Google Maps" ? "google_maps" :
      originFilter === "Instagram" ? "instagram" : originFilter;

    const matchesOrigin = originFilter === "todos" ||
      lead.origem?.toLowerCase() === normalizedOriginFilter.toLowerCase() ||
      lead.origem?.toLowerCase() === originFilter.toLowerCase();

    return matchesSearch && matchesTag && matchesStatus && matchesOrigin;
  });

  const handleDelete = async (id: string) => {
    try {
      await firestoreService.delete("leads", id);
      toast({ title: "Lead excluído" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const formatOrigem = (origem: string) => {
    if (origem === "google_maps") return "Google Maps";
    if (origem === "instagram") return "Instagram";
    return origem;
  };

  const createTestLead = async () => {
    if (!user) return;
    try {
      await firestoreService.add("leads", user.uid, {
        nome: "Lead de Teste " + new Date().toLocaleTimeString(),
        telefone: "11999999999",
        origem: "google_maps",
        status: "novo",
        created_at: new Date().toISOString()
      });
      toast({ title: "Lead de teste criado!" });
    } catch (error: any) {
      toast({ title: "Erro ao criar teste", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meus Leads</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-muted-foreground text-sm">
              Total no banco: <span className="text-primary font-bold">{leads.length}</span>
            </p>
            <span className="text-muted-foreground/30">|</span>
            <p className="text-muted-foreground text-sm">
              Filtrados: <span className="text-success font-bold">{filteredLeads.length}</span>
            </p>
            <span className="text-muted-foreground/30">|</span>
            <p className="text-muted-foreground text-xs font-mono bg-secondary px-2 py-0.5 rounded">
              UID: {user?.uid?.substring(0, 8)}...
            </p>
          </div>
        </div>
        <button
          onClick={createTestLead}
          className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-secondary transition-colors text-muted-foreground"
        >
          Criar Lead de Teste
        </button>
      </div>

      <div className="glass-card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-secondary border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] bg-secondary border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="novo">Novo</SelectItem>
              <SelectItem value="contatado">Contatado</SelectItem>
              <SelectItem value="respondeu">Respondeu</SelectItem>
              <SelectItem value="convertido">Convertido</SelectItem>
            </SelectContent>
          </Select>
          <Select value={originFilter} onValueChange={setOriginFilter}>
            <SelectTrigger className="w-[160px] bg-secondary border-border">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas origens</SelectItem>
              <SelectItem value="Instagram">Instagram</SelectItem>
              <SelectItem value="Google Maps">Google Maps</SelectItem>
            </SelectContent>
          </Select>
          {tags.length > 0 && (
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-[150px] bg-secondary border-border">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas tags</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {leads.length === 0
              ? "Nenhum lead encontrado. Comece extraindo leads na aba Extração."
              : "Nenhum lead corresponde aos filtros selecionados."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Origem</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cidade</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, i) => (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="p-4 text-sm text-foreground font-medium">{lead.nome}</td>
                    <td className="p-4 text-sm text-muted-foreground">{lead.telefone || "-"}</td>
                    <td className="p-4 text-sm text-muted-foreground">{formatOrigem(lead.origem)}</td>
                    <td className="p-4 text-sm text-muted-foreground">{lead.cidade || "-"}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {(leadTags[lead.id] || []).map((t: any) => (
                          <TagBadge key={t.id} nome={t.nome} cor={t.cor} />
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[lead.status] || ""}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{new Date(lead.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingLead(lead)}
                          className="p-1.5 rounded-md hover:bg-primary/20 transition-colors text-muted-foreground hover:text-primary"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(lead.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive"
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

      <LeadEditModal
        lead={editingLead}
        open={!!editingLead}
        onClose={() => setEditingLead(null)}
        onSaved={() => { }}
      />
    </div>
  );
};

export default Leads;
