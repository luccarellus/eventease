import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { Lock, Mail, ArrowRight, User } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { user } = useAuth();

  useEffect(() => {
    if (user && user.role === 'admin') {
      navigate('/admin');
    }
  }, [user, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      let res: Response;
      try {
        res = await api.post('/auth/register', {
          email: cleanEmail,
          password,
          fullName: fullName || undefined,
        });
      } catch (networkError) {
        toast.error('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        let errorMessage = 'Erro ao criar conta. Verifique os dados informados.';
        try {
          const errorData = await res.json();
          if (Array.isArray(errorData.message)) {
            errorMessage = errorData.message.join('. ');
          } else {
            errorMessage = errorData.message || errorMessage;
          }
        } catch { }

        toast.error(errorMessage);
        return;
      }

      const data = await res.json();

      if (data.claimed) {
        toast.success('Conta reivindicada com sucesso! Faça login com sua nova senha.');
      } else {
        toast.success('Conta criada com sucesso! Faça login.');
      }

      navigate('/login');
    } catch (error) {
      console.error('Register error inesperado:', error);
      toast.error('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-7rem)] px-3 sm:px-4 md:px-6 py-4 sm:py-8 md:py-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md flex flex-col items-center mb-4 sm:mb-8 space-y-2 sm:space-y-4"
      >
        <div className="w-full flex items-center justify-center">
          <img
            src="/logo_oficial.png"
            alt="Instituto Olhar Jovem"
            className="h-12 sm:h-24 w-auto max-w-[85vw] object-contain -translate-x-3 sm:-translate-x-6"
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full max-w-md"
      >
        <Card className="glass-card shadow-3xl overflow-hidden border-white/[0.04] rounded-2xl sm:rounded-3xl">
          <CardHeader className="text-left px-4 sm:px-12 pt-4 sm:pt-12 pb-1 sm:pb-2">
            <span className="text-primary font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.2em]">Criar conta de equipe</span>
            <CardTitle className="font-display text-xl sm:text-3xl font-extrabold tracking-tight text-white mt-0.5 sm:mt-1">Cadastro</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-12 pt-4 sm:pt-8 pb-5 sm:pb-12">
            <form id="register-form" onSubmit={handleRegister} className="space-y-3.5 sm:space-y-6">
              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="fullName" className="text-white/40 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.2em]">Nome completo</Label>
                <div className="relative group">
                  <User className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-white/10 group-focus-within:text-primary transition-colors" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="liquid-input pl-10 sm:pl-12 h-11 sm:h-14 text-sm border-white/[0.05] focus:ring-primary rounded-xl sm:rounded-2xl"
                  />
                </div>
              </div>

              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="email" className="text-white/40 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.2em]">E-mail</Label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-white/10 group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="liquid-input pl-10 sm:pl-12 h-11 sm:h-14 text-sm border-white/[0.05] focus:ring-primary rounded-xl sm:rounded-2xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="password" className="text-white/40 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.2em]">Senha</Label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-white/10 group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 10 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="liquid-input pl-10 sm:pl-12 h-11 sm:h-14 text-sm border-white/[0.05] focus:ring-primary rounded-xl sm:rounded-2xl"
                    minLength={10}
                    required
                  />
                </div>
                <p className="text-[9px] sm:text-[10px] text-white/30 mt-0.5 sm:mt-1">
                  Mínimo 10 caracteres, com maiúscula, minúscula, número e caractere especial.
                </p>
              </div>

              <Button
                type="submit"
                className="modern-button w-full h-11 sm:h-14 text-xs sm:text-base font-bold uppercase tracking-wider mt-2 sm:mt-4 touch-press rounded-xl sm:rounded-2xl"
                disabled={loading}
              >
                {loading && <LoadingSpinner size="sm" variant="white" className="mr-2" />}
                {loading ? 'Criando conta...' : 'Criar conta'}
                {!loading && <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1" />}
              </Button>

              <div className="text-center text-xs sm:text-sm text-white/40 mt-3 sm:mt-4">
                Já tem conta?{' '}
                <Link to="/login" className="text-primary hover:text-primary-dark transition-colors font-bold">
                  Fazer login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-4 sm:mt-8 flex flex-col items-center gap-2 sm:gap-3 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-white/20"
        >
          <div className="flex gap-4">
            <Link to="/politica-de-privacidade" className="hover:text-white/40 transition-colors">Privacidade</Link>
            <Link to="/termos" className="hover:text-white/40 transition-colors">Cookies</Link>
          </div>
          <span>© 2026 Instituto Olhar Jovem</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
