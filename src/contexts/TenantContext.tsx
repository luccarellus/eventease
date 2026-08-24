import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Tenant, TenantContextType } from '@/types/tenant';
import { api, getActiveTenantId, setActiveTenantId } from '@/lib/api';

const TenantContext = createContext<TenantContextType | null>(null);

export const TenantProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [tenantList, setTenantList] = useState<Tenant[]>([]);
  const [loadingTenant, setLoadingTenant] = useState(true);

  const fetchCurrentTenant = useCallback(async () => {
    try {
      const res = await api.get('/tenants/current');
      if (res.ok) {
        const data: Tenant = await res.json();
        setCurrentTenant(data);
        setActiveTenantId(data.id);
      }
    } catch (error) {
      console.error('[TenantContext] Falha ao carregar organização atual:', error);
    }
  }, []);

  const fetchTenantList = useCallback(async () => {
    try {
      const res = await api.get('/tenants');
      if (res.ok) {
        const list: Tenant[] = await res.json();
        setTenantList(list);
      }
    } catch {
      // Normal para usuários sem privilégio de super_admin
    }
  }, []);

  const refreshTenants = useCallback(async () => {
    setLoadingTenant(true);
    try {
      await Promise.allSettled([fetchCurrentTenant(), fetchTenantList()]);
    } finally {
      setLoadingTenant(false);
    }
  }, [fetchCurrentTenant, fetchTenantList]);

  const switchTenant = async (tenantId: string) => {
    setLoadingTenant(true);
    try {
      setActiveTenantId(tenantId);
      const res = await api.get('/tenants/current');
      if (res.ok) {
        const data: Tenant = await res.json();
        setCurrentTenant(data);
      }
      // Notifica componentes para sincronizarem seus dados com o novo tenant
      window.dispatchEvent(new CustomEvent('sync-data'));
      window.dispatchEvent(new CustomEvent('tenant-changed', { detail: { tenantId } }));
    } finally {
      setLoadingTenant(false);
    }
  };

  useEffect(() => {
    // Verifica se veio um parâmetro de tenant na URL (ex: ?tenant=meu-slug ou ?tenantId=...)
    const params = new URLSearchParams(window.location.search);
    const tenantParam = params.get('tenant') || params.get('tenantId') || params.get('tenantSlug');
    if (tenantParam) {
      setActiveTenantId(tenantParam);
    }

    void refreshTenants();
  }, [refreshTenants]);

  const value: TenantContextType = {
    currentTenant,
    tenantList,
    loadingTenant,
    switchTenant,
    refreshTenants,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant deve ser utilizado dentro de um TenantProvider');
  }
  return context;
};
