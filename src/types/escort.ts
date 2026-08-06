export interface Servicio {
  nombre: string;
  icono: string | null;
}

export interface Escort {
  id: number;
  nombre: string;
  slug: string;
  edad: number;
  ciudad: string;
  foto_principal: string | null;
  vip: number;
  verificado: number;
  destacado: number;
  estado: string;
  likes: number;
  visitas_perfil: number;
  rating: number;
  total_valoraciones?: number;
  tarifa_1h: number | null;
  servicios?: Servicio[];
  plan?: string;
  extras_count?: number;
  en_gira?: number;
  gira_ciudad?: string | null;
  gira_activa?: number;
  gira_fecha_inicio?: string | null;
  gira_fecha_fin?: string | null;
  ciudad_base?: string;
  descripcion_corta?: string;
  created_at?: string;
  fecha_aprobacion?: string;
  sticky?: number;
  sticky_orden?: number;
  disponible_ahora?: number;
}

export interface EscortCardProps {
  escort: Escort;
  skeleton?: boolean;
}

export interface Filters {
  vip: boolean;
  verificado: boolean;
  ciudad: string;
  edad_min: string;
  edad_max: string;
}

export interface SearchFilters extends Filters {
  q: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  has_more: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: Pagination;
  error?: string;
  total?: number;
  ciudad?: string;
  has_more?: boolean;
}

export interface Ciudad {
  id: number;
  nombre: string;
  activa: number;
  orden: number;
  total_escorts?: number;
  total_escorts_real?: number;
  created_at?: string;
}