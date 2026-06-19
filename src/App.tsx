/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Toaster } from './components/ui/event-toaster';
import Home from '@/pages/Home';
import Confirm from '@/pages/Confirm';
import Admin from '@/pages/Admin';
import Login from '@/pages/Login';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import TermsOfService from '@/pages/TermsOfService';
import CookieBanner from '@/components/CookieBanner';
import { motion } from 'motion/react';
import { Calendar, UserCheck, LayoutDashboard, LogOut, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

function Navbar() {
  const location = useLocation();
  const { userIsAdmin, signOut } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src="/logo_oficial.png"
            alt="Olhar Jovem"
            className="h-10 md:h-12 w-auto transition-transform group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
        </Link>

        <div className="hidden md:flex items-center gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
          {!userIsAdmin && (
            <>
              <NavLink to="/" icon={<Calendar className="w-4 h-4" />} label="Eventos" active={location.pathname === '/' && !location.search.includes('buscar-credencial')} />
              <NavLink to="/?buscar-credencial=true" icon={<UserCheck className="w-4 h-4" />} label="Minha Credencial" active={location.search.includes('buscar-credencial')} />
            </>
          )}

          {userIsAdmin && (
            <>
              <NavLink to="/confirmar" icon={<UserCheck className="w-4 h-4" />} label="Check-in" active={location.pathname === '/confirmar'} />
              <NavLink to="/admin" icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" active={location.pathname === '/admin'} />
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

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-black/70 backdrop-blur-3xl saturate-150 border-t border-white/10 rounded-t-3xl p-3 pb-8 flex items-center justify-around shadow-[0_-10px_40px_rgba(0,0,0,0.8)] pointer-events-auto"
      >
        {!userIsAdmin && (
          <>
            <MobileNavLink to="/" icon={<Calendar className="w-6 h-6" />} active={location.pathname === '/' && !location.search.includes('buscar-credencial')} />
            <MobileNavLink to="/?buscar-credencial=true" icon={<UserCheck className="w-6 h-6" />} active={location.search.includes('buscar-credencial')} />
          </>
        )}

        {userIsAdmin && (
          <>
            <MobileNavLink to="/confirmar" icon={<UserCheck className="w-6 h-6" />} active={location.pathname === '/confirmar'} />
            <MobileNavLink to="/admin" icon={<LayoutDashboard className="w-6 h-6" />} active={location.pathname.startsWith('/admin')} />
          </>
        )}
      </motion.div>
    </div>
  );
}

function MobileNavLink({ to, icon, active }: { to: string; icon: React.ReactNode; active: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all duration-500",
        active
          ? "bg-primary text-white shadow-lg shadow-primary/40 scale-110 -translate-y-2"
          : "text-white/30 hover:text-white/60"
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
        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
        active
          ? "bg-white/10 text-white border border-white/10 shadow-sm"
          : "text-white/40 hover:text-white hover:bg-white/5"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

const IS_MAINTENANCE_MODE = false;

function MaintenanceScreen() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-8">
        <div className="flex justify-center">
          <img src="/logo_oficial.png" alt="Olhar Jovem" className="h-16 md:h-20 w-auto" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Estamos em Manutenção</h1>
        <p className="text-white/60 text-lg md:text-xl leading-relaxed">
          Nosso sistema está passando por melhorias no momento. Voltaremos em breve com novidades!
        </p>
      </div>
    </div>
  );
}

export default function App() {
  if (IS_MAINTENANCE_MODE) {
    return <MaintenanceScreen />;
  }

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
    <div className="min-h-[100dvh] pt-24 pb-36 md:pb-12 overflow-x-hidden selection:bg-primary/30 flex flex-col">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 md:px-6 flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/eventos" element={<Home />} />
          <Route path="/confirmar" element={
            <ProtectedRoute>
              <Confirm />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          } />
          <Route path="/login" element={<Login />} />
          <Route path="/politica-de-privacidade" element={<PrivacyPolicy />} />
          <Route path="/termos" element={<TermsOfService />} />
        </Routes>
      </main>

      {!userIsAdmin && (
        <footer className="mt-auto py-8 text-center opacity-40 hover:opacity-100 transition-opacity">
          <Link to="/login" className="text-xs uppercase tracking-[0.2em] font-bold text-white hover:text-primary">
            Staff/Organização
          </Link>
        </footer>
      )}

      <BottomNav />
      <CookieBanner />
      <Toaster theme="dark" position="top-center" expand={true} richColors />
    </div>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -20, scale: 0.98, filter: 'blur(10px)' }}
      transition={{
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
        opacity: { duration: 0.4 }
      }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}
