import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Info, X } from 'lucide-react';

const CLARITY_ID = 'wxtq6jk07r';

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('cookie-consent');
      if (!consent) {
        setIsVisible(true);
      } else if (consent === 'accepted') {
        injectClarity();
      }
    } catch {
      setIsVisible(false);
    }
  }, []);

  const injectClarity = () => {
    const clarityWindow = window as Window & { clarity?: unknown };
    if (clarityWindow.clarity) return; // Already injected

    type ClarityFunction = ((...args: unknown[]) => void) & { q?: unknown[] };
    const win = window as unknown as Window & { clarity?: ClarityFunction };
    win.clarity = win.clarity || ((...args: unknown[]) => {
      win.clarity!.q = win.clarity!.q || [];
      win.clarity!.q.push(args);
    });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;

    const firstScript = document.getElementsByTagName('script')[0];
    firstScript?.parentNode?.insertBefore(script, firstScript);
  };

  const handleAccept = () => {
    try {
      localStorage.setItem('cookie-consent', 'accepted');
    } catch {}
    setIsVisible(false);
    injectClarity();
  };

  const handleDecline = () => {
    try {
      localStorage.setItem('cookie-consent', 'declined');
    } catch {}
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-0 md:p-6 pointer-events-none pb-[env(safe-area-inset-bottom)]"
        >
          <div className="max-w-4xl mx-auto bg-card/95 backdrop-blur-2xl border-t md:border border-white/10 p-4 sm:p-5 md:p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-6 rounded-t-3xl md:rounded-3xl shadow-[0_-10px_50px_rgba(0,0,0,0.5)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 pointer-events-auto relative overflow-hidden">
            {/* Decoração Visual */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary to-primary-dark opacity-50" />
            <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start gap-3 sm:gap-4 flex-1 relative z-10 pr-6 md:pr-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5 md:mt-0">
                <Info className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm sm:text-base mb-0.5 sm:mb-1">Valorizamos sua privacidade</h4>
                <p className="text-white/60 text-xs sm:text-sm leading-relaxed font-medium">
                  Utilizamos cookies e tecnologias similares para melhorar sua experiência no sistema. Ao clicar em "Aceitar", você concorda com o uso de cookies. Leia nossa <Link to="/politica-de-privacidade" className="text-primary hover:text-primary-dark underline underline-offset-4 transition-colors">Política de Privacidade</Link>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3 w-full md:w-auto relative z-10">
              <Button
                variant="outline"
                onClick={handleDecline}
                className="flex-1 md:flex-none border-white/10 hover:bg-white/5 text-white/70 hover:text-white rounded-xl h-10 sm:h-12 px-4 sm:px-6 font-bold text-[11px] sm:text-xs uppercase tracking-wider touch-press"
              >
                Recusar
              </Button>
              <Button
                onClick={handleAccept}
                className="modern-button flex-1 md:flex-none rounded-xl h-10 sm:h-12 px-6 sm:px-8 font-bold text-[11px] sm:text-xs uppercase tracking-wider touch-press"
              >
                Aceitar
              </Button>
            </div>
            
            <button
              onClick={handleDecline}
              className="absolute top-3.5 right-3.5 p-1 text-white/30 hover:text-white transition-colors md:hidden touch-press"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
