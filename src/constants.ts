export const isAdmin = (email: string | undefined | null): boolean => {
  // Retorna true para qualquer usuário autenticado (que tenha e-mail),
  // tornando todos os usuários cadastrados em administradores.
  return !!email;
};
