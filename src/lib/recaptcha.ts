type RecaptchaAction = 'participant_create' | 'participant_lookup' | 'registration_create';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: RecaptchaAction }) => Promise<string>;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadRecaptcha(siteKey: string): Promise<void> {
  if (window.grecaptcha) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não foi possível carregar o reCAPTCHA.'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Pré-carrega o reCAPTCHA assim que a aplicação inicia,
 * para que o badge de proteção fique visível desde o primeiro acesso.
 */
export function initRecaptcha(): void {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim();
  if (siteKey) {
    loadRecaptcha(siteKey).catch(() => {
      // falha silenciosa — o executeRecaptcha() lançará erro se necessário
    });
  }
}

export async function executeRecaptcha(action: RecaptchaAction): Promise<string> {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim();
  if (!siteKey) throw new Error('reCAPTCHA não configurado.');

  await loadRecaptcha(siteKey);
  const recaptcha = window.grecaptcha;
  if (!recaptcha) throw new Error('reCAPTCHA indisponível.');

  await new Promise<void>((resolve) => recaptcha.ready(resolve));
  return recaptcha.execute(siteKey, { action });
}
