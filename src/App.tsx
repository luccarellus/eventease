/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Toaster } from './components/ui/event-toaster';
import Home from '@/pages/Home';
import Confirm from '@/pages/Confirm';
import Admin from '@/pages/Admin';
import Login from '@/pages/Login';
import Events from '@/pages/Events';
import { supabase } from '@/lib/supabase';
import { isAdmin } from '@/constants';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, UserCheck, LayoutDashboard, LogIn, ShieldCheck, LogOut, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function Navbar() {
  const location = useLocation();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const userIsAdmin = session ? isAdmin(session.user?.email) : false;

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
              <NavLink to="/" icon={<UserPlus className="w-4 h-4" />} label="Cadastro" active={location.pathname === '/'} />
              <NavLink to="/eventos" icon={<Calendar className="w-4 h-4" />} label="Eventos" active={location.pathname === '/eventos'} />
            </>
          )}
          
          {userIsAdmin && (
            <>
              <NavLink to="/confirmar" icon={<UserCheck className="w-4 h-4" />} label="Check-in" active={location.pathname === '/confirmar'} />
              <NavLink to="/admin" icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" active={location.pathname === '/admin'} />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => supabase.auth.signOut()}
                className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl flex items-center gap-2"
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
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const userIsAdmin = session ? isAdmin(session.user?.email) : false;

  if (!userIsAdmin && location.pathname === '/') return null;

  return (
    <div className="md:hidden fixed bottom-6 left-6 right-6 z-50 pointer-events-none">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-2 flex items-center justify-around shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-auto"
      >
        {!userIsAdmin && (
          <>
            <MobileNavLink to="/" icon={<UserPlus className="w-6 h-6" />} active={location.pathname === '/'} />
            <MobileNavLink to="/eventos" icon={<Calendar className="w-6 h-6" />} active={location.pathname === '/eventos'} />
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
        "flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-500",
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

export default function App() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    }).catch(err => console.error('Supabase session error:', err));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const userIsAdmin = session ? isAdmin(session.user?.email) : false;

  return (
    <Router>
      <div className="min-h-screen pt-24 pb-32 md:pb-12 overflow-x-hidden selection:bg-primary/30 flex flex-col">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 md:px-6 flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/eventos" element={<Events />} />
            <Route path="/confirmar" element={<Confirm />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>
        
        {!userIsAdmin && (
          <footer className="mt-auto py-8 text-center opacity-40 hover:opacity-100 transition-opacity">
            <Link to="/login" className="text-xs uppercase tracking-[0.2em] font-bold text-white hover:text-primary">
              Portal do Organizador
            </Link>
          </footer>
        )}

        <BottomNav />
        <Toaster theme="dark" position="top-center" expand={true} richColors />
      </div>
    </Router>
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
