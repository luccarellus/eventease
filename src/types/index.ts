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
  createdAt?: string;
  created_at?: string;
}

export type NewParticipante = Omit<Participante, 'id' | 'presente' | 'confirmado_em' | 'created_at' | 'createdAt'>;

export interface Evento {
  id: string;
  titulo: string;
  descricao?: string;
  data: string;
  local: string;
  publicado: boolean;
  createdAt?: string;
  created_at?: string;
}

export interface InscricaoEvento {
  id: string;
  evento_id: string;
  participante_id: string;
  // API NestJS retorna em camelCase também
  eventoId?: string;
  participanteId?: string;
  presente: boolean;
  confirmado_em?: string;
  createdAt?: string;
  created_at?: string;
  participantes?: Participante;
}



