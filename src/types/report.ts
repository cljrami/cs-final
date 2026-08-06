export interface Report {
  id: number;
  escort_id: number;
  escort_nombre?: string;
  foto_principal?: string | null;
  reportado_por?: string | null;
  usuario_id?: number | null;
  reportador_nombre?: string | null;
  reportador_email?: string | null;
  motivo: string;
  detalle?: string | null;
  estado: 'pending' | 'reviewed' | 'dismissed';
  created_at: string;
}
