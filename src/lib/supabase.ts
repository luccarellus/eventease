import { createClient } from '@supabase/supabase-js';

// Função para limpar a URL (remover barras extras ou /rest/v1)
const sanitizeUrl = (url: string | undefined) => {
  if (!url) return '';
  let cleanUrl = url.trim();
  // Remove barra final
  if (cleanUrl.endsWith('/')) {
    cleanUrl = cleanUrl.slice(0, -1);
  }
  // Remove /rest/v1 se o usuário incluiu por engano
  if (cleanUrl.endsWith('/rest/v1')) {
    cleanUrl = cleanUrl.slice(0, -8);
  }
  return cleanUrl;
};

const supabaseUrl = sanitizeUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
  console.warn(
    'Configuração do Supabase incompleta. Certifique-se de definir VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no seu ambiente (Vercel).'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);
