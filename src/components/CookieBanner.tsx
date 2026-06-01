import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Info, X } from 'lucide-react';

const CLARITY_ID = 'wxtq6jk07r';

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setIsVisible(true);
    } else if (consent === 'accepted') {
      injectClarity();
    }
  }, []);

  const injectClarity = () => {
    if ((window as any).clarity) return; // Already injected
    
    // Configura o script do Clarity
    (function(c: any, l: any, a: string, r: string, i: string, t?: any, y?: any) {
        c[a] = c[a] || function() { (c[a].q = c[a].q || []).push(arguments) };
        t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
        y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", CLARITY_ID);
  };

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setIsVisible(false);
    injectClarity();
  };

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined');
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
          className="fixed bottom-0 left-0 right-0 z-[100] p-0 md:p-6 pointer-events-none"
        >
          <div className="max-w-4xl mx-auto bg-neutral-950/90 backdrop-blur-2xl border-t md:border border-white/10 p-5 pb-8 md:pb-6 md:p-6 rounded-t-3xl md:rounded-3xl shadow-[0_-10px_50px_rgba(0,0,0,0.5)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pointer-events-auto relative overflow-hidden">
            {/* Decoração Visual */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-primary to-teal-500 opacity-50" />
            <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start gap-4 flex-1 relative z-10">
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-1 md:mt-0">
                <Info className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="text-white font-bold text-base mb-1">Valorizamos sua privacidade</h4>
                <p className="text-white/60 text-sm leading-relaxed font-medium">
                  Utilizamos cookies e tecnologias similares para melhorar sua experiência em nosso sistema, personalizar conteúdo e analisar o tráfego. Ao clicar em "Aceitar", você concorda com o uso de cookies. Leia nossa <Link to="/politica-de-privacidade" className="text-primary hover:text-emerald-400 underline underline-offset-4 transition-colors">Política de Privacidade</Link> para mais detalhes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto relative z-10">
              <Button
                variant="outline"
                onClick={handleDecline}
                className="flex-1 md:flex-none border-white/10 hover:bg-white/5 text-white/70 hover:text-white rounded-xl h-12 px-6 font-bold text-xs uppercase tracking-wider"
              >
                Recusar
              </Button>
              <Button
                onClick={handleAccept}
                className="modern-button flex-1 md:flex-none rounded-xl h-12 px-8 font-bold text-xs uppercase tracking-wider"
              >
                Aceitar
              </Button>
            </div>
            
            <button
              onClick={handleDecline}
              className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors md:hidden"
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
