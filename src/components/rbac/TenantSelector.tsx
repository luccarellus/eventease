import React from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, ChevronDown, Check, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TenantSelector: React.FC<{ className?: string }> = ({ className }) => {
  const { currentTenant, tenantList, switchTenant } = useTenant();
  const { isSuperAdmin } = useAuth();

  if (!currentTenant) return null;

  // Se não for Super Admin e não tiver múltiplas organizações para trocar, exibe apenas a badge da organização
  if (!isSuperAdmin || tenantList.length <= 1) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white/80',
          className,
        )}
      >
        <Building2 className="w-3.5 h-3.5 text-primary" />
        <span className="truncate max-w-[150px]">{currentTenant.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-2 h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white/90 hover:bg-white/10 hover:text-white transition-all cursor-pointer outline-none',
          className,
        )}
      >
        <Building2 className="w-3.5 h-3.5 text-primary" />
        <span className="truncate max-w-[140px]">{currentTenant.name}</span>
        <ChevronDown className="w-3 h-3 text-white/40 ml-1" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-[#0a111e]/95 backdrop-blur-xl border-white/10 text-white rounded-xl shadow-2xl"
      >
        <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-white/50 font-normal px-2 py-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
          Organizações (Super Admin)
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        {tenantList.map((tenant) => {
          const isSelected = tenant.id === currentTenant.id;
          return (
            <DropdownMenuItem
              key={tenant.id}
              onClick={() => void switchTenant(tenant.id)}
              className={cn(
                'flex items-center justify-between px-2.5 py-2 text-xs rounded-lg cursor-pointer transition-colors',
                isSelected
                  ? 'bg-primary/20 text-white font-bold'
                  : 'text-white/70 hover:text-white hover:bg-white/5',
              )}
            >
              <div className="flex flex-col min-w-0 pr-2">
                <span className="truncate">{tenant.name}</span>
                <span className="text-[10px] text-white/40 truncate">@{tenant.slug}</span>
              </div>
              {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
