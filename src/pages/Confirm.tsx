import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { UserCheck, QrCode, Search, CheckCircle2, AlertCircle, Clock, MapPin, User, Building, RefreshCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Participante } from '@/types/index';
import { Html5Qrcode } from 'html5-qrcode';

import { isAdmin } from '@/constants';

export default function Confirm() {
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [scannerActive, setScannerActive] = useState(false);
  const [result, setResult] = useState<{ status: 'success' | 'already' | 'notfound'; data?: Participante } | null>(null);
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          toast.error('Acesso restrito. Por favor, faça login.');
          navigate('/login');
          return;
        }

        if (!isAdmin(session.user?.email)) {
          toast.error('Você não tem permissão de administrador.');
          await supabase.auth.signOut();
          navigate('/login');
          return;
        }

        setAuthLoading(false);
      } catch (e) {
        console.error('Auth check error in Confirm:', e);
        toast.error('Erro de conexão. Verifique suas credenciais.');
        navigate('/login');
      }
    };
    checkAuth();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [navigate]);

  const startScanner = async () => {
    setScannerActive(true);
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            // Sucesso no scan
            setCodigo(decodedText);
            stopScanner();
            handleManualCheckin(undefined, decodedText);
          },
          (errorMessage) => {
            // Erros de leitura são comuns, ignoramos para não poluir
          }
        );
      } catch (err) {
        console.error("Erro ao iniciar scanner:", err);
        toast.error("Não foi possível acessar a câmera.");
        setScannerActive(false);
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error("Erro ao parar scanner:", err);
      }
    }
    setScannerActive(false);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw className="w-8 h-8 animate-spin text-neutral-400" />
          <p className="text-neutral-500 font-medium tracking-tight">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  const handleManualCheckin = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    const finalCode = codeOverride || codigo;
    if (!finalCode) return;

    setLoading(true);
    try {
      // 1. Buscar participante
      const { data, error } = await supabase
        .from('participantes')
        .select('*')
        .eq('codigo', finalCode.toUpperCase().trim())
        .single();

      if (error) {
        if (error.message.includes('Invalid path') || error.code === 'PGRST125') {
          toast.error('Configuração de URL Inválida', {
            description: 'A URL do Supabase está incorreta. Remova o /rest/v1 da URL no painel Vercel.',
          });
          return;
        }
        if (error.message.includes('relation "participantes" does not exist')) {
          toast.error('Banco de dados incompleto', {
            description: 'Execute o script SQL no Supabase.',
          });
          return;
        }
        setResult({ status: 'notfound' });
        toast.error('Código não encontrado.');
        return;
      }

      if (!data) {
        setResult({ status: 'notfound' });
        toast.error('Código não encontrado.');
        return;
      }

      const participante = data as Participante;

      // 2. Verificar se já está confirmado
      if (participante.presente) {
        setResult({ status: 'already', data: participante });
        toast.info('Presença já havia sido registrada.');
        return;
      }

      // 3. Confirmar presença
      const { error: updateError } = await supabase
        .from('participantes')
        .update({ presente: true, confirmado_em: new Date().toISOString() })
        .eq('id', participante.id);

      if (updateError) throw updateError;

      setResult({ status: 'success', data: { ...participante, presente: true, confirmado_em: new Date().toISOString() } });
      toast.success(`Check-in realizado para ${participante.nome}!`);
    } catch (error: any) {
      console.error('Check-in error:', error);
      toast.error('Erro ao realizar check-in.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setCodigo('');
    setResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 md:py-12 px-4 md:px-6">
      <div className="text-center mb-8 md:mb-12">
        <motion.div
           initial={{ opacity: 0, y: -10 }}
           animate={{ opacity: 1, y: 0 }}
           className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-primary text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-4 md:mb-6"
        >
           Controle de Acesso
        </motion.div>
        <h1 className="heading-display text-3xl md:text-5xl mb-3 md:mb-4 text-white leading-tight">Validação de <span className="text-primary italic">Presença</span></h1>
        <p className="text-white/40 text-base md:text-xl font-medium max-w-xl mx-auto px-4">Valide as credenciais dos participantes para entrada no evento em tempo real.</p>
      </div>

        <AnimatePresence mode="wait">
          {scannerActive ? (
            <motion.div
              key="scanner"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto relative"
            >
              <Card className="glass-card overflow-hidden border-white/20 rounded-[2rem] shadow-3xl bg-black">
                <div className="p-4 flex items-center justify-between border-b border-white/10">
                  <span className="text-white font-bold text-xs uppercase tracking-widest">Scanner Ativo</span>
                  <Button variant="ghost" size="icon" onClick={stopScanner} className="rounded-full hover:bg-white/10 text-white">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                <div id="reader" className="w-full aspect-square overflow-hidden" />
                <div className="p-6 text-center">
                  <p className="text-white/40 text-xs font-medium">Aponte a câmera para o QR Code da credencial.</p>
                </div>
              </Card>
            </motion.div>
          ) : !result ? (
            <motion.div
              key="search"
              initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-2xl mx-auto px-2 md:px-0"
            >
            <Card className="glass-card shadow-3xl overflow-hidden border-white/[0.08] rounded-[2rem] md:rounded-[2.5rem]">
              <CardHeader className="bg-white/[0.02] border-b border-white/[0.08] p-8 md:p-12 pb-8 md:pb-10">
                <div>
                  <CardTitle className="font-display text-2xl md:text-3xl text-white leading-none mb-2 md:mb-3 tracking-tight">Validar Ingresso</CardTitle>
                  <CardDescription className="text-white/30 text-sm md:text-lg font-medium">Escaneie ou digite o código alfanumérico.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-8 md:p-12 pb-6 md:pb-8">
                <form onSubmit={handleManualCheckin} className="space-y-6 md:space-y-8">
                  <div className="relative group">
                    <Search className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 w-6 h-6 md:w-8 md:h-8 text-white/10 transition-colors group-focus-within:text-primary" />
                    <Input
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                      placeholder="EVT-000000"
                      className="liquid-input pl-14 md:pl-16 h-16 md:h-24 text-2xl md:text-4xl font-display font-black tracking-[0.1em] md:tracking-[0.15em] uppercase placeholder:text-white/5 border-white/[0.05]"
                      autoFocus
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="modern-button h-16 md:h-20 w-full text-lg md:text-xl shadow-2xl"
                    disabled={loading || !codigo}
                  >
                    {loading ? 'Validando...' : 'Confirmar Presença'}
                    {!loading && <UserCheck className="w-5 h-5 md:w-7 md:h-7 ml-2" />}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="bg-white/[0.01] p-8 md:p-10 flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6 border-t border-white/[0.08]">
                <span className="text-[9px] md:text-[10px] text-white/20 uppercase tracking-[0.3em] font-black">Módulo de Escaneamento</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={startScanner}
                  className="rounded-2xl gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all h-10 md:h-12 px-6 md:px-8 font-bold text-[10px] md:text-xs uppercase tracking-widest"
                >
                  <QrCode className="w-4 h-4 md:w-5 md:h-5 mr-1" /> Ativar Scanner
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 30, scale: 0.95, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6 md:space-y-8 max-w-2xl mx-auto px-2 md:px-0"
          >
            <Card className={cn(
              "glass-card overflow-hidden shadow-3xl border-2 transition-all duration-700 rounded-[2rem] md:rounded-[2.5rem]",
              result.status === 'success' ? "border-emerald-500/20 bg-emerald-500/[0.02]" : 
              result.status === 'already' ? "border-orange-500/20 bg-orange-500/[0.02]" :
              "border-red-500/20 bg-red-500/[0.02]"
            )}>
              <div className={cn(
                "h-2 w-full",
                result.status === 'success' ? "bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]" : 
                result.status === 'already' ? "bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.5)]" :
                "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
              )} />
              
              <CardContent className="p-10 md:p-14 flex flex-col items-center">
                {result.status === 'success' && (
                  <>
                    <motion.div 
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="w-20 h-20 md:w-28 md:h-28 bg-emerald-500/10 rounded-[2rem] md:rounded-[3rem] flex items-center justify-center text-emerald-400 mb-6 md:mb-10 border border-emerald-500/20 shadow-2xl"
                    >
                      <CheckCircle2 className="w-10 h-10 md:w-14 md:h-14" />
                    </motion.div>
                    <CardTitle className="text-3xl md:text-5xl font-display text-center mb-2 md:mb-4 text-white leading-tight tracking-tight">Autorizado!</CardTitle>
                    <CardDescription className="text-center text-base md:text-xl mb-8 md:mb-12 font-medium text-white/40 italic">Check-in processado e sincronizado.</CardDescription>
                  </>
                )}


                {result.status === 'already' && (
                  <>
                    <div className="w-28 h-28 bg-orange-500/10 rounded-[3rem] flex items-center justify-center text-orange-400 mb-10 border border-orange-500/20 shadow-2xl">
                      <AlertCircle className="w-14 h-14" />
                    </div>
                    <CardTitle className="text-5xl font-display text-center mb-4 text-white leading-tight tracking-tight">Já Confirmado</CardTitle>
                    <CardDescription className="text-center text-xl mb-12 font-medium text-white/40 italic">Esta credencial já foi validada anteriormente.</CardDescription>
                  </>
                )}

                {result.status === 'notfound' && (
                  <>
                    <div className="w-28 h-28 bg-red-500/10 rounded-[3rem] flex items-center justify-center text-red-400 mb-10 border border-red-500/20 shadow-2xl">
                      <AlertCircle className="w-14 h-14" />
                    </div>
                    <CardTitle className="text-5xl font-display text-center mb-4 text-white leading-tight tracking-tight">Falha na Busca</CardTitle>
                    <CardDescription className="text-center text-xl mb-12 font-medium text-white/40 italic">
                      Código <span className="font-mono bg-red-500/20 px-3 py-1 rounded-xl text-white font-black tracking-tight">{codigo}</span> inexistente.
                    </CardDescription>
                  </>
                )}

                {result.data && (
                  <div className="w-full grid grid-cols-1 gap-4 mt-8 border-t border-white/5 pt-12">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InfoRow icon={<User className="w-5 h-5 text-teal-400" />} label="Participante" value={result.data.nome} />
                      <InfoRow icon={<Building className="w-5 h-5 text-emerald-400" />} label="Instituição" value={result.data.escola} />
                      <InfoRow icon={<MapPin className="w-5 h-5 text-orange-400" />} label="Cidade Base" value={result.data.cidade} />
                      <InfoRow 
                        icon={<Clock className="w-5 h-5 text-purple-400" />} 
                        label="Data/Hora Registro" 
                        value={result.data.confirmado_em ? new Date(result.data.confirmado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'} 
                      />
                    </div>
                  </div>
                )}
                
                <Button onClick={reset} className="modern-button w-full max-w-sm mt-16 h-16 shadow-2xl text-lg">
                  Próximo Participante
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 p-5 bg-white/[0.03] rounded-3xl border border-white/[0.06] shadow-inner backdrop-blur-xl">
      <div className="mt-0.5 bg-white/5 p-2.5 rounded-2xl border border-white/5">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] uppercase font-bold tracking-[0.2em] text-white/20 leading-none mb-2">{label}</p>
        <p className="text-base font-bold text-white truncate leading-tight tracking-tight">{value}</p>
      </div>
    </div>
  );
}
