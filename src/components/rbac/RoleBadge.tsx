import { Role, ROLE_LABELS, ROLE_BADGE_STYLES } from '@/types/rbac';
import { cn } from '@/lib/utils';

export interface RoleBadgeProps {
  role: Role | string;
  /** Tamanho do badge (afeta ponto, padding e fonte) */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Identificação de cargo: ponto pulsante + label, sem contêiner/fundo.
 * As cores por cargo vêm de ROLE_BADGE_STYLES (rbac.ts).
 *
 * Padrão visual do sistema (mesmo do badge "Aberto" dos eventos):
 * ponto com animate-ping + label na cor do cargo.
 */
export function RoleBadge({ role, size = 'md', className }: RoleBadgeProps) {
  const normalized = (role || Role.USER) as Role;
  const style = ROLE_BADGE_STYLES[normalized] ?? ROLE_BADGE_STYLES[Role.USER];
  const label = ROLE_LABELS[normalized] ?? String(role);

  const isSmall = size === 'sm';
  const dotSize = isSmall ? 'h-1.5 w-1.5' : 'h-2 w-2';
  const textSize = isSmall ? 'text-[10px]' : 'text-xs';
  const bgClass = style.text.replace('text-', 'bg-');

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold',
        textSize,
        style.text,
        className,
      )}
      title={`Cargo: ${label}`}
    >
      <span className={cn('relative flex shrink-0', dotSize)}>
        <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', bgClass)} />
        <span className={cn('relative inline-flex rounded-full', dotSize, bgClass)} />
      </span>
      <span className={cn(isSmall && 'truncate max-w-[100px]')}>{label}</span>
    </div>
  );
}
