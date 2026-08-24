import React from 'react';
import { Role } from '@/types/rbac';
import { useAuth } from '@/contexts/AuthContext';

interface HasRoleProps {
  roles: (Role | string)[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const HasRole: React.FC<HasRoleProps> = ({
  roles,
  fallback = null,
  children,
}) => {
  const { hasRole: checkRole } = useAuth();

  if (!checkRole(roles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
