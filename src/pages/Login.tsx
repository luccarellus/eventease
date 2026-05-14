import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { isAdmin } from '@/constants';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkLogged = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && isAdmin(session.user?.email)) {
          navigate('/admin');
        }
      } catch (e) {
        console.error('Check logged error:', e);
      }
    };
    checkLogged();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user && !isAdmin(data.user.email)) {
        toast.error('Acesso restrito. Sua conta não tem permissões de administrador.');
        await supabase.auth.signOut();
        return;
      }

      toast.success('Login realizado com sucesso!');
      navigate('/admin');
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error('Erro ao realizar login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="glass-card shadow-3xl border-white/[0.08] overflow-hidden">
          <CardHeader className="text-center p-12 border-b border-white/[0.08] bg-white/[0.02]">
            <CardTitle className="font-display text-3xl tracking-tight text-white mb-2">Portal Administrativo</CardTitle>
            <CardDescription className="text-white/40 font-medium text-base">
              Acesso exclusivo para administradores autorizados.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-12 pb-10">
            <form id="login-form" onSubmit={handleLogin} className="space-y-8">
              <div className="space-y-3">
                <Label htmlFor="email" className="text-white/40 font-bold text-[10px] uppercase tracking-[0.2em]">Credencial de E-mail</Label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10 group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="liquid-input pl-12 h-14 border-white/[0.05] focus:ring-primary rounded-2xl"
                    required
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-white/40 font-bold text-[10px] uppercase tracking-[0.2em]">Chave de Acesso</Label>
                </div>
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
              <Button
                type="submit"
                className="modern-button w-full h-14 text-base shadow-2xl"
                disabled={loading}
              >
                {loading ? 'Autenticando...' : 'Entrar no Sistema'}
                {!loading && <ArrowRight className="w-5 h-5 ml-2" />}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="bg-white/[0.01] flex flex-col p-8 items-center border-t border-white/[0.08]">
            <p className="text-[10px] text-white/10 text-center leading-relaxed font-black uppercase tracking-[0.3em]">
              Protocolo de Segurança Ativo
            </p>
          </CardFooter>
        </Card>

        {/* Helper for Configuration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-10 p-6 bg-white/[0.02] border border-white/[0.08] rounded-3xl backdrop-blur-xl"
        >
          <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-3 flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-primary" /> Sugestão de Setup
          </p>
          <p className="text-white/30 text-xs leading-relaxed font-medium">
            O acesso é protegido por políticas RLS de nível empresarial.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
