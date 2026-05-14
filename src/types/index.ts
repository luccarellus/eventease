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
  presente: boolean;
  confirmado_em?: string;
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
