import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formata um número de telefone brasileiro no padrão (99) 99999-9999
 * enquanto o usuário digita. Aceita também números colados em outros
 * formatos (ex.: 11999998888, (11)99999-8888 ou +55 11 99999-8888).
 *
 * - 10 dígitos  -> (99) 9999-9999 (fixo)
 * - 11 dígitos  -> (99) 99999-9999 (celular)
 */
export function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, '');

  // Remove o código do país (+55) quando o número completo for colado
  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.slice(2);
  }

  digits = digits.slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
