
export const ADMIN_EMAILS = [
  "lucashybriah@gmail.com", 
  "presidente@olharjovem.org"
];

export const isAdmin = (email: string | undefined | null): boolean => {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();
  return ADMIN_EMAILS.some(admin => admin.trim().toLowerCase() === normalizedEmail);
};
