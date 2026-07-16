import { useEffect, useState } from 'react';
import { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import PlanesTable from './PlanesTable';
import StatCard from '../ui/StatCard';

interface Stats {
  total: number;
  activos: number;
  inactivos: number;
  bases: number;
  extras: number;
}

interface Plan {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string;
  tipo: 'base' | 'extra';
  duracion_dias: number;
  precio: number;
  moneda: string;
  max_fotos: number;
  max_videos: number;
  max_pausas_permitidas: number;
  permite_vip: number;
  permite_destacado: number;
  uso_unico: number;
  badge: string;
  color_badge: string;
  orden: number;
  activo: number;
  creado_en: string;
  actualizado_en: string;
  total_suscripciones: number;
  total_escorts: number;
}

const statConfig = [
  { key: 'total' as keyof Stats, icon: 'fa-layer-group', label: 'Total Planes', color: '#3b82f6', bgColor: '#1e3a5f' },
  { key: 'activos' as keyof Stats, icon: 'fa-check-circle', label: 'Activos', color: '#10b981', bgColor: '#1a3d2e' },
  { key: 'inactivos' as keyof Stats, icon: 'fa-times-circle', label: 'Inactivos', color: '#ef4444', bgColor: '#3d1a1a' },
  { key: 'bases' as keyof Stats, icon: 'fa-box', label: 'Planes Base', color: '#8b5cf6', bgColor: '#2e1a3d' },
  { key: 'extras' as keyof Stats, icon: 'fa-puzzle-piece', label: 'Extras', color: '#f59e0b', bgColor: '#3d3d1a' },
];

export default function PlanesData() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = () => {
    setLoading(true);
    const token = localStorage.getItem('admin_token');

    fetch('/api/admin/planes.php', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(async r => {
        const text = await r.text();
        try { return JSON.parse(text); } catch (e) { throw new Error('No es JSON'); }
      })
      .then(data => {
        if (data.success) {
          setStats(data.stats);
          setPlanes(data.planes);
        } else {
          setError(data.error || 'Error');
        }
      })
      .catch(err => setError('Error: ' + err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-red-400">
        <i className="fas fa-exclamation-circle mr-2"></i>{error}
      </div>
    );
  }

  return (
    <SkeletonTheme baseColor="#1a1a2e" highlightColor="#2d2d44" duration={1.2}>
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Gestión de Planes</h1>
        <p className="text-admin-muted mb-8">Administra planes base y extras de suscripción</p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {statConfig.map((stat) => (
            <StatCard key={stat.key} icon={stat.icon} value={stats?.[stat.key] ?? 0} label={stat.label} color={stat.color} loading={loading} />
          ))}
        </div>

        <PlanesTable planes={planes} loading={loading} onRefresh={fetchData} />
      </div>
    </SkeletonTheme>
  );
}