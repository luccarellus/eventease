export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  logoUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    users?: number;
    eventos?: number;
    participantes?: number;
  };
}

export interface TenantContextType {
  currentTenant: Tenant | null;
  tenantList: Tenant[];
  loadingTenant: boolean;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshTenants: () => Promise<void>;
}
