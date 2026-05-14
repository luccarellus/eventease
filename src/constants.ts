
/**
 * Verifica se um usuário tem permissões de administrador.
 * 
 * ATUALIZAÇÃO: Agora, qualquer usuário que esteja cadastrado e autenticado 
 * no seu painel do Supabase é tratado automaticamente como administrador.
 * Não é mais necessário listar os e-mails manualmente aqui.
 */
export const isAdmin = (email: string | undefined | null): boolean => {
  // Se o usuário possui um e-mail (está autenticado), ele é considerado admin
  return !!email;
};
