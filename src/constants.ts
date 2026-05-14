
export const ADMIN_EMAILS = [
  "lucashybriah@gmail.com", "presidente@olharjovem.org"// Administrador Principal
  // Para adicionar novos admins, basta colocar o e-mail abaixo (sempre em letras minúsculas):
  // "outro-email@exemplo.com",
];

export const isAdmin = (email: string | undefined): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};
