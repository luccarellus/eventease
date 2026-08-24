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
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Role } from '@/types/rbac';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const navigate = useNavigate();

  const { user, checkAuth } = useAuth();

  useEffect(() => {
    if (user) {
      if (user.role === Role.STAFF) {
        navigate('/confirmar');
      } else if (
        user.role === Role.SUPER_ADMIN ||
        user.role === Role.ADMIN ||
        user.role === Role.ORGANIZER ||
        user.role === Role.VIEWER
      ) {
        navigate('/admin');
      }
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lockoutUntil && Date.now() < lockoutUntil) {
      toast.error(`Muitas tentativas falhas. Tente novamente em ${Math.ceil((lockoutUntil - Date.now()) / 1000)} segundos.`);
      return;
    }

    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      let res: Response;
      try {
        res = await api.post('/auth/login', {
          email: cleanEmail,
          password,
        });
      } catch {
        toast.error('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        let errorMessage = 'Credenciais inválidas. Verifique seu e-mail e senha.';
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        } catch { }

        toast.error(errorMessage);

        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);

        if (newAttempts >= 3) {
          const lockoutTime = Date.now() + 30000;
          setLockoutUntil(lockoutTime);
          toast.error('Muitas tentativas falhas. Acesso bloqueado temporariamente por 30 segundos.');
          setTimeout(() => {
            setLoginAttempts(0);
            setLockoutUntil(null);
          }, 30000);
        }
        return;
      }

      const loginData = await res.json();
      await checkAuth();
      toast.success('Login realizado com sucesso!');
      setLoginAttempts(0);

      const loggedRole = loginData.user?.role;
      if (loggedRole === Role.STAFF) {
        navigate('/confirmar');
      } else {
        navigate('/admin');
      }
    } catch (error) {
      console.error('Login error inesperado:', error);
      toast.error('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-7rem)] px-3 sm:px-4 md:px-6 py-4 sm:py-8 md:py-12">
      {/* Logo above the card */}
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
            <span className="text-primary font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.2em]">Faça login para continuar</span>
            <CardTitle className="font-display text-xl sm:text-3xl font-extrabold tracking-tight text-white mt-0.5 sm:mt-1">Acesso da equipe</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-12 pt-4 sm:pt-8 pb-5 sm:pb-12">
            <form id="login-form" onSubmit={handleLogin} className="space-y-3.5 sm:space-y-6">
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
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="liquid-input pl-10 sm:pl-12 h-11 sm:h-14 text-sm border-white/[0.05] focus:ring-primary rounded-xl sm:rounded-2xl"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 sm:h-14 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl sm:rounded-2xl text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.2em] shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all flex items-center justify-center gap-2 group cursor-pointer"
                >
                  {loading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <span>Entrar no Sistema</span>
                      <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <p className="text-xs text-white/40">
                Primeiro acesso da instituição?{' '}
                <Link to="/cadastro" className="text-primary hover:underline font-semibold">
                  Criar conta
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
