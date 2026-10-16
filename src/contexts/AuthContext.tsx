import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setActiveTenantId } from '@/lib/api';
import { Permission, Role, hasPermission as checkPermission, getRolePermissions } from '@/types/rbac';
import { Tenant } from '@/types/tenant';

export interface User {
  id: string;
  email: string;
  role: Role | string;
  fullName?: string | null;
  tenantId?: string | null;
  tenant?: Tenant | null;
  permissions?: Permission[];
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  userIsAdmin: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isOrganizer: boolean;
  isStaff: boolean;
  isViewer: boolean;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (roles: (Role | string)[]) => boolean;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/me');
      if (res.ok) {
        const data = await res.json();
        const userData: User = data.user;
        setUser(userData);
        if (userData.tenantId) {
          setActiveTenantId(userData.tenantId);
        }
        try {
          localStorage.setItem('eventease_has_session', 'true');
        } catch {}
        return;
      }

      // Se 401 e o usuário possuía uma sessão anterior ativa, tenta renovar via refresh token.
      // Se for um visitante anônimo (nunca logou), não dispara requisição redundante.
      const hasPreviousSession = typeof window !== 'undefined' && localStorage.getItem('eventease_has_session') === 'true';
      if (res.status === 401 && hasPreviousSession) {
        const refreshRes = await api.post('/auth/refresh', {});
        if (refreshRes.ok) {
          const retryRes = await api.get('/auth/me');
          if (retryRes.ok) {
            const data = await retryRes.json();
            const userData: User = data.user;
            setUser(userData);
            if (userData.tenantId) {
              setActiveTenantId(userData.tenantId);
            }
            return;
          }
        }
        try {
          localStorage.removeItem('eventease_has_session');
        } catch {}
      }

      setUser(null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  const signOut = async () => {
    try {
      await api.post('/auth/logout', {});
    } finally {
      try {
        localStorage.removeItem('eventease_has_session');
      } catch {}
      setUser(null);
    }
  };

  const isSuperAdmin = user?.role === Role.SUPER_ADMIN;
  const isAdmin = isSuperAdmin || user?.role === Role.ADMIN;
  const isOrganizer = isAdmin || user?.role === Role.ORGANIZER;
  const isStaff = isOrganizer || user?.role === Role.STAFF;
  const isViewer = isStaff || user?.role === Role.VIEWER;

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false;
      if (isSuperAdmin) return true;
      return checkPermission(user.role, permission);
    },
    [user, isSuperAdmin],
  );

  const hasRole = useCallback(
    (roles: (Role | string)[]): boolean => {
      if (!user) return false;
      if (isSuperAdmin) return true;
      return roles.includes(user.role);
    },
    [user, isSuperAdmin],
  );

  const value: AuthContextType = {
    user,
    loading,
    userIsAdmin: isAdmin,
    isSuperAdmin,
    isAdmin,
    isOrganizer,
    isStaff,
    isViewer,
    hasPermission,
    hasRole,
    signOut,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
