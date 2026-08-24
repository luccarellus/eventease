import { Tenant } from './tenant';
import { Role } from './rbac';

export interface AdminUserRecord {
  id: string;
  email: string;
  fullName?: string | null;
  role: Role | string;
  tenantId?: string | null;
  tenant?: Tenant;
  createdAt?: string;
}

export interface Participante {
  id: string;
  tenantId?: string;
  nome: string;
  email: string;
  telefone: string;
  empresa?: string;
  cidade: string;
  escola: string;
  gremio?: string;
  codigo: string;
  aceitou_termos?: boolean;
  termos_aceitos_em?: string;
  createdAt?: string;
  created_at?: string;
}

export type NewParticipante = Omit<Participante, 'id' | 'presente' | 'confirmado_em' | 'created_at' | 'createdAt'>;

export interface Evento {
  id: string;
  tenantId?: string;
  titulo: string;
  descricao?: string;
  data: string;
  local: string;
  cidade?: string;
  publicado: boolean;
  dataInicioInscricao?: string;
  data_inicio_inscricao?: string;
  dataFimInscricao?: string;
  data_fim_inscricao?: string;
  createdAt?: string;
  created_at?: string;
}

export interface InscricaoEvento {
  id: string;
  tenantId?: string;
  evento_id: string;
  participante_id: string;
  eventoId?: string;
  participanteId?: string;
  presente: boolean;
  confirmado_em?: string;
  createdAt?: string;
  created_at?: string;
  participantes?: Participante;
  participante?: Participante;
}
