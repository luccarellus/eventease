/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { generateCredentialCode } from '@/lib/credential-code';
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
  Building2,
  ArrowRight,
  AlertCircle,
  Calendar,
  Clock,
  Ticket,
  RefreshCcw,
  X,
  ExternalLink,
  MapPin,
  ChevronDown,
  Sparkles,
  Search,
  UserCheck,
  XCircle,
  Gift,
  Mail
} from 'lucide-react';
import rawSchoolsData from '@/data/cidades_escolas.json';
import { cn, formatPhone } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { executeRecaptcha } from '@/lib/recaptcha';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const registrationSchema = z.object({
  nome: z
    .string()
    .min(3, 'Nome muito curto')
    .max(100)
    .refine(
      (value) => value.trim().split(/\s+/).filter(Boolean).length >= 2,
      { message: 'Por favor, insira seu nome completo (nome e sobrenome)' }
    ),
  email: z.string().email('Email inválido'),
  telefone: z.string().regex(/^\(\d{2}\) \d{4,5}-\d{4}$/, 'Telefone inválido — use o formato (99) 99999-9999'),
  cidade: z.string().min(2, 'Cidade obrigatória'),
  escola: z.string().min(2, 'Escola obrigatória'),
  gremio: z.string().optional(),
  aceiteTermos: z.boolean().refine((val) => val === true, {
    message: 'Você deve aceitar a Política de Privacidade e os Termos de Uso.',
  }),
});

type RegistrationData = z.infer<typeof registrationSchema>;
type CredentialSummary = { nome: string; codigo: string };
type SchoolEntry = { city: string; school: string };
type EventItem = {
  id: string;
  titulo: string;
  descricao?: string;
  data: string;
  local: string;
  cidade?: string;
  publicado: boolean;
  dataInicioInscricao?: string;
  data_inicio_inscricao?: string;
  dataFimInscricao?: string;
  data_fim_inscricao?: string;
  createdAt?: string;
  created_at?: string;
};

type EventRegistrationStatus = 'em_breve' | 'aberto' | 'encerrado';

function getEventStatus(evento: EventItem): EventRegistrationStatus {
  const now = Date.now();
  const inicioStr = evento.dataInicioInscricao || evento.data_inicio_inscricao;
  const fimStr = evento.dataFimInscricao || evento.data_fim_inscricao;

  if (inicioStr) {
    const inicioDate = new Date(inicioStr);
    if (!isNaN(inicioDate.getTime()) && inicioDate.getTime() > now) {
      return 'em_breve';
    }
  }

  if (!evento.publicado) {
    return 'encerrado';
  }

  if (fimStr) {
    const fimDate = new Date(fimStr);
    if (!isNaN(fimDate.getTime()) && fimDate.getTime() < now) {
      return 'encerrado';
    }
  }

  const eventDate = new Date(evento.data);
  if (!isNaN(eventDate.getTime()) && eventDate.getTime() < now) {
    return 'encerrado';
  }

  return 'aberto';
}

function isEventInactive(evento: EventItem): boolean {
  return getEventStatus(evento) !== 'aberto';
}

const CREDENTIAL_STORAGE_KEY = 'eventease_credential';
const INACTIVE_EVENT_MESSAGE = 'As inscrições para este evento estão encerradas no momento.';

function loadStoredCredential(): CredentialSummary | null {
  try {
    const savedCredential = sessionStorage.getItem(CREDENTIAL_STORAGE_KEY);
    if (!savedCredential) {
      return null;
    }

    return JSON.parse(savedCredential) as CredentialSummary;
  } catch {
    return null;
  }
}

function saveStoredCredential(credential: CredentialSummary) {
  try {
    sessionStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(credential));
  } catch { }
}

function formatEventDate(value?: string, pattern = "dd 'de' MMMM") {
  if (!value) {
    return 'Data indisponível';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Data indisponível';
  }

  return format(date, pattern, { locale: ptBR });
}

function openCredentialModal(
  setCredentialData: React.Dispatch<React.SetStateAction<CredentialSummary | null>>,
  setCredentialEmail: React.Dispatch<React.SetStateAction<string>>,
  setCredentialError: React.Dispatch<React.SetStateAction<string>>,
  setShowCredentialModal: React.Dispatch<React.SetStateAction<boolean>>,
) {
  const savedCredential = loadStoredCredential();

  setCredentialEmail('');
  setCredentialError('');
  setCredentialData(savedCredential);
  setShowCredentialModal(true);
}

export default function Home() {
  // Controle de Eventos
  const [eventos, setEventos] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Controle de Inscrição no Evento Selecionado
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'detalhes' | 'cadastro' | 'busca'>('cadastro');
  const [successData, setSuccessData] = useState<{
    nome: string;
    codigo: string;
    email?: string;
    eventoTitulo?: string;
  } | null>(null);
  const [submittingRegistration, setSubmittingRegistration] = useState(false);

  // Controle de Busca de Credencial Existente (Geral)
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [credentialEmail, setCredentialEmail] = useState('');
  const [credentialData, setCredentialData] = useState<{ nome: string; codigo: string } | null>(null);
  const [searchingCredential, setSearchingCredential] = useState(false);
  const [credentialError, setCredentialError] = useState('');

  // Controle de Busca de Credencial para Vincular no Evento Selecionado
  const [existingCredentialSearch, setExistingCredentialSearch] = useState('');
  const [searchingExisting, setSearchingExisting] = useState(false);
  const [existingError, setExistingError] = useState('');

  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const qrSize = windowWidth < 380 ? 120 : windowWidth < 640 ? 150 : 220;

  // Escutar parâmetro de busca de credencial na URL (?buscar-credencial=true)
  useEffect(() => {
    if (searchParams.get('buscar-credencial') === 'true') {
      openCredentialModal(setCredentialData, setCredentialEmail, setCredentialError, setShowCredentialModal);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Carregar eventos publicados
  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const res = await api.get('/events');
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = (await res.json()) as EventItem[];

      setEventos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching events:', err);
      toast.error('Erro ao carregar os eventos.');
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Form de cadastro/inscrição
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegistrationData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      nome: '',
      email: '',
      telefone: '',
      cidade: '',
      escola: '',
      gremio: '',
      aceiteTermos: false,
    }
  });

  const selectedCity = watch('cidade');

  const schoolsData = useMemo(() => {
    const data: Record<string, string[]> = {};
    (rawSchoolsData as SchoolEntry[]).forEach((item) => {
      if (!data[item.city]) {
        data[item.city] = [];
      }
      data[item.city].push(item.school);
    });
    return data;
  }, []);

  const citiesList = useMemo(() => {
    return Object.keys(schoolsData).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [schoolsData]);

  const availableSchools = useMemo(() => {
    if (!selectedCity) return [];
    const schools = schoolsData[selectedCity] || [];
    return [...schools].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [selectedCity, schoolsData]);

  const linkParticipantToEvent = async (eventId: string, participantId: string) => {
    const checkRegRes = await api.get(`/registrations/check/${eventId}/${participantId}`);
    const registrationExists = checkRegRes.ok ? (await checkRegRes.json()).registered : false;

    if (!registrationExists) {
      const recaptchaToken = await executeRecaptcha('registration_create');
      const insertRegRes = await api.post('/registrations', {
        eventoId: eventId,
        participanteId: participantId,
        recaptchaToken,
      });

      if (!insertRegRes.ok) {
        let message = 'Falha ao registrar evento';
        try {
          const errorData = (await insertRegRes.json()) as { message?: string | string[] };
          if (errorData?.message) {
            message = Array.isArray(errorData.message) ? errorData.message.join(' ') : errorData.message;
          }
        } catch {
          // mantém a mensagem genérica se o corpo não for JSON válido
        }
        throw new Error(message);
      }

      return false;
    }

    return true;
  };

  // Submissão do cadastro contextualizado ao evento
  const onSubmitRegistration = async (formData: RegistrationData) => {
    if (!selectedEvent) return;
    setSubmittingRegistration(true);
    try {

      const emailClean = formData.email.trim().toLowerCase();

      // 1. Verificar se participante já existe
      const lookupToken = await executeRecaptcha('participant_lookup');
      const checkRes = await api.get(`/participants/email/${encodeURIComponent(emailClean)}`, {
        headers: { 'x-recaptcha-token': lookupToken },
      });
      let existing = null;
      if (checkRes.ok) {
        existing = await checkRes.json();
      }

      let participantId = '';
      let participantCode = '';
      let participantName = '';

      if (existing && existing.id) {
        toast.warning(
          'Este e-mail já está cadastrado. Por razões de segurança, use a aba "Já sou cadastrado" informando seu código da credencial para se inscrever.',
          { duration: 6000 }
        );
        setSubmittingRegistration(false);
        return;
      } else {
        // Criar participante novo
        const generatedCode = generateCredentialCode();
        const recaptchaToken = await executeRecaptcha('participant_create');
        const createRes = await api.post('/participants', {
          nome: formData.nome,
          email: formData.email,
          telefone: formData.telefone,
          cidade: formData.cidade,
          escola: formData.escola,
          gremio: formData.gremio || '',
          codigo: generatedCode,
          aceitou_termos: true,
          termos_aceitos_em: new Date().toISOString(),
          recaptchaToken,
        });

        if (!createRes.ok) {
          throw new Error('Falha ao criar participante');
        }

        const rawPart = await createRes.json();

        participantId = rawPart.id;
        participantCode = rawPart.codigo;
        participantName = rawPart.nome;
      }

      if (!participantId) {
        throw new Error('Falha ao obter dados do participante.');
      }

      // 2. Verificar inscrição existente no evento
      const registrationExists = await linkParticipantToEvent(selectedEvent.id, participantId);

      if (!registrationExists) {
        toast.success('Inscrição confirmada com sucesso!');
      } else {
        toast.info('Você já está inscrito neste evento! Sua credencial foi carregada.');
      }

      // LocalStorage backup
      saveStoredCredential({
        nome: participantName,
        codigo: participantCode,
      });

      setSuccessData({
        nome: participantName,
        codigo: participantCode,
        email: formData.email,
        eventoTitulo: selectedEvent.titulo,
      });
      reset();
    } catch (error) {
      console.error('Registration/Subscription error:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao realizar inscrição: ' + message);
    } finally {
      setSubmittingRegistration(false);
    }
  };

  // Submissão de busca e vínculo para aluno já cadastrado
  const handleSubscribeExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !existingCredentialSearch.trim()) return;

    // Bloqueia a vinculação quando o evento está inativo/encerrado
    if (isEventInactive(selectedEvent)) {
      setExistingError(INACTIVE_EVENT_MESSAGE);
      return;
    }

    setSearchingExisting(true);
    setExistingError('');

    try {
      const searchClean = existingCredentialSearch.trim();
      let participantCode = '';
      let participantName = '';
      let participantId = '';

      let participantEmail = '';

      if (searchClean.includes('@')) {
        // Buscar por email
        const recaptchaToken = await executeRecaptcha('participant_lookup');
        const checkRes = await api.get(`/participants/email/${encodeURIComponent(searchClean.toLowerCase())}`, {
          headers: { 'x-recaptcha-token': recaptchaToken },
        });

        if (checkRes.ok) {
          setExistingError(
            'Cadastro localizado! Por motivos de segurança, não é possível se vincular informando apenas o e-mail. Por favor, insira o seu código da credencial (EVT-XXXXXX).'
          );
          setSearchingExisting(false);
          return;
        } else {
          setExistingError('Nenhum cadastro encontrado para este e-mail.');
          setSearchingExisting(false);
          return;
        }
      } else {
        // Buscar por código
        const formattedCode = searchClean.toUpperCase();
        const recaptchaToken = await executeRecaptcha('participant_lookup');
        const codeRes = await api.get(`/participants/code/${encodeURIComponent(formattedCode)}`, {
          headers: { 'x-recaptcha-token': recaptchaToken },
        });

        if (!codeRes.ok) {
          setExistingError('Código de credencial não encontrado.');
          setSearchingExisting(false);
          return;
        }

        const participant = await codeRes.json();
        participantId = participant.id;
        participantName = participant.nome;
        participantCode = formattedCode;
        participantEmail = participant.email || '';

      }

      if (!participantId) {
        throw new Error('Falha ao localizar participante.');
      }

      // Verificar se já está inscrito no evento
      const registrationExists = await linkParticipantToEvent(selectedEvent.id, participantId);

      if (!registrationExists) {
        toast.success('Inscrição vinculada com sucesso!');
      } else {
        toast.info('Você já está inscrito neste evento!');
      }

      setSuccessData({
        nome: participantName,
        codigo: participantCode,
        email: participantEmail || undefined,
        eventoTitulo: selectedEvent.titulo,
      });
      setExistingCredentialSearch('');
    } catch (err) {
      console.error('Error linking existing participant:', err);
      setExistingError('Erro ao vincular inscrição. Tente novamente.');
    } finally {
      setSearchingExisting(false);
    }
  };

  // Busca geral de credencial (consulta rápida)
  const handleSearchCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialEmail.trim()) return;

    setSearchingCredential(true);
    setCredentialError('');

    try {
      const recaptchaToken = await executeRecaptcha('participant_lookup');
      const email = credentialEmail.trim().toLowerCase();
      const res = await api.get(`/participants/email/${encodeURIComponent(email)}`, {
        headers: { 'x-recaptcha-token': recaptchaToken },
      });

      if (res.ok) {
        const existing = await res.json();
        setCredentialData({
          nome: existing.nome,
          codigo: existing.codigo
        });
        saveStoredCredential({
          nome: existing.nome,
          codigo: existing.codigo,
        });
      } else {
        setCredentialError('Nenhum cadastro encontrado para este e-mail. Verifique se o e-mail está correto ou realize a inscrição em um evento.');
      }
    } catch (err) {
      console.error('Error searching credential:', err);
      setCredentialError('Erro ao buscar credencial. Tente novamente mais tarde.');
    } finally {
      setSearchingCredential(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.info('Código copiado!');
  };

  const closeRegistration = () => {
    setSelectedEvent(null);
    setSuccessData(null);
    setActiveModalTab('cadastro');
    setExistingCredentialSearch('');
    setExistingError('');
    reset();
  };

  const openEventModal = (event: EventItem, tab: 'detalhes' | 'cadastro' = 'detalhes') => {
    setSelectedEvent(event);
    setActiveModalTab(isEventInactive(event) ? 'detalhes' : tab);
    setSuccessData(null);
  };

  // Filtrar eventos por termo de busca
  const filteredEvents = useMemo(() => {
    return eventos.filter(evt =>
      evt.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.local.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [eventos, searchTerm]);

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 md:space-y-12 pb-4 sm:pb-8 md:pb-12">
      {/* Hero / Banner Principal */}
      <div className="text-center mb-5 sm:mb-8 md:mb-16 px-3 sm:px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-white/[0.03] text-primary text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-3 sm:mb-6 border border-white/10 backdrop-blur-md shadow-lg shadow-black/40"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Eventos disponíveis
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="heading-display text-2xl sm:text-4xl md:text-7xl mb-2.5 sm:mb-6 md:mb-8 tracking-tight font-extrabold leading-[1.15] md:leading-[1.05]"
        >
          <span className="text-white drop-shadow-sm">EventEase</span>
          <span className="mx-1.5 sm:mx-4 text-white/15 font-light text-xl sm:text-3xl md:text-5xl align-middle">/</span>
          <span className="bg-gradient-to-r from-primary via-primary to-primary-dark bg-clip-text text-transparent font-black tracking-tighter">
            Instituto Olhar Jovem
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-white/50 text-xs sm:text-base md:text-lg max-w-2xl mx-auto font-medium leading-relaxed px-2 sm:px-4 mb-4 sm:mb-8 line-clamp-3 sm:line-clamp-none"
        >
          Escolha um evento na lista abaixo e garanta sua vaga. O cadastro é feito de forma simples e direta, liberando seu <span className="text-white font-semibold">QR Code de presença</span> imediatamente.
        </motion.p>

      </div>

      {/* Caixa de Busca de Eventos */}
      <div className="max-w-md mx-auto relative group px-2 md:px-0 mb-5 sm:mb-10">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-white/20 transition-colors group-focus-within:text-primary" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar eventos por título ou local..."
          className="liquid-input pl-11 sm:pl-12 h-10 sm:h-12 text-xs sm:text-sm placeholder:text-white/20 border-white/[0.05]"
        />
      </div>

      {/* Listagem de Eventos */}
      {loadingEvents ? (
        <div className="flex items-center justify-center h-[30vh]">
          <div className="flex flex-col items-center gap-4">
            <LoadingSpinner size="lg" />
            <p className="text-neutral-500 font-medium tracking-tight">Carregando eventos...</p>
          </div>
        </div>
      ) : filteredEvents.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center p-6 sm:p-12 bg-white/[0.02] border border-white/[0.06] rounded-[1.5rem] sm:rounded-[2rem] max-w-xl mx-auto"
        >
          <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-white/20 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Nenhum evento localizado</h3>
          <p className="text-white/40 text-xs sm:text-sm leading-relaxed">
            {searchTerm ? 'Nenhum resultado corresponde à sua pesquisa. Tente buscar por outros termos.' : 'No momento não há eventos com inscrições abertas.'}
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6 md:gap-8 px-1 sm:px-2 md:px-0"
        >
          {filteredEvents.map((evento) => (
            <motion.div
              key={evento.id}
              variants={{
                hidden: { opacity: 0, y: 20, filter: 'blur(5px)' },
                visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }
              }}
              whileHover={{ y: -4 }}
              className="h-full"
            >
              <Card
                role="button"
                tabIndex={0}
                onClick={() => openEventModal(evento, 'detalhes')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openEventModal(evento, 'detalhes');
                  }
                }}
                className="glass-card border-white/[0.10] hover:border-primary/30 bg-card/90 transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-full group cursor-pointer will-change-transform !shadow-[0_16px_50px_rgba(0,0,0,0.5)] hover:!shadow-[0_24px_70px_rgba(0,0,0,0.7)] hover:-translate-y-1 active:translate-y-0 focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-2xl sm:rounded-3xl gap-1.5 sm:gap-2"
              >
                <CardHeader className="p-4 sm:p-7 md:p-8 pb-1 sm:pb-2">
                  <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                    {(() => {
                      const status = getEventStatus(evento);
                      if (status === 'em_breve') {
                        return (
                          <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                            Em Breve
                          </span>
                        );
                      }
                      if (status === 'encerrado') {
                        return (
                          <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Encerrado
                          </span>
                        );
                      }
                      return (
                        <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Aberto
                        </span>
                      );
                    })()}
                    <span className="text-[10px] sm:text-xs text-white/40 font-bold uppercase tracking-wider">
                      {formatEventDate(evento.data)}
                    </span>
                  </div>
                  <CardTitle className="font-display font-bold text-lg sm:text-2xl text-white tracking-tight leading-snug group-hover:text-primary transition-colors line-clamp-2">
                    {evento.titulo}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-7 md:p-8 pt-0 pb-3 sm:pb-6 flex-grow">
                  <p className="text-xs sm:text-sm text-white/50 leading-relaxed font-medium mb-3 sm:mb-5 line-clamp-2 sm:line-clamp-3">
                    {evento.descricao || 'Sem descrição fornecida.'}
                  </p>

                  <div className="space-y-1.5 sm:space-y-2.5 border-t border-white/5 pt-3 sm:pt-4 text-xs text-white/40 font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary shrink-0" />
                      <span className="text-[11px] sm:text-xs">{formatEventDate(evento.data, "HH:mm'h'")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary shrink-0 animate-pulse" />
                      <span className="truncate max-w-[220px] sm:max-w-[260px] text-[11px] sm:text-xs">{evento.local}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-4 sm:p-7 md:p-8 pt-0 border-none bg-transparent">
                  {(() => {
                    const status = getEventStatus(evento);
                    if (status === 'em_breve') {
                      return (
                        <Button
                          onClick={(event) => {
                            event.stopPropagation();
                            openEventModal(evento, 'detalhes');
                          }}
                          variant="outline"
                          className="w-full h-10 sm:h-12 text-xs uppercase tracking-wider font-bold border-sky-500/30 text-sky-400 hover:bg-sky-500/10 bg-sky-500/5 rounded-xl sm:rounded-2xl cursor-pointer touch-press"
                        >
                          Inscrições Em Breve
                        </Button>
                      );
                    }
                    if (status === 'encerrado') {
                      return (
                        <Button
                          onClick={(event) => {
                            event.stopPropagation();
                            openEventModal(evento, 'detalhes');
                          }}
                          variant="outline"
                          className="w-full h-10 sm:h-12 text-xs uppercase tracking-wider font-bold border-amber-500/30 text-amber-400 hover:bg-amber-500/10 bg-amber-500/5 rounded-xl sm:rounded-2xl cursor-pointer touch-press"
                        >
                          Inscrições Encerradas
                        </Button>
                      );
                    }
                    return (
                      <Button
                        onClick={(event) => {
                          event.stopPropagation();
                          openEventModal(evento, 'cadastro');
                        }}
                        className="modern-button w-full h-10 sm:h-12 text-xs sm:text-sm uppercase tracking-wider font-bold touch-press rounded-xl sm:rounded-2xl"
                      >
                        Participar
                        <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                      </Button>
                    );
                  })()}
                </CardFooter>

                <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent opacity-70" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.045] via-transparent to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Modal Contextual de Inscrição */}
      <AnimatePresence>
        {selectedEvent && (
          <div
            className={cn(
              "fixed inset-0 z-[100] flex justify-center bg-black/85 backdrop-blur-md",
              activeModalTab === 'detalhes' && !successData
                ? "items-end sm:items-center p-0 sm:p-4 md:p-6"
                : "items-end md:items-center p-0 sm:p-4 md:p-6"
            )}
            onClick={closeRegistration}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={cn(
                "w-full bg-card border border-white/10 overflow-hidden relative flex flex-col",
                activeModalTab === 'detalhes' && !successData
                  ? "max-w-xl rounded-t-[1.75rem] sm:rounded-[2rem] max-h-[90dvh] sm:max-h-[88dvh] shadow-[0_24px_80px_rgba(0,0,0,0.85)]"
                  : "max-w-2xl rounded-t-[1.75rem] md:rounded-[2.5rem] mt-auto md:mt-0 max-h-[92dvh] md:max-h-[90dvh] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] md:shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-1.5 sm:h-2 bg-gradient-to-r from-primary via-primary to-primary-dark" />

              <button
                onClick={closeRegistration}
                className="absolute top-3 right-3 sm:top-6 sm:right-6 p-1.5 sm:p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white transition-all z-10 touch-press"
                title="Fechar modal de inscrição"
                aria-label="Fechar"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Header do Modal */}
              <div className="p-3.5 sm:p-6 md:p-8 border-b border-white/5 bg-white/[0.01]">
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary">
                  {activeModalTab === 'detalhes' && !successData ? 'Detalhes do Evento' : 'Inscrição no Evento'}
                </span>
                <h3 className="text-base sm:text-xl md:text-2xl font-display font-bold text-white mt-0.5 truncate pr-8 sm:pr-10">{selectedEvent.titulo}</h3>
                <p className="text-white/40 text-[11px] sm:text-xs mt-0.5 flex items-center gap-1.5 truncate">
                  <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary shrink-0" /> {selectedEvent.local}{selectedEvent.cidade ? ` • ${selectedEvent.cidade}` : ''}
                </p>
              </div>

              {/* Tabs Seletoras (Novo Cadastro vs Já Cadastrado) - Ocultas em caso de sucesso */}
              {!successData && (
                <div className="flex border-b border-white/5 px-2 sm:px-6 md:px-8 bg-black/40 gap-1 overflow-x-auto scrollbar-hide">
                  <button
                    onClick={() => { setActiveModalTab('detalhes'); setExistingError(''); }}
                    className={cn(
                      "py-2 sm:py-3.5 px-2.5 sm:px-4 font-bold text-[10px] sm:text-xs uppercase tracking-wider border-b-2 transition-all whitespace-nowrap flex-1 sm:flex-none text-center touch-press",
                      activeModalTab === 'detalhes' ? "border-primary text-white" : "border-transparent text-white/40 hover:text-white/60"
                    )}
                  >
                    Detalhes
                  </button>
                  <button
                    onClick={() => { setActiveModalTab('cadastro'); setExistingError(''); }}
                    className={cn(
                      "py-2 sm:py-3.5 px-2.5 sm:px-4 font-bold text-[10px] sm:text-xs uppercase tracking-wider border-b-2 transition-all whitespace-nowrap flex-1 sm:flex-none text-center touch-press",
                      activeModalTab === 'cadastro' ? "border-primary text-white" : "border-transparent text-white/40 hover:text-white/60"
                    )}
                  >
                    Novo Cadastro
                  </button>
                  <button
                    onClick={() => { setActiveModalTab('busca'); setExistingError(''); }}
                    className={cn(
                      "py-2 sm:py-3.5 px-2.5 sm:px-4 font-bold text-[10px] sm:text-xs uppercase tracking-wider border-b-2 transition-all whitespace-nowrap flex-1 sm:flex-none text-center touch-press",
                      activeModalTab === 'busca' ? "border-primary text-white" : "border-transparent text-white/40 hover:text-white/60"
                    )}
                  >
                    Já sou cadastrado
                  </button>
                </div>
              )}

              {/* Corpo do Modal com Scroll Interno para telas menores */}
              <div className="overflow-y-auto p-3.5 sm:p-6 md:p-8 flex-grow custom-scrollbar overscroll-contain">
                <AnimatePresence mode="wait">
                  {successData ? (
                    // TELA DE SUCESSO
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center space-y-3.5 sm:space-y-6 md:space-y-8 py-1 sm:py-4"
                    >
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto border border-emerald-500/20 shadow-xl">
                        <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8" />
                      </div>

                      <div>
                        <h4 className="text-lg sm:text-2xl md:text-3xl font-display font-bold text-white mb-1">Inscrição Confirmada!</h4>
                        <p className="text-xs sm:text-sm text-white/60 max-w-md mx-auto leading-relaxed">
                          Olá, <strong className="text-white">{successData.nome}</strong>! Sua vaga está garantida. Apresente seu QR Code ou informe seu código no credenciamento.
                        </p>
                      </div>

                      {/* 🎁 CARD DE NOTIFICAÇÃO VISUAL DA SURPRESA NO E-MAIL */}
                      <div className="relative overflow-hidden p-3 sm:p-6 rounded-xl sm:rounded-[2rem] bg-gradient-to-br from-amber-500/15 via-primary/20 to-purple-600/15 border border-amber-500/30 text-left max-w-md mx-auto shadow-[0_15px_40px_rgba(245,158,11,0.15)]">
                        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
                        <div className="flex items-start gap-2.5 sm:gap-4 relative z-10">
                          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0 shadow-lg">
                            <Gift className="w-4 h-4 sm:w-6 sm:h-6 animate-bounce" />
                          </div>
                          <div className="space-y-0.5 sm:space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[8px] sm:text-[10px] font-extrabold uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                                🎁 Surpresa Especial
                              </span>
                              <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                            </div>
                            <h5 className="text-xs sm:text-base font-bold text-white leading-tight">Verifique o seu e-mail de cadastro!</h5>
                            <p className="text-[11px] sm:text-xs text-white/80 leading-relaxed font-medium">
                              Preparamos uma <strong className="text-amber-300">surpresa exclusiva</strong> para você! Enviamos a confirmação e o seu presente para{' '}
                              <strong className="text-white underline underline-offset-2 break-all">
                                {successData.email || 'o seu e-mail cadastrado'}
                              </strong>.
                            </p>
                            <p className="text-[9px] sm:text-[11px] text-white/50 pt-0.5 flex items-center gap-1">
                              <Mail className="w-3 h-3 text-amber-300 shrink-0" />
                              <span>Verifique também sua pasta de <strong>Spam/Lixo</strong>.</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* RESUMO DAS INFORMAÇÕES DO CADASTRO */}
                      <div className="p-3 sm:p-6 bg-white/[0.02] rounded-xl sm:rounded-[2rem] border border-white/[0.08] max-w-md mx-auto text-left space-y-2.5 sm:space-y-4 shadow-inner">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="text-[8px] sm:text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/40">Informações</span>
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Ativo
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs">
                          <div>
                            <p className="text-white/40 font-bold uppercase tracking-wider text-[8px] sm:text-[9px]">Participante</p>
                            <p className="text-white font-semibold mt-0.5 truncate text-xs sm:text-sm">{successData.nome}</p>
                          </div>
                          {successData.email && (
                            <div>
                              <p className="text-white/40 font-bold uppercase tracking-wider text-[8px] sm:text-[9px]">E-mail</p>
                              <p className="text-white font-semibold mt-0.5 truncate text-xs sm:text-sm">{successData.email}</p>
                            </div>
                          )}
                          {successData.eventoTitulo && (
                            <div className="sm:col-span-2">
                              <p className="text-white/40 font-bold uppercase tracking-wider text-[8px] sm:text-[9px]">Evento</p>
                              <p className="text-white font-semibold mt-0.5 truncate text-xs sm:text-sm">{successData.eventoTitulo}</p>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 sm:pt-3 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3">
                          <div className="text-center sm:text-left">
                            <p className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-[0.2em] text-white/30">Código da Credencial</p>
                            <span className="font-display text-lg sm:text-2xl font-black tracking-tight text-white select-all">
                              {successData.codigo}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyText(successData.codigo)}
                            className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl gap-1.5 text-xs font-bold transition-all px-3 h-8 border border-white/10 w-full sm:w-auto touch-press"
                          >
                            <Copy className="w-3.5 h-3.5" /> Copiar Código
                          </Button>
                        </div>
                      </div>

                      {/* QR CODE DE CREDENCIAMENTO */}
                      <div className="flex flex-col items-center space-y-2">
                        <div id="registration-qr-code" className="p-2.5 sm:p-4 bg-white rounded-xl sm:rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-white/10 flex items-center justify-center">
                          <QRCodeSVG
                            value={successData.codigo}
                            size={qrSize}
                            level="H"
                            fgColor="#000000"
                            bgColor="#ffffff"
                          />
                        </div>
                      </div>

                      <div className="pt-1 max-w-sm mx-auto">
                        <Button
                          onClick={closeRegistration}
                          className="modern-button w-full h-11 sm:h-12 text-xs sm:text-sm touch-press"
                        >
                          Concluir e Fechar
                        </Button>
                      </div>
                    </motion.div>
                  ) : activeModalTab === 'detalhes' ? (
                    <motion.div
                      key="event-details"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="space-y-4 sm:space-y-6"
                    >
                      <div className="space-y-3 sm:space-y-4">
                        <div className="flex flex-wrap items-center gap-2.5 text-[11px] sm:text-xs text-white/40 font-bold uppercase tracking-wider">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                            {formatEventDate(selectedEvent.data)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                            {formatEventDate(selectedEvent.data, "HH:mm'h'")}
                          </span>
                        </div>
                        <div className="rounded-xl sm:rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 sm:p-5">
                          <p className="whitespace-pre-line text-xs sm:text-base text-white/65 leading-relaxed font-medium">
                            {selectedEvent.descricao || 'Sem descrição fornecida.'}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 sm:pt-4 flex flex-col sm:flex-row gap-2.5 sm:gap-4 border-t border-white/5">
                        {(() => {
                          const status = getEventStatus(selectedEvent);
                          if (status === 'em_breve') {
                            const inicioStr = selectedEvent.dataInicioInscricao || selectedEvent.data_inicio_inscricao;
                            return (
                              <div className="w-full p-3.5 sm:p-4 bg-sky-500/10 border border-sky-500/20 rounded-xl sm:rounded-2xl text-center space-y-1">
                                <p className="text-sky-400 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5">
                                  <Clock className="w-4 h-4" /> Inscrições Em Breve
                                </p>
                                <p className="text-white/50 text-[11px] sm:text-xs">
                                  As inscrições iniciam em {formatEventDate(inicioStr, "dd/MM/yyyy 'às' HH:mm'h'")}.
                                </p>
                              </div>
                            );
                          }
                          if (status === 'encerrado') {
                            return (
                              <div className="w-full p-3.5 sm:p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl sm:rounded-2xl text-center space-y-1">
                                <p className="text-amber-400 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5">
                                  <XCircle className="w-4 h-4" /> Inscrições Encerradas
                                </p>
                                <p className="text-white/50 text-[11px] sm:text-xs">Este evento está inativo ou o período de inscrições expirou.</p>
                              </div>
                            );
                          }
                          return (
                            <>
                              <Button
                                type="button"
                                onClick={() => setActiveModalTab('cadastro')}
                                className="modern-button h-11 sm:h-12 flex-1 text-xs sm:text-sm font-bold uppercase touch-press"
                              >
                                Participar
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={closeRegistration}
                                className="h-11 sm:h-12 border-white/10 hover:bg-white/5 text-white font-bold rounded-xl sm:rounded-2xl hover:text-white transition-all text-xs sm:text-sm px-5 sm:px-6 touch-press"
                              >
                                Fechar
                              </Button>
                            </>
                          );
                        })()}
                      </div>
                    </motion.div>
                  ) : activeModalTab === 'cadastro' ? (
                    // FORMULÁRIO DE NOVO CADASTRO
                    <motion.form
                      key="form-cadastro"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      onSubmit={handleSubmit(onSubmitRegistration)}
                      className="space-y-3 sm:space-y-4 md:space-y-5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 md:gap-5">
                        <div className="space-y-1">
                          <Label htmlFor="nome" className="text-white/60 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest pl-0.5">Nome Completo</Label>
                          <Input
                            id="nome"
                            placeholder="Informe seu nome completo"
                            {...register('nome')}
                            className={cn("liquid-input h-10 sm:h-12 text-sm", errors.nome && "border-red-500/50 focus:border-red-500/50")}
                          />
                          {errors.nome && <p className="text-[10px] text-red-400 font-bold uppercase pl-0.5">{errors.nome.message}</p>}
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="email" className="text-white/60 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest pl-0.5">E-mail</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="seu@email.com"
                            {...register('email')}
                            className={cn("liquid-input h-10 sm:h-12 text-sm", errors.email && "border-red-500/50 focus:border-red-500/50")}
                          />
                          {errors.email && <p className="text-[10px] text-red-400 font-bold uppercase pl-0.5">{errors.email.message}</p>}
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="cidade" className="text-white/60 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest pl-0.5">Cidade</Label>
                          <div className="relative">
                            <select
                              id="cidade"
                              {...register('cidade')}
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                setValue('cidade', e.target.value);
                                setValue('escola', '');
                              }}
                              className={cn(
                                "liquid-input h-10 sm:h-12 w-full appearance-none pr-10 cursor-pointer text-sm",
                                errors.cidade && "border-red-500/50 focus:border-red-500/50"
                              )}
                            >
                              <option value="" className="text-white/60 bg-card">Selecione sua cidade</option>
                              {citiesList.map((city) => (
                                <option key={city} value={city} className="text-white bg-card">
                                  {city}
                                </option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
                              <ChevronDown className="w-4 h-4" />
                            </div>
                          </div>
                          {errors.cidade && <p className="text-[10px] text-red-400 font-bold uppercase pl-0.5">{errors.cidade.message}</p>}
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="escola" className="text-white/60 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest pl-0.5">Escola / Instituição</Label>
                          <div className="relative">
                            <select
                              id="escola"
                              disabled={!selectedCity}
                              {...register('escola')}
                              className={cn(
                                "liquid-input h-10 sm:h-12 w-full appearance-none pr-10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-sm",
                                errors.escola && "border-red-500/50 focus:border-red-500/50"
                              )}
                            >
                              <option value="" className="text-white/60 bg-card">
                                {!selectedCity ? "Selecione primeiro a cidade" : "Selecione sua escola"}
                              </option>
                              {availableSchools.map((school) => (
                                <option key={school} value={school} className="text-white bg-card">
                                  {school}
                                </option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
                              <ChevronDown className="w-4 h-4" />
                            </div>
                          </div>
                          {errors.escola && <p className="text-[10px] text-red-400 font-bold uppercase pl-0.5">{errors.escola.message}</p>}
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="gremio" className="text-white/60 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest pl-0.5">Grêmio Estudantil (Opcional)</Label>
                          <Input
                            id="gremio"
                            placeholder="Nome do seu grêmio"
                            {...register('gremio')}
                            className="liquid-input h-10 sm:h-12 text-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="telefone" className="text-white/60 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest pl-0.5">WhatsApp / Telefone</Label>
                          <Input
                            id="telefone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="(99) 99999-9999"
                            maxLength={15}
                            {...register('telefone')}
                            onChange={(e) => setValue('telefone', formatPhone(e.target.value))}
                            className={cn("liquid-input h-10 sm:h-12 text-sm", errors.telefone && "border-red-500/50 focus:border-red-500/50")}
                          />
                          {errors.telefone && <p className="text-[10px] text-red-400 font-bold uppercase pl-0.5">{errors.telefone.message}</p>}
                        </div>
                      </div>

                      <div className="pt-1 sm:pt-2">
                        <label className="flex items-start gap-2.5 sm:gap-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                            <input
                              type="checkbox"
                              {...register('aceiteTermos')}
                              className="peer appearance-none w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/20 rounded-md bg-transparent checked:bg-primary checked:border-primary transition-all focus:ring-2 focus:ring-primary/30 outline-none cursor-pointer"
                            />
                            <CheckCircle2 className="absolute w-3 h-3 sm:w-3.5 sm:h-3.5 text-black opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                          </div>
                          <span className="text-[11px] sm:text-xs md:text-sm text-white/60 leading-tight">
                            Declaro que li e concordo com os <Link to="/termos" target="_blank" className="text-primary hover:underline underline-offset-4">Termos de Uso</Link> e a <Link to="/politica-de-privacidade" target="_blank" className="text-primary hover:underline underline-offset-4">Política de Privacidade</Link>, e autorizo o tratamento dos meus dados conforme a LGPD.
                          </span>
                        </label>
                        {errors.aceiteTermos && <p className="text-[10px] text-red-400 font-bold uppercase pl-0.5 mt-1.5">{errors.aceiteTermos.message}</p>}
                      </div>

                      <div className="pt-2.5 sm:pt-4 flex flex-col sm:flex-row gap-2.5 sm:gap-4 border-t border-white/5 mt-3 sm:mt-6">
                        <Button
                          type="submit"
                          disabled={submittingRegistration || isEventInactive(selectedEvent)}
                          className="modern-button h-11 sm:h-12 flex-1 text-xs sm:text-sm font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed touch-press"
                        >
                          {submittingRegistration && <LoadingSpinner size="xs" variant="white" className="mr-2" />}
                          {getEventStatus(selectedEvent) === 'em_breve'
                            ? 'Inscrições Em Breve'
                            : getEventStatus(selectedEvent) === 'encerrado'
                              ? 'Inscrições Encerradas'
                              : submittingRegistration
                                ? 'Processando Inscrição...'
                                : 'Confirmar e Participar'}
                          {!submittingRegistration && !isEventInactive(selectedEvent) && <ArrowRight className="w-4 h-4 ml-1" />}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={closeRegistration}
                          className="h-11 sm:h-12 border-white/10 hover:bg-white/5 text-white font-bold rounded-xl sm:rounded-2xl hover:text-white transition-all text-xs sm:text-sm px-5 sm:px-6 touch-press"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </motion.form>
                  ) : (
                    // VÍNCULO PARA ALUNO JÁ CADASTRADO
                    <motion.form
                      key="form-busca"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      onSubmit={handleSubscribeExisting}
                      className="space-y-4 sm:space-y-6 py-1 sm:py-4"
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="existing-search" className="text-white/60 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest pl-0.5">
                          E-mail ou Código da Credencial
                        </Label>
                        <Input
                          id="existing-search"
                          placeholder="seu@email.com ou EVT-XXXXXX"
                          value={existingCredentialSearch}
                          onChange={(e) => setExistingCredentialSearch(e.target.value)}
                          className="liquid-input h-10 sm:h-12 text-sm tracking-wide"
                          required
                          disabled={searchingExisting}
                        />
                        <p className="text-[10px] sm:text-[11px] text-white/30 pl-0.5 leading-relaxed">
                          Informe o e-mail cadastrado anteriormente ou seu código permanente `EVT-XXXXXX` para se vincular instantaneamente a este evento.
                        </p>
                      </div>

                      {isEventInactive(selectedEvent) && !existingError && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5"
                        >
                          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-300 font-medium leading-relaxed">
                            {INACTIVE_EVENT_MESSAGE}
                          </p>
                        </motion.div>
                      )}

                      {existingError && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3 sm:p-4 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2.5"
                        >
                          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-300 font-medium leading-relaxed">
                            {existingError}
                          </p>
                        </motion.div>
                      )}

                      <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row gap-2.5 sm:gap-4 border-t border-white/5">
                        <Button
                          type="submit"
                          disabled={searchingExisting || !existingCredentialSearch.trim() || isEventInactive(selectedEvent)}
                          className="modern-button h-11 sm:h-12 flex-1 text-xs sm:text-sm font-bold uppercase touch-press"
                        >
                          {searchingExisting ? 'Localizando...' : 'Confirmar Inscrição'}
                          {!searchingExisting && <ArrowRight className="w-4 h-4" />}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={closeRegistration}
                          className="h-11 sm:h-12 border-white/10 hover:bg-white/5 text-white font-bold rounded-xl sm:rounded-2xl hover:text-white transition-all text-xs sm:text-sm px-5 sm:px-6 touch-press"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Geral de Consulta de Credencial (Minha Credencial) */}
      <AnimatePresence>
        {showCredentialModal && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md" onClick={() => setShowCredentialModal(false)}>
            <motion.div
              initial={{ scale: 0.96, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 30, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-lg bg-card border border-white/10 rounded-t-[1.75rem] sm:rounded-[2.5rem] overflow-y-auto max-h-[92dvh] custom-scrollbar shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative p-4 sm:p-8 md:p-10 space-y-4 sm:space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-1.5 sm:h-2 bg-gradient-to-r from-primary via-primary to-primary-dark absolute top-0 left-0 right-0" />

              <button
                onClick={() => setShowCredentialModal(false)}
                className="absolute top-3 right-3 sm:top-6 sm:right-6 p-1.5 sm:p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white transition-all z-10 touch-press"
                title="Fechar modal de consulta"
                aria-label="Fechar"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <AnimatePresence mode="wait">
                {!credentialData ? (
                  <motion.div
                    key="search-form"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4 sm:space-y-6"
                  >
                    <div>
                      <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary pl-0.5">
                        Consulta de Acesso
                      </span>
                      <h3 className="font-display font-bold text-lg sm:text-2xl md:text-3xl text-white mt-0.5 tracking-tight">
                        Buscar Minha Credencial
                      </h3>
                      <p className="text-white/40 text-xs sm:text-sm mt-1 font-medium">
                        Informe o e-mail cadastrado para obter seu código de acesso e QR Code.
                      </p>
                    </div>

                    <form onSubmit={handleSearchCredential} className="space-y-3 sm:space-y-5">
                      <div className="space-y-1.5">
                        <Label htmlFor="cred-email" className="text-white/60 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest pl-0.5">
                          E-mail Cadastrado
                        </Label>
                        <Input
                          id="cred-email"
                          type="email"
                          placeholder="seu@email.com"
                          value={credentialEmail}
                          onChange={(e) => setCredentialEmail(e.target.value)}
                          className="liquid-input h-10 sm:h-12 text-sm tracking-wide"
                          required
                          disabled={searchingCredential}
                        />
                      </div>

                      {credentialError && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3 sm:p-4 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2.5"
                        >
                          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-300 font-medium leading-relaxed">
                            {credentialError}
                          </p>
                        </motion.div>
                      )}

                      <div className="flex gap-2.5 sm:gap-4 pt-1 sm:pt-2">
                        <Button
                          type="submit"
                          disabled={searchingCredential || !credentialEmail.trim()}
                          className="modern-button h-11 sm:h-12 flex-1 text-xs sm:text-sm touch-press"
                        >
                          {searchingCredential ? 'Buscando...' : 'Verificar Credencial'}
                          {!searchingCredential && <ArrowRight className="w-4 h-4" />}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowCredentialModal(false)}
                          className="h-11 sm:h-12 border-white/10 hover:bg-white/5 text-white font-bold rounded-xl sm:rounded-2xl hover:text-white transition-all text-xs sm:text-sm px-4 sm:px-6 touch-press"
                        >
                          Fechar
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
                    className="text-center space-y-3.5 sm:space-y-6"
                  >
                    <div>
                      <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">
                        Credencial Encontrada
                      </span>
                      <h3 className="font-display font-bold text-lg sm:text-2xl text-white mt-0.5 truncate">
                        Olá, {credentialData.nome}!
                      </h3>
                      <p className="text-white/40 text-xs mt-0.5 font-medium">
                        Aqui está o seu passe de acesso aos eventos.
                      </p>
                    </div>

                    <div className="p-3.5 sm:p-6 bg-white/[0.02] rounded-xl sm:rounded-2xl border border-white/5 flex flex-col items-center space-y-2 sm:space-y-3">
                      <p className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-[0.2em] text-white/30">
                        Código da Credencial
                      </p>
                      <span className="font-display text-xl sm:text-3xl font-black tracking-tight text-white select-all">
                        {credentialData.codigo}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyText(credentialData.codigo)}
                        className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl gap-1.5 text-[9px] sm:text-[10px] font-bold tracking-wider uppercase px-3 h-7 sm:h-8 border border-white/5 mt-0.5 touch-press"
                      >
                        <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Copiar Código
                      </Button>
                    </div>

                    <div id="credential-search-qr-code" className="flex flex-col items-center justify-center p-3 sm:p-6 bg-white rounded-xl sm:rounded-3xl w-36 h-36 sm:w-48 sm:h-48 mx-auto shadow-xl border border-white/10">
                      <QRCodeSVG
                        value={credentialData.codigo}
                        size={qrSize}
                        level="H"
                        fgColor="#000000"
                        bgColor="#ffffff"
                      />
                    </div>

                    <p className="text-[11px] sm:text-xs text-white/40 max-w-xs mx-auto leading-relaxed">
                      Mostre este QR Code ou informe o código acima no credenciamento físico dos eventos.
                    </p>

                    <div className="flex gap-2.5 sm:gap-4 pt-1 sm:pt-2">
                      <Button
                        variant="outline"
                        onClick={() => setCredentialData(null)}
                        className="h-11 sm:h-12 border-white/10 hover:bg-white/5 text-white font-bold rounded-xl sm:rounded-2xl hover:text-white transition-all text-xs flex-1 touch-press"
                      >
                        Consultar Outro
                      </Button>
                      <Button
                        onClick={() => setShowCredentialModal(false)}
                        className="modern-button h-11 sm:h-12 flex-1 text-xs touch-press rounded-xl sm:rounded-2xl"
                      >
                        Concluído
                      </Button>
                    </div>
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
