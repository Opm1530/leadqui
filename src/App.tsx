import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ModuleProvider } from "./contexts/ModuleContext";
import { UploadProvider } from "./contexts/UploadContext";
import UploadIndicator from "./components/UploadIndicator";
import ProtectedRoute from "./components/ProtectedRoute";
import Hub from "./pages/Hub";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Campaigns from "./pages/Campaigns";
import Instances from "./pages/Instances";
import Extraction from "./pages/Extraction";
import Settings from "./pages/Settings";
import CRM from "./pages/CRM";
import Tags from "./pages/Tags";
import Clients from "./pages/Clients";
import Tasqui from "./pages/Tasqui";
import Teamqui from "./pages/Teamqui";
import Projects from "./pages/Projects";
import Stats from "./pages/Stats";
import Roles from "./pages/Roles";
import AppLayout from "./components/AppLayout";
import HubLayout from "./components/HubLayout";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";
import CashQuiDashboard from "./pages/CashQuiDashboard";
import CashQuiInvoices from "./pages/CashQuiInvoices";
import CashQuiExpenses from "./pages/CashQuiExpenses";
import CashQuiReport from "./pages/CashQuiReport";
import CashQuiFixedExpenses from "./pages/CashQuiFixedExpenses";
import CashQuiInter from "./pages/CashQuiInter";
import TasquiCalendar from "./pages/TasquiCalendar";
import TasquiTraffic from "./pages/TasquiTraffic";
import TasquiTemplates from "./pages/TasquiTemplates";
import ViewQui from "./pages/ViewQui";
import TechQui from "./pages/TechQui";
import Vault from "./pages/Vault";
import Assistant from "./pages/Assistant";
import Demandas from "./pages/Demandas";
import Influencers from "./pages/Influencers";
import Onboarding from "./pages/Onboarding";
import ClienteProfile from "./pages/ClienteProfile";
import DashQui from "./pages/DashQui";
import Tarefas from "./pages/Tarefas";
import ClientesGrid from "./pages/ClientesGrid";
import Editorial from "./pages/Editorial";
import Inbox from "./pages/Inbox";
import Formularios from "./pages/Formularios";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ConfirmProvider />
      <BrowserRouter>
        <AuthProvider>
          <ModuleProvider>
            <UploadProvider>
            <Routes>
              {/* Rotas Públicas */}
              <Route path="/" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Hub e Páginas Independentes (protegido, sem sidebar) */}
              <Route element={<ProtectedRoute><Hub /></ProtectedRoute>} path="/hub" />
              <Route element={<ProtectedRoute><ViewQui /></ProtectedRoute>} path="/viewqui" />
              <Route element={<ProtectedRoute><ComingSoon /></ProtectedRoute>} path="/coming-soon" />
              {/* Páginas standalone com cabeçalho padrão (Hub/Config/Sair) */}
              <Route element={<ProtectedRoute staffOnly><HubLayout /></ProtectedRoute>}>
                <Route path="/settings" element={<Settings />} />
                <Route path="/assistente" element={<Assistant />} />
                <Route path="/demandas" element={<Demandas />} />
                <Route path="/influencers" element={<Influencers />} />
                <Route path="/onboarding/:clientId" element={<Onboarding />} />
                <Route path="/cliente/:id" element={<ClienteProfile />} />
                <Route path="/dashqui" element={<DashQui />} />
                <Route path="/tarefas" element={<Tarefas />} />
                <Route path="/clientes" element={<ClientesGrid />} />
                <Route path="/editorial" element={<Editorial />} />
                <Route path="/inbox" element={<ProtectedRoute adminOnly><Inbox /></ProtectedRoute>} />
                <Route path="/formularios" element={<ProtectedRoute adminOnly><Formularios /></ProtectedRoute>} />
              </Route>

              {/* App Principal (protegido, com sidebar — somente equipe interna) */}
              <Route element={<ProtectedRoute staffOnly><AppLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/campaigns" element={<Campaigns />} />
                <Route path="/instances" element={<Instances />} />
                <Route path="/extractions" element={<Extraction />} />
                <Route path="/crm" element={<CRM />} />
                <Route path="/tags" element={<Tags />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/vault" element={<Vault />} />
                <Route path="/tasqui" element={<Tasqui />} />
                <Route path="/tasqui/cliente/:clientId" element={<Tasqui />} />
                <Route path="/tasqui/calendar" element={<TasquiCalendar />} />
                <Route path="/tasqui/traffic" element={<TasquiTraffic />} />
                <Route path="/tasqui/jobs" element={<Projects />} />
                <Route path="/tasqui/templates" element={<TasquiTemplates />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/tasqui-stats" element={<Stats />} />
                <Route path="/teamqui" element={<Teamqui />} />
                <Route path="/techqui" element={<TechQui />} />
                <Route path="/techqui/instagram" element={<TechQui />} />
                <Route path="/techqui/ads" element={<TechQui />} />
                <Route path="/techqui/comments" element={<TechQui />} />
                <Route path="/roles" element={<Roles />} />
                {/* CashQui */}
                <Route path="/cashqui" element={<CashQuiDashboard />} />
                <Route path="/cashqui/invoices" element={<CashQuiInvoices />} />
                <Route path="/cashqui/expenses" element={<CashQuiExpenses />} />
                <Route path="/cashqui/fixed-expenses" element={<CashQuiFixedExpenses />} />
                <Route path="/cashqui/inter" element={<CashQuiInter />} />
                <Route path="/cashqui/report" element={<CashQuiReport />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
            <UploadIndicator />
            </UploadProvider>
          </ModuleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
