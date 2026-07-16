// ============================================
// TIPOS DE KIMI
// ============================================

export interface Escort {
    id: number;
    nombre: string;
    edad: number;
    ciudad: string;
    zona?: string;
    foto_principal: string;
    estado: string;
    vip: number;
    destacado: number;
    verificado: number;
    descripcion_corta?: string;
    tarifa_1h?: number;
    rating?: number;
    total_valoraciones?: number;
  }
  
  export interface ApiResponse<T> {
    success: boolean;
    count?: number;
    data: T;
    error?: string;
  }
  
  export interface Usuario {
    id: number;
    nombre: string;
    email: string;
    nivel: 'bronce' | 'plata' | 'oro' | 'platino' | 'diamante';
    puntos: number;
    giros_ruleta_hoy: number;
  }
  
  export interface Servicio {
    id: number;
    nombre: string;
    categoria: string;
    descripcion?: string;
    icono?: string;
  }