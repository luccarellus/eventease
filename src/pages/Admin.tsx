import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Participante, Evento, InscricaoEvento } from '@/types/index';
import rawSchoolsData from '@/data/cidades_escolas.json';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
  Download,
  Search,
  Users,
  UserCheck,
  UserMinus,
  MoreVertical,
  Filter,
  BarChart3,
  RefreshCcw,
  LogOut,
  TrendingUp,
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
  XCircle
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
import { ptBR } from 'date-fns/locale';

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

  // Modais de Criação
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
  const { signOut } = useAuth();

  const formatOptionalDate = (value?: string | null, fallback = 'Não Informado') => {
    if (!value) {
      return fallback;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return fallback;
    }

    return format(date, 'dd/MM/yyyy HH:mm:ss');
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Obter contagem global leve de Alunos para os Stats
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
  };

  const fetchParticipantes = async (page: number, search: string) => {
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
  };

  // Buscar inscrições do evento selecionado
  const fetchInscritosEvento = async (eventoId: string) => {
    setLoadingInscritos(true);
    try {
      const res = await api.get(`/registrations/event/${eventoId}`);
      if (!res.ok) throw new Error('Failed to fetch event registrations');
      const data = (await res.json()) as RegistrationRecord[];

      // Mapear os dados para o formato esperado pelo frontend
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

  useEffect(() => {
    fetchData();

    const handleSync = () => {
      fetchData();
      if (activeTab === 'alunos') {
        fetchParticipantes(currentPage, searchTerm);
      }
    };
    window.addEventListener('sync-data', handleSync);

    return () => {
      window.removeEventListener('sync-data', handleSync);
    };
  }, []);

  // Efeito para recarregar alunos quando a aba, página ou busca mudar
  useEffect(() => {
    if (activeTab === 'alunos') {
      fetchParticipantes(currentPage, searchTerm);
    }
  }, [activeTab, currentPage, searchTerm]);

  // Efeito para recarregar inscritos quando o evento selecionado mudar
  useEffect(() => {
    if (selectedEvento) {
      fetchInscritosEvento(selectedEvento.id);
    }
  }, [selectedEvento, participantes]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // --- Ações de Alunos (Global) ---
  const handleDeleteStudent = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o cadastro de ${nome}? Isso removerá o aluno de todos os eventos.`)) return;

    try {
      const res = await api.delete(`/participants/${id}`);
      if (!res.ok) throw new Error('Falha ao deletar participante');

      toast.success('Participante removido com sucesso.');
      fetchData();
    } catch (error) {
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

      if (!res.ok) throw new Error('Falha ao adicionar participante');

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
      fetchData();
    } catch (error) {
      toast.error('Erro ao realizar cadastro.');
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
      fetchData();
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error('Erro ao salvar evento.');
    } finally {
      setSubmittingEvent(false);
    }
  };

  const handleDeleteEvent = async (id: string, titulo: string) => {
    if (!confirm(`Tem certeza que deseja excluir o evento "${titulo}"? Todas as inscrições associadas serão perdidas.`)) return;
    try {
      const res = await api.delete(`/events/${id}`);
      if (!res.ok) throw new Error('Falha ao excluir evento');

      toast.success('Evento excluído com sucesso.');
      if (selectedEvento?.id === id) {
        setSelectedEvento(null);
      }
      fetchData();
    } catch (err) {
      toast.error('Erro ao excluir evento.');
    }
  };

  const handleTogglePublish = async (event: Evento) => {
    try {
      const newStatus = !event.publicado;
      const res = await api.patch(`/events/${event.id}`, { publicado: newStatus });
      if (!res.ok) throw new Error('Falha ao alterar status');

      toast.success(
        newStatus
          ? 'Evento marcado como ATIVO (recebendo inscrições).'
          : 'Evento marcado como INATIVO (inscrições encerradas).'
      );
      fetchData();
      if (selectedEvento?.id === event.id) {
        setSelectedEvento({ ...selectedEvento, publicado: newStatus });
      }
    } catch (err) {
      toast.error('Erro ao alterar status do evento.');
    }
  };

  // --- Ações de Inscrições/Presença em Evento Específico ---
  const handleTogglePresence = async (inscricao: InscricaoEvento) => {
    const newPresence = !inscricao.presente;
    try {
      const res = await api.patch(`/registrations/${inscricao.id}`, {
        presente: newPresence,
        confirmado_em: newPresence ? new Date().toISOString() : null
      });

      if (!res.ok) throw new Error('Falha ao atualizar presença');
      toast.success(`Check-in ${newPresence ? 'confirmado' : 'cancelado'}!`);
      if (selectedEvento) {
        fetchInscritosEvento(selectedEvento.id);
      }
    } catch (err) {
      toast.error('Erro ao atualizar presença.');
    }
  };

  const handleRemoveFromEvent = async (inscricaoId: string) => {
    if (!confirm('Deseja remover este aluno do evento? A inscrição dele será cancelada.')) return;
    try {
      const res = await api.delete(`/registrations/${inscricaoId}`);
      if (!res.ok) throw new Error('Falha ao remover aluno do evento');

      toast.success('Aluno removido do evento com sucesso.');
      if (selectedEvento) {
        fetchInscritosEvento(selectedEvento.id);
      }
    } catch (err) {
      toast.error('Erro ao remover aluno do evento.');
    }
  };

  const handleAddStudentToEvent = async (participanteId: string) => {
    if (!selectedEvento) return;
    try {
      const recaptchaToken = await executeRecaptcha('registration_create');
      const res = await api.post('/registrations', {
        eventoId: selectedEvento.id,
        participanteId: participanteId,
        recaptchaToken,
      });

      if (!res.ok) {
        const errorData = await res.json();
        if (errorData.message?.includes('Unique constraint failed') || errorData.message?.includes('já existe')) {
          toast.info('Aluno já inscrito neste evento.');
          return;
        }
        throw new Error('Falha ao inscrever aluno');
      }

      toast.success('Aluno inscrito com sucesso!');
      fetchInscritosEvento(selectedEvento.id);
      setShowAddStudentToEventModal(false);
    } catch (err) {
      toast.error('Erro ao inscrever aluno no evento.');
    }
  };

  // --- Estatísticas ---
  const statsGlobal = useMemo(() => {
    const totalAlunos = totalStudents;
    const totalEventos = eventos.length;
    const eventosPublicados = eventos.filter((e: Evento) => e.publicado).length;
    return { totalAlunos, totalEventos, eventosPublicados };
  }, [totalStudents, eventos]);

  const statsEvento = useMemo(() => {
    if (!selectedEvento) return { total: 0, presentes: 0, ausentes: 0, porcentagem: 0 };
    const total = inscritosEvento.length;
    const presentes = inscritosEvento.filter((p: InscricaoEvento) => p.presente).length;
    const ausentes = total - presentes;
    const porcentagem = total > 0 ? (presentes / total) * 100 : 0;
    return { total, presentes, ausentes, porcentagem };
  }, [inscritosEvento, selectedEvento]);

  // --- Filtros e Pesquisas ---
  const filteredAlunos = participantes;

  const filteredInscritos = useMemo(() => {
    return inscritosEvento.filter((i: InscricaoEvento) => {
      const p = i.participantes;
      if (!p) return false;

      const matchesSearch =
        p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.codigo.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter =
        filter === 'all' ||
        (filter === 'present' && i.presente) ||
        (filter === 'absent' && !i.presente);

      return matchesSearch && matchesFilter;
    });
  }, [inscritosEvento, searchTerm, filter]);

  // Filtrar alunos que NÃO estão inscritos no evento selecionado (para adicionar)
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
    // Adiciona o BOM do UTF-8 para o Excel reconhecer os caracteres especiais (acentos)
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
    toast.success(`Relatório de ${type === 'all' ? 'todos os inscritos' : 'alunos confirmados'} gerado com sucesso!`);
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
    // Adiciona o BOM do UTF-8 para o Excel reconhecer os caracteres especiais (acentos)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `base_geral_alunos_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Planilha da Base Geral de Alunos exportada com sucesso!');
  };

  const chartData = [
    { name: 'Presentes', value: statsEvento.presentes },
    { name: 'Ausentes', value: statsEvento.ausentes },
  ];

  const handleChartFilter = (index: number) => {
    setFilter(index === 0 ? 'present' : 'absent');
  };

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-8 md:mb-12 px-2 md:px-0">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-primary text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-4">
            Controle Administrativo
          </div>
          <h1 className="heading-display text-3xl md:text-4xl mb-2 text-white leading-tight">
            Painel do <span className="text-primary">Staff</span>
          </h1>
          <p className="text-white/40 text-base md:text-lg font-medium">Gerenciamento integrado de múltiplos eventos, inscrições e cadastro de alunos.</p>
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
              description="Cadastrados no sistema"
            />
            <StatCard
              title="Total de Eventos"
              value={statsGlobal.totalEventos}
              icon={<Calendar className="w-5 h-5 text-primary" />}
              description="Gerenciados"
            />
            <StatCard
              title="Eventos Ativos"
              value={statsGlobal.eventosPublicados}
              icon={<Sparkles className="w-5 h-5 text-primary" />}
              description="Publicados para os alunos"
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
              Base Geral de Alunos
            </button>
          </div>

          {/* CONTEÚDO DAS ABAS */}
          <AnimatePresence mode="wait">
            {activeTab === 'eventos' ? (
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
                    <p className="text-white/40 text-xs mt-0.5">Planeje e acompanhe as datas dos eventos.</p>
                  </div>
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
                    className="rounded-2xl gap-2 bg-primary hover:bg-primary/95 text-white font-bold h-11 px-5 sm:px-6 shadow-lg shadow-primary/20 text-xs sm:text-sm touch-press w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Novo Evento
                  </Button>
                </div>

                {eventos.length === 0 ? (
                  <Card className="glass-card text-center p-8 sm:p-12 border-white/[0.08] rounded-[2rem]">
                    <Calendar className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-white mb-1">Nenhum evento registrado</h3>
                    <p className="text-white/40 text-sm">Crie seu primeiro evento clicando no botão acima.</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {eventos.map((evt: Evento) => (
                      <Card
                        key={evt.id}
                        className={cn(
                          "relative overflow-hidden group flex flex-col justify-between transition-all duration-300 rounded-[1.75rem] border border-white/10 bg-gradient-to-b from-white/[0.05] via-white/[0.02] to-transparent hover:border-primary/40 hover:shadow-[0_12px_40px_rgba(0,191,165,0.15)]",
                          !evt.publicado && "opacity-70 border-dashed border-white/20"
                        )}
                      >
                        {/* Linha de acento decorativa superior */}
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-40 group-hover:opacity-100 transition-opacity" />

                        <CardHeader className="p-5 sm:p-6 pb-4 space-y-3">
                          <div className="flex justify-between items-center gap-2">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest border flex items-center gap-1.5 shrink-0 shadow-sm",
                              evt.publicado
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-amber-500/10"
                            )}>
                              <span className="relative flex h-2 w-2">
                                {evt.publicado && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                                <span className={cn("relative inline-flex rounded-full h-2 w-2", evt.publicado ? "bg-emerald-400" : "bg-amber-400")} />
                              </span>
                              {evt.publicado ? 'Ativo' : 'Inativo'}
                            </span>
                            <span className="text-xs text-white/80 font-medium flex items-center gap-1.5 bg-white/[0.04] px-2.5 py-1 rounded-full border border-white/10 shadow-inner">
                              <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                              {format(new Date(evt.data), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <CardTitle className="text-lg sm:text-xl font-display font-extrabold text-white truncate tracking-tight group-hover:text-primary transition-colors">
                              {evt.titulo}
                            </CardTitle>
                            <div className="inline-flex items-center gap-1.5 text-xs text-white/70 font-medium bg-white/[0.03] px-2.5 py-1 rounded-xl border border-white/5 max-w-full">
                              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="truncate">{evt.local}</span>
                            </div>
                          </div>

                          <p className="text-xs text-white/70 line-clamp-3 leading-relaxed pt-1">
                            {evt.descricao || 'Sem descrição.'}
                          </p>
                        </CardHeader>

                        <CardContent className="p-5 sm:p-6 pt-0 flex-1 flex flex-col justify-end">
                          <div className="flex gap-2 pt-3 border-t border-white/5">
                            <Button
                              onClick={() => setSelectedEvento(evt)}
                              className="flex-1 rounded-xl bg-primary text-white hover:bg-primary-dark transition-all h-10 text-xs font-bold uppercase tracking-wider touch-press shadow-lg shadow-primary/20 hover:shadow-primary/30"
                            >
                              Inscritos & Estatísticas
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-white/5 text-white/50 hover:text-white touch-press" />}>
                                <MoreVertical className="w-4 h-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-2xl bg-black/90 border-white/10 p-2 min-w-[170px]">
                                <DropdownMenuItem
                                  onClick={() => handleTogglePublish(evt)}
                                  className="text-xs font-bold text-white/80 rounded-xl px-4 py-2.5 focus:bg-white/10 cursor-pointer flex items-center gap-2"
                                >
                                  {evt.publicado ? (
                                    <>
                                      <XCircle className="w-3.5 h-3.5 text-amber-400" />
                                      <span>Marcar como Inativo</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>Marcar como Ativo</span>
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    const inicio = evt.dataInicioInscricao || evt.data_inicio_inscricao;
                                    const fim = evt.dataFimInscricao || evt.data_fim_inscricao;
                                    setEditingEventId(evt.id);
                                    setNewEvent({
                                      titulo: evt.titulo,
                                      descricao: evt.descricao || '',
                                      data: formatToDatetimeLocal(evt.data),
                                      local: evt.local,
                                      cidade: evt.cidade || '',
                                      publicado: evt.publicado,
                                      dataInicioInscricao: formatToDatetimeLocal(inicio),
                                      dataFimInscricao: formatToDatetimeLocal(fim),
                                    });
                                    setShowCreateEventModal(true);
                                  }}
                                  className="text-xs font-bold text-white/80 rounded-xl px-4 py-2.5 focus:bg-white/10 cursor-pointer flex items-center gap-2"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  <span>Editar</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-white/5" />
                                <DropdownMenuItem
                                  onClick={() => handleDeleteEvent(evt.id, evt.titulo)}
                                  className="text-xs font-bold text-red-400 rounded-xl px-4 py-2.5 focus:bg-red-500/10 cursor-pointer flex items-center gap-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Excluir</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="tab-alunos"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                {/* Tabela de Alunos Geral */}
                <Card className="glass-card overflow-hidden border-white/[0.08] shadow-3xl rounded-[2rem] md:rounded-[2.5rem]">
                  <CardHeader className="p-5 sm:p-7 md:p-8 lg:p-10 border-b border-white/[0.08] bg-white/[0.02]">
                    <div className="space-y-5 sm:space-y-6">
                      {/* Linha 1: Título e Botões de Ação */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <CardTitle className="font-display font-bold text-xl sm:text-2xl md:text-3xl text-white tracking-tight leading-tight sm:whitespace-nowrap">
                            Base Geral de Alunos
                          </CardTitle>
                          <CardDescription className="text-white/40 text-xs md:text-sm font-medium">
                            Lista de todos os alunos registrados no sistema.
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                          <Button
                            onClick={exportAllStudentsCSV}
                            variant="outline"
                            className="flex-1 sm:flex-none rounded-2xl gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all h-10 sm:h-11 px-3 sm:px-4 text-[11px] sm:text-xs font-bold uppercase tracking-wider touch-press"
                          >
                            <Download className="w-4 h-4 text-primary" />
                            <span>Planilha Geral</span>
                          </Button>
                          <Button
                            onClick={() => setShowAddStudentModal(true)}
                            className="flex-1 sm:flex-none rounded-2xl gap-2 bg-primary hover:bg-primary/95 text-white font-bold h-10 sm:h-11 px-4 sm:px-5 shadow-lg shadow-primary/20 text-[11px] sm:text-xs uppercase tracking-wider touch-press"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Cadastrar</span>
                          </Button>
                        </div>
                      </div>

                      {/* Linha 2: Busca e Filtros */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-white/5">
                        <div className="relative w-full sm:w-72 md:w-80">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                          <Input
                            placeholder="Buscar aluno..."
                            className="liquid-input h-10 sm:h-11 w-full text-base md:text-sm pl-11"
                            value={searchTerm}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              setSearchTerm(e.target.value);
                              setCurrentPage(1); // Resetar para a primeira página ao buscar
                            }}
                          />
                        </div>
                        <div className="text-[10px] text-white/30 font-bold uppercase tracking-wider hidden sm:block">
                          Total: {totalStudents} cadastrados
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <div className="overflow-x-auto custom-scrollbar overscroll-x-contain">
                    <Table className="min-w-[620px] sm:min-w-[700px]">
                      <TableHeader className="bg-white/[0.02] border-b border-white/[0.08] sticky top-0 z-10 font-bold uppercase text-[10px] tracking-[0.2em]">
                        <TableRow className="hover:bg-transparent border-none">
                          <TableHead className="py-3 md:py-4 px-3 md:px-6 lg:px-8 text-white/30">Nome</TableHead>
                          <TableHead className="py-3 md:py-4 px-3 md:px-6 lg:px-8 text-white/30">Escola</TableHead>
                          <TableHead className="py-3 md:py-4 px-3 md:px-6 lg:px-8 text-white/30">Cidade</TableHead>
                          <TableHead className="py-3 md:py-4 px-3 md:px-6 lg:px-8 text-white/30">Grêmio</TableHead>
                          <TableHead className="py-3 md:py-4 px-3 md:px-6 lg:px-8 text-center text-white/30">Código</TableHead>
                          <TableHead className="w-[50px] md:w-[70px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAlunos.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="h-40 sm:h-48 text-center text-white/20 font-medium text-sm">
                              Nenhum participante encontrado.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredAlunos.map((p: Participante) => (
                            <TableRow key={p.id} className="hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] group text-sm">
                              <TableCell className="py-2.5 sm:py-3.5 md:py-4 px-3 md:px-6 lg:px-8 font-bold text-white text-xs sm:text-sm md:text-base">
                                {p.nome}
                              </TableCell>
                              <TableCell className="py-2.5 sm:py-3.5 md:py-4 px-3 md:px-6 lg:px-8 text-white/60 text-xs sm:text-sm">
                                {p.escola}
                              </TableCell>
                              <TableCell className="py-2.5 sm:py-3.5 md:py-4 px-3 md:px-6 lg:px-8 text-white/60 text-xs sm:text-sm">
                                {p.cidade}
                              </TableCell>
                              <TableCell className="py-2.5 sm:py-3.5 md:py-4 px-3 md:px-6 lg:px-8 text-white/60 text-xs sm:text-sm">
                                {p.gremio || '-'}
                              </TableCell>
                              <TableCell className="py-2.5 sm:py-3.5 md:py-4 px-3 md:px-6 lg:px-8 text-center">
                                <code className="text-[9px] md:text-[11px] font-black bg-white/5 text-white/80 border border-white/10 rounded-xl px-2 md:px-2.5 py-1 md:py-1.5 shadow-sm uppercase tracking-wider">
                                  {p.codigo}
                                </code>
                              </TableCell>
                              <TableCell className="px-2 sm:px-4 md:px-6">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteStudent(p.id, p.nome)}
                                  className="h-8 w-8 sm:h-9 sm:w-9 text-white/30 hover:text-red-400 rounded-xl hover:bg-red-500/10 touch-press"
                                >
                                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="p-4 sm:p-6 md:p-8 border-t border-white/[0.08] bg-white/[0.02] flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 px-5 sm:px-8 md:px-10">
                    <span className="text-[9px] md:text-[10px] uppercase font-bold tracking-[0.2em] text-white/20">
                      Total: {totalStudents} cadastrados
                    </span>

                    {/* Controles de Paginação */}
                    {totalStudents > itemsPerPage && (
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 1 || loading}
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-35 text-[10px] font-bold uppercase tracking-widest px-2.5 sm:px-3 h-8 sm:h-9 touch-press"
                        >
                          Anterior
                        </Button>
                        <span className="text-white/45 text-xs font-bold px-1 sm:px-2">
                          {currentPage} / {Math.ceil(totalStudents / itemsPerPage)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage >= Math.ceil(totalStudents / itemsPerPage) || loading}
                          onClick={() => setCurrentPage(prev => prev + 1)}
                          className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-35 text-[10px] font-bold uppercase tracking-widest px-2.5 sm:px-3 h-8 sm:h-9 touch-press"
                        >
                          Próximo
                        </Button>
                      </div>
                    )}

                    <span className="flex items-center gap-2 text-[9px] md:text-[10px] uppercase font-bold tracking-[0.2em] text-white/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      Banco de Dados Ativo
                    </span>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        /* DETALHE DO EVENTO SELECIONADO */
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 sm:space-y-8"
        >
          {/* Botão Voltar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              onClick={() => { setSelectedEvento(null); setFilter('all'); setSearchTerm(''); }}
              variant="ghost"
              className="rounded-xl text-white/60 hover:text-white hover:bg-white/5 gap-2 px-3 h-10 touch-press"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar aos Eventos
            </Button>

            <Button
              onClick={() => handleTogglePublish(selectedEvento)}
              variant="outline"
              size="sm"
              className={cn(
                "rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all cursor-pointer touch-press",
                selectedEvento.publicado
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-amber-500/20 hover:text-amber-400"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-emerald-500/20 hover:text-emerald-400"
              )}
            >
              {selectedEvento.publicado ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                  Ativo (Inscrições Abertas)
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 mr-1 text-amber-400" />
                  Inativo (Inscrições Encerradas)
                </>
              )}
            </Button>
          </div>

          {/* Dados do Evento e Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">

            {/* Info Evento */}
            <div className="lg:col-span-8 space-y-6">
              <Card className="glass-card border-white/[0.08] bg-white/[0.01] p-5 sm:p-7 md:p-8 rounded-[2rem] space-y-5 sm:space-y-6 relative overflow-hidden">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight leading-tight">{selectedEvento.titulo}</h2>
                  <p className="text-white/40 text-xs sm:text-sm mt-2 font-medium leading-relaxed">
                    {selectedEvento.descricao || 'Sem descrição.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-white/5 text-xs text-white/50 font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <span>{format(new Date(selectedEvento.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-primary shrink-0" />
                    <span>{format(new Date(selectedEvento.data), "HH:mm'h'", { locale: ptBR })}</span>
                  </div>
                  <div className="flex items-center gap-2.5 sm:col-span-2">
                    <MapPin className="w-4 h-4 text-primary shrink-0 animate-pulse" />
                    <span className="truncate">{selectedEvento.local}</span>
                  </div>
                </div>

                {/* Efeito decorativo */}
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
              </Card>

              {/* Tabela de Inscritos neste Evento */}
              <Card className="glass-card overflow-hidden border-white/[0.08] shadow-3xl rounded-[2rem] md:rounded-[2.5rem]">
                <CardHeader className="p-5 sm:p-7 md:p-8 border-b border-white/[0.08] bg-white/[0.02]">
                  <div className="space-y-5 sm:space-y-6">
                    {/* Linha 1: Título e Botão de Ação */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                      <div className="space-y-1">
                        <CardTitle className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight leading-tight sm:whitespace-nowrap">Lista de Inscritos</CardTitle>
                        <CardDescription className="text-white/40 text-xs md:text-sm font-medium">Controle de inscrições e presenças para este evento.</CardDescription>
                      </div>
                      <Button
                        onClick={() => setShowAddStudentToEventModal(true)}
                        className="rounded-2xl gap-2 bg-primary hover:bg-primary/95 text-white font-bold h-10 px-4 sm:px-5 shadow-lg shadow-primary/20 text-[11px] sm:text-xs uppercase tracking-wider touch-press w-full sm:w-auto"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Adicionar Aluno</span>
                      </Button>
                    </div>

                    {/* Linha 2: Busca e Filtro */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t border-white/5">
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <Input
                          placeholder="Buscar inscrito..."
                          className="liquid-input h-10 w-full text-base md:text-xs pl-11"
                          value={searchTerm}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                        />
                      </div>

                      <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="outline" className="flex-1 sm:flex-none h-10 rounded-xl bg-white/5 border-white/10 gap-2 px-4 shadow-sm hover:bg-white/10 transition-all font-bold text-xs uppercase tracking-wider text-white/60 touch-press" />}>
                            <Filter className="w-3.5 h-3.5" />
                            <span>Filtro</span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl border-white/10 shadow-3xl bg-black/90 p-2 min-w-[160px]">
                            <DropdownMenuItem onClick={() => setFilter('all')} className="rounded-xl focus:bg-white/10 focus:text-white transition-all px-4 py-2 cursor-pointer font-medium text-xs text-white/80">Todos</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFilter('present')} className="rounded-xl focus:bg-emerald-500/20 focus:text-emerald-400 transition-all px-4 py-2 cursor-pointer font-medium text-xs text-emerald-400/80">Confirmados</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFilter('absent')} className="rounded-xl focus:bg-white/10 focus:text-white transition-all px-4 py-2 cursor-pointer font-medium text-xs text-white/60">Apenas Inscritos</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <div className="overflow-x-auto custom-scrollbar overscroll-x-contain">
                  <Table className="min-w-[560px] sm:min-w-[700px]">
                    <TableHeader className="bg-white/[0.02] border-b border-white/[0.08] sticky top-0 z-10 font-bold uppercase text-[10px] tracking-[0.2em]">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="py-3 md:py-4 px-3 md:px-6 lg:px-8 text-white/30">Participante</TableHead>
                        <TableHead className="py-3 md:py-4 px-3 md:px-6 lg:px-8 text-center text-white/30">Código</TableHead>
                        <TableHead className="py-3 md:py-4 px-3 md:px-6 lg:px-8 text-white/30">Status</TableHead>
                        <TableHead className="w-[50px] md:w-[70px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingInscritos ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-40 sm:h-48 text-center text-white/20 font-medium text-sm">
                            <div className="flex flex-col items-center justify-center gap-3">
                              <LoadingSpinner size="md" />
                              <span>Carregando inscrições...</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredInscritos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-40 sm:h-48 text-center text-white/20 font-medium text-sm">
                            Nenhum aluno inscrito neste evento.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredInscritos.map((i: InscricaoEvento) => {
                          const p = i.participantes;
                          if (!p) return null;
                          return (
                            <TableRow key={i.id} className="hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] group text-sm">
                              <TableCell className="py-2.5 sm:py-3.5 md:py-4 px-3 md:px-6 lg:px-8">
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-white text-xs sm:text-sm md:text-base mb-0.5 truncate">{p.nome}</span>
                                  <span className="text-[9px] sm:text-xs text-white/30 font-medium truncate">{p.cidade} • {p.escola}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-2.5 sm:py-3.5 md:py-4 px-3 md:px-6 lg:px-8 text-center">
                                <code className="text-[9px] md:text-[11px] font-black bg-white/5 text-white/80 border border-white/10 rounded-xl px-2 sm:px-2.5 py-1 sm:py-1.5 shadow-sm uppercase tracking-wider">
                                  {p.codigo}
                                </code>
                              </TableCell>
                              <TableCell className="py-2.5 sm:py-3.5 md:py-4 px-3 md:px-6 lg:px-8">
                                <div className={cn(
                                  "inline-flex items-center gap-1.5 sm:gap-2 px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[9px] font-bold uppercase tracking-[0.15em] md:tracking-[0.2em] shadow-sm border",
                                  i.presente
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : "bg-white/5 text-white/50 border-white/10"
                                )}>
                                  <div className={cn("w-1 h-1 md:w-1.5 md:h-1.5 rounded-full", i.presente ? "bg-emerald-400 animate-pulse" : "bg-white/40")} />
                                  {i.presente ? 'Confirmado' : 'Inscrito'}
                                </div>
                              </TableCell>
                              <TableCell className="px-2 sm:px-4 md:px-6">
                                <DropdownMenu>
                                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 opacity-50 hover:opacity-100 transition-all rounded-xl hover:bg-white/10 touch-press" />}>
                                    <MoreVertical className="w-4 h-4 text-white" />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="rounded-2xl bg-black/95 border-white/10 p-2 min-w-[150px]">
                                    <DropdownMenuItem onClick={() => handleTogglePresence(i)} className="text-xs font-bold text-white/80 rounded-xl px-4 py-2.5 focus:bg-white/10 cursor-pointer">
                                      <UserCheck className="w-3.5 h-3.5 mr-2 text-primary" />
                                      {i.presente ? 'Cancelar Check-in' : 'Fazer Check-in'}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-white/5" />
                                    <DropdownMenuItem
                                      onClick={() => handleRemoveFromEvent(i.id)}
                                      className="text-xs font-bold text-red-400 rounded-xl px-4 py-2.5 focus:bg-red-500/10 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                                      Remover do Evento
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="p-4 sm:p-6 md:p-8 border-t border-white/[0.08] bg-white/[0.02] text-[9px] md:text-[10px] uppercase font-bold tracking-[0.2em] text-white/20 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 px-5 sm:px-8 md:px-10">
                  <span>{filteredInscritos.length} de {inscritosEvento.length} inscritos exibidos</span>
                  <span className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Sincronização em tempo real
                  </span>
                </div>
              </Card>
            </div>

            {/* Sidebar Evento: Stats & Export */}
            <div className="lg:col-span-4 space-y-5 sm:space-y-6 h-full">

              {/* Mini Stats Card */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="glass-card bg-white/[0.01] border-white/[0.08] p-4 sm:p-5 rounded-2xl">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">Inscritos</span>
                  <div className="text-2xl sm:text-3xl font-display font-bold text-white mt-1">{statsEvento.total}</div>
                </div>
                <div className="glass-card bg-white/[0.01] border-white/[0.08] p-4 sm:p-5 rounded-2xl">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">Confirmados</span>
                  <div className="text-2xl sm:text-3xl font-display font-bold text-emerald-400 mt-1">{statsEvento.presentes}</div>
                </div>
                <div className="glass-card bg-white/[0.01] border-white/[0.08] p-4 sm:p-5 rounded-2xl">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">Apenas Inscritos</span>
                  <div className="text-2xl sm:text-3xl font-display font-bold text-white mt-1">{statsEvento.ausentes}</div>
                </div>
                <div className="glass-card bg-white/[0.01] border-white/[0.08] p-4 sm:p-5 rounded-2xl">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">Frequência</span>
                  <div className="text-2xl sm:text-3xl font-display font-bold text-primary mt-1">{statsEvento.porcentagem.toFixed(0)}%</div>
                </div>
              </div>

              {/* Chart Pie */}
              {statsEvento.total > 0 && (
                <Card className="glass-card border-white/[0.08] shadow-3xl overflow-hidden bg-white/[0.01] rounded-[2rem] md:rounded-[2.5rem]">
                  <CardHeader className="pb-2 p-4 sm:p-6 border-b border-white/[0.08] bg-white/[0.02]">
                    <CardTitle className="font-display text-sm text-white">Engajamento Presencial</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[180px] sm:h-[200px] pt-4 sm:pt-6 p-4 sm:p-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={8}
                          dataKey="value"
                          stroke="none"
                          cursor="pointer"
                          onClick={(_, index) => handleChartFilter(index)}
                        >
                          <Cell fill="var(--color-primary)" />
                          <Cell fill="rgba(255,255,255,0.05)" />
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: '15px', border: 'none', backgroundColor: '#000', color: '#fff', fontSize: '10px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-3 sm:gap-4 text-[9px] uppercase tracking-widest font-bold mt-2">
                      <button
                        type="button"
                        onClick={() => setFilter('present')}
                        className={cn(
                          'transition-colors hover:text-primary focus:outline-none touch-press',
                          filter === 'present' ? 'text-primary' : 'text-primary/70'
                        )}
                      >
                        Confirmados ({statsEvento.presentes})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilter('absent')}
                        className={cn(
                          'transition-colors hover:text-white focus:outline-none touch-press',
                          filter === 'absent' ? 'text-white' : 'text-white/25'
                        )}
                      >
                        Apenas Inscritos ({statsEvento.ausentes})
                      </button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Export Event CSV */}
              <Card className="glass-card bg-primary/20 text-white border-primary/20 shadow-3xl overflow-hidden relative group rounded-[2rem]">
                <div className="absolute top-0 right-0 p-8 opacity-5 -mr-10 -mt-10 pointer-events-none">
                  <FileSpreadsheet className="w-48 h-48" />
                </div>
                <CardHeader className="p-5 sm:p-6 relative z-10">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3 border border-white/20">
                    <Download className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <CardTitle className="font-display text-base sm:text-lg tracking-tight mb-1">Relatórios CSV</CardTitle>
                  <CardDescription className="text-white/70 font-medium text-xs mb-3 sm:mb-4">Exportar planilhas deste evento.</CardDescription>
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => exportEventCSV('all')}
                      className="w-full bg-white text-primary hover:bg-neutral-100 font-bold rounded-xl h-10 shadow-md text-[10px] uppercase tracking-widest touch-press"
                    >
                      1. Todos os Inscritos
                    </Button>
                    <Button
                      onClick={() => exportEventCSV('present')}
                      className="w-full bg-primary text-white hover:bg-primary-dark font-bold rounded-xl h-10 shadow-md border border-white/20 text-[10px] uppercase tracking-widest touch-press"
                    >
                      2. Apenas Confirmados
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            </div>
          </div>
        </motion.div>
      )}

      {/* --- MODAIS --- */}

      {/* Modal 1: Cadastro Manual de Aluno (Global) */}
      <AnimatePresence>
        {showAddStudentModal && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 pt-6 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 40 }}
              className="w-full max-w-2xl bg-card border border-white/10 rounded-t-[2rem] md:rounded-[2.5rem] mt-auto md:mt-0 overflow-hidden shadow-[0_-20px_50px_rgba(0,0,0,0.8)] md:shadow-3xl max-h-[92dvh] overflow-y-auto custom-scrollbar overscroll-contain"
            >
              <div className="p-5 sm:p-7 md:p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <div>
                  <h3 className="text-xl sm:text-2xl font-display font-bold text-white">Cadastrar Aluno</h3>
                  <p className="text-white/40 text-xs sm:text-sm mt-0.5 sm:mt-1">Criação de participante na base permanente do sistema.</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAddStudentModal(false)}
                  className="rounded-full hover:bg-white/10 text-white/40 hover:text-white touch-press"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
              </div>

              <form onSubmit={handleAddStudentSubmit} className="p-5 sm:p-7 md:p-10 space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest ml-1">Nome Completo</label>
                    <Input
                      required
                      className="liquid-input h-12 text-base md:text-sm"
                      value={newStudent.nome}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStudent({ ...newStudent, nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest ml-1">E-mail</label>
                    <Input
                      type="email"
                      required
                      className="liquid-input h-12 text-base md:text-sm"
                      value={newStudent.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStudent({ ...newStudent, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest ml-1">Telefone</label>
                    <Input
                      required
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={15}
                      pattern="\(\d{2}\) \d{4,5}-\d{4}"
                      title="Formato esperado: (99) 99999-9999"
                      placeholder="(99) 99999-9999"
                      className="liquid-input h-12 text-base md:text-sm"
                      value={newStudent.telefone}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStudent({ ...newStudent, telefone: formatPhone(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest ml-1">Cidade</label>
                    <Input
                      required
                      className="liquid-input h-12 text-base md:text-sm"
                      value={newStudent.cidade}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStudent({ ...newStudent, cidade: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest ml-1">Escola</label>
                    <Input
                      required
                      className="liquid-input h-12 text-base md:text-sm"
                      value={newStudent.escola}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStudent({ ...newStudent, escola: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest ml-1">Grêmio Estudantil (Opcional)</label>
                    <Input
                      className="liquid-input h-12 text-base md:text-sm"
                      value={newStudent.gremio}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStudent({ ...newStudent, gremio: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-white/5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddStudentModal(false)}
                    className="flex-1 h-12 rounded-2xl border-white/10 text-white font-bold touch-press"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold touch-press"
                  >
                    Confirmar Cadastro
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 2: Criar Evento */}
      <AnimatePresence>
        {showCreateEventModal && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 pt-6 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 40 }}
              className="w-full max-w-xl bg-card border border-white/10 rounded-t-[2rem] md:rounded-[2.5rem] mt-auto md:mt-0 overflow-hidden shadow-[0_-20px_50px_rgba(0,0,0,0.8)] md:shadow-3xl max-h-[92dvh] overflow-y-auto custom-scrollbar overscroll-contain"
            >
              <div className="p-5 sm:p-7 md:p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <div>
                  <h3 className="text-xl sm:text-2xl font-display font-bold text-white">{editingEventId ? 'Editar Evento' : 'Criar Evento'}</h3>
                  <p className="text-white/40 text-xs sm:text-sm mt-0.5 sm:mt-1">{editingEventId ? 'Modifique os dados do evento.' : 'Insira os dados do próximo encontro/fórum.'}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCreateEventModal(false)}
                  className="rounded-full hover:bg-white/10 text-white/40 hover:text-white touch-press"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
              </div>

              <form onSubmit={handleCreateEventSubmit} className="p-5 sm:p-7 md:p-10 space-y-4 sm:space-y-6">
                <div className="space-y-3.5 sm:space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest pl-1">Título do Evento</label>
                    <Input
                      required
                      className="liquid-input h-12 text-base md:text-sm"
                      placeholder="Ex: I Fórum de Liderança Olhar Jovem"
                      value={newEvent.titulo}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEvent({ ...newEvent, titulo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest pl-1">Descrição</label>
                    <textarea
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-base md:text-sm focus:outline-none focus:border-primary transition-all duration-300 min-h-[90px] sm:min-h-[100px] placeholder:text-white/10"
                      placeholder="Informações adicionais sobre o cronograma, palestrantes, etc..."
                      value={newEvent.descricao}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewEvent({ ...newEvent, descricao: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest pl-1">Data & Hora</label>
                      <Input
                        type="datetime-local"
                        required
                        className="liquid-input h-12 text-white/70 text-base md:text-sm"
                        value={newEvent.data}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEvent({ ...newEvent, data: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest pl-1">Localização</label>
                      <Input
                        required
                        className="liquid-input h-12 text-base md:text-sm"
                        placeholder="Ex: Auditório Municipal"
                        value={newEvent.local}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEvent({ ...newEvent, local: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest pl-1">Cidade do Evento (Restrição de Inscrição)</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-2xl h-12 px-4 text-white text-base md:text-sm focus:outline-none focus:border-primary transition-all duration-300"
                      value={newEvent.cidade}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewEvent({ ...newEvent, cidade: e.target.value })}
                    >
                      <option value="" className="bg-neutral-900 text-white/60">Todas as cidades (Sem restrição)</option>
                      {adminCitiesList.map((c) => (
                        <option key={c} value={c} className="bg-neutral-900 text-white">{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 border-t border-white/5 pt-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest pl-1">Início das Inscrições (Opcional)</label>
                      <Input
                        type="datetime-local"
                        className="liquid-input h-12 text-white/70 text-base md:text-sm"
                        value={newEvent.dataInicioInscricao}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEvent({ ...newEvent, dataInicioInscricao: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest pl-1">Término das Inscrições (Opcional)</label>
                      <Input
                        type="datetime-local"
                        className="liquid-input h-12 text-white/70 text-base md:text-sm"
                        value={newEvent.dataFimInscricao}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEvent({ ...newEvent, dataFimInscricao: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-1 sm:pt-2">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest pl-1">Status de Inscrições do Evento</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => setNewEvent({ ...newEvent, publicado: true })}
                        className={cn(
                          "flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer touch-press",
                          newEvent.publicado
                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-lg shadow-emerald-500/10"
                            : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                        )}
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Ativo (Recebendo Inscrições)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewEvent({ ...newEvent, publicado: false })}
                        className={cn(
                          "flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer touch-press",
                          !newEvent.publicado
                            ? "bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-500/10"
                            : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                        )}
                      >
                        <XCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Inativo (Inscrições Encerradas)</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-white/5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateEventModal(false)}
                    className="flex-1 h-12 rounded-2xl border-white/10 text-white font-bold touch-press"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={submittingEvent}
                    className="flex-1 h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold disabled:opacity-50 touch-press"
                  >
                    {submittingEvent && <LoadingSpinner size="xs" variant="white" className="mr-2" />}
                    {submittingEvent
                      ? (editingEventId ? 'Salvando...' : 'Criando...')
                      : (editingEventId ? 'Salvar Alterações' : 'Criar Evento')}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 3: Inscrever Aluno no Evento Específico */}
      <AnimatePresence>
        {showAddStudentToEventModal && selectedEvento && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 pt-6 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 40 }}
              className="w-full max-w-xl bg-card border border-white/10 rounded-t-[2rem] md:rounded-[2.5rem] mt-auto md:mt-0 overflow-hidden shadow-[0_-20px_50px_rgba(0,0,0,0.8)] md:shadow-3xl flex flex-col max-h-[92dvh] custom-scrollbar overscroll-contain"
            >
              <div className="p-5 sm:p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <div>
                  <h3 className="text-lg sm:text-xl font-display font-bold text-white">Inscrever Aluno no Evento</h3>
                  <p className="text-white/40 text-xs mt-0.5 sm:mt-1">Inscreva participantes já cadastrados no evento selecionado.</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setShowAddStudentToEventModal(false); setSearchStudentForEvent(''); }}
                  className="rounded-full hover:bg-white/10 text-white/40 hover:text-white touch-press"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Filtro de Busca */}
              <div className="p-4 sm:p-5 border-b border-white/5">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <Input
                    placeholder="Buscar participante por nome ou código..."
                    className="liquid-input h-11 w-full text-base md:text-sm pl-11"
                    value={searchStudentForEvent}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchStudentForEvent(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              {/* Lista de Alunos Elegíveis */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 sm:space-y-3 min-h-[180px] custom-scrollbar">
                {studentsNotSubscribed.length === 0 ? (
                  <div className="text-center py-8 sm:py-10 text-white/30 text-xs sm:text-sm font-medium">
                    {searchStudentForEvent ? 'Nenhum aluno correspondente encontrado.' : 'Todos os alunos cadastrados já estão inscritos.'}
                  </div>
                ) : (
                  studentsNotSubscribed.map((student: Participante) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all"
                    >
                      <div className="min-w-0 pr-3 sm:pr-4">
                        <p className="font-bold text-white truncate text-xs sm:text-sm">{student.nome}</p>
                        <p className="text-[10px] text-white/40 mt-0.5 truncate">{student.codigo} • {student.escola} • {student.cidade}</p>
                      </div>
                      <Button
                        onClick={() => handleAddStudentToEvent(student.id)}
                        className="rounded-xl bg-primary hover:bg-primary/95 text-white font-bold h-8 sm:h-9 px-3 sm:px-4 text-[11px] sm:text-xs shrink-0 touch-press"
                      >
                        Inscrever
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 sm:p-5 border-t border-white/5 bg-white/[0.01] flex justify-end">
                <Button
                  onClick={() => { setShowAddStudentToEventModal(false); setSearchStudentForEvent(''); }}
                  variant="outline"
                  className="rounded-xl border-white/10 text-white/60 hover:text-white text-xs h-10 px-5 sm:px-6 font-bold touch-press"
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
        <CardHeader className="flex flex-row items-center justify-between p-6 pb-2">
          <CardTitle className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30 leading-none">
            {title}
          </CardTitle>
          <div className="p-2.5 bg-white/5 rounded-xl border border-white/10">
            {icon}
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0 mt-4">
          <div className="text-3xl font-display font-bold text-white tracking-tighter mb-1">{value}</div>
          <p className="text-[10px] text-white/30 font-medium italic">{description}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
