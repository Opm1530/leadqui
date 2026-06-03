import { useState, useEffect } from "react";
import { ShieldAlert, Users, ArrowRight, Crown, Briefcase, Wrench, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";

const ROLE_CFG: Record<string, {
  label: string;
  description: string;
  permissions: string[];
  icon: any;
  color: string;
  bg: string;
  border: string;
}> = {
  ADMIN: {
    label: "Administrador",
    description: "Controle total do sistema. Pode gerenciar equipe, ver financeiro, configurar integrações e acessar todos os módulos.",
    permissions: [
      "Todos os módulos (LeadQui, Tasqui, CashQui, TeamQui)",
      "Gestão de equipe e permissões",
      "Configurações globais e integrações",
      "Relatórios financeiros completos",
      "Criar e excluir clientes",
    ],
    icon: Crown,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  MANAGER: {
    label: "Gestor",
    description: "Gestão operacional da agência. Pode criar e acompanhar clientes, projetos, tarefas e visualizar o financeiro.",
    permissions: [
      "LeadQui: leads, CRM, clientes, extrações",
      "Tasqui: tarefas, calendário, tráfego, jobs",
      "CashQui: faturas, despesas e relatórios (leitura)",
      "Não gerencia equipe nem configurações globais",
    ],
    icon: Briefcase,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  OPERATOR: {
    label: "Operador",
    description: "Focado na execução. Visualiza e atualiza as tarefas atribuídas. Sem acesso ao financeiro.",
    permissions: [
      "Tasqui: ver e atualizar tarefas atribuídas a si",
      "Calendário editorial (leitura)",
      "Sem acesso ao CashQui",
      "Sem acesso a configurações",
    ],
    icon: Wrench,
    color: "text-slate-300",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
  },
  CLIENT: {
    label: "Cliente",
    description: "Acesso exclusivo ao portal ViewQui. Visualiza tarefas, calendário editorial, campanhas e faturas do próprio cliente.",
    permissions: [
      "Portal ViewQui (acesso via /viewqui)",
      "Ver tarefas e status de projetos",
      "Aprovar posts do calendário editorial",
      "Ver campanhas de tráfego pago",
      "Ver faturas próprias",
    ],
    icon: Eye,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
};

const Roles = () => {
  const navigate = useNavigate();
  const [team, setTeam] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);

  useEffect(() => {
    api.get("/api/teamqui")
      .then((data: any) => setTeam(data.team || []))
      .catch(() => {})
      .finally(() => setLoadingTeam(false));
  }, []);

  const countByRole = (role: string) => team.filter(m => m.role === role).length;
  const membersByRole = (role: string) => team.filter(m => m.role === role);

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-4 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
            Cargos e Permissões
          </h1>
          <p className="text-muted-foreground mt-1">
            Níveis de acesso do ecossistema Pequi Digital.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => navigate("/teamqui")}
        >
          <Users className="w-4 h-4" />
          Gerenciar Equipe
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="grid gap-4">
        {Object.entries(ROLE_CFG).map(([roleKey, cfg]) => {
          const Icon = cfg.icon;
          const members = membersByRole(roleKey);
          const count = countByRole(roleKey);

          return (
            <div
              key={roleKey}
              className={`glass-card p-5 border ${cfg.border} rounded-2xl`}
            >
              <div className="flex items-start gap-4">
                {/* Ícone */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                  <Icon className={`w-5 h-5 ${cfg.color}`} />
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h3 className="text-base font-bold text-foreground">{cfg.label}</h3>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border border-white/10 bg-white/5 text-muted-foreground tracking-widest">
                      {roleKey}
                    </span>
                    {/* Badge de membros ao vivo */}
                    {roleKey !== "CLIENT" && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                        {loadingTeam ? "..." : `${count} membro${count !== 1 ? "s" : ""}`}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    {cfg.description}
                  </p>

                  {/* Permissões */}
                  <ul className="space-y-1 mb-3">
                    {cfg.permissions.map((perm, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${cfg.color.replace("text-", "bg-")}`} />
                        {perm}
                      </li>
                    ))}
                  </ul>

                  {/* Membros com esse role */}
                  {roleKey !== "CLIENT" && !loadingTeam && members.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {members.map((m: any) => (
                        <span
                          key={m.id}
                          className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-foreground"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.color.replace("text-", "bg-")}`} />
                          {m.name}
                          {m.position && <span className="text-muted-foreground">· {m.position}</span>}
                        </span>
                      ))}
                    </div>
                  )}

                  {roleKey !== "CLIENT" && !loadingTeam && members.length === 0 && (
                    <p className="text-xs text-muted-foreground/50 italic">Nenhum membro com este cargo ainda.</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rodapé informativo */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-white/3 border border-white/5 text-xs text-muted-foreground">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-orange-400/60" />
        <p>
          As permissões são pré-definidas pelo sistema para garantir segurança operacional.
          Para adicionar, editar ou remover membros da equipe, acesse a página{" "}
          <button
            onClick={() => navigate("/teamqui")}
            className="text-primary underline underline-offset-2 font-medium"
          >
            TeamQui
          </button>.
        </p>
      </div>
    </div>
  );
};

export default Roles;
