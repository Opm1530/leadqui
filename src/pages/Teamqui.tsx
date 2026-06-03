import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  UserPlus, 
  Mail, 
  Shield, 
  Trash2, 
  Search,
  MoreVertical,
  CheckCircle2,
  XCircle
} from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

const Teamqui = () => {
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("OPERATOR");
  const [newPosition, setNewPosition] = useState("");

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    try {
      const response = await api.get("/api/teamqui");
      setTeam(response);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar a equipe.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/api/teamqui", {
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
        position: newPosition
      });
      toast({ title: "Sucesso", description: "Membro adicionado à equipe." });
      setIsAdding(false);
      resetForm();
      fetchTeam();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.response?.data?.error || "Erro ao adicionar membro.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este membro?")) return;
    try {
      await api.delete(`/api/teamqui/${id}`);
      toast({ title: "Removido", description: "Membro removido com sucesso." });
      fetchTeam();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.response?.data?.error || "Erro ao remover membro.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewRole("OPERATOR");
    setNewPosition("");
  };

  const filteredTeam = team.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
            Gestão de Equipe
          </h1>
          <p className="text-muted-foreground mt-1">
            Controle quem acessa e opera no ecossistema da agência.
          </p>
        </div>

        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <button className="gradient-button px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-orange-500/10">
              <UserPlus className="w-5 h-5" />
              NOVO MEMBRO
            </button>
          </DialogTrigger>
          <DialogContent className="bg-secondary border-border">
            <DialogHeader>
              <DialogTitle>Adicionar à Equipe</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddMember} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: João Silva" required />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" placeholder="joao@agencia.com" required />
              </div>
              <div className="space-y-2">
                <Label>Senha Inicial</Label>
                <Input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" placeholder="••••••••" required />
              </div>
              <div className="space-y-2">
                <Label>Cargo / Permissão</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Administrador (Total)</SelectItem>
                    <SelectItem value="MANAGER">Gestor (Operação)</SelectItem>
                    <SelectItem value="OPERATOR">Operador (Tarefas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cargo / Função (Tag)</Label>
                <Input value={newPosition} onChange={e => setNewPosition(e.target.value)} placeholder="Ex: Designer, Tráfego, Copy..." />
              </div>
              <button type="submit" className="w-full gradient-button py-3 mt-4 rounded-xl font-bold">
                CADASTRAR MEMBRO
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..." 
            className="pl-10 bg-secondary/50 border-border"
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-black/20">
              <th className="p-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Membro</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cargo</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Acesso</th>
              <th className="p-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              [1, 2, 3].map(i => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={4} className="p-4 h-16 bg-white/5" />
                </tr>
              ))
            ) : filteredTeam.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-12 text-center text-muted-foreground">
                  Nenhum membro encontrado.
                </td>
              </tr>
            ) : filteredTeam.map((member) => (
              <tr key={member.id} className="group hover:bg-white/[0.02] transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400/20 to-yellow-400/20 flex items-center justify-center text-orange-400 font-bold border border-orange-500/10">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{member.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {member.email}
                      </div>
                      {member.position && (
                        <div className="mt-1">
                          <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-[10px] font-bold border border-orange-500/20">
                            {member.position}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase border ${
                    member.role === 'ADMIN' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                    member.role === 'MANAGER' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                    'bg-slate-500/10 text-slate-400 border-slate-500/20'
                  }`}>
                    {member.role === 'ADMIN' ? 'Administrador' : 
                     member.role === 'MANAGER' ? 'Gestor' : 'Operador'}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 text-sm text-green-500">
                    <CheckCircle2 className="w-4 h-4" />
                    Ativo
                  </div>
                </td>
                <td className="p-4 text-right">
                  <button 
                    onClick={() => handleDelete(member.id)}
                    className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Teamqui;
