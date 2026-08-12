import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Wrench, ShieldAlert, Sparkles, RefreshCw, Lock, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Maintenance() {
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckStatus = () => {
    setIsChecking(true);
    toast.info('Verificando status do sistema...');
    setTimeout(() => {
      setIsChecking(false);
      if (import.meta.env.VITE_MAINTENANCE_MODE === 'true') {
        toast.warning('O sistema permanece em manutenção no momento.');
      } else {
        toast.success('O sistema está online! Redirecionando...');
        window.location.reload();
      }
    }, 1200);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4 relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-2xl bg-[#0a111e]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative z-10 text-center flex flex-col items-center"
      >
        {/* Header Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Manutenção Programada
        </motion.div>

        {/* Central Icon Construction */}
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_30px_rgba(0,191,165,0.2)]">
            <Wrench className="w-12 h-12 animate-bounce" style={{ animationDuration: '2s' }} />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-[#0a111e] border border-white/10 flex items-center justify-center text-amber-400 shadow-md">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        {/* Main Title & Description */}
        <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight font-display">
          Estamos em Manutenção
        </h1>
        <p className="text-base md:text-lg text-white/70 max-w-lg mb-8 leading-relaxed">
          O <strong className="text-white">EventEase</strong> está passando por atualizações e melhorias para oferecer uma experiência ainda melhor. Voltaremos muito em breve!
        </p>

        {/* Features / Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-8 text-left">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-start gap-3">
            <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-white">Previsão de Retorno</h3>
              <p className="text-xs text-white/50 mt-0.5">Em breve o sistema estará totalmente restabelecido.</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-white">Segurança dos Dados</h3>
              <p className="text-xs text-white/50 mt-0.5">Todas as suas informações e credenciais continuam 100% salvas.</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          <Button
            onClick={handleCheckStatus}
            disabled={isChecking}
            className="w-full sm:w-auto h-12 px-6 rounded-2xl bg-primary text-white font-bold hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,191,165,0.25)]"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            Verificar Novamente
          </Button>

          <Link to="/login" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full h-12 px-6 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-medium transition-all flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4 text-amber-400" />
              Área de Staff / Login
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Footer Branding */}
      <div className="mt-8 text-center text-xs text-white/40 flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span>EventEase &bull; Plataforma Oficial Olhar Jovem</span>
      </div>
    </div>
  );
}
