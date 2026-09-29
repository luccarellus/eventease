import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, extractApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Participante, Evento, InscricaoEvento, AdminUserRecord } from '@/types/index';
import {
  Role,
  Permission,
  ROLE_LABELS,
  ROLE_BADGE_STYLES,
  ALL_ROLES,
} from '@/types/rbac';
import { HasPermission } from '@/components/rbac/HasPermission';
import { HasRole } from '@/components/rbac/HasRole';
import rawSchoolsData from '@/data/cidades_escolas.json';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Search,
  Users,
  UserCheck,
  MoreVertical,
  Filter,
  BarChart3,
  RefreshCcw,
  FileSpreadsheet,
  Plus,
  X,
  Trash2,
  Edit,
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  ChevronLeft,
  Eye,
  EyeOff,
  UserPlus,
  CheckCircle2,
  Shield,
  ShieldCheck,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import Papa from 'papaparse';
import { cn, formatPhone } from '@/lib/utils';
import { generateCredentialCode } from '@/lib/credential-code';
import { executeRecaptcha } from '@/lib/recaptcha';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';

type ParticipantRecord = Participante & {
  createdAt?: string;
  created_at?: string;
};

type RegistrationRecord = InscricaoEvento & {
  participante?: Participante;
  participanteId?: string;
  participante_id?: string;
};

function formatToDatetimeLocal(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function Admin() {
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'eventos' | 'alunos'>('eventos');

  // Evento selecionado para exibição de detalhes/inscritos
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);
  const [inscritosEvento, setInscritosEvento] = useState<InscricaoEvento[]>([]);
  const [loadingInscritos, setLoadingInscritos] = useState(false);

  // Paginação e Contagem de Alunos
  const [currentPage, setCurrentPage] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const itemsPerPage = 10;

  // Filtros e Pesquisas
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'present' | 'absent'>('all');

  // Modais de Eventos & Alunos
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showAddStudentToEventModal, setShowAddStudentToEventModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // States dos formulários
  const [newStudent, setNewStudent] = useState({
    nome: '',
    email: '',
    telefone: '',
    cidade: '',
    escola: '',
    gremio: ''
  });

  const [newEvent, setNewEvent] = useState({
    titulo: '',
    descricao: '',
    data: '',
    local: '',
    cidade: '',
    publicado: false,
    dataInicioInscricao: '',
    dataFimInscricao: ''
  });

  const adminCitiesList = useMemo(() => {
    const cities = new Set<string>();
    (rawSchoolsData as Array<{ city: string; school: string }>).forEach((item) => {
      if (item.city) cities.add(item.city);
    });
    return Array.from(cities).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, []);

  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [searchStudentForEvent, setSearchStudentForEvent] = useState('');

  const navigate = useNavigate();
  const { user, isSuperAdmin, isAdmin, hasPermission } = useAuth();
  const { currentTenant } = useTenant();

  const formatOptionalDate = (value?: string | null, fallback = 'Não Informado') => {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return format(date, 'dd/MM/yyyy HH:mm:ss');
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Obter contagem global de Alunos para os Stats
      const pRes = await api.get('/participants?page=1&limit=1');
      if (pRes.ok) {
        const page = await pRes.json() as { total: number };
        setTotalStudents(page.total);
      }

      // Buscar Eventos
      const evtRes = await api.get('/events/admin/all');
      if (evtRes.ok) {
        const evts = await evtRes.json();
        setEventos(evts || []);
      }
    } catch (error) {
      console.error('Error fetching general stats/events:', error);
      toast.error('Erro ao carregar dados dos eventos.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchParticipantes = useCallback(async (page: number, search: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(itemsPerPage),
        search: search.trim(),
      });
      const res = await api.get(`/participants?${params.toString()}`);
      if (!res.ok) throw new Error('Error fetching participants');
      const result = (await res.json()) as { items: ParticipantRecord[]; total: number };
      const participants = result.items.map((p) => ({
        ...p,
        created_at: p.createdAt || p.created_at,
      }));
      setTotalStudents(result.total);
      setParticipantes(participants);
    } catch (error) {
      console.error('Error fetching participants:', error);
      toast.error('Erro ao carregar lista de participantes.');
    } finally {
      setLoading(false);
    }
  }, [itemsPerPage]);

  useEffect(() => {
    void fetchData();
    if (activeTab === 'alunos') {
      void fetchParticipantes(currentPage, searchTerm);
    }

    const handleSync = () => {
      void fetchData();
      if (activeTab === 'alunos') {
        void fetchParticipantes(currentPage, searchTerm);
      }
    };

    window.addEventListener('sync-data', handleSync);
    window.addEventListener('tenant-changed', handleSync);

    return () => {
      window.removeEventListener('sync-data', handleSync);
      window.removeEventListener('tenant-changed', handleSync);
    };
  }, [fetchData, fetchParticipantes, activeTab, currentPage, searchTerm]);

  // Buscar inscrições do evento selecionado
  const fetchInscritosEvento = async (eventoId: string) => {
    setLoadingInscritos(true);
    try {
      const res = await api.get(`/registrations/event/${eventoId}`);
      if (!res.ok) throw new Error('Failed to fetch event registrations');
      const data = (await res.json()) as RegistrationRecord[];

      const mappedData = data.map((item) => ({
        ...item,
        created_at: item.createdAt || item.created_at,
        participantes: item.participante
      }));
      setInscritosEvento(mappedData as unknown as InscricaoEvento[] || []);
    } catch (error) {
      console.error('Error fetching event subscriptions:', error);
      toast.error('Erro ao carregar inscritos do evento.');
    } finally {
      setLoadingInscritos(false);
    }
  };

  // Efeito para recarregar inscritos quando o evento selecionado mudar
  useEffect(() => {
    if (selectedEvento) {
      void fetchInscritosEvento(selectedEvento.id);
    }
  }, [selectedEvento]);

  // --- Ações de Alunos (Global) ---
  const handleDeleteStudent = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o cadastro de ${nome}? Isso removerá o aluno de todos os eventos.`)) return;

    try {
      const res = await api.delete(`/participants/${id}`);
      if (!res.ok) throw new Error('Falha ao deletar participante');

      toast.success('Participante removido com sucesso.');
      void fetchData();
      void fetchParticipantes(currentPage, searchTerm);
    } catch {
      toast.error('Erro ao remover participante.');
    }
  };

  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = generateCredentialCode();

    try {
      const recaptchaToken = await executeRecaptcha('participant_create');
      const res = await api.post('/participants', {
        ...newStudent,
        codigo: finalCode,
        aceitou_termos: true,
        recaptchaToken,
      });

      if (!res.ok) {
        const detail = await extractApiError(
          res,
          'Falha ao adicionar participante',
        );
        throw new Error(detail);
      }

      toast.success('Participante cadastrado com sucesso!');
      setShowAddStudentModal(false);
      setNewStudent({
        nome: '',
        email: '',
        telefone: '',
        cidade: '',
        escola: '',
        gremio: ''
      });
      void fetchData();
      void fetchParticipantes(currentPage, searchTerm);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao realizar cadastro.';
      toast.error(message, { duration: 8000 });
    }
  };

  // --- Ações de Eventos ---
  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingEvent(true);
    try {
      const payload = {
        titulo: newEvent.titulo,
        descricao: newEvent.descricao,
        data: new Date(newEvent.data).toISOString(),
        local: newEvent.local,
        cidade: newEvent.cidade || null,
        publicado: newEvent.publicado,
        dataInicioInscricao: newEvent.dataInicioInscricao ? new Date(newEvent.dataInicioInscricao).toISOString() : null,
        dataFimInscricao: newEvent.dataFimInscricao ? new Date(newEvent.dataFimInscricao).toISOString() : null,
      };

      if (editingEventId) {
        const res = await api.patch(`/events/${editingEventId}`, payload);
        if (!res.ok) throw new Error('Falha ao atualizar evento');
        toast.success('Evento atualizado com sucesso!');
      } else {
        const res = await api.post('/events', payload);
        if (!res.ok) throw new Error('Falha ao criar evento');
        toast.success('Evento criado com sucesso!');
      }

      setShowCreateEventModal(false);
      setEditingEventId(null);
      setNewEvent({
        titulo: '',
        descricao: '',
        data: '',
        local: '',
        cidade: '',
        publicado: false,
        dataInicioInscricao: '',
        dataFimInscricao: ''
      });
      void fetchData();
    } catch {
      toast.error(editingEventId ? 'Erro ao atualizar evento.' : 'Erro ao criar evento.');
    } finally {
      setSubmittingEvent(false);
    }
  };

  const handleDeleteEvent = async (id: string, titulo: string) => {
    if (!confirm(`Tem certeza que deseja excluir o evento "${titulo}"? Todas as inscrições deste evento serão perdidas.`)) return;

    try {
      const res = await api.delete(`/events/${id}`);
      if (!res.ok) throw new Error('Falha ao deletar evento');

      toast.success('Evento excluído com sucesso.');
      if (selectedEvento?.id === id) {
        setSelectedEvento(null);
      }
      void fetchData();
    } catch {
      toast.error('Erro ao excluir evento.');
    }
  };

  const handleTogglePublish = async (evento: Evento) => {
    try {
      const res = await api.patch(`/events/${evento.id}`, { publicado: !evento.publicado });
      if (!res.ok) throw new Error('Falha ao alternar visibilidade');

      toast.success(evento.publicado ? 'Evento despublicado.' : 'Evento publicado com sucesso!');
      void fetchData();
      if (selectedEvento?.id === evento.id) {
        setSelectedEvento({ ...selectedEvento, publicado: !evento.publicado });
      }
    } catch {
      toast.error('Erro ao alterar status do evento.');
    }
  };

  // --- Ações de Inscrição em Evento ---
  const handleAddStudentToEvent = async (studentId: string) => {
    if (!selectedEvento) return;
    try {
      const recaptchaToken = await executeRecaptcha('registration_create');
      const res = await api.post('/registrations', {
        eventoId: selectedEvento.id,
        participanteId: studentId,
        recaptchaToken,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Falha ao inscrever aluno no evento');
      }

      toast.success('Aluno inscrito no evento com sucesso!');
      void fetchInscritosEvento(selectedEvento.id);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao inscrever aluno';
      toast.error(msg);
    }
  };

  const handleRemoveRegistration = async (registrationId: string) => {
    if (!confirm('Deseja remover esta inscrição do evento?')) return;
    try {
      const res = await api.delete(`/registrations/${registrationId}`);
      if (!res.ok) throw new Error('Falha ao remover inscrição');

      toast.success('Inscrição removida.');
      if (selectedEvento) {
        void fetchInscritosEvento(selectedEvento.id);
      }
    } catch {
      toast.error('Erro ao remover inscrição.');
    }
  };



  // --- Estatísticas ---
  const statsGlobal = useMemo(() => {
    const totalEventos = eventos.length;
    const eventosPublicados = eventos.filter(e => e.publicado).length;
    return {
      totalAlunos: totalStudents,
      totalEventos,
      eventosPublicados
    };
  }, [eventos, totalStudents]);

  const statsEvento = useMemo(() => {
    if (!selectedEvento) return { total: 0, presentes: 0, ausentes: 0, taxaPresenca: 0 };
    const total = inscritosEvento.length;
    const presentes = inscritosEvento.filter((i: InscricaoEvento) => i.presente).length;
    const ausentes = total - presentes;
    const taxaPresenca = total > 0 ? Math.round((presentes / total) * 100) : 0;
    return { total, presentes, ausentes, taxaPresenca };
  }, [selectedEvento, inscritosEvento]);

  // Filtrar inscritos no evento com base na busca e filtro de presença
  const filteredInscritos = useMemo(() => {
    return inscritosEvento.filter((i: InscricaoEvento) => {
      const p = i.participantes;
      const matchesSearch = !searchTerm || (
        (p?.nome && p.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p?.codigo && p.codigo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p?.email && p.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p?.cidade && p.cidade.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p?.escola && p.escola.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      const matchesFilter =
        filter === 'all' ||
        (filter === 'present' && i.presente) ||
        (filter === 'absent' && !i.presente);

      return matchesSearch && matchesFilter;
    });
  }, [inscritosEvento, searchTerm, filter]);

  // Filtrar alunos que NÃO estão inscritos no evento selecionado
  const studentsNotSubscribed = useMemo(() => {
    if (!selectedEvento) return [];
    const subscribedIds = new Set(inscritosEvento.map((i: InscricaoEvento) => i.participanteId ?? i.participante_id));
    return participantes.filter((p: Participante) => {
      const isNotSubscribed = !subscribedIds.has(p.id);
      const matchesSearch =
        p.nome.toLowerCase().includes(searchStudentForEvent.toLowerCase()) ||
        p.codigo.toLowerCase().includes(searchStudentForEvent.toLowerCase());
      return isNotSubscribed && matchesSearch;
    });
  }, [participantes, inscritosEvento, selectedEvento, searchStudentForEvent]);

  // --- Exportação CSV ---
  const exportEventCSV = (type: 'all' | 'present' = 'all') => {
    if (!selectedEvento) return;
    const filteredList = type === 'all'
      ? inscritosEvento
      : inscritosEvento.filter((p: InscricaoEvento) => p.presente);

    const dataToExport = filteredList.map((i: InscricaoEvento) => {
      const p = i.participantes;
      return {
        Nome: p?.nome || '',
        Email: p?.email || '',
        Telefone: p?.telefone || '',
        Cidade: p?.cidade || '',
        Escola: p?.escola || '',
        Grêmio: p?.gremio || 'N/A',
        Código: p?.codigo || '',
        Status: i.presente ? 'Confirmado' : 'Inscrito',
        'Confirmou Presença': i.presente ? 'Sim' : 'Não',
        'Data de Confirmação': formatOptionalDate(i.confirmado_em, 'Não Confirmado'),
        'Data de Inscrição': formatOptionalDate(i.createdAt || i.created_at)
      };
    });

    const csv = Papa.unparse(dataToExport, { delimiter: ';' });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const fileName = type === 'all' ? 'inscritos' : 'confirmados';
    link.setAttribute('download', `relatorio_${fileName}_${selectedEvento.titulo.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Relatório gerado com sucesso!`);
  };

  const exportAllStudentsCSV = () => {
    if (participantes.length === 0) {
      toast.error('Nenhum aluno cadastrado para exportar.');
      return;
    }

    const dataToExport = participantes.map((p: Participante) => ({
      Nome: p.nome,
      Email: p.email,
      Telefone: p.telefone,
      Cidade: p.cidade,
      Escola: p.escola,
      Grêmio: p.gremio || 'N/A',
      Código: p.codigo,
      'Data de Cadastro': formatOptionalDate(p.createdAt || p.created_at)
    }));

    const csv = Papa.unparse(dataToExport, { delimiter: ';' });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `base_geral_alunos_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Planilha exportada com sucesso!');
  };

  const chartData = [
    { name: 'Presentes', value: statsEvento.presentes },
    { name: 'Ausentes', value: statsEvento.ausentes },
  ];

  if (loading && eventos.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-neutral-500 font-medium tracking-tight">Carregando painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-12">
      {/* Header Admin */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 md:mb-10 px-2 md:px-0">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-primary text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Painel Administrativo • {currentTenant?.name || 'Organização'}</span>
          </div>
          <h1 className="heading-display text-3xl md:text-4xl mb-1.5 text-white leading-tight">
            Gestão <span className="text-primary">EventEase</span>
          </h1>
          <p className="text-white/40 text-sm md:text-base font-medium">
            Gerencie eventos, participantes, equipe e acessos em um só lugar.

          </p>
        </motion.div>
      </div>

      {/* Tabs Principais ou Detalhe do Evento */}
      {!selectedEvento ? (
        <>
          {/* Stats Globais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-6">
            <StatCard
              title="Total de Alunos"
              value={statsGlobal.totalAlunos}
              icon={<Users className="w-5 h-5 text-primary" />}
              description="Cadastrados na organização"
            />
            <StatCard
              title="Total de Eventos"
              value={statsGlobal.totalEventos}
              icon={<Calendar className="w-5 h-5 text-primary" />}
              description="Nesta organização"
            />
            <StatCard
              title="Eventos Ativos"
              value={statsGlobal.eventosPublicados}
              icon={<Sparkles className="w-5 h-5 text-primary" />}
              description="Publicados para inscrição"
            />
          </div>

          {/* Seletor de Abas */}
          <div className="flex border-b border-white/10 pb-1 gap-1 sm:gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => { setActiveTab('eventos'); setSearchTerm(''); }}
              className={cn(
                "px-4 sm:px-6 py-2.5 sm:py-3 font-bold text-[11px] sm:text-xs uppercase tracking-widest border-b-2 transition-all whitespace-nowrap touch-press",
                activeTab === 'eventos'
                  ? "border-primary text-white"
                  : "border-transparent text-white/40 hover:text-white/60"
              )}
            >
              Eventos
            </button>
            <button
              onClick={() => { setActiveTab('alunos'); setSearchTerm(''); }}
              className={cn(
                "px-4 sm:px-6 py-2.5 sm:py-3 font-bold text-[11px] sm:text-xs uppercase tracking-widest border-b-2 transition-all whitespace-nowrap touch-press",
                activeTab === 'alunos'
                  ? "border-primary text-white"
                  : "border-transparent text-white/40 hover:text-white/60"
              )}
            >
              Base de Alunos
            </button>
          </div>

          {/* CONTEÚDO DAS ABAS */}
          <AnimatePresence mode="wait">
            {/* ABA 1: EVENTOS */}
            {activeTab === 'eventos' && (
              <motion.div
                key="tab-eventos"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 px-1 sm:px-0">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Eventos Cadastrados</h2>
                    <p className="text-white/40 text-xs mt-0.5">Planeje e acompanhe os eventos desta organização.</p>
                  </div>
                  <HasPermission permission={Permission.EVENTS_CREATE}>
                    <Button
                      onClick={() => {
                        setEditingEventId(null);
                        setNewEvent({
                          titulo: '',
                          descricao: '',
                          data: '',
                          local: '',
                          cidade: '',
                          publicado: false,
                          dataInicioInscricao: '',
                          dataFimInscricao: ''
                        });
                        setShowCreateEventModal(true);
                      }}
                      className="bg-primary hover:bg-primary-dark text-white font-bold h-11 px-5 rounded-2xl shadow-lg shadow-primary/20 text-xs uppercase tracking-widest transition-all touch-press shrink-0 flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Novo Evento
                    </Button>
                  </HasPermission>
                </div>

                {eventos.length === 0 ? (
                  <Card className="glass-card border-white/5 py-12 text-center">
                    <CardContent className="space-y-3">
                      <Calendar className="w-12 h-12 text-white/20 mx-auto" />
                      <p className="text-white/60 font-medium text-sm">Nenhum evento cadastrado para esta organização.</p>
                      <HasPermission permission={Permission.EVENTS_CREATE}>
                        <Button
                          onClick={() => setShowCreateEventModal(true)}
                          variant="outline"
                          size="sm"
                          className="border-white/10 text-white font-bold"
                        >
                          Criar Primeiro Evento
                        </Button>
                      </HasPermission>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {eventos.map((evento) => (
                      <Card
                        key={evento.id}
                        className={cn(
                          "glass-card border-white/5 hover:border-white/15 transition-all overflow-hidden flex flex-col justify-between group",
                          evento.publicado ? "bg-white/[0.02]" : "bg-white/[0.01] opacity-75"
                        )}
                      >
                        <CardHeader className="p-5 pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <span
                              className={cn(
                                "px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border",
                                evento.publicado
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              )}
                            >
                              {evento.publicado ? 'Publicado' : 'Rascunho / Inativo'}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger className="h-8 w-8 text-white/40 hover:text-white rounded-lg flex items-center justify-center cursor-pointer outline-none hover:bg-white/10 transition-colors">
                                <MoreVertical className="w-4 h-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-[#0a111e] border-white/10 text-white">
                                <HasPermission permission={Permission.EVENTS_UPDATE}>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingEventId(evento.id);
                                      setNewEvent({
                                        titulo: evento.titulo,
                                        descricao: evento.descricao || '',
                                        data: formatToDatetimeLocal(evento.data),
                                        local: evento.local,
                                        cidade: evento.cidade || '',
                                        publicado: evento.publicado,
                                        dataInicioInscricao: formatToDatetimeLocal(evento.dataInicioInscricao || evento.data_inicio_inscricao),
                                        dataFimInscricao: formatToDatetimeLocal(evento.dataFimInscricao || evento.data_fim_inscricao)
                                      });
                                      setShowCreateEventModal(true);
                                    }}
                                    className="cursor-pointer gap-2 text-xs"
                                  >
                                    <Edit className="w-3.5 h-3.5" /> Editar
                                  </DropdownMenuItem>
                                </HasPermission>

                                <HasPermission permission={Permission.EVENTS_PUBLISH}>
                                  <DropdownMenuItem
                                    onClick={() => handleTogglePublish(evento)}
                                    className="cursor-pointer gap-2 text-xs"
                                  >
                                    {evento.publicado ? (
                                      <>
                                        <EyeOff className="w-3.5 h-3.5 text-amber-400" /> Despublicar
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="w-3.5 h-3.5 text-emerald-400" /> Publicar
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </HasPermission>

                                <HasPermission permission={Permission.EVENTS_DELETE}>
                                  <DropdownMenuSeparator className="bg-white/10" />
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteEvent(evento.id, evento.titulo)}
                                    className="cursor-pointer gap-2 text-xs text-red-400 focus:text-red-400 focus:bg-red-500/10"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Excluir Evento
                                  </DropdownMenuItem>
                                </HasPermission>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <CardTitle className="text-base font-bold text-white mt-2 group-hover:text-primary transition-colors">
                            {evento.titulo}
                          </CardTitle>
                          {evento.descricao && (
                            <CardDescription className="text-xs text-white/50 line-clamp-2 mt-1">
                              {evento.descricao}
                            </CardDescription>
                          )}
                        </CardHeader>

                        <CardContent className="p-5 pt-0 space-y-2">
                          <div className="flex items-center gap-2 text-xs text-white/60">
                            <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>{format(new Date(evento.data), 'dd/MM/yyyy HH:mm')}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-white/60">
                            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="truncate">{evento.local} {evento.cidade ? `(${evento.cidade})` : ''}</span>
                          </div>
                        </CardContent>

                        <div className="p-5 pt-2 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                          <Button
                            onClick={() => {
                              setSelectedEvento(evento);
                              setSearchTerm('');
                              setFilter('all');
                            }}
                            className="w-full bg-primary/20 hover:bg-primary text-primary hover:text-white font-bold h-9 rounded-xl text-xs transition-all touch-press cursor-pointer"
                          >
                            Ver Inscritos & Check-in
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ABA 2: BASE GERAL DE ALUNOS */}
            {activeTab === 'alunos' && (
              <motion.div
                key="tab-alunos"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Participantes Registrados</h2>
                    <p className="text-white/40 text-xs mt-0.5">Base cadastral de participantes da organização.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <HasPermission permission={Permission.PARTICIPANTS_EXPORT}>
                      <Button
                        variant="outline"
                        onClick={exportAllStudentsCSV}
                        className="border-white/10 hover:bg-white/5 text-white/80 font-bold h-11 px-4 rounded-2xl text-xs uppercase tracking-widest transition-all touch-press flex items-center gap-2"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span className="hidden sm:inline">Exportar CSV</span>
                      </Button>
                    </HasPermission>

                    <HasPermission permission={Permission.PARTICIPANTS_CREATE}>
                      <Button
                        onClick={() => setShowAddStudentModal(true)}
                        className="bg-primary hover:bg-primary-dark text-white font-bold h-11 px-5 rounded-2xl shadow-lg shadow-primary/20 text-xs uppercase tracking-widest transition-all touch-press flex items-center gap-2"
                      >
                        <UserPlus className="w-4 h-4" />
                        Cadastrar Aluno
                      </Button>
                    </HasPermission>
                  </div>
                </div>

                {/* Filtro de Busca */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    placeholder="Pesquisar por nome, email ou código de credencial..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="liquid-input pl-11 h-12 rounded-2xl bg-white/[0.02] border-white/10 text-white placeholder:text-white/30 text-sm"
                  />
                </div>

                {/* Tabela de Participantes */}
                <Card className="glass-card border-white/5 overflow-hidden rounded-2xl sm:rounded-3xl">
                  <div className="overflow-x-auto custom-scrollbar">
                    <Table>
                      <TableHeader className="bg-white/[0.02]">
                        <TableRow className="border-white/5">
                          <TableHead className="text-white/40 font-bold text-[10px] uppercase tracking-wider">Código</TableHead>
                          <TableHead className="text-white/40 font-bold text-[10px] uppercase tracking-wider">Nome</TableHead>
                          <TableHead className="text-white/40 font-bold text-[10px] uppercase tracking-wider">Contato</TableHead>
                          <TableHead className="text-white/40 font-bold text-[10px] uppercase tracking-wider">Escola / Cidade</TableHead>
                          <TableHead className="text-white/40 font-bold text-[10px] uppercase tracking-wider">Grêmio</TableHead>
                          <TableHead className="text-white/40 font-bold text-[10px] uppercase tracking-wider text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {participantes.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-12 text-white/30 text-sm">
                              Nenhum aluno encontrado.
                            </TableCell>
                          </TableRow>
                        ) : (
                          participantes.map((aluno) => (
                            <TableRow key={aluno.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                              <TableCell className="font-mono text-xs text-primary font-bold">{aluno.codigo}</TableCell>
                              <TableCell className="font-bold text-white text-xs">{aluno.nome}</TableCell>
                              <TableCell className="text-xs text-white/60">
                                <div>{aluno.email}</div>
                                <div className="text-[10px] text-white/40">{aluno.telefone}</div>
                              </TableCell>
                              <TableCell className="text-xs text-white/60">
                                <div>{aluno.escola}</div>
                                <div className="text-[10px] text-white/40">{aluno.cidade}</div>
                              </TableCell>
                              <TableCell className="text-xs text-white/40">{aluno.gremio || '-'}</TableCell>
                              <TableCell className="text-right">
                                <HasPermission permission={Permission.PARTICIPANTS_DELETE}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteStudent(aluno.id, aluno.nome)}
                                    className="h-8 w-8 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </HasPermission>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </motion.div>
            )}



          </AnimatePresence>
        </>
      ) : (
        /* DETALHE DO EVENTO SELECIONADO */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedEvento(null)}
                className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <span className="text-primary font-bold text-[10px] uppercase tracking-widest">Painel do Evento</span>
                <h2 className="text-xl sm:text-2xl font-bold text-white">{selectedEvento.titulo}</h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <HasPermission permission={Permission.PARTICIPANTS_EXPORT}>
                <Button
                  onClick={() => exportEventCSV('all')}
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-white/80 font-bold h-10 px-4 rounded-xl text-xs flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Exportar CSV
                </Button>
              </HasPermission>
              <HasPermission permission={Permission.REGISTRATIONS_CREATE}>
                <Button
                  onClick={() => setShowAddStudentToEventModal(true)}
                  className="bg-primary hover:bg-primary-dark text-white font-bold h-10 px-4 rounded-xl text-xs flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Inscrever Aluno
                </Button>
              </HasPermission>
            </div>
          </div>

          {/* Stats do Evento */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Inscritos</p>
              <p className="text-2xl font-bold text-white mt-1">{statsEvento.total}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <p className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">Presentes</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{statsEvento.presentes}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <p className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">Ausentes</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{statsEvento.ausentes}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <p className="text-[10px] text-primary uppercase font-bold tracking-wider">Taxa de Presença</p>
              <p className="text-2xl font-bold text-primary mt-1">{statsEvento.taxaPresenca}%</p>
            </div>
          </div>

          {/* Tabela de Inscritos do Evento */}
          <Card className="glass-card border-white/5 overflow-hidden rounded-2xl sm:rounded-3xl">
            <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  placeholder="Buscar inscritos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="liquid-input pl-10 h-10 rounded-xl bg-white/[0.02] border-white/10 text-white text-xs"
                />
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <Button
                  size="sm"
                  variant={filter === 'all' ? 'default' : 'ghost'}
                  onClick={() => setFilter('all')}
                  className={cn("h-8 rounded-lg text-xs font-bold", filter === 'all' ? "bg-white/10 text-white" : "text-white/40")}
                >
                  Todos ({statsEvento.total})
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'present' ? 'default' : 'ghost'}
                  onClick={() => setFilter('present')}
                  className={cn("h-8 rounded-lg text-xs font-bold", filter === 'present' ? "bg-emerald-500/20 text-emerald-300" : "text-white/40")}
                >
                  Presentes ({statsEvento.presentes})
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'absent' ? 'default' : 'ghost'}
                  onClick={() => setFilter('absent')}
                  className={cn("h-8 rounded-lg text-xs font-bold", filter === 'absent' ? "bg-amber-500/20 text-amber-300" : "text-white/40")}
                >
                  Ausentes ({statsEvento.ausentes})
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-white/[0.02]">
                  <TableRow className="border-white/5">
                    <TableHead className="text-white/40 font-bold text-[10px] uppercase">Código</TableHead>
                    <TableHead className="text-white/40 font-bold text-[10px] uppercase">Aluno</TableHead>
                    <TableHead className="text-white/40 font-bold text-[10px] uppercase">Contato</TableHead>
                    <TableHead className="text-white/40 font-bold text-[10px] uppercase">Status</TableHead>
                    <TableHead className="text-white/40 font-bold text-[10px] uppercase">Data Check-in</TableHead>
                    <TableHead className="text-white/40 font-bold text-[10px] uppercase text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInscritos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-white/30 text-xs">
                        Nenhum participante encontrado neste filtro.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInscritos.map((inscricao: InscricaoEvento) => {
                      const aluno = inscricao.participantes;
                      return (
                        <TableRow key={inscricao.id} className="border-white/5 hover:bg-white/[0.02]">
                          <TableCell className="font-mono text-xs text-primary font-bold">{aluno?.codigo}</TableCell>
                          <TableCell>
                            <div className="font-bold text-white text-xs">{aluno?.nome}</div>
                            <div className="text-[10px] text-white/40">{aluno?.escola}</div>
                          </TableCell>
                          <TableCell className="text-xs text-white/60">
                            <div>{aluno?.email}</div>
                            <div className="text-[10px] text-white/40">{aluno?.telefone}</div>
                          </TableCell>
                          <TableCell>
                            {inscricao.presente ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" /> Presente
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Clock className="w-3 h-3" /> Inscrito
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-white/40">
                            {formatOptionalDate(inscricao.confirmado_em, 'Não Confirmado')}
                          </TableCell>
                          <TableCell className="text-right">
                            <HasPermission permission={Permission.REGISTRATIONS_DELETE}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveRegistration(inscricao.id)}
                                className="h-8 w-8 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </HasPermission>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </motion.div>
      )}

      {/* --- MODAIS DO SISTEMA --- */}

      {/* Modal: Cadastro Manual de Aluno */}
      <AnimatePresence>
        {showAddStudentModal && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 pt-6 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 40 }}
              className="w-full max-w-2xl bg-[#0a111e] border border-white/10 rounded-t-[2rem] md:rounded-[2.5rem] mt-auto md:mt-0 overflow-hidden shadow-3xl max-h-[92dvh] overflow-y-auto custom-scrollbar"
            >
              <div className="p-5 sm:p-7 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Cadastrar Participante</h3>
                  <p className="text-white/40 text-xs mt-0.5">Adiciona o participante na base permanente da organização.</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowAddStudentModal(false)} className="rounded-full text-white/40 hover:text-white">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <form onSubmit={handleAddStudentSubmit} className="p-5 sm:p-7 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Nome Completo</label>
                    <Input
                      required
                      className="liquid-input h-11 text-sm"
                      value={newStudent.nome}
                      onChange={(e) => setNewStudent({ ...newStudent, nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">E-mail</label>
                    <Input
                      type="email"
                      required
                      className="liquid-input h-11 text-sm"
                      value={newStudent.email}
                      onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Telefone</label>
                    <Input
                      required
                      type="tel"
                      placeholder="(99) 99999-9999"
                      className="liquid-input h-11 text-sm"
                      value={newStudent.telefone}
                      onChange={(e) => setNewStudent({ ...newStudent, telefone: formatPhone(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Cidade</label>
                    <Input
                      required
                      className="liquid-input h-11 text-sm"
                      value={newStudent.cidade}
                      onChange={(e) => setNewStudent({ ...newStudent, cidade: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Escola / Instituição</label>
                    <Input
                      required
                      className="liquid-input h-11 text-sm"
                      value={newStudent.escola}
                      onChange={(e) => setNewStudent({ ...newStudent, escola: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Grêmio (Opcional)</label>
                    <Input
                      className="liquid-input h-11 text-sm"
                      value={newStudent.gremio}
                      onChange={(e) => setNewStudent({ ...newStudent, gremio: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/5">
                  <Button type="button" variant="outline" onClick={() => setShowAddStudentModal(false)} className="flex-1 h-11 rounded-xl border-white/10 text-white font-bold">
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold">
                    Cadastrar
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Criar/Editar Evento */}
      <AnimatePresence>
        {showCreateEventModal && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 pt-6 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 40 }}
              className="w-full max-w-xl bg-[#0a111e] border border-white/10 rounded-t-[2rem] md:rounded-[2.5rem] mt-auto md:mt-0 overflow-hidden shadow-3xl max-h-[92dvh] overflow-y-auto custom-scrollbar"
            >
              <div className="p-5 sm:p-7 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">{editingEventId ? 'Editar Evento' : 'Novo Evento'}</h3>
                  <p className="text-white/40 text-xs mt-0.5">Preencha as informações do evento para esta organização.</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowCreateEventModal(false)} className="rounded-full text-white/40 hover:text-white">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <form onSubmit={handleCreateEventSubmit} className="p-5 sm:p-7 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Título do Evento</label>
                  <Input
                    required
                    className="liquid-input h-11 text-sm"
                    value={newEvent.titulo}
                    onChange={(e) => setNewEvent({ ...newEvent, titulo: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Descrição</label>
                  <Input
                    className="liquid-input h-11 text-sm"
                    value={newEvent.descricao}
                    onChange={(e) => setNewEvent({ ...newEvent, descricao: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Data e Horário</label>
                    <Input
                      type="datetime-local"
                      required
                      className="liquid-input h-11 text-sm"
                      value={newEvent.data}
                      onChange={(e) => setNewEvent({ ...newEvent, data: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Local</label>
                    <Input
                      required
                      className="liquid-input h-11 text-sm"
                      value={newEvent.local}
                      onChange={(e) => setNewEvent({ ...newEvent, local: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Início das Inscrições</label>
                    <Input
                      type="datetime-local"
                      className="liquid-input h-11 text-sm"
                      value={newEvent.dataInicioInscricao}
                      onChange={(e) => setNewEvent({ ...newEvent, dataInicioInscricao: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Fim das Inscrições</label>
                    <Input
                      type="datetime-local"
                      className="liquid-input h-11 text-sm"
                      value={newEvent.dataFimInscricao}
                      onChange={(e) => setNewEvent({ ...newEvent, dataFimInscricao: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="publicado"
                    checked={newEvent.publicado}
                    onChange={(e) => setNewEvent({ ...newEvent, publicado: e.target.checked })}
                    className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary"
                  />
                  <label htmlFor="publicado" className="text-xs text-white/80 font-bold cursor-pointer">
                    Publicar este evento no site (abrir inscrições públicas)
                  </label>
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/5">
                  <Button type="button" variant="outline" onClick={() => setShowCreateEventModal(false)} className="flex-1 h-11 rounded-xl border-white/10 text-white font-bold">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submittingEvent} className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold">
                    {submittingEvent ? <LoadingSpinner size="sm" /> : editingEventId ? 'Salvar Alterações' : 'Criar Evento'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Inscrever Aluno no Evento */}
      <AnimatePresence>
        {showAddStudentToEventModal && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 pt-6 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 40 }}
              className="w-full max-w-xl bg-[#0a111e] border border-white/10 rounded-t-[2rem] md:rounded-[2.5rem] mt-auto md:mt-0 overflow-hidden shadow-3xl flex flex-col max-h-[92dvh] custom-scrollbar"
            >
              <div className="p-5 sm:p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-white">Inscrever Aluno no Evento</h3>
                  <p className="text-white/40 text-xs mt-0.5">Selecione participantes cadastrados nesta organização.</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowAddStudentToEventModal(false)} className="rounded-full text-white/40 hover:text-white">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-4 border-b border-white/5">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    placeholder="Buscar participante por nome ou código..."
                    className="liquid-input h-10 w-full pl-10 text-xs"
                    value={searchStudentForEvent}
                    onChange={(e) => setSearchStudentForEvent(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[300px] custom-scrollbar">
                {studentsNotSubscribed.length === 0 ? (
                  <div className="text-center py-8 text-white/30 text-xs">
                    {searchStudentForEvent ? 'Nenhum aluno correspondente.' : 'Todos os alunos da organização já estão inscritos.'}
                  </div>
                ) : (
                  studentsNotSubscribed.map((student: Participante) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="font-bold text-white truncate text-xs">{student.nome}</p>
                        <p className="text-[10px] text-white/40 truncate">{student.codigo} • {student.escola} • {student.cidade}</p>
                      </div>
                      <Button
                        onClick={() => handleAddStudentToEvent(student.id)}
                        className="rounded-lg bg-primary hover:bg-primary/90 text-white font-bold h-8 px-3 text-xs shrink-0"
                      >
                        Inscrever
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-white/5 flex justify-end">
                <Button
                  onClick={() => setShowAddStudentToEventModal(false)}
                  variant="outline"
                  className="rounded-xl border-white/10 text-white text-xs h-9 px-5 font-bold"
                >
                  Fechar
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  description
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      className="h-full"
    >
      <Card className="glass-card border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.08] transition-all bg-white/[0.02] h-full flex flex-col justify-between">
        <CardHeader className="flex flex-row items-center justify-between p-5 pb-2">
          <CardTitle className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30 leading-none">
            {title}
          </CardTitle>
          <div className="p-2 bg-white/5 rounded-xl border border-white/10">
            {icon}
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0 mt-3">
          <div className="text-3xl font-display font-bold text-white tracking-tighter mb-0.5">{value}</div>
          <p className="text-[10px] text-white/30 font-medium italic">{description}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
