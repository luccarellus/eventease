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

  // Garante que a URL comece com http:// ou https://
  if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }

  return cleanUrl;
};

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseUrl = sanitizeUrl(rawUrl);
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Validação extra para evitar erro de inicialização que causa tela branca
const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const finalUrl = isValidUrl(supabaseUrl) ? supabaseUrl : 'https://placeholder.supabase.co';
const finalKey = supabaseAnonKey && supabaseAnonKey !== 'placeholder' ? supabaseAnonKey : 'placeholder';

if (!isValidUrl(supabaseUrl) || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
  console.warn(
    '⚠️ Configuração do Supabase incompleta ou inválida.\n' +
    'URL detectada:', supabaseUrl || 'ausente', '\n' +
    'Verifique se as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão configuradas corretamente no Vercel.'
  );
}

export const supabase = createClient(finalUrl, finalKey);
