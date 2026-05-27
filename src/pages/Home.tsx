import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  Copy,
  Download,
  UserPlus,
  Building2,
  Mail,
  Phone,
  ArrowRight,
  AlertCircle,
  Calendar,
  Clock,
  Ticket,
  RefreshCcw,
  X,
  ExternalLink,
  MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';

const registrationSchema = z.object({
  nome: z.string().min(3, 'Nome muito curto').max(100),
  email: z.string().email('Email inválido'),
  telefone: z.string().min(10, 'Telefone inválido'),
  cidade: z.string().min(2, 'Cidade obrigatória'),
  escola: z.string().min(2, 'Escola obrigatória'),
  gremio: z.string().optional(),
});

type RegistrationData = z.infer<typeof registrationSchema>;

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ nome: string; codigo: string } | null>(null);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const qrSize = windowWidth < 640 ? 160 : 220;

  const [closestEvent, setClosestEvent] = useState<any>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [credentialEmail, setCredentialEmail] = useState('');
  const [credentialData, setCredentialData] = useState<{ nome: string; codigo: string } | null>(null);
  const [searchingCredential, setSearchingCredential] = useState(false);
  const [credentialError, setCredentialError] = useState('');

  const fetchHomeEvents = async () => {
    try {
      const nowStr = new Date().toISOString();
      const { data, error } = await supabase
        .from('eventos')
        .select('*')
        .eq('publicado', true)
        .order('data', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Encontrar o evento futuro mais próximo
        const futures = data.filter(e => new Date(e.data) >= new Date());
        if (futures.length > 0) {
          setClosestEvent(futures[0]);
          setUpcomingEvents(futures.slice(0, 3));
        } else {
          // Se não houver eventos futuros, pega o mais recente no passado
          setClosestEvent(data[0]);
          setUpcomingEvents([]);
        }
      }
    } catch (err) {
      console.error('Error fetching home events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchHomeEvents();
  }, []);

  const handleSedeClick = () => {
    if (closestEvent) {
      setShowLocationModal(true);
    } else {
      toast.info('Nenhum evento agendado no momento.');
    }
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegistrationData>({
    resolver: zodResolver(registrationSchema),
  });

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `EVT-${code}`;
  };

  const onSubmit = async (data: RegistrationData) => {
    setLoading(true);
    try {
      // Verificar se o e-mail já existe para recuperar o cadastro e a credencial do aluno via RPC
      const { data: rawExisting, error: findError } = await supabase
        .rpc('get_participant_by_email', { p_email: data.email.trim().toLowerCase() })
        .maybeSingle();

      if (findError) throw findError;

      const existing = rawExisting as { nome: string; codigo: string } | null;

      if (existing) {
        setSuccessData({ nome: existing.nome, codigo: existing.codigo });
        toast.success('Cadastro localizado! Sua credencial foi recuperada com sucesso.');
        reset();
        return;
      }

      const codigo = generateCode();

      const { error } = await supabase.from('participantes').insert([
        {
          nome: data.nome,
          email: data.email,
          telefone: data.telefone,
          cidade: data.cidade,
          escola: data.escola,
          gremio: data.gremio || '',
          codigo: codigo,
          presente: false,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      setSuccessData({ nome: data.nome, codigo });
      toast.success('Inscrição realizada com sucesso!');
      reset();
    } catch (error: any) {
      console.error('Registration error details:', error);
      const message = error.message || 'Erro desconhecido';
      const details = error.details || '';
      const hint = error.hint || '';

      console.log('Error structure:', { message, details, hint });

      if (message.includes('relation "participantes" does not exist')) {
        toast.error('Banco de dados incompleto', {
          description: 'A tabela "participantes" não foi encontrada. Por favor, execute o script SQL fornecido no seu painel Supabase.',
          duration: 6000,
          action: {
            label: 'Ver SQL',
            onClick: () => window.open('https://supabase.com', '_blank')
          }
        });
      } else if (message.includes('Invalid path') || message.includes('PGRST125')) {
        toast.error('Configuração de URL Inválida', {
          description: 'A URL do Supabase parece estar incorreta no painel da Vercel. Certifique-se de que a URL NÃO termina com /rest/v1.',
          duration: 8000
        });
      } else if (message.includes('duplicate key value') || message.includes('already exists')) {
        toast.error('Registro Duplicado', {
          description: 'Este e-mail ou código já está registrado no sistema.',
        });
      } else if (message.includes('JWT') || message.includes('key')) {
        toast.error('Erro de Autenticação', {
          description: 'As chaves do Supabase parecem estar incorretas ou expiradas.',
        });
      } else {
        toast.error('Erro na Inscrição', {
          description: `Detalhes: ${message}. Verifique sua conexão e tente novamente.`,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.info('Código copiado!');
  };

  const handleSearchCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialEmail.trim()) return;

    setSearchingCredential(true);
    setCredentialError('');

    try {
      const { data, error } = await supabase
        .rpc('get_participant_by_email', { p_email: credentialEmail.trim().toLowerCase() })
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCredentialData(data);
      } else {
        setCredentialError('Nenhum cadastro encontrado para este e-mail. Verifique e tente novamente ou realize sua inscrição ao lado.');
      }
    } catch (err: any) {
      console.error('Error searching credential:', err);
      setCredentialError('Erro ao buscar credencial. Tente novamente mais tarde.');
    } finally {
      setSearchingCredential(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 md:space-y-12 pb-12">
      <div className="text-center mb-10 md:mb-16 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] text-primary text-xs font-bold uppercase tracking-wider mb-6 border border-white/10 backdrop-blur-md shadow-lg shadow-black/40"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Inscrições Abertas
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="heading-display text-4xl md:text-7xl mb-6 md:mb-8 tracking-tight font-extrabold leading-[1.1] md:leading-[1.05]"
        >
          <span className="text-white drop-shadow-sm">Event</span>
          <span className="text-primary font-black drop-shadow-[0_2px_10px_rgba(0,191,165,0.2)]">Ease</span>
          <span className="mx-4 text-white/15 font-light text-3xl md:text-5xl align-middle">/</span>
          <span className="bg-gradient-to-r from-emerald-400 via-primary to-teal-300 bg-clip-text text-transparent font-black tracking-tighter">
            Olhar Jovem
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-white/50 text-base md:text-lg max-w-2xl mx-auto font-medium leading-relaxed px-4"
        >
          Cadastre-se para obter sua <span className="text-white font-semibold">credencial digital exclusiva</span> e garantir sua confirmação online nos eventos oficiais do <span className="text-primary font-semibold">Instituto Olhar Jovem</span>.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start px-2 md:px-0">
        {/* Registration Form Widget */}
        <AnimatePresence mode="wait">
          {!successData ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -30, filter: 'blur(10px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: 30, filter: 'blur(10px)', transition: { duration: 0.4 } }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-8 w-full"
            >
              <Card className="glass-card shadow-2xl overflow-hidden border-white/[0.08] rounded-[2rem] md:rounded-[2.5rem]">
                <CardHeader className="p-8 md:p-10 border-b border-white/[0.08] bg-white/[0.02]">
                  <div>
                    <CardTitle className="font-display tracking-tight text-2xl md:text-3xl text-white leading-none mb-1 md:mb-2">Inscrição Oficial</CardTitle>
                    <CardDescription className="text-white/40 text-sm md:text-base font-medium">
                      Preencha as informações e gere seu token de acesso digital.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-6 md:p-10">
                  <motion.form
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    id="registration-form"
                    onSubmit={handleSubmit(onSubmit)}
                    className="space-y-6 md:space-y-8"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
                      <motion.div variants={itemVariants} className="space-y-2 md:space-y-3">
                        <Label htmlFor="nome" className="text-white/60 font-bold text-[10px] md:text-xs uppercase tracking-widest pl-1">Nome Completo</Label>
                        <Input
                          id="nome"
                          placeholder="Informe seu nome"
                          {...register('nome')}
                          className={cn("liquid-input h-12 md:h-14 transition-all duration-300 focus:scale-[1.01]", errors.nome && "border-red-500/50 focus:border-red-500/50")}
                        />
                        {errors.nome && <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider pl-1">{errors.nome.message}</p>}
                      </motion.div>
                      <motion.div variants={itemVariants} className="space-y-2 md:space-y-3">
                        <Label htmlFor="email" className="text-white/60 font-bold text-[10px] md:text-xs uppercase tracking-widest pl-1">E-mail</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="seu@email.com"
                          {...register('email')}
                          className={cn("liquid-input h-12 md:h-14 transition-all duration-300 focus:scale-[1.01]", errors.email && "border-red-500/50 focus:border-red-500/50")}
                        />
                        {errors.email && <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider pl-1">{errors.email.message}</p>}
                      </motion.div>
                      <motion.div variants={itemVariants} className="space-y-2 md:space-y-3">
                        <Label htmlFor="telefone" className="text-white/60 font-bold text-[10px] md:text-xs uppercase tracking-widest pl-1">WhatsApp</Label>
                        <Input
                          id="telefone"
                          type="tel"
                          inputMode="tel"
                          placeholder="(00) 00000-0000"
                          {...register('telefone')}
                          className={cn("liquid-input h-12 md:h-14 transition-all duration-300 focus:scale-[1.01]", errors.telefone && "border-red-500/50 focus:border-red-500/50")}
                        />
                        {errors.telefone && <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider pl-1">{errors.telefone.message}</p>}
                      </motion.div>
                      <motion.div variants={itemVariants} className="space-y-2 md:space-y-3">
                        <Label htmlFor="cidade" className="text-white/60 font-bold text-[10px] md:text-xs uppercase tracking-widest pl-1">Cidade</Label>
                        <Input
                          id="cidade"
                          placeholder="Sua Cidade"
                          {...register('cidade')}
                          className={cn("liquid-input h-12 md:h-14 transition-all duration-300 focus:scale-[1.01]", errors.cidade && "border-red-500/50 focus:border-red-500/50")}
                        />
                        {errors.cidade && <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider pl-1">{errors.cidade.message}</p>}
                      </motion.div>
                      <motion.div variants={itemVariants} className="space-y-2 md:space-y-3">
                        <Label htmlFor="escola" className="text-white/60 font-bold text-[10px] md:text-xs uppercase tracking-widest pl-1">Escola / Instituição</Label>
                        <Input
                          id="escola"
                          placeholder="Ex: Escola Estadual..."
                          {...register('escola')}
                          className={cn("liquid-input h-12 md:h-14 transition-all duration-300 focus:scale-[1.01]", errors.escola && "border-red-500/50 focus:border-red-500/50")}
                        />
                        {errors.escola && <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider pl-1">{errors.escola.message}</p>}
                      </motion.div>
                      <motion.div variants={itemVariants} className="space-y-2 md:space-y-3">
                        <Label htmlFor="gremio" className="text-white/60 font-bold text-[10px] md:text-xs uppercase tracking-widest pl-1">Grêmio Estudantil (Opcional)</Label>
                        <Input
                          id="gremio"
                          placeholder="Nome do seu grêmio"
                          {...register('gremio')}
                          className="liquid-input h-12 md:h-14 transition-all duration-300 focus:scale-[1.01] shadow-inner"
                        />
                      </motion.div>
                    </div>
                  </motion.form>
                </CardContent>
                <CardFooter className="p-8 md:p-10 border-t border-white/[0.08] bg-white/[0.02] flex flex-col md:flex-row justify-between items-center gap-6 md:gap-8">
                  <div className="flex flex-col gap-1 md:gap-1.5 text-center md:text-left">
                    <p className="text-[9px] md:text-[10px] text-white/40 font-bold uppercase tracking-[0.2em] leading-none">Proteção de Dados Ativa</p>
                    <p className="text-[10px] md:text-xs text-white/20 font-medium">Criptografia AES-256 aplicada.</p>
                  </div>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full md:w-auto"
                  >
                    <Button
                      form="registration-form"
                      type="submit"
                      disabled={loading}
                      className="modern-button h-14 md:h-16 w-full md:px-16 text-base md:text-lg"
                    >
                      {loading ? 'Sincronizando...' : 'Gerar Credencial Digital'}
                      {!loading && <ArrowRight className="w-5 h-5" />}
                    </Button>
                  </motion.div>
                </CardFooter>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 30, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-8 flex justify-center"
            >
              <Card className="w-full max-w-xl glass-card text-center overflow-hidden shadow-3xl border-white/20">
                <div className="h-2 bg-gradient-to-r from-teal-400 via-emerald-600 to-teal-400 animate-pulse" />
                <CardHeader className="pt-12 px-12 pb-10 flex flex-col items-center border-b border-white/[0.08] bg-white/[0.03]">
                  <CardTitle className="font-display text-4xl text-white leading-tight mb-3">Check-in Confirmado!</CardTitle>
                  <CardDescription className="text-white/40 text-xl font-medium">Prepare-se para uma experiência incrível.</CardDescription>
                </CardHeader>
                <CardContent className="p-12 space-y-12">
                  <div className="p-6 sm:p-10 bg-white/[0.03] rounded-[2.5rem] border border-white/[0.08] flex flex-col items-center space-y-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-white/30">Código da Credencial</p>
                    <span className="font-display text-6xl font-black tracking-tighter text-white drop-shadow-lg">
                      {successData.codigo}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => successData && copyText(successData.codigo)} className="text-white/60 hover:text-white hover:bg-white/10 rounded-2xl gap-2 text-xs font-bold transition-all px-6 h-10 mt-4 border border-white/5">
                      <Copy className="w-4 h-4" /> Copiar Código
                    </Button>
                  </div>

                  <div className="flex flex-col items-center space-y-8">
                    <div className="p-6 sm:p-10 bg-white rounded-[2rem] sm:rounded-[3rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] border-4 border-white/10">
                      <QRCodeSVG
                        value={successData.codigo}
                        size={qrSize}
                        level="H"
                        fgColor="#000000"
                        bgColor="#ffffff"
                      />
                    </div>
                    <p className="text-base text-white/40 font-medium max-w-[280px] mx-auto leading-relaxed">
                      Sua credencial foi sincronizada. Mostre este QR Code ou informe o seu código no check-in.
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="bg-white/[0.03] p-10 border-t border-white/[0.08] flex justify-center">
                  <div className="flex items-center justify-center gap-3 text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">
                    <Download className="w-4 h-4" /> Recomenda-se salvar uma foto
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar Bento Widgets */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <BentoItem
            icon={<Mail className="w-6 h-6 text-teal-400" />}
            title="Credencial Digital"
            description="Consulte sua credencial digital e QR Code a qualquer momento informando seu e-mail."
            color="bg-teal-500/10"
            onClick={() => {
              setCredentialEmail('');
              setCredentialData(null);
              setCredentialError('');
              setShowCredentialModal(true);
            }}
            isClickable={true}
          />
          <BentoItem
            icon={<Building2 className="w-6 h-6 text-emerald-400" />}
            title="Sede do Evento"
            description={
              closestEvent
                ? `Local: ${closestEvent.local}\nPróximo evento: ${closestEvent.titulo}\nClique para ver os detalhes do local.`
                : "Fique por dentro da localização e horários de check-in."
            }
            color="bg-emerald-500/10"
            onClick={handleSedeClick}
            isClickable={true}
          />
          <UpcomingEventsWidget
            events={upcomingEvents}
            loading={loadingEvents}
          />
        </div>
      </div>

      <AnimatePresence>
        {showLocationModal && closestEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-lg z-50 flex items-center justify-center p-4"
            onClick={() => setShowLocationModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-lg glass-card overflow-hidden border border-white/10 rounded-[2.5rem] shadow-3xl bg-neutral-950/90 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />
              <button
                onClick={() => setShowLocationModal(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white transition-all z-10"
                title="Fechar modal de localização"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-6 md:p-10 space-y-6">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-teal-400 pl-1">
                    Localização do Evento
                  </span>
                  <h3 className="font-display font-bold text-2xl md:text-3xl text-white mt-1 tracking-tight">
                    {closestEvent.titulo}
                  </h3>
                </div>

                <div className="space-y-4 py-2">
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider">Local do Encontro</h4>
                      <p className="text-sm text-white font-medium mt-1 leading-relaxed">
                        {closestEvent.local}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 flex-shrink-0 mt-0.5">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider">Data e Horário</h4>
                      <p className="text-sm text-white font-medium mt-1 leading-relaxed">
                        {new Date(closestEvent.data).toLocaleDateString('pt-BR', {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })} às {new Date(closestEvent.data).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}h
                      </p>
                    </div>
                  </div>

                  {closestEvent.descricao && (
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 flex-shrink-0 mt-0.5">
                        <Ticket className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider">Descrição do Evento</h4>
                        <p className="text-sm text-white/75 font-medium mt-1 leading-relaxed">
                          {closestEvent.descricao}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  <Button
                    onClick={() => {
                      const query = encodeURIComponent(closestEvent.local);
                      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                    }}
                    className="modern-button h-12 flex-1 gap-2 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" /> Abrir no Google Maps
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowLocationModal(false)}
                    className="h-12 border-white/10 hover:bg-white/5 text-white font-bold rounded-2xl hover:text-white transition-all text-sm px-6"
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCredentialModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-lg z-50 flex items-center justify-center p-4"
            onClick={() => setShowCredentialModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-lg glass-card overflow-hidden border border-white/10 rounded-[2.5rem] shadow-3xl bg-neutral-950/90 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-3 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-500" />
              <button
                onClick={() => setShowCredentialModal(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white transition-all z-10"
                title="Fechar modal de credencial"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <AnimatePresence mode="wait">
                {!credentialData ? (
                  <motion.div
                    key="search-form"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.3 }}
                    className="p-6 md:p-10 space-y-6"
                  >
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-teal-400 pl-1">
                        Acesso Restrito
                      </span>
                      <h3 className="font-display font-bold text-2xl md:text-3xl text-white mt-1 tracking-tight">
                        Consultar Credencial
                      </h3>
                      <p className="text-white/40 text-sm mt-2 font-medium">
                        Informe o e-mail cadastrado para visualizar seu código de acesso e QR Code exclusivo.
                      </p>
                    </div>

                    <form onSubmit={handleSearchCredential} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="cred-email" className="text-white/60 font-bold text-[10px] md:text-xs uppercase tracking-widest pl-1">
                          E-mail Cadastrado
                        </Label>
                        <Input
                          id="cred-email"
                          type="email"
                          placeholder="seu@email.com"
                          value={credentialEmail}
                          onChange={(e) => setCredentialEmail(e.target.value)}
                          className="liquid-input h-12 md:h-14 tracking-wide"
                          required
                          disabled={searchingCredential}
                        />
                      </div>

                      {credentialError && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-3"
                        >
                          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-300 font-medium leading-relaxed">
                            {credentialError}
                          </p>
                        </motion.div>
                      )}

                      <div className="flex gap-4 pt-2">
                        <Button
                          type="submit"
                          disabled={searchingCredential}
                          className="modern-button h-12 flex-1 text-sm"
                        >
                          {searchingCredential ? 'Buscando...' : 'Verificar Credencial'}
                          {!searchingCredential && <ArrowRight className="w-4 h-4" />}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowCredentialModal(false)}
                          className="h-12 border-white/10 hover:bg-white/5 text-white font-bold rounded-2xl hover:text-white transition-all text-sm px-6"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="credential-result"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.3 }}
                    className="p-6 md:p-10 text-center space-y-6"
                  >
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">
                        Credencial Encontrada
                      </span>
                      <h3 className="font-display font-bold text-2xl text-white mt-1 truncate">
                        Olá, {credentialData.nome}!
                      </h3>
                      <p className="text-white/40 text-xs mt-1.5 font-medium">
                        Aqui está o seu passe de acesso aos eventos.
                      </p>
                    </div>

                    <div className="p-6 bg-white/[0.02] rounded-2xl border border-white/5 flex flex-col items-center space-y-3">
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-white/30">
                        Código da Credencial
                      </p>
                      <span className="font-display text-4xl font-black tracking-tight text-white">
                        {credentialData.codigo}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyText(credentialData.codigo)}
                        className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl gap-2 text-[10px] font-bold tracking-wider uppercase px-4 h-8 border border-white/5 mt-1"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copiar Código
                      </Button>
                    </div>

                    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl w-48 h-48 mx-auto shadow-xl border-4 border-white/5">
                      <QRCodeSVG
                        value={credentialData.codigo}
                        size={144}
                        level="H"
                        fgColor="#000000"
                        bgColor="#ffffff"
                      />
                    </div>

                    <p className="text-xs text-white/40 max-w-xs mx-auto leading-relaxed">
                      Mostre este QR Code ou informe o código acima no credenciamento físico dos eventos.
                    </p>

                    <div className="flex gap-4 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => setCredentialData(null)}
                        className="h-12 border-white/10 hover:bg-white/5 text-white font-bold rounded-2xl hover:text-white transition-all text-xs flex-1"
                      >
                        Consultar Outro E-mail
                      </Button>
                      <Button
                        onClick={() => setShowCredentialModal(false)}
                        className="modern-button h-12 flex-1 text-xs"
                      >
                        Concluído
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BentoItem({
  icon,
  title,
  description,
  color,
  onClick,
  isClickable
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  onClick?: () => void;
  isClickable?: boolean;
}) {
  return (
    <motion.div
      whileHover={isClickable ? { y: -5, scale: 1.01 } : { y: -5 }}
      onClick={onClick}
      className={cn(
        "glass-card p-8 group border-white/[0.08] relative overflow-hidden h-full",
        isClickable && "cursor-pointer hover:border-primary/20"
      )}
    >
      <div className={cn("inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-6 border border-white/5", color)}>
        {icon}
      </div>
      <h3 className="font-display font-bold text-xl text-white mb-3 tracking-tight group-hover:text-primary transition-colors flex items-center gap-2">
        {title}
        {isClickable && <ExternalLink className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity text-teal-400" />}
      </h3>
      <p className="text-sm text-white/40 leading-relaxed font-medium whitespace-pre-line">{description}</p>

      {/* Decorative gradient overlay */}
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all" />
    </motion.div>
  );
}

function UpcomingEventsWidget({ events, loading }: { events: any[]; loading: boolean }) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [studentCode, setStudentCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successEventId, setSuccessEventId] = useState<string | null>(null);

  const handleSubscribeInline = async (e: React.FormEvent, eventId: string) => {
    e.preventDefault();
    if (!studentCode.trim()) return;

    setSubmitting(true);
    try {
      const cleanedCode = studentCode.toUpperCase().trim();

      // 1. Buscar o participante pelo código via RPC
      const { data: rawParticipante, error: partError } = await supabase
        .rpc('get_participant_by_code', { p_code: cleanedCode })
        .maybeSingle();

      if (partError) throw partError;

      const participante = rawParticipante as { id: string; nome: string } | null;

      if (!participante) {
        toast.error('Código não encontrado', {
          description: 'Verifique seu código ou faça o cadastro ao lado.',
        });
        setSubmitting(false);
        return;
      }

      // 2. Verificar se já existe a inscrição via RPC
      const { data: registrationExists, error: checkError } = await supabase
        .rpc('check_event_registration', { p_event_id: eventId, p_participant_id: participante.id });

      if (checkError) throw checkError;

      if (registrationExists) {
        toast.info('Inscrição já realizada!', {
          description: 'Você já está inscrito neste evento.',
        });
        setSelectedEventId(null);
        setStudentCode('');
        setSuccessEventId(eventId);
        setTimeout(() => setSuccessEventId(null), 5000);
        setSubmitting(false);
        return;
      }

      // 3. Criar inscrição
      const { error: insertError } = await supabase
        .from('inscricoes_evento')
        .insert([{
          evento_id: eventId,
          participante_id: participante.id,
          presente: false
        }]);

      if (insertError) throw insertError;

      toast.success('Inscrição realizada com sucesso!');
      setSuccessEventId(eventId);
      setSelectedEventId(null);
      setStudentCode('');
      setTimeout(() => setSuccessEventId(null), 5000);
    } catch (err: any) {
      console.error('Subscription error inline:', err);
      toast.error('Erro ao realizar inscrição.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-8 border-white/[0.08] relative overflow-hidden flex flex-col justify-center items-center min-h-[250px]">
        <RefreshCcw className="w-6 h-6 animate-spin text-primary mb-3" />
        <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Carregando eventos...</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-8 border-white/[0.08] relative overflow-hidden flex flex-col min-h-[300px]">
      <div className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-6 border border-white/5 bg-orange-500/10">
        <Calendar className="w-6 h-6 text-orange-400" />
      </div>

      <h3 className="font-display font-bold text-xl text-white mb-2 tracking-tight">Próximos Eventos</h3>
      <p className="text-xs text-white/40 font-medium mb-6">Selecione para se inscrever informando seu código.</p>

      {events.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center py-6 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
          <Ticket className="w-8 h-8 text-white/10 mb-2" />
          <p className="text-xs text-white/30 font-bold uppercase tracking-wider">Sem eventos agendados</p>
          <p className="text-[10px] text-white/20 mt-1 max-w-[180px]">Fique de olho, em breve teremos novos fóruns e datas!</p>
        </div>
      ) : (
        <div className="space-y-4 flex-grow">
          {events.map((evt) => {
            const isSelected = selectedEventId === evt.id;
            const isSuccess = successEventId === evt.id;

            return (
              <div
                key={evt.id}
                className={cn(
                  "p-4 rounded-2xl border transition-all duration-300",
                  isSelected
                    ? "bg-white/[0.04] border-primary/30"
                    : isSuccess
                      ? "bg-emerald-500/[0.02] border-emerald-500/30"
                      : "bg-white/[0.01] border-white/5 hover:border-white/10"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-grow">
                    <h4 className="text-sm font-bold text-white truncate leading-tight">{evt.titulo}</h4>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/40 font-bold uppercase tracking-wider">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      <span>{new Date(evt.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às {new Date(evt.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}h</span>
                    </div>
                  </div>

                  {!isSelected && !isSuccess && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedEventId(evt.id);
                        setSuccessEventId(null);
                        setStudentCode('');
                      }}
                      className="h-8 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-[10px] uppercase tracking-wider px-3"
                    >
                      Inscrever
                    </Button>
                  )}

                  {isSuccess && (
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Inscrito</span>
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {isSelected && (
                    <motion.form
                      initial={{ height: 0, opacity: 0, marginTop: 0 }}
                      animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                      exit={{ height: 0, opacity: 0, marginTop: 0 }}
                      onSubmit={(e) => handleSubscribeInline(e, evt.id)}
                      className="overflow-hidden space-y-2.5 pt-2 border-t border-white/5"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Código (EVT-XXXXXX)"
                          required
                          value={studentCode}
                          onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                          className="h-9 text-xs rounded-xl bg-black/40 border-white/10 text-white uppercase placeholder:text-white/20 tracking-wider focus:border-primary font-bold text-center"
                          autoFocus
                          autoCapitalize="characters"
                          autoCorrect="off"
                          spellCheck="false"
                          disabled={submitting}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={submitting || !studentCode.trim()}
                          className="h-9 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-[10px] uppercase"
                        >
                          {submitting ? '...' : 'Ok'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedEventId(null)}
                          className="h-9 w-9 rounded-xl hover:bg-white/5 text-white/40 hover:text-white"
                          disabled={submitting}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-[9px] text-white/30 font-medium pl-1 leading-relaxed">
                        Informe o código recebido no seu cadastro.
                      </p>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Decorative gradient overlay */}
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
    </div>
  );
}
