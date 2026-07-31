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
import { AtomSpinner } from '@/components/ui/AtomSpinner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const navigate = useNavigate();

  const { user, checkAuth } = useAuth();

  useEffect(() => {
    if (user && user.role === 'admin') {
      navigate('/admin');
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
      } catch (networkError) {
        // Erro de rede: backend offline ou sem conexão
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

      await checkAuth();
      toast.success('Login realizado com sucesso!');
      setLoginAttempts(0);
      navigate('/admin');
    } catch (error) {
      console.error('Login error inesperado:', error);
      toast.error('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-9rem)] px-4 md:px-6 py-8 md:py-12">
      {/* Logo above the card */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md flex flex-col items-center mb-8 space-y-4"
      >
        <div className="w-full flex items-center justify-center">
          <img
            src="/logo_oficial.png"
            alt="Instituto Olhar Jovem"
            className="h-16 sm:h-24 w-auto max-w-[88vw] object-contain -translate-x-4 sm:-translate-x-6"
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full max-w-md"
      >
        <Card className="glass-card shadow-3xl overflow-hidden border-white/[0.04]">
          <CardHeader className="text-left px-6 sm:px-12 pt-8 sm:pt-12 pb-2">
            <span className="text-primary font-bold text-[10px] uppercase tracking-[0.2em]">Faça login para continuar</span>
            <CardTitle className="font-display text-3xl font-extrabold tracking-tight text-white mt-1">Acesso da equipe</CardTitle>
          </CardHeader>
          <CardContent className="px-6 sm:px-12 pt-6 sm:pt-8 pb-8 sm:pb-12">
            <form id="login-form" onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/40 font-bold text-[10px] uppercase tracking-[0.2em]">E-mail</Label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10 group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="liquid-input pl-12 h-14 border-white/[0.05] focus:ring-primary rounded-2xl"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/40 font-bold text-[10px] uppercase tracking-[0.2em]">Senha</Label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10 group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="liquid-input pl-12 h-14 border-white/[0.05] focus:ring-primary rounded-2xl"
                    required
                  />
                </div>
              </div>

              {/* Remember Me and Forgot Password links */}
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.1em] pt-1">
                <label className="flex items-center gap-2 text-white/40 cursor-pointer hover:text-white/60 transition-colors">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded bg-input border-white/[0.1] text-primary focus:ring-0 cursor-pointer"
                  />
                  <span>Lembrar-me</span>
                </label>
                <a href="#" className="text-primary hover:text-primary-dark transition-colors" onClick={(e) => e.preventDefault()}>
                  Esqueceu a senha?
                </a>
              </div>

              <Button
                type="submit"
                className="modern-button w-full h-14 text-base font-bold uppercase tracking-wider mt-4"
                disabled={loading || (lockoutUntil !== null && Date.now() < lockoutUntil)}
              >
                {loading && <AtomSpinner className="w-5 h-5 mr-2 text-white" />}
                {loading ? 'Autenticando...' : (lockoutUntil && Date.now() < lockoutUntil ? 'Acesso Bloqueado' : 'Acessar')}
                {!loading && (!lockoutUntil || Date.now() >= lockoutUntil) && <ArrowRight className="w-5 h-5 ml-1" />}
              </Button>

            </form>
          </CardContent>
        </Card>

        {/* Footer links under the card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 flex flex-col items-center gap-3 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-white/20"
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
