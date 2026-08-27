import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
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
            <ShieldCheck className="w-10 h-10 text-primary" />
            Política de Privacidade
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
          <h2 className="text-2xl font-bold text-white mb-4">1. Coleta de Dados Pessoais</h2>
          <p className="mb-4">
            O EventEase coleta dados pessoais estritamente necessários para o funcionamento do sistema de credenciamento e gestão de eventos. Os dados coletados incluem:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li><strong>Nome Completo:</strong> Para identificação na credencial do evento.</li>
            <li><strong>Endereço de E-mail:</strong> Para comunicação, confirmação de cadastro e busca de credenciais.</li>
            <li><strong>Número de Telefone/WhatsApp:</strong> Para contato em caso de necessidades do evento.</li>
            <li><strong>Instituição de Ensino e Cidade:</strong> Para fins estatísticos e organização da participação das escolas.</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">2. Uso de Cookies e Analytics</h2>
          <p className="mb-4">
            Utilizamos o <strong>Microsoft Clarity</strong> para entender como você interage com nossa plataforma. O Clarity utiliza cookies de rastreamento primários e de terceiros para gerar mapas de calor (heatmaps) e gravações de sessão que nos ajudam a otimizar a experiência do usuário. 
          </p>
          <p className="mb-4">
            Garantimos que a coleta de dados de comportamento só ocorre mediante seu <strong>consentimento explícito</strong> no aviso de cookies. Campos sensíveis como senhas e e-mails são automaticamente mascarados e não são registrados visualmente.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">3. Proteção e Retenção de Dados</h2>
          <p className="mb-4">
            Armazenamos suas informações em bancos de dados seguros hospedados em infraestrutura própria, com controle de acesso rigoroso para evitar acessos não autorizados. Seus dados são retidos apenas pelo tempo necessário para a execução do evento e fins legais associados.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">4. Direitos do Titular (LGPD)</h2>
          <p className="mb-4">
            Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você possui o direito de solicitar a visualização, alteração, portabilidade ou a <strong>exclusão completa</strong> dos seus dados de nossos sistemas a qualquer momento.
          </p>
          <p>
            Para exercer seus direitos, entre em contato conosco através do e-mail oficial da organização do evento.
          </p>
        </section>
      </motion.div>
    </div>
  );
}
