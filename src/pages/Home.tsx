import React, { useState } from 'react';
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
import { CheckCircle2, Copy, Download, UserPlus, Building2, Mail, Phone, ArrowRight, AlertCircle } from 'lucide-react';
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

const copyCode = () => {
  if (successData) {
    navigator.clipboard.writeText(successData.codigo);
    toast.info('Código copiado!');
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
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 text-primary text-xs md:text-sm font-semibold mb-6 border border-white/10 backdrop-blur-sm shadow-xl"
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
        className="heading-display text-4xl md:text-7xl mb-6 md:mb-8 text-white leading-[1.1] md:leading-[1.05] tracking-tight"
      >
        Evento <br /> <span className="bg-gradient-to-r from-emerald-400 to-teal-600 bg-clip-text text-transparent">Olhar Jovem</span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed"
      >
        O futuro da liderança começa aqui. Cadastre-se agora para garantir sua credencial digital exclusiva.
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
                    Preencha os dados e gere seu check-in digital.
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
                <div className="p-10 bg-white/[0.03] rounded-[2.5rem] border border-white/[0.08] flex flex-col items-center space-y-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-white/30">Código da Credencial</p>
                  <span className="font-display text-6xl font-black tracking-tighter text-white drop-shadow-lg">
                    {successData.codigo}
                  </span>
                  <Button variant="ghost" size="sm" onClick={copyCode} className="text-white/60 hover:text-white hover:bg-white/10 rounded-2xl gap-2 text-xs font-bold transition-all px-6 h-10 mt-4 border border-white/5">
                    <Copy className="w-4 h-4" /> Copiar Código
                  </Button>
                </div>

                <div className="flex flex-col items-center space-y-8">
                  <div className="p-10 bg-white rounded-[3rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] border-4 border-white/10">
                    <QRCodeSVG
                      value={successData.codigo}
                      size={220}
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
          description="Receba sua credencial e a salve para apresentar no dia do evento."
          color="bg-teal-500/10"
        />
        <BentoItem
          icon={<Building2 className="w-6 h-6 text-emerald-400" />}
          title="Sede do Evento"
          description="Fique por dentro da localização e horários de check-in."
          color="bg-emerald-500/10"
        />
        <BentoItem
          icon={<Phone className="w-6 h-6 text-orange-400" />}
          title="Suporte Direto"
          description="Dúvidas? Entre em contato com nossa equipe para mais informações."
          color="bg-orange-500/10"
        />
      </div>
    </div>
  </div>
);
}

function BentoItem({ icon, title, description, color }: { icon: React.ReactNode; title: string; description: string; color: string }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="glass-card p-8 group border-white/[0.08] relative overflow-hidden h-full"
    >
      <div className={cn("inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-6 border border-white/5", color)}>
        {icon}
      </div>
      <h3 className="font-display font-bold text-xl text-white mb-3 tracking-tight group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-sm text-white/40 leading-relaxed font-medium">{description}</p>

      {/* Decorative gradient overlay */}
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all" />
    </motion.div>
  );
}
