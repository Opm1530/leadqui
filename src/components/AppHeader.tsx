import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Zap, Settings as SettingsIcon, LogOut, LayoutGrid } from "lucide-react";

// Cabeçalho geral padrão (mesmo design do Hub) usado em todas as páginas.
const AppHeader = ({ extra, showHub = true }: { extra?: ReactNode; showHub?: boolean }) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto flex justify-between items-center px-6 py-3">
        <button onClick={() => navigate("/hub")} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-orange-400 to-yellow-400 shadow-lg shadow-orange-500/20">
            <Zap className="w-6 h-6 text-black fill-black" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Pequi Digital
          </span>
        </button>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Usuário Logado</p>
            <p className="text-sm text-gray-300 font-medium">{user?.email}</p>
          </div>
          {extra}
          {showHub && (
            <button
              onClick={() => navigate("/hub")}
              title="Hub"
              className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 hover:bg-white/5 transition-all text-gray-400 hover:text-white"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          )}
          {user?.role !== "CLIENT" && (
            <button
              onClick={() => navigate("/settings")}
              title="Configurações"
              className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 hover:bg-white/5 transition-all text-gray-400 hover:text-white"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 hover:bg-white/5 transition-all text-sm text-gray-400 hover:text-white"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
