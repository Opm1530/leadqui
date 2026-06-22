import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "@/lib/api";
import { ArrowLeft, Loader2, Building2, Search } from "lucide-react";

const ClientesGrid = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/api/clients").then(d => setClients(d.clients || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-6 py-6">
      <button onClick={() => navigate("/hub")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" /> Voltar ao Hub
      </button>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground text-sm">Selecione um cliente para acessar tudo dele</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..."
            className="pl-9 pr-3 h-10 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/50 w-56" />
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-16">Nenhum cliente encontrado.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((c, i) => (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => navigate(`/cliente/${c.id}`)}
              className="group text-left rounded-2xl border border-border bg-card/40 p-5 hover:bg-card/80 hover:border-primary/30 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <span className="text-white font-black text-lg">{(c.name || "?").charAt(0).toUpperCase()}</span>
              </div>
              <p className="font-semibold text-foreground truncate">{c.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.status === "ATIVO" ? "bg-green-500/20 text-green-300" : "bg-secondary text-muted-foreground"}`}>{c.status}</span>
                {c.contract?.value != null && <span className="text-[11px] text-muted-foreground">{Number(c.contract.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês</span>}
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientesGrid;
