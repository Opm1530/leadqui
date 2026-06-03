import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, CheckCircle2, AlertTriangle, BarChart3, Users, Briefcase, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const COLORS = {
  concluido:   "#22c55e",
  em_andamento: "#3b82f6",
  pendente:    "#eab308",
  criadas:     "#6366f1",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-bold text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.fill || p.color }} className="font-medium">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const Stats = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const data = await api.get("/api/tasqui/stats");
      setStats(data);
    } catch {
      toast({ title: "Erro ao carregar estatísticas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-20 text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground animate-pulse text-sm">Carregando métricas...</p>
      </div>
    );
  }

  const hasMembers = stats?.tasksByMember?.length > 0;
  const hasClients = stats?.tasksByClient?.length > 0;
  const hasMonthly = stats?.monthlyCompletion?.some((m: any) => m.criadas > 0);
  const hasDist    = stats?.statusDist?.length > 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-8">
      {/* Título */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
          Estatísticas Operacionais
        </h1>
        <p className="text-muted-foreground mt-1">
          Análise de performance e produtividade da agência.
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Taxa de Conclusão
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-green-400">
              {stats?.completionRate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.totalTasks || 0} tarefas no total
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Concluídas
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-blue-400">{stats?.completed || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.inProgress || 0} em andamento agora
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Projetos Ativos
            </CardTitle>
            <Briefcase className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-indigo-400">{stats?.activeProjects || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">projetos em execução</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Pendentes
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-orange-400">{stats?.pending || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">aguardando início</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos — linha 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Evolução Mensal */}
        <Card className="glass-card border-border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              Evolução Mensal — Criadas vs Concluídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasMonthly ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={stats.monthlyCompletion} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCriadas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={COLORS.criadas}    stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.criadas}    stopOpacity={0}   />
                    </linearGradient>
                    <linearGradient id="gradConcluidas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={COLORS.concluido}  stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.concluido}  stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="criadas"    name="Criadas"    stroke={COLORS.criadas}   fill="url(#gradCriadas)"    strokeWidth={2} dot={{ r: 3, fill: COLORS.criadas }} />
                  <Area type="monotone" dataKey="concluidas" name="Concluídas" stroke={COLORS.concluido} fill="url(#gradConcluidas)" strokeWidth={2} dot={{ r: 3, fill: COLORS.concluido }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart icon={Calendar} msg="Nenhuma tarefa criada nos últimos 6 meses" />
            )}
          </CardContent>
        </Card>

        {/* Distribuição por Status */}
        <Card className="glass-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-400" />
              Status das Tarefas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasDist ? (
              <>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={stats.statusDist}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={75}
                      dataKey="value"
                      paddingAngle={3}
                    >
                      {stats.statusDist.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {stats.statusDist.map((s: any) => (
                    <div key={s.status} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: s.fill }} />
                        <span className="text-muted-foreground">{s.status}</span>
                      </span>
                      <span className="font-bold text-foreground">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyChart icon={BarChart3} msg="Nenhuma tarefa ainda" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráficos — linha 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Produtividade por Membro */}
        <Card className="glass-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              Produtividade por Membro
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasMembers ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.tasksByMember} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="concluido"    name="Concluídas"   fill={COLORS.concluido}    radius={[0, 3, 3, 0]} stackId="a" />
                  <Bar dataKey="em_andamento" name="Em Andamento" fill={COLORS.em_andamento} radius={[0, 3, 3, 0]} stackId="a" />
                  <Bar dataKey="pendente"     name="Pendentes"    fill={COLORS.pendente}     radius={[0, 3, 3, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart icon={Users} msg="Nenhuma tarefa atribuída ainda" />
            )}
          </CardContent>
        </Card>

        {/* Tarefas por Cliente */}
        <Card className="glass-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-green-400" />
              Tarefas por Cliente (top 8)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasClients ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.tasksByClient} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="concluido" name="Concluídas" fill={COLORS.concluido} radius={[0, 3, 3, 0]} stackId="a" />
                  <Bar dataKey="total"     name="Total"      fill="#374151"          radius={[0, 3, 3, 0]} stackId="b"
                    data={stats.tasksByClient.map((c: any) => ({ ...c, total: c.total - c.concluido }))}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart icon={Briefcase} msg="Nenhuma tarefa vinculada a clientes" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const EmptyChart = ({ icon: Icon, msg }: { icon: any; msg: string }) => (
  <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground/40 gap-3">
    <Icon className="w-10 h-10" />
    <p className="text-xs text-center max-w-[160px]">{msg}</p>
  </div>
);

export default Stats;
