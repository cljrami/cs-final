import { useState, useEffect, useCallback } from 'react';
import DataTable from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';

interface Valoracion {
  id: number;
  general: string;
  comentario: string;
  aprobado: string;
  created_at: string;
  escort_nombre: string;
  usuario_nombre: string;
}

export default function ValoracionesData() {
  const [data, setData] = useState<Valoracion[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token') || '';
      const res = await fetch('/api/admin/valoraciones.php', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const token = localStorage.getItem('admin_token') || '';
      const res = await fetch(`/api/admin/valoraciones.php?id=${confirmDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg('Valoración eliminada');
        setConfirmDelete(null);
        fetchData();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'escort_nombre', label: 'Escort' },
    { key: 'usuario_nombre', label: 'Usuario' },
    {
      key: 'general',
      label: 'Punt.',
      render: (v: Valoracion) => (
        <span className="text-amber-400">{'★'.repeat(Number(v.general))}</span>
      )
    },
    {
      key: 'aprobado',
      label: 'Estado',
      render: (v: Valoracion) => (
        <span className={`text-xs px-2 py-0.5 rounded-full ${v.aprobado === '1' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'}`}>
          {v.aprobado === '1' ? 'Aprobada' : 'Pendiente'}
        </span>
      )
    },
    { key: 'comentario', label: 'Comentario' },
    {
      key: 'created_at',
      label: 'Fecha',
      render: (v: Valoracion) => new Date(v.created_at + ' UTC').toLocaleDateString('es-CL')
    },
    {
      key: 'acciones',
      label: '',
      render: (v: Valoracion) => (
        <button onClick={() => setConfirmDelete(v.id)}
          className="px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-all">
          <i className="fas fa-trash mr-1"></i>Eliminar
        </button>
      )
    }
  ];

  return (
    <div>
      {successMsg && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
          <i className="fas fa-check-circle"></i>{successMsg}
        </div>
      )}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        emptyText="No hay valoraciones"
      />
      <ConfirmModal
        isOpen={confirmDelete !== null}
        title="Eliminar valoración"
        message="¿Estás seguro de eliminar esta valoración? No se podrá recuperar."
        confirmText="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
