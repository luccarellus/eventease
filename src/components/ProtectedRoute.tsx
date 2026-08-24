import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Permission, Role } from '@/types/rbac';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: (Role | string)[];
  requiredPermissions?: Permission[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  requiredPermissions,
}) => {
  const { user, loading, isSuperAdmin, hasRole, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-neutral-500 font-medium tracking-tight">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  // Usuário não autenticado
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se for super_admin, tem acesso irrestrito
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Validação por papéis requeridos
  if (requiredRoles && requiredRoles.length > 0) {
    if (!hasRole(requiredRoles)) {
      // Se for staff tentando acessar dashboard restrito, redireciona para tela de checkin
      if (user.role === Role.STAFF) {
        return <Navigate to="/confirmar" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  // Validação por permissões requeridas
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAll = requiredPermissions.every((perm) => hasPermission(perm));
    if (!hasAll) {
      if (user.role === Role.STAFF) {
        return <Navigate to="/confirmar" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  // Por padrão, se não informou restrição específica, exige ser pelo menos um membro com cargo (não usuário público sem privilégio)
  if (user.role === Role.USER) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
