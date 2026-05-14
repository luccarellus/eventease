import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Participante } from '@/types/index';
import { motion } from 'motion/react';
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
  Edit
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { isAdmin } from '@/constants';

export default function Admin() {
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newParticipante, setNewParticipante] = useState({
    nome: '',
    email: '',
    telefone: '',
    cidade: '',
    escola: '',
    gremio: ''
  });
  const navigate = useNavigate();

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

      fetchData();
    } catch (e: any) {
      console.error('Auth check error:', e);
      if (e.message?.includes('Invalid path') || e.code === 'PGRST125') {
        toast.error('Erro de Configuração Supabase (URL Inválida)');
      } else {
        toast.error('Erro ao verificar permissões de acesso.');
      }
      navigate('/login');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('participantes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setParticipantes(data || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      if (error.message?.includes('Invalid path') || error.code === 'PGRST125') {
        toast.error('Erro de Configuração Supabase', {
          description: 'URL do API inválida. Remova o /rest/v1 da URL no Vercel.'
        });
      } else {
        toast.error('Erro ao carregar participantes.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    // Inscrição em tempo real
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participantes' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o cadastro de ${nome}?`)) return;

    try {
      const { error } = await supabase
        .from('participantes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Participante removido com sucesso.');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao remover participante.');
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
      const { error } = await supabase
        .from('participantes')
        .insert([{
          ...newParticipante,
          codigo,
          presente: false
        }]);

      if (error) throw error;
      
      toast.success('Participante cadastrado com sucesso!');
      setShowAddModal(false);
      setNewParticipante({
        nome: '',
        email: '',
        telefone: '',
        cidade: '',
        escola: '',
        gremio: ''
      });
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao realizar cadastro manual.');
    }
  };

  const stats = useMemo(() => {
    const total = participantes.length;
    const presentes = participantes.filter(p => p.presente).length;
    const ausentes = total - presentes;
    const porcentagem = total > 0 ? (presentes / total) * 100 : 0;

    return { total, presentes, ausentes, porcentagem };
  }, [participantes]);

  const filteredData = useMemo(() => {
    return participantes.filter(p => {
      const matchesSearch = 
        p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.codigo.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = 
        filter === 'all' || 
        (filter === 'present' && p.presente) || 
        (filter === 'absent' && !p.presente);

      return matchesSearch && matchesFilter;
    });
  }, [participantes, searchTerm, filter]);

  const exportCSV = (type: 'all' | 'present' = 'all') => {
    const filteredList = type === 'all' 
      ? participantes 
      : participantes.filter(p => p.presente);

    const dataToExport = filteredList.map(p => ({
      ID: p.id,
      Nome: p.nome,
      Email: p.email,
      Telefone: p.telefone,
      Cidade: p.cidade,
      Escola: p.escola,
      Grêmio: p.gremio || 'N/A',
      Código: p.codigo,
      Presente: p.presente ? 'Sim' : 'Não',
      Confirmado_Em: p.confirmado_em ? format(new Date(p.confirmado_em), 'dd/MM/yyyy HH:mm:ss') : '',
      Criado_Em: format(new Date(p.created_at), 'dd/MM/yyyy HH:mm:ss')
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const fileName = type === 'all' ? 'inscritos' : 'presentes';
    link.setAttribute('download', `relatorio_${fileName}_evento_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Relatório de ${type === 'all' ? 'inscritos' : 'presenças'} gerado com sucesso!`);
  };

  const chartData = [
    { name: 'Presentes', value: stats.presentes, color: '#171717' },
    { name: 'Ausentes', value: stats.ausentes, color: '#e5e5e5' },
  ];

  if (loading && participantes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw className="w-8 h-8 animate-spin text-neutral-400" />
          <p className="text-neutral-500 font-medium tracking-tight">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-12">
      {/* Header Admin */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-8 md:mb-12 px-2 md:px-0">
        <motion.div
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-primary text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-4">
             Controle Administrativo
          </div>
          <h1 className="heading-display text-3xl md:text-4xl mb-2 text-white leading-tight">Painel de <span className="text-primary italic">Liderança</span></h1>
          <p className="text-white/40 text-base md:text-lg font-medium">Gestão em tempo real de participantes e métricas de impacto.</p>
        </motion.div>
        <motion.div 
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           className="flex flex-wrap items-center gap-3"
        >
          <Button variant="outline" size="sm" onClick={fetchData} className="rounded-2xl gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all h-10 md:h-12 px-4 md:px-6 text-xs font-bold">
            <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin")} />
            Sincronizar
          </Button>
        </motion.div>
      </div>

      {/* Stats Grid */}
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1
            }
          }
        }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <StatCard 
          title="Total Inscritos" 
          value={stats.total} 
          icon={<Users className="w-5 h-5 text-teal-400" />} 
          description="Líderes cadastrados"
          trend="+12%"
          color="blue"
        />
        <StatCard 
          title="Presentes" 
          value={stats.presentes} 
          icon={<UserCheck className="w-5 h-5 text-emerald-400" />} 
          description="Check-in realizado"
          color="green"
          trend={`${stats.porcentagem.toFixed(0)}%`}
        />
        <StatCard 
          title="Aguardando" 
          value={stats.ausentes} 
          icon={<UserMinus className="w-5 h-5 text-orange-400" />} 
          description="Acesso pendente"
          trend="Ausentes"
        />
        <StatCard 
          title="Engajamento" 
          value={`${stats.porcentagem.toFixed(1)}%`} 
          icon={<TrendingUp className="w-5 h-5 text-purple-400" />} 
          description="Frequência ativa"
          color="purple"
          trend="85% Meta"
        />
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 px-2 md:px-0"
      >
        {/* Table Section */}
        <Card className="lg:col-span-2 glass-card overflow-hidden border-white/[0.08] shadow-3xl rounded-[2rem] md:rounded-[2.5rem]">
          <CardHeader className="p-8 md:p-10 border-b border-white/[0.08] bg-white/[0.02]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <CardTitle className="font-display font-bold text-2xl md:text-3xl text-white leading-none mb-2">Lista de Participantes</CardTitle>
                <CardDescription className="text-white/40 text-sm md:text-base font-medium">Filtre e gerencie as inscrições ativas.</CardDescription>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <Input 
                    placeholder="Pesquisar..." 
                    className="liquid-input h-11 w-full text-sm pl-11"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-11 rounded-2xl bg-white/5 border-white/10 gap-2 px-4 shadow-sm hover:bg-white/10 transition-all font-bold text-[10px] uppercase tracking-widest text-white/60">
                      <Filter className="w-4 h-4" />
                      Filtro
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-[1.5rem] border-white/10 shadow-3xl backdrop-blur-3xl bg-black/80 p-2 min-w-[200px]">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-white/30 font-extrabold px-4 py-3">Status do Acesso</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem onClick={() => setFilter('all')} className="rounded-xl focus:bg-white/10 focus:text-white transition-all px-4 py-2.5 cursor-pointer font-medium text-white/80">Todos</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilter('present')} className="rounded-xl focus:bg-emerald-500/20 focus:text-emerald-400 transition-all px-4 py-2.5 cursor-pointer font-medium text-emerald-400/80">Presentes</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilter('absent')} className="rounded-xl focus:bg-orange-500/20 focus:text-orange-400 transition-all px-4 py-2.5 cursor-pointer font-medium text-orange-400/80">Pendentes</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto scrollbar-hide">
            <Table className="min-w-[700px]">
              <TableHeader className="bg-white/[0.02] border-b border-white/[0.08] sticky top-0 z-10 font-bold uppercase text-[10px] tracking-[0.2em]">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="py-6 px-8 md:px-10 text-white/30">Participante</TableHead>
                  <TableHead className="py-6 px-8 md:px-10 text-center text-white/30">Código</TableHead>
                  <TableHead className="py-6 px-8 md:px-10 text-white/30">Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-48 text-center text-white/20 font-medium">
                      Nenhum resultado encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((p) => (
                    <TableRow key={p.id} className="hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] group text-sm">
                      <TableCell className="py-5 md:py-6 px-8 md:px-10">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-base mb-0.5">{p.nome}</span>
                          <span className="text-[10px] md:text-xs text-white/30 font-medium">{p.email} • {p.cidade}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-5 md:py-6 px-8 md:px-10 text-center">
                        <code className="text-[10px] md:text-[11px] font-black bg-white/5 text-white/80 border border-white/10 rounded-xl px-2.5 py-1.5 shadow-sm uppercase tracking-wider">
                          {p.codigo}
                        </code>
                      </TableCell>
                      <TableCell className="py-5 md:py-6 px-8 md:px-10">
                        <div className={cn(
                          "inline-flex items-center gap-2 px-3 md:px-4 py-1 md:py-1.5 rounded-full text-[8.5px] md:text-[9px] font-bold uppercase tracking-[0.2em] shadow-sm transition-all border",
                          p.presente 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                        )}>
                          <div className={cn("w-1.5 h-1.5 rounded-full", p.presente ? "bg-emerald-400 animate-pulse" : "bg-orange-400")} />
                          {p.presente ? 'Confirmado' : 'Pendente'}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 md:px-10">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 opacity-40 group-hover:opacity-100 transition-all rounded-xl hover:bg-white/10">
                              <MoreVertical className="w-4 h-4 text-white" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl bg-black/90 border-white/10 p-2 min-w-[140px]">
                            <DropdownMenuItem className="text-xs font-bold text-white/80 rounded-xl px-4 py-2.5 focus:bg-white/10">
                              <Edit className="w-3.5 h-3.5 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/5" />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(p.id, p.nome)}
                              className="text-xs font-bold text-red-400 rounded-xl px-4 py-2.5 focus:bg-red-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="p-6 md:p-8 border-t border-white/[0.08] bg-white/[0.02] text-[9px] md:text-[10px] uppercase font-bold tracking-[0.2em] text-white/20 flex flex-col sm:flex-row justify-between items-center gap-4 px-8 md:px-10">
            <span>{filteredData.length} de {participantes.length} ativos</span>
            <span className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Sincronizado via Supabase
            </span>
          </div>
        </Card>

        {/* Analytics Section */}
        <div className="space-y-6 md:space-y-8">
          <Card className="glass-card border-white/[0.08] shadow-3xl overflow-hidden bg-white/[0.01] rounded-[2rem] md:rounded-[2.5rem]">
            <CardHeader className="pb-4 p-8 border-b border-white/[0.08] bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-primary">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="font-display text-xl text-white leading-none mb-1">Métricas de Acesso</CardTitle>
                  <CardDescription className="text-[10px] uppercase font-bold text-white/20 tracking-widest">Status em tempo real</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-[280px] pt-10 p-6 md:p-8">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={10}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)'} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', backgroundColor: '#000', color: '#fff', fontSize: '12px', padding: '12px 18px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-8 mt-6">
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(0,191,165,0.5)]" />
                   <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Presentes</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-white/5" />
                   <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Pendentes</span>
                 </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card bg-primary/20 text-white border-primary/20 shadow-3xl overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 -mr-10 -mt-10 group-hover:scale-110 transition-transform duration-700">
              <FileSpreadsheet className="w-64 h-64" />
            </div>
            <CardHeader className="p-8 relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-[1.2rem] flex items-center justify-center mb-4 border border-white/20 shadow-inner">
                <Download className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="font-display text-2xl tracking-tight mb-2">Relatórios CSV</CardTitle>
              <CardDescription className="text-white/70 font-medium text-base mb-6">Extraia listas detalhadas para controle externo.</CardDescription>
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={() => exportCSV('all')} 
                  className="w-full bg-white text-primary hover:bg-neutral-100 font-bold rounded-2xl h-12 shadow-xl text-xs uppercase tracking-widest"
                >
                   1. Todos os Inscritos
                </Button>
                <Button 
                  onClick={() => exportCSV('present')} 
                  className="w-full bg-emerald-500 text-white hover:bg-emerald-600 font-bold rounded-2xl h-12 shadow-xl border border-white/20 text-xs uppercase tracking-widest"
                >
                   2. Confirmados (Presentes)
                </Button>
              </div>
            </CardHeader>
          </Card>
        </div>
      </motion.div>

      {/* Modal de Cadastro Manual */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-3xl"
          >
            <div className="p-8 md:p-10 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-display font-bold text-white">Novo Participante</h3>
                <p className="text-white/40 text-sm mt-1">Insira os dados para gerar um novo código.</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowAddModal(false)}
                className="rounded-full hover:bg-white/10 text-white/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-8 md:p-10 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest ml-1">Nome Completo</label>
                  <Input 
                    required 
                    className="liquid-input h-12" 
                    value={newParticipante.nome}
                    onChange={e => setNewParticipante({...newParticipante, nome: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest ml-1">E-mail</label>
                  <Input 
                    type="email" 
                    required 
                    className="liquid-input h-12" 
                    value={newParticipante.email}
                    onChange={e => setNewParticipante({...newParticipante, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest ml-1">Telefone</label>
                  <Input 
                    required 
                    className="liquid-input h-12" 
                    value={newParticipante.telefone}
                    onChange={e => setNewParticipante({...newParticipante, telefone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest ml-1">Cidade</label>
                  <Input 
                    required 
                    className="liquid-input h-12" 
                    value={newParticipante.cidade}
                    onChange={e => setNewParticipante({...newParticipante, cidade: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest ml-1">Escola</label>
                  <Input 
                    required 
                    className="liquid-input h-12" 
                    value={newParticipante.escola}
                    onChange={e => setNewParticipante({...newParticipante, escola: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest ml-1">Grêmio Estudantil</label>
                  <Input 
                    className="liquid-input h-12" 
                    value={newParticipante.gremio}
                    onChange={e => setNewParticipante({...newParticipante, gremio: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 h-12 rounded-2xl border-white/10 text-white font-bold"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold"
                >
                  Confirmar Cadastro
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  description, 
  color = 'neutral',
  trend
}: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode; 
  description: string;
  color?: 'neutral' | 'blue' | 'green' | 'purple',
  trend?: string
}) {
  return (
    <motion.div 
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
      }}
      whileHover={{ y: -5 }}
    >
      <Card className="glass-card border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.08] transition-all bg-white/[0.02]">
        <CardHeader className="flex flex-row items-center justify-between p-8 pb-3">
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 leading-none">
            {title}
          </CardTitle>
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
            {icon}
          </div>
        </CardHeader>
        <CardContent className="p-8 pt-0 mt-4">
          <div className="text-4xl font-display font-bold text-white tracking-tighter mb-2">{value}</div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/30 font-medium italic">{description}</p>
            {trend && (
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-lg border",
                trend.includes('%') || trend.includes('+') 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                  : "bg-white/5 text-white/40 border-white/5"
              )}>
                {trend}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
