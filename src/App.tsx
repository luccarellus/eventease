/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Toaster } from './components/ui/event-toaster';
import CookieBanner from '@/components/CookieBanner';
import { motion } from 'motion/react';
import { Calendar, UserCheck, LayoutDashboard, LogOut, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { initRecaptcha } from '@/lib/recaptcha';
import { AtomSpinner } from '@/components/ui/AtomSpinner';

const Home = lazy(() => import('@/pages/Home'));
const Confirm = lazy(() => import('@/pages/Confirm'));
const Admin = lazy(() => import('@/pages/Admin'));
const Login = lazy(() => import('@/pages/Login'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/TermsOfService'));

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  isActive: (pathname: string, search: string) => boolean;
};

const PUBLIC_NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Eventos',
    icon: <Calendar className="w-4 h-4" />,
    isActive: (pathname, search) => pathname === '/' && !search.includes('buscar-credencial'),
  },
  {
    to: '/?buscar-credencial=true',
    label: 'Minha Credencial',
    icon: <UserCheck className="w-4 h-4" />,
    isActive: (_, search) => search.includes('buscar-credencial'),
  },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    to: '/confirmar',
    label: 'Check-in',
    icon: <UserCheck className="w-4 h-4" />,
    isActive: (pathname) => pathname === '/confirmar',
  },
  {
    to: '/admin',
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    isActive: (pathname) => pathname === '/admin',
  },
];

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <AtomSpinner className="w-16 h-16 text-primary" />
    </div>
  );
}

function Navbar() {
  const location = useLocation();
  const { userIsAdmin, signOut } = useAuth();
  const navItems = userIsAdmin ? ADMIN_NAV_ITEMS : PUBLIC_NAV_ITEMS;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src="/logo_oficial.png"
            alt="Olhar Jovem"
            className="h-8 md:h-12 w-auto transition-transform group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
        </Link>

        <div className="hidden md:flex items-center gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              active={item.isActive(location.pathname, location.search)}
            />
          ))}

          {userIsAdmin && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('sync-data'));
                  toast.success('Dados sincronizados!');
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all text-white/40 hover:text-white hover:bg-white/5 h-auto bg-transparent hover:bg-white/5 active:scale-95"
              >
                <RefreshCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Sincronizar</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all text-white/50 hover:text-red-400 hover:bg-red-500/10 h-auto active:scale-95"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function BottomNav() {
  const location = useLocation();
  const { userIsAdmin } = useAuth();
  const navItems = userIsAdmin ? ADMIN_NAV_ITEMS : PUBLIC_NAV_ITEMS;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-black/70 backdrop-blur-3xl saturate-150 border-t border-white/10 rounded-t-3xl p-2 pb-6 flex items-center justify-around shadow-[0_-10px_40px_rgba(0,0,0,0.8)] pointer-events-auto"
      >
        {navItems.map((item) => (
          <MobileNavLink
            key={item.to}
            to={item.to}
            icon={item.icon}
            active={item.isActive(location.pathname, location.search)}
          />
        ))}
      </motion.div>
    </div>
  );
}

function MobileNavLink({ to, icon, active }: { to: string; icon: React.ReactNode; active: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-500',
        active
          ? 'bg-primary text-white shadow-lg shadow-primary/40 scale-110 -translate-y-2'
          : 'text-white/30 hover:text-white/60',
      )}
    >
      {icon}
    </Link>
  );
}

function NavLink({ to, icon, label, active }: { to: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all',
        active
          ? 'bg-white/10 text-white border border-white/10 shadow-sm'
          : 'text-white/40 hover:text-white hover:bg-white/5',
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

export default function App() {
  useEffect(() => {
    initRecaptcha();
  }, []);

  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

function AppContent() {
  const { userIsAdmin } = useAuth();

  return (
    <div className="min-h-[100dvh] pt-20 md:pt-24 pb-32 md:pb-12 overflow-x-hidden selection:bg-primary/30 flex flex-col">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 md:px-6 flex-grow">
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/eventos" element={<Home />} />
            <Route
              path="/confirmar"
              element={
                <ProtectedRoute>
                  <Confirm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/politica-de-privacidade" element={<PrivacyPolicy />} />
            <Route path="/termos" element={<TermsOfService />} />
          </Routes>
        </Suspense>
      </main>

      {!userIsAdmin && (
        <footer className="mt-auto py-8 text-center opacity-40 hover:opacity-100 transition-opacity">
          <Link to="/login" className="text-xs uppercase tracking-[0.2em] font-bold text-white hover:text-primary">
            Staff/Organização
          </Link>
        </footer>
      )}

      <p className="px-4 pb-20 text-center text-[10px] text-white/30 md:pb-4">
        Este site é protegido pelo reCAPTCHA e se aplicam a{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="underline hover:text-white/60">
          Política de Privacidade
        </a>{' '}
        e os{' '}
        <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="underline hover:text-white/60">
          Termos de Serviço
        </a>{' '}
        do Google.
      </p>

      <BottomNav />
      <CookieBanner />
      <Toaster theme="dark" position="top-center" expand={true} richColors />
    </div>
  );
}
