import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Evento } from '@/types/index';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, MapPin, Clock, ArrowRight, UserCheck, X, AlertCircle, Sparkles, CheckCircle2, Ticket } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function Events() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Evento | null>(null);
  const [studentCode, setStudentCode] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState<boolean>(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('eventos')
        .select('*')
        .eq('publicado', true)
        .order('data', { ascending: true });

      if (error) throw error;
      setEventos(data || []);
    } catch (err: any) {
      console.error('Error fetching events:', err);
      toast.error('Erro ao carregar eventos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !studentCode.trim()) return;

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
          description: 'Verifique se o seu código está correto ou realize o seu cadastro para obter um novo.',
        });
        setSubmitting(false);
        return;
      }

      // 2. Verificar se já existe a inscrição via RPC
      const { data: registrationExists, error: checkError } = await supabase
        .rpc('check_event_registration', { p_event_id: selectedEvent.id, p_participant_id: participante.id });

      if (checkError) throw checkError;

      if (registrationExists) {
        toast.info('Inscrição já realizada!', {
          description: 'Você já está inscrito neste evento. Basta apresentar o seu código no check-in no dia.',
        });
        setSelectedEvent(null);
        setStudentCode('');
        setSubmitting(false);
        return;
      }

      // 3. Criar inscrição
      const { error: insertError } = await supabase
        .from('inscricoes_evento')
        .insert([{
          evento_id: selectedEvent.id,
          participante_id: participante.id,
          presente: false
        }]);

      if (insertError) throw insertError;

      setRegistrationSuccess(true);
      toast.success('Inscrição realizada com sucesso!');
    } catch (err: any) {
      console.error('Subscription error:', err);
      toast.error('Erro ao realizar inscrição.');
    } finally {
      setSubmitting(false);
    }
  };

  const closeRegistration = () => {
    setSelectedEvent(null);
    setStudentCode('');
    setRegistrationSuccess(false);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, filter: 'blur(5px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Clock className="w-8 h-8 animate-spin text-neutral-400" />
          <p className="text-neutral-500 font-medium tracking-tight">Buscando próximos eventos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 md:space-y-12 pb-12">
      <div className="text-center mb-10 md:mb-16 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 text-primary text-xs md:text-sm font-semibold mb-6 border border-white/10 backdrop-blur-sm shadow-xl"
        >
          <Sparkles className="w-4 h-4" />
          Agenda Olhar Jovem
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="heading-display text-4xl md:text-7xl mb-6 md:mb-8 text-white leading-[1.1] md:leading-[1.05] tracking-tight"
        >
          Próximos <br /> <span className="bg-gradient-to-r from-emerald-400 to-teal-600 bg-clip-text text-transparent">Eventos</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed"
        >
          Encontre os fóruns e encontros mais próximos de você e garanta a sua inscrição utilizando a sua credencial.
        </motion.p>
      </div>

      {eventos.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center p-12 bg-white/[0.02] border border-white/[0.06] rounded-[2rem] max-w-xl mx-auto"
        >
          <AlertCircle className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Nenhum evento publicado</h3>
          <p className="text-white/40 text-sm mb-6 leading-relaxed">
            No momento não há eventos com inscrições abertas. Fique atento às nossas redes sociais para novas divulgações!
          </p>
          <Button asChild className="rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10">
            <Link to="/">Fazer Meu Cadastro</Link>
          </Button>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 px-2 md:px-0"
        >
          {eventos.map((evento) => (
            <motion.div key={evento.id} variants={itemVariants} className="h-full">
              <Card className="glass-card border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02] transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-full group hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
                <CardHeader className="p-8 pb-4">
                  <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-widest mb-3">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(evento.data), "dd 'de' MMMM", { locale: ptBR })}
                  </div>
                  <CardTitle className="font-display font-bold text-2xl text-white tracking-tight leading-tight group-hover:text-primary transition-colors">
                    {evento.titulo}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-0 pb-8 flex-grow">
                  <p className="text-sm text-white/50 leading-relaxed font-medium mb-6 line-clamp-4">
                    {evento.descricao || 'Sem descrição fornecida.'}
                  </p>
                  
                  <div className="space-y-3 border-t border-white/5 pt-6 text-xs text-white/40 font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      <span>{format(new Date(evento.data), "HH:mm'h'", { locale: ptBR })}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-teal-400 animate-pulse" />
                      <span className="truncate max-w-[200px]">{evento.local}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-8 pt-0 border-none bg-transparent">
                  <Button 
                    onClick={() => setSelectedEvent(evento)}
                    className="modern-button w-full h-12 text-sm uppercase tracking-wider font-bold"
                  >
                    Inscrever-se
                    <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                  </Button>
                </CardFooter>
                
                {/* Efeito decorativo */}
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-primary/5 transition-all" />
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Modal de Inscrição */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-neutral-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
            >
              <div className="p-6 sm:p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <div>
                  <h3 className="text-xl font-display font-bold text-white">Inscrição no Evento</h3>
                  <p className="text-white/40 text-xs mt-1 truncate max-w-[300px]">{selectedEvent.titulo}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={closeRegistration}
                  className="rounded-full hover:bg-white/10 text-white/40 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <AnimatePresence mode="wait">
                {!registrationSuccess ? (
                  <motion.form 
                    key="form"
                    onSubmit={handleSubscribe} 
                    className="p-6 sm:p-8 space-y-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="space-y-3">
                      <Label htmlFor="code" className="text-[10px] uppercase font-bold text-white/40 tracking-widest pl-1">Código da Credencial (Permanente)</Label>
                      <Input
                        id="code"
                        placeholder="EVT-XXXXXX"
                        required
                        value={studentCode}
                        onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                        className="liquid-input h-14 text-center font-display text-xl font-bold tracking-widest placeholder:text-white/10"
                        autoFocus
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck="false"
                      />
                      <p className="text-[11px] text-white/30 leading-relaxed pl-1">
                        Informe o código alfanumérico que você salvou ao realizar seu cadastro inicial.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 pt-4">
                      <Button 
                        type="submit" 
                        disabled={submitting || !studentCode.trim()}
                        className="h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold"
                      >
                        {submitting ? 'Confirmando Inscrição...' : 'Confirmar Inscrição'}
                      </Button>
                      
                      <div className="text-center mt-2 border-t border-white/5 pt-4">
                        <span className="text-xs text-white/20">Não possui um código ainda? </span>
                        <Link 
                          to="/" 
                          onClick={closeRegistration}
                          className="text-xs text-primary hover:underline font-bold"
                        >
                          Cadastre-se para obter um.
                        </Link>
                      </div>
                    </div>
                  </motion.form>
                ) : (
                  <motion.div 
                    key="success"
                    className="p-6 sm:p-8 text-center space-y-6"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto border border-emerald-500/20 shadow-xl">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-display font-bold text-white mb-2">Inscrição Confirmada!</h4>
                      <p className="text-sm text-white/40 max-w-[280px] mx-auto leading-relaxed">
                        Sua vaga para <strong>{selectedEvent.titulo}</strong> foi reservada. Use sua credencial no dia para check-in.
                      </p>
                    </div>
                    <Button 
                      onClick={closeRegistration}
                      className="h-12 w-full max-w-xs rounded-2xl bg-white text-black hover:bg-neutral-200 font-bold"
                    >
                      Fechar
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
