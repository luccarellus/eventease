import React from 'react';
import { Permission } from '@/types/rbac';
import { useAuth } from '@/contexts/AuthContext';

interface HasPermissionProps {
  permission: Permission;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const HasPermission: React.FC<HasPermissionProps> = ({
  permission,
  fallback = null,
  children,
}) => {
  const { hasPermission: checkPerm } = useAuth();

  if (!checkPerm(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
