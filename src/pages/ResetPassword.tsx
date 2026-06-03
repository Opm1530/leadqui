import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Zap, CheckCircle, AlertCircle } from "lucide-react";
import api from "@/lib/api";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) navigate("/");
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirm) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }

    if (password.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => navigate("/"), 3000);
    } catch (error: any) {
      toast({
        title: "Erro ao redefinir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-8">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-yellow-400 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Pequi Digital</h1>
          </div>

          {!token ? (
            <div className="text-center text-destructive flex flex-col items-center gap-3">
              <AlertCircle className="w-12 h-12" />
              <p>Link inválido ou expirado.</p>
              <Link to="/" className="text-sm text-orange-400 hover:underline">Voltar para login</Link>
            </div>
          ) : done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
              <h2 className="text-lg font-semibold">Senha redefinida!</h2>
              <p className="text-sm text-muted-foreground">Redirecionando para o login...</p>
            </motion.div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-foreground mb-2">Nova senha</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Crie uma nova senha segura para sua conta.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground uppercase tracking-wider">
                    Nova Senha
                  </Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="bg-secondary border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground uppercase tracking-wider">
                    Confirmar Senha
                  </Label>
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="bg-secondary border-border"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 gradient-button rounded-lg disabled:opacity-50 font-semibold"
                >
                  {loading ? "Salvando..." : "SALVAR NOVA SENHA"}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
