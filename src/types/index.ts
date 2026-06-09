export interface Participante {
  id: string;
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
  created_at: string;
}

export type NewParticipante = Omit<Participante, 'id' | 'presente' | 'confirmado_em' | 'created_at'>;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface Evento {
  id: string;
  titulo: string;
  descricao?: string;
  data: string;
  local: string;
  publicado: boolean;
  created_at: string;
}

export interface InscricaoEvento {
  id: string;
  evento_id: string;
  participante_id: string;
  presente: boolean;
  confirmado_em?: string;
  created_at: string;
  participantes?: Participante;
}

