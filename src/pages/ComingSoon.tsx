import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Rocket, ArrowLeft, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";

const ComingSoon = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6 overflow-hidden relative">
      {/* Decorative ambient light */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-2xl w-full text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex justify-center"
        >
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-400 to-yellow-400 flex items-center justify-center shadow-2xl shadow-orange-500/20">
            <Construction className="w-12 h-12 text-black" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400"
        >
          Em Construção
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-gray-400 text-lg md:text-xl mb-12 leading-relaxed"
        >
          Estamos trabalhando duro para trazer essa funcionalidade até você.
          Fique atento! Novidades incríveis do ecossistema<span className="text-orange-400 font-bold"> Pequi</span> estão chegando em breve.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Button
            onClick={() => navigate("/hub")}
            className="h-14 px-8 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold transition-all group"
          >
            <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
            Voltar para o Hub
          </Button>
        </motion.div>
      </div>

      {/* Background element */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none select-none">
        <Rocket className="w-[800px] h-[800px] rotate-12" />
      </div>
    </div>
  );
};

export default ComingSoon;
