export enum Role {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  ORGANIZER = 'organizer',
  STAFF = 'staff',
  VIEWER = 'viewer',
  USER = 'user',
}

export enum Permission {
  // Gestão de Tenants
  TENANTS_READ = 'tenants:read',
  TENANTS_WRITE = 'tenants:write',
  TENANTS_DELETE = 'tenants:delete',

  // Gestão de Usuários / Equipe
  USERS_READ = 'users:read',
  USERS_WRITE = 'users:write',
  USERS_DELETE = 'users:delete',
  USERS_ROLES = 'users:roles',

  // Eventos
  EVENTS_READ = 'events:read',
  EVENTS_CREATE = 'events:create',
  EVENTS_UPDATE = 'events:update',
  EVENTS_DELETE = 'events:delete',
  EVENTS_PUBLISH = 'events:publish',

  // Participantes / Alunos
  PARTICIPANTS_READ = 'participants:read',
  PARTICIPANTS_CREATE = 'participants:create',
  PARTICIPANTS_UPDATE = 'participants:update',
  PARTICIPANTS_DELETE = 'participants:delete',
  PARTICIPANTS_EXPORT = 'participants:export',

  // Inscrições e Check-in
  REGISTRATIONS_READ = 'registrations:read',
  REGISTRATIONS_CREATE = 'registrations:create',
  REGISTRATIONS_CHECKIN = 'registrations:checkin',
  REGISTRATIONS_DELETE = 'registrations:delete',
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: Object.values(Permission),

  [Role.ADMIN]: [
    Permission.TENANTS_READ,
    Permission.USERS_READ,
    Permission.USERS_WRITE,
    Permission.USERS_ROLES,
    Permission.EVENTS_READ,
    Permission.EVENTS_CREATE,
    Permission.EVENTS_UPDATE,
    Permission.EVENTS_DELETE,
    Permission.EVENTS_PUBLISH,
    Permission.PARTICIPANTS_READ,
    Permission.PARTICIPANTS_CREATE,
    Permission.PARTICIPANTS_UPDATE,
    Permission.PARTICIPANTS_DELETE,
    Permission.PARTICIPANTS_EXPORT,
    Permission.REGISTRATIONS_READ,
    Permission.REGISTRATIONS_CREATE,
    Permission.REGISTRATIONS_CHECKIN,
    Permission.REGISTRATIONS_DELETE,
  ],

  [Role.ORGANIZER]: [
    Permission.EVENTS_READ,
    Permission.EVENTS_CREATE,
    Permission.EVENTS_UPDATE,
    Permission.EVENTS_PUBLISH,
    Permission.PARTICIPANTS_READ,
    Permission.PARTICIPANTS_CREATE,
    Permission.PARTICIPANTS_UPDATE,
    Permission.PARTICIPANTS_EXPORT,
    Permission.REGISTRATIONS_READ,
    Permission.REGISTRATIONS_CREATE,
    Permission.REGISTRATIONS_CHECKIN,
  ],

  [Role.STAFF]: [
    Permission.EVENTS_READ,
    Permission.PARTICIPANTS_READ,
    Permission.REGISTRATIONS_READ,
    Permission.REGISTRATIONS_CHECKIN,
  ],

  [Role.VIEWER]: [
    Permission.EVENTS_READ,
    Permission.PARTICIPANTS_READ,
    Permission.REGISTRATIONS_READ,
  ],

  [Role.USER]: [
    Permission.EVENTS_READ,
    Permission.PARTICIPANTS_CREATE,
    Permission.REGISTRATIONS_CREATE,
  ],
};

export const ALL_ROLES: Role[] = Object.values(Role);

export function getRolePermissions(role: string): Permission[] {
  const normalizedRole = role as Role;
  return ROLE_PERMISSIONS[normalizedRole] || [];
}

export function hasPermission(userRole: string, permission: Permission): boolean {
  if (userRole === Role.SUPER_ADMIN) {
    return true;
  }
  const permissions = getRolePermissions(userRole);
  return permissions.includes(permission);
}
