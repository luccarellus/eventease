import React from 'react';
import { motion } from 'motion/react';
import { FileText, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div>
          <Link to="/" className="inline-flex items-center gap-2 text-white/40 hover:text-primary transition-colors text-xs font-bold uppercase tracking-wider mb-6">
            <ArrowLeft className="w-4 h-4" />
            Voltar para o Início
          </Link>
          <h1 className="heading-display text-4xl md:text-5xl font-black text-white flex items-center gap-4">
            <FileText className="w-10 h-10 text-primary" />
            Termos de Uso
          </h1>
          <p className="text-white/50 mt-4 text-lg">Última atualização: 01 de Junho de 2026</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card bg-white/[0.02] border border-white/[0.08] p-8 md:p-12 rounded-[2.5rem] prose prose-invert max-w-none text-white/70"
      >
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">1. Aceitação dos Termos</h2>
          <p className="mb-4">
            Ao acessar e utilizar o portal Olhar Jovem Eventos (EventEase), você concorda integralmente com estes Termos de Uso. Caso não concorde com qualquer condição estabelecida, por favor, não utilize nossos serviços de credenciamento.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">2. Uso do Sistema de Credenciais</h2>
          <p className="mb-4">
            O sistema é destinado à inscrição e emissão de credenciais para eventos educacionais e culturais. O usuário se compromete a fornecer informações verdadeiras, exatas e atualizadas (como nome completo, escola e cidade). 
          </p>
          <p className="mb-4">
            O uso de identidades falsas ou a emissão de credenciais para terceiros sem autorização constitui violação destes termos e pode resultar no cancelamento imediato da inscrição.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">3. QR Code e Ingresso</h2>
          <p className="mb-4">
            O QR Code gerado pelo sistema é de uso pessoal e intransferível. A segurança e guarda da credencial são de responsabilidade exclusiva do participante. A organização do evento reserva-se o direito de exigir a apresentação de documento de identidade com foto para validar a credencial no local.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">4. Limitação de Responsabilidade</h2>
          <p className="mb-4">
            A organização não se responsabiliza por falhas de conectividade que impeçam o cadastro ou o carregamento da credencial na entrada do evento. Recomendamos que os usuários tirem uma captura de tela (print) ou baixem o código gerado para evitar imprevistos.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">5. Modificações</h2>
          <p className="mb-4">
            Estes termos podem ser alterados a qualquer momento pela administração do sistema para refletir melhorias ou exigências legais. Alterações significativas serão notificadas através da própria plataforma.
          </p>
        </section>
      </motion.div>
    </div>
  );
}
