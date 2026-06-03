import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Zap, ArrowLeft, CheckCircle } from "lucide-react";
import api from "@/lib/api";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post("/api/auth/forgot-password", { email });
      setSent(true);
    } catch (error: any) {
      toast({
        title: "Erro",
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
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-orange-400 to-yellow-400 shadow-lg shadow-orange-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Pequi Digital</h1>
          </div>

          {sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
              <h2 className="text-lg font-semibold text-foreground">E-mail enviado!</h2>
              <p className="text-sm text-muted-foreground">
                Se este e-mail estiver cadastrado, você receberá as instruções de redefinição em breve.
              </p>
              <Link
                to="/"
                className="block mt-4 text-sm text-orange-400 hover:underline"
              >
                ← Voltar para o login
              </Link>
            </motion.div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-foreground mb-2">Recuperar senha</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Digite seu e-mail e enviaremos um link para redefinir sua senha.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground uppercase tracking-wider">
                    E-mail
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="bg-secondary border-border"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 gradient-button rounded-lg disabled:opacity-50 font-semibold"
                >
                  {loading ? "Enviando..." : "ENVIAR LINK"}
                </button>
              </form>

              <div className="mt-5 text-center">
                <Link
                  to="/"
                  className="text-sm text-muted-foreground hover:text-orange-400 transition-colors flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Voltar para login
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
