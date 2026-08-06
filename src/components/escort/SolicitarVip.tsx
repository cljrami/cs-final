import { useState, useEffect, useRef, useCallback } from 'react';
import DataCell from '../ui/DataCell';
import ConfirmModal from '../ui/ConfirmModal';

interface PlanBase {
  id: number;
  nombre: string;
  color: string;
  fecha_fin: string;
  dias_restantes: number;
  permite_vip: boolean;
}

interface Solicitud {
  id: number;
  estado: 'enviado' | 'aprobado' | 'rechazado';
  comprobante_pago: string | null;
  admin_notas: string | null;
  fecha_respuesta: string | null;
  created_at: string;
}

interface SolicitudAprobada {
  id: number;
  estado: 'aprobado';
  comprobante_pago: string | null;
  fecha_respuesta: string | null;
}

interface Config {
  precio_vip: number;
  moneda_vip: string;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CL');
};

const MAX_COMPROBANTE_SIZE = 5 * 1024 * 1024;
const TIPOS_ADMITIDOS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

const esPdf = (nombre?: string | null) => {
  if (!nombre) return false;
  return /\.pdf$/i.test(nombre);
};

const formatearBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
};

const validarArchivo = (file: File): string | null => {
  if (!TIPOS_ADMITIDOS.includes(file.type)) {
    return 'Formato no permitido. Usa: JPG, PNG, GIF, WEBP o PDF.';
  }
  if (file.size > MAX_COMPROBANTE_SIZE) {
    return 'El archivo no puede superar los 5 MB.';
  }
  return null;
};

type EstadoPantalla =
  | 'vip_activo'
  | 'solicitud_pendiente'
  | 'solicitud_rechazada'
  | 'sin_plan'
  | 'plan_no_vip'
  | 'formulario';

export default function SolicitarVip() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [vipActivo, setVipActivo] = useState(false);
  const [diasVipRestantes, setDiasVipRestantes] = useState(0);
  const [fechaVipExpira, setFechaVipExpira] = useState<string | null>(null);

  const [planBase, setPlanBase] = useState<PlanBase | null>(null);
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [solicitudAprobada, setSolicitudAprobada] = useState<SolicitudAprobada | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [puedeSolicitar, setPuedeSolicitar] = useState(false);

  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [showReuploadModal, setShowReuploadModal] = useState(false);
  const [reuploadFile, setReuploadFile] = useState<File | null>(null);
  const [reuploadPreview, setReuploadPreview] = useState<string | null>(null);
  const [reuploadLoading, setReuploadLoading] = useState(false);
  const reuploadInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('escort_token') : '';

  const [dragging, setDragging] = useState(false);
  const [reuploadDragging, setReuploadDragging] = useState(false);

  const [modalVer, setModalVer] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    confirmText: string;
    onConfirm: () => void;
  }>({
    open: false, title: '', message: '', variant: 'danger', confirmText: 'Confirmar', onConfirm: () => {},
  });

  const fetchEstado = useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/escort/estado-vip.php', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Respuesta no es JSON');
      }

      if (data.success) {
        setVipActivo(data.escort.vip_activo ?? false);
        setDiasVipRestantes(data.escort.dias_vip_restantes ?? 0);
        setFechaVipExpira(data.escort.fecha_vip_expira ?? null);
        setPlanBase(data.plan_base ?? null);
        setSolicitud(data.solicitud ?? null);
        setSolicitudAprobada(data.solicitud_aprobada ?? null);
        setConfig(data.config ?? null);
        setPuedeSolicitar(data.puede_solicitar ?? false);
      } else {
        setError(data.error || 'Error cargando estado VIP');
      }
    } catch (e: any) {
      setError('Error de conexion: ' + e.message);
    } finally {
      setTimeout(() => setLoading(false), 600);
    }
  }, [token]);

  useEffect(() => {
    fetchEstado();
  }, [fetchEstado]);

  useEffect(() => {
    let disposed = false;
    import('@fancyapps/ui').then((mod) => {
      if (disposed) return;
      const F = mod.Fancybox;
      F.bind('[data-fancybox]', {
        compact: false,
        idle: false,
        Toolbar: { display: ['close'] },
      });
    });
    return () => { disposed = true; };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // LÓGICA DE ESTADO EXCLUSIVO — CORREGIDA
  // ═══════════════════════════════════════════════════════════
  const getEstadoPantalla = (): EstadoPantalla => {
    if (vipActivo) return 'vip_activo';
    if (solicitud && solicitud.estado === 'enviado') return 'solicitud_pendiente';
    if (solicitud && solicitud.estado === 'rechazado') return 'solicitud_rechazada';

    // Si tiene plan base activo que permite VIP → formulario
    if (planBase && planBase.permite_vip && puedeSolicitar) return 'formulario';

    // Si tiene plan base pero NO permite VIP
    if (planBase && !planBase.permite_vip) return 'plan_no_vip';

    // Si NO tiene plan base (planBase es null o undefined)
    if (!planBase) return 'sin_plan';

    // Fallback: si tiene plan pero no puede solicitar por alguna razón
    return 'formulario';
  };

  const estadoPantalla = getEstadoPantalla();

  const solicitudObjetivo = solicitud ?? solicitudAprobada;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const err = validarArchivo(file);
    if (err) {
      setError(err);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setComprobanteFile(file);
    setError('');

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setComprobantePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setComprobantePreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const err = validarArchivo(file);
    if (err) {
      setError(err);
      return;
    }

    setComprobanteFile(file);
    setError('');

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setComprobantePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setComprobantePreview(null);
    }
  };

  const handleReuploadFile = (file: File) => {
    const err = validarArchivo(file);
    if (err) {
      setError(err);
      if (reuploadInputRef.current) reuploadInputRef.current.value = '';
      return;
    }

    setReuploadFile(file);
    setError('');

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setReuploadPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setReuploadPreview(null);
    }
  };

  const handleReuploadDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setReuploadDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    handleReuploadFile(file);
  };

  const handleSubmit = async () => {
    if (!puedeSolicitar) return;

    setEnviando(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      if (comprobanteFile) {
        formData.append('comprobante', comprobanteFile);
      }

      const res = await fetch('/api/escort/solicitar-vip.php', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Respuesta no es JSON');
      }

      if (data.success) {
        setSuccess(data.message);
        setComprobanteFile(null);
        setComprobantePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await fetchEstado();
        window.dispatchEvent(new Event('sidebar-refresh'));
      } else {
        setError(data.error || 'Error al enviar solicitud');
      }
    } catch (e: any) {
      setError('Error de conexion: ' + e.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleReuploadComprobante = async () => {
    if (!solicitudObjetivo || !reuploadFile) return;
    setReuploadLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('comprobante', reuploadFile);
      formData.append('tipo', 'vip');
      formData.append('id', String(solicitudObjetivo.id));
      const res = await fetch('/api/escort/subir-comprobante.php', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setReuploadFile(null);
        setReuploadPreview(null);
        setShowReuploadModal(false);
        setSuccess('Comprobante subido correctamente');
        await fetchEstado();
      } else {
        setError(data.error || 'Error al subir comprobante');
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setReuploadLoading(false);
    }
  };

  const openConfirmModal = (
    title: string,
    message: string,
    onConfirm: () => void,
    variant: 'danger' | 'warning' | 'info' = 'danger',
    confirmText: string = 'Confirmar'
  ) => {
    setConfirmModal({ open: true, title, message, variant, confirmText, onConfirm });
  };

  const closeConfirmModal = () => {
    setConfirmModal(m => ({ ...m, open: false }));
  };

  const handleConfirmarEnvio = () => {
    closeConfirmModal();
    handleSubmit();
  };

  // ═══════════════════════════════════════════════════════════
  // GLOW EFFECTS
  // ═══════════════════════════════════════════════════════════
  const GlowAmber = () => (
    <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
  );
  const GlowBlue = () => (
    <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
  );
  const GlowRed = () => (
    <div className="absolute -top-20 -right-20 w-40 h-40 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
  );

  // ═══════════════════════════════════════════════════════════
  // STAT ITEM
  // ═══════════════════════════════════════════════════════════
  const StatItem = ({ icon, label, value, color = 'text-white', accent }: {
    icon: string;
    label: string;
    value: React.ReactNode;
    color?: string;
    accent?: string;
  }) => (
    <div className="bg-admin-border/10 rounded-2xl p-5 group hover:bg-admin-border/20 transition-all duration-300">
      <div className={`w-10 h-10 rounded-xl ${accent || 'bg-admin-border/30'} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
        <i className={`fas ${icon} text-sm opacity-70`} />
      </div>
      <div className="text-gray-500 text-xs uppercase tracking-wider mb-1.5">{label}</div>
      <div className={`font-bold text-xl ${color}`}>
        {value}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // INFO BLOCK
  // ═══════════════════════════════════════════════════════════
  const InfoBlock = ({ icon, iconColor, iconBg, title, children }: {
    icon: string;
    iconColor: string;
    iconBg: string;
    title: string;
    children: React.ReactNode;
  }) => (
    <div className="mt-5 pt-5 border-t border-admin-border/50">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          <i className={`fas ${icon} ${iconColor} text-xs`} />
        </div>
        <div className="flex-1">
          <div className="text-white font-medium text-sm mb-1">{title}</div>
          {children}
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // CARD: VIP ACTIVO — SIN BORDES
  // ═══════════════════════════════════════════════════════════
  const renderVipActivo = () => (
    <div className="relative bg-admin-card rounded-3xl overflow-hidden">
      <GlowAmber />

      {/* <div className="relative h-1.5 bg-linear-to-r from-amber-600 via-amber-400 to-amber-600" /> */}

      <div className="relative p-8">
        <div className="flex items-center gap-5 mb-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-amber-500/15 flex items-center justify-center">
              <i className="fas fa-crown text-amber-400 text-4xl" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
              <i className="fas fa-check text-[8px] text-white" />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h2 className="text-white font-bold text-2xl">VIP Activo</h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Vigente
              </span>
            </div>
            <p className="text-admin-muted text-sm">Disfrutas de visibilidad premium en el directorio</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatItem
            icon="fa-calendar-alt"
            label="Vencimiento"
            value={<DataCell value={fechaVipExpira ? formatDate(fechaVipExpira) : 'N/A'} loading={loading} />}
            accent="bg-amber-500/10"
          />
          <StatItem
            icon="fa-hourglass-half"
            label="Días restantes"
            value={<DataCell value={`${diasVipRestantes} días`} loading={loading} />}
            color="text-amber-300"
            accent="bg-amber-500/10"
          />
          <StatItem
            icon="fa-tag"
            label="Precio VIP"
            value={<DataCell value={config ? `$${config.precio_vip.toLocaleString('es-CL')}` : '—'} loading={loading} />}
            color="text-amber-400"
            accent="bg-amber-500/10"
          />
          <StatItem
            icon="fa-shield-alt"
            label="Estado"
            value={<DataCell value="Activo" loading={loading} />}
            color="text-green-400"
            accent="bg-green-500/10"
          />
        </div>

        {planBase && (
          <InfoBlock
            icon="fa-link"
            iconColor="text-gray-500"
            iconBg="bg-admin-border/30"
            title="Plan base"
          >
            <div className="text-white font-medium">
              <span className="font-bold" style={{ color: planBase.color }}>
                <DataCell value={planBase.nombre} loading={loading} />
              </span>
            </div>
            <div className="text-gray-500 text-sm mt-0.5">
              VIP ligado a tu plan base. Expira junto con tu suscripción.
            </div>
          </InfoBlock>
        )}

        <div className="mt-6 pt-5 border-t border-admin-border/50">
          <div className="text-gray-500 text-xs uppercase tracking-wider mb-3 font-medium">Beneficios activos</div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: 'fa-star', text: 'Badge dorado en perfil' },
              { icon: 'fa-arrow-up', text: 'Prioridad en búsquedas' },
              { icon: 'fa-eye', text: 'Más visitas a tu perfil' },
              { icon: 'fa-gem', text: 'Insignia exclusiva' },
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/5">
                <i className={`fas ${b.icon} text-amber-400/70 text-xs`} />
                <span className="text-gray-400 text-sm">{b.text}</span>
              </div>
            ))}
          </div>
        </div>

        {solicitudObjetivo && (
          <div className="mt-6 pt-5 border-t border-admin-border/50 flex justify-end gap-3">
            <button
              onClick={() => setShowReuploadModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-xl text-sm font-medium transition-all"
            >
              <i className="fas fa-upload" />
              {solicitudObjetivo.comprobante_pago ? 'Re-subir' : 'Subir'} comprobante
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // CARD: SOLICITUD PENDIENTE — SIN BORDES
  // ═══════════════════════════════════════════════════════════
  const renderSolicitudPendiente = () => (
    <div className="relative bg-admin-card rounded-3xl overflow-hidden">
      <GlowBlue />

      <div className="relative h-1.5 bg-linear-to-r from-blue-600 via-blue-400 to-blue-600" />

      <div className="relative p-8">
        <div className="flex items-center gap-5 mb-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <i className="fas fa-clock text-blue-400 text-4xl" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
              <i className="fas fa-ellipsis-h text-[8px] text-white" />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h2 className="text-white font-bold text-2xl">Solicitud en Revisión</h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Pendiente
              </span>
            </div>
            <p className="text-admin-muted text-sm">Tu solicitud está siendo evaluada por el equipo administrativo</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatItem
            icon="fa-calendar"
            label="Fecha envío"
            value={<DataCell value={formatDate(solicitud?.created_at || null)} loading={loading} />}
            accent="bg-blue-500/10"
          />
          <StatItem
            icon="fa-tag"
            label="Precio VIP"
            value={<DataCell value={config ? `$${config.precio_vip.toLocaleString('es-CL')}` : '—'} loading={loading} />}
            color="text-amber-400"
            accent="bg-amber-500/10"
          />
          <StatItem
            icon="fa-hourglass-half"
            label="Plan base"
            value={<DataCell value={planBase ? `${planBase.dias_restantes} días` : 'Sin plan'} loading={loading} />}
            accent="bg-blue-500/10"
          />
          <StatItem
            icon="fa-receipt"
            label="Comprobante"
            value={solicitud?.comprobante_pago ? 'Adjunto' : 'No adjunto'}
            color="text-blue-400"
            accent="bg-blue-500/10"
          />
        </div>

        {planBase && (
          <InfoBlock
            icon="fa-link"
            iconColor="text-gray-500"
            iconBg="bg-admin-border/30"
            title="Plan base"
          >
            <div className="text-white font-medium">
              <span className="font-bold" style={{ color: planBase.color }}>
                <DataCell value={planBase.nombre} loading={loading} />
              </span>
            </div>
            <div className="text-gray-500 text-sm mt-0.5">
              Tu VIP será activado junto con tu plan base. Vence el {formatDate(planBase.fecha_fin)}.
            </div>
          </InfoBlock>
        )}

        <InfoBlock
          icon="fa-info-circle"
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
          title="¿Qué sigue?"
        >
          <div className="text-gray-500 text-sm">
            Un administrador revisará tu solicitud y comprobante de pago. Te notificaremos por email cuando tu VIP sea activado.
          </div>
        </InfoBlock>

        <InfoBlock
          icon="fa-receipt"
          iconColor={solicitud?.comprobante_pago ? 'text-green-400' : 'text-amber-400'}
          iconBg={solicitud?.comprobante_pago ? 'bg-green-500/10' : 'bg-amber-500/10'}
          title="Comprobante de pago"
        >
          {solicitud?.comprobante_pago ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                <i className="fas fa-check-circle text-[0.6rem]" /> Adjunto
              </span>
              <a href={`/${solicitud.comprobante_pago}`} data-fancybox="vip-comprobante"
                className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs">
                <i className="fas fa-eye" /> Ver comprobante
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400">
                <i className="fas fa-exclamation-triangle text-[0.6rem]" /> No adjunto
              </span>
              <span className="text-gray-500 text-xs">
                Sube el comprobante para agilizar la aprobación.
              </span>
            </div>
          )}
        </InfoBlock>

        <div className="mt-6 pt-5 border-t border-admin-border/50 flex justify-end gap-3">
          <button
            onClick={() => setShowReuploadModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-xl text-sm font-medium transition-all"
          >
            <i className="fas fa-upload" />
            {solicitud?.comprobante_pago ? 'Re-subir' : 'Subir'} comprobante
          </button>
          <button
            onClick={() => setModalVer(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-xl text-sm font-medium transition-all"
          >
            <i className="fas fa-eye" />
            Ver detalles
          </button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // CARD: SOLICITUD RECHAZADA — SIN BORDES
  // ═══════════════════════════════════════════════════════════
  const renderSolicitudRechazada = () => (
    <div className="relative bg-admin-card rounded-3xl overflow-hidden">
      <GlowRed />

      <div className="relative h-1.5 bg-linear-to-r from-red-600 via-red-400 to-red-600" />

      <div className="relative p-8">
        <div className="flex items-center gap-5 mb-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center">
              <i className="fas fa-times text-red-400 text-4xl" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
              <i className="fas fa-exclamation text-[8px] text-white" />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h2 className="text-white font-bold text-2xl">Solicitud Rechazada</h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400">
                <i className="fas fa-times-circle text-[10px]" />
                Rechazado
              </span>
            </div>
            <p className="text-admin-muted text-sm">
              Revisada el <DataCell value={formatDate(solicitud?.fecha_respuesta || null)} loading={loading} />
            </p>
          </div>
        </div>

        {solicitud?.admin_notas && (
          <div className="bg-red-500/5 rounded-2xl p-5 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <i className="fas fa-exclamation-triangle text-red-400 text-sm" />
              </div>
              <div>
                <div className="text-red-400 text-sm font-semibold mb-1">Motivo del rechazo</div>
                <div className="text-gray-400 text-sm">{solicitud.admin_notas}</div>
              </div>
            </div>
          </div>
        )}

        <InfoBlock
          icon="fa-redo"
          iconColor="text-red-400"
          iconBg="bg-red-500/10"
          title="¿Qué puedes hacer?"
        >
          <div className="text-gray-500 text-sm">
            Puedes enviar una nueva solicitud corrigiendo lo indicado. Revisa que el comprobante de pago sea válido y el monto correcto.
          </div>
        </InfoBlock>

        <InfoBlock
          icon="fa-receipt"
          iconColor={solicitud?.comprobante_pago ? 'text-green-400' : 'text-amber-400'}
          iconBg={solicitud?.comprobante_pago ? 'bg-green-500/10' : 'bg-amber-500/10'}
          title="Comprobante de pago"
        >
          {solicitud?.comprobante_pago ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                <i className="fas fa-check-circle text-[0.6rem]" /> Adjunto
              </span>
              <a href={`/${solicitud.comprobante_pago}`} data-fancybox="vip-comprobante"
                className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs">
                <i className="fas fa-eye" /> Ver comprobante
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400">
                <i className="fas fa-exclamation-triangle text-[0.6rem]" /> No adjunto
              </span>
              <span className="text-gray-500 text-xs">
                Sube el comprobante para volver a revisión.
              </span>
            </div>
          )}
        </InfoBlock>

        <div className="mt-6 pt-5 border-t border-admin-border/50 flex justify-end gap-3">
          <button
            onClick={() => setShowReuploadModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-xl text-sm font-medium transition-all"
          >
            <i className="fas fa-upload" />
            {solicitud?.comprobante_pago ? 'Re-subir' : 'Subir'} comprobante
          </button>
          <button
            onClick={() => setModalVer(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-admin-border hover:bg-gray-700 text-white rounded-xl text-sm font-medium transition-all"
          >
            <i className="fas fa-eye" />
            Ver detalles
          </button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // CARD: SIN PLAN — SIN BORDES
  // ═══════════════════════════════════════════════════════════
  const renderSinPlan = () => (
    <div className="relative bg-admin-card rounded-3xl overflow-hidden">
      <div className="relative p-8">
        <div className="flex items-center gap-5 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-admin-border/40 flex items-center justify-center">
            <i className="fas fa-lock text-gray-500 text-4xl" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold text-2xl mb-1">Necesitas un plan activo</h2>
            <p className="text-admin-muted text-sm">El VIP está ligado a tu plan base. Activa un plan primero.</p>
          </div>
        </div>

        <div className="bg-admin-border/10 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-admin-border/40 flex items-center justify-center shrink-0">
              <i className="fas fa-credit-card text-gray-500 text-lg" />
            </div>
            <div className="flex-1">
              <div className="text-white font-semibold text-lg mb-1">¿Cómo funciona?</div>
              <div className="text-gray-500 text-sm mb-5 leading-relaxed">
                El badge VIP se activa junto con tu plan base. Cuando compras un plan, podrás solicitar el VIP como complemento para destacar en el directorio.
              </div>
              <a
                href="/micuenta/mi-plan"
                className="inline-flex items-center gap-2.5 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30"
              >
                <i className="fas fa-arrow-right" />
                Ir a Mi Plan
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // CARD: PLAN NO VIP — SIN BORDES
  // ═══════════════════════════════════════════════════════════
  const renderPlanNoVip = () => (
    <div className="relative bg-admin-card rounded-3xl overflow-hidden">
      <div className="relative p-8">
        <div className="flex items-center gap-5 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-admin-border/40 flex items-center justify-center">
            <i className="fas fa-ban text-gray-500 text-4xl" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold text-2xl mb-1">Tu plan no incluye VIP</h2>
            <p className="text-admin-muted text-sm">Tu plan actual no permite solicitar el badge VIP.</p>
          </div>
        </div>

        <div className="bg-admin-border/10 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-admin-border/40 flex items-center justify-center shrink-0">
              <i className="fas fa-arrow-up text-gray-500 text-lg" />
            </div>
            <div className="flex-1">
              <div className="text-white font-semibold text-lg mb-1">Actualiza tu plan</div>
              <div className="text-gray-500 text-sm mb-5 leading-relaxed">
                Los planes superiores incluyen la opción de activar VIP. Actualiza tu plan para acceder a esta función premium.
              </div>
              <a
                href="/micuenta/mi-plan"
                className="inline-flex items-center gap-2.5 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30"
              >
                <i className="fas fa-arrow-right" />
                Ver planes disponibles
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // CARD: FORMULARIO — SIN BORDES
  // ═══════════════════════════════════════════════════════════
  const renderFormulario = () => (
    <div className="relative bg-admin-card rounded-3xl overflow-hidden">
      <GlowAmber />

      <div className="relative h-1.5 bg-linear-to-r from-amber-600 via-amber-400 to-amber-600" />

      <div className="relative p-8">
        <div className="flex items-center gap-5 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <i className="fas fa-crown text-amber-400 text-4xl" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold text-2xl mb-1">Solicitar Badge VIP</h2>
            <div className="text-admin-muted text-sm">
              Valor:{" "}
              <span className="text-amber-400 font-bold text-base">
                <DataCell value={config ? `$${config.precio_vip.toLocaleString('es-CL')} ${config.moneda_vip || ''}` : '—'} loading={loading} />
              </span>
            </div>
          </div>
        </div>

        {planBase && (
          <div className="bg-admin-border/10 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-admin-border/40 flex items-center justify-center shrink-0">
                <i className="fas fa-link text-gray-500 text-lg" />
              </div>
              <div>
                <div className="text-white font-semibold text-base mb-1">
                  Plan base:{" "}
                  <span className="font-bold" style={{ color: planBase.color }}>
                    <DataCell value={planBase.nombre} loading={loading} />
                  </span>
                </div>
                <div className="text-gray-500 text-sm">
                  Vence el {formatDate(planBase.fecha_fin)} · {planBase.dias_restantes} días restantes
                </div>
                <div className="text-gray-500 text-xs mt-1.5">
                  <i className="fas fa-info-circle mr-1.5 text-amber-400/60" />
                  El VIP durará lo que dure tu plan base
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-gray-500 text-xs uppercase tracking-wider mb-3 font-medium">
            Comprobante de pago <span className="text-gray-600 normal-case">(opcional)</span>
          </label>

          {!comprobanteFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all group ${
                dragging
                  ? 'border-amber-500/60 bg-amber-500/10'
                  : 'border-admin-border hover:border-amber-500/30 hover:bg-amber-500/5'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/25 to-amber-500/5 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-all duration-300">
                <i className="fas fa-cloud-upload-alt text-2xl text-amber-400/80 group-hover:text-amber-400" />
              </div>
              <div className="text-gray-300 text-sm font-medium">Arrastra y suelta tu comprobante</div>
              <div className="text-gray-600 text-xs mt-1">o haz clic para seleccionar un archivo</div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {['JPG', 'PNG', 'GIF', 'WEBP', 'PDF'].map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-md bg-white/5 text-gray-500 text-[10px] font-semibold uppercase tracking-wide">
                    {t}
                  </span>
                ))}
                <span className="text-gray-600 text-[10px] font-medium ml-1">· Máx. 5 MB</span>
              </div>
            </div>
          ) : (
            <div className="bg-admin-border/20 rounded-2xl p-5 border border-admin-border/40">
              <div className="flex items-center gap-4">
                {comprobantePreview ? (
                  <img src={comprobantePreview} alt="Preview" className="w-16 h-16 rounded-xl object-cover border border-admin-border/50" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                    <i className="fas fa-file-pdf text-2xl text-red-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium truncate">{comprobanteFile.name}</span>
                    {esPdf(comprobanteFile.name) && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 text-[10px] font-bold">PDF</span>
                    )}
                  </div>
                  <div className="text-gray-500 text-xs mt-0.5">{formatearBytes(comprobanteFile.size)}</div>
                  <div className="text-green-400/80 text-[11px] mt-0.5">
                    <i className="fas fa-check-circle mr-1" />
                    Listo para adjuntar
                  </div>
                </div>
                <button
                  onClick={() => {
                    setComprobanteFile(null);
                    setComprobantePreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-500/10 transition-all"
                  title="Quitar archivo"
                >
                  <i className="fas fa-trash-alt" />
                </button>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <button
          onClick={() =>
            openConfirmModal(
              'Confirmar solicitud VIP',
              comprobanteFile
                ? `Vas a enviar una solicitud VIP con comprobante adjunto. El valor es ${config ? `$${config.precio_vip.toLocaleString('es-CL')} ${config.moneda_vip || ''}` : '—'}. ¿Continuar?`
                : `Vas a enviar una solicitud VIP sin comprobante. El valor es ${config ? `$${config.precio_vip.toLocaleString('es-CL')} ${config.moneda_vip || ''}` : '—'}. ¿Continuar?`,
              handleConfirmarEnvio,
              'warning',
              'Enviar solicitud'
            )
          }
          disabled={enviando}
          className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-[1.01] active:scale-[0.99]"
        >
          {enviando ? (
            <>
              <i className="fas fa-circle-notch fa-spin" />
              Enviando solicitud...
            </>
          ) : (
            <>
              <i className="fas fa-paper-plane" />
              Enviar Solicitud VIP
            </>
          )}
        </button>

        <p className="text-gray-600 text-xs text-center mt-4">
          <i className="fas fa-lock mr-1.5 text-gray-500" />
          Tu solicitud será revisada por un administrador antes de ser aprobada
        </p>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // RENDER PRINCIPAL — SIN PANTALLA DE LOADING
  // ═══════════════════════════════════════════════════════════
  const renderContent = () => {
    switch (estadoPantalla) {
      case 'vip_activo':
        return renderVipActivo();
      case 'solicitud_pendiente':
        return renderSolicitudPendiente();
      case 'solicitud_rechazada':
        return renderSolicitudRechazada();
      case 'sin_plan':
        return renderSinPlan();
      case 'plan_no_vip':
        return renderPlanNoVip();
      case 'formulario':
        return renderFormulario();
      default:
        return renderSinPlan();
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <i className="fas fa-crown text-amber-500" />
          Badge VIP
        </h1>
        <p className="text-admin-muted text-sm mt-1">
          El badge VIP te da visibilidad premium en el directorio
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
          <i className="fas fa-exclamation-triangle" />
          <span className="flex-1 text-sm">{error}</span>
          <button onClick={() => setError('')} className="text-sm hover:text-red-300">
            <i className="fas fa-xmark" />
          </button>
        </div>
      )}

      {/* Success — SIN BORDE */}
      {success && (
        <div className="bg-green-500/8 rounded-2xl overflow-hidden">
          <div className="h-1 bg-green-500/50" />
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-2xl bg-green-500/15 flex items-center justify-center shrink-0">
                <i className="fas fa-paper-plane text-green-400 text-4xl" />
              </div>
              <div className="flex-1">
                <div className="text-white font-bold text-2xl mb-1">Solicitud enviada</div>
                <div className="text-green-400/80 text-sm">{success}</div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 text-sm text-green-400">
                    <i className="fas fa-clock text-xs" />
                    <span>En revisión por admin</span>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 text-sm text-green-400">
                    <i className="fas fa-bell text-xs" />
                    <span>Te notificaremos cuando sea aprobada</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contenido principal — SOLO UNA CARD, sin pantalla loading */}
      {renderContent()}

      {/* ═══ MODAL RE-UPLOAD COMPROBANTE VIP ═══ */}
      {showReuploadModal && solicitudObjetivo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                <i className="fas fa-upload text-blue-400 text-xl"></i>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Subir comprobante</h3>
              <p className="text-gray-500 text-xs mb-5">Selecciona el comprobante de pago VIP</p>

              <div className="w-full mb-4">
                <input ref={reuploadInputRef} type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) { setError('El archivo no puede superar 5MB'); return; }
                    setReuploadFile(file);
                    if (file.type.startsWith('image/')) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setReuploadPreview(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    } else {
                      setReuploadPreview(null);
                    }
                  }} />
                {!reuploadFile ? (
                  <div onClick={() => reuploadInputRef.current?.click()}
                    className="border-2 border-dashed border-[#2d2d44] rounded-xl p-4 text-center cursor-pointer hover:border-gray-500 transition-colors">
                    <i className="fas fa-cloud-upload-alt text-gray-500 text-2xl mb-2"></i>
                    <div className="text-gray-500 text-sm">Click para seleccionar archivo</div>
                    <div className="text-gray-600 text-xs mt-1">JPG, PNG, PDF · Max 5MB</div>
                  </div>
                ) : (
                  <div className="bg-[#13131a] rounded-xl p-3 flex items-center gap-3">
                    {reuploadPreview ? (
                      <img src={reuploadPreview} alt="Preview" className="w-14 h-14 rounded object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded bg-[#1a1a2e] flex items-center justify-center text-gray-500"><i className="fas fa-file-pdf text-2xl"></i></div>
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-white text-sm truncate">{reuploadFile.name}</div>
                      <div className="text-gray-500 text-xs">{(reuploadFile.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button onClick={() => { setReuploadFile(null); setReuploadPreview(null); }} className="text-red-400 hover:text-red-300">
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 w-full">
                <button onClick={() => { setShowReuploadModal(false); setReuploadFile(null); setReuploadPreview(null); }}
                  className="flex-1 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors text-sm">
                  Cancelar
                </button>
                <button onClick={handleReuploadComprobante} disabled={!reuploadFile || reuploadLoading}
                  className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-semibold rounded-lg transition-all text-sm flex items-center justify-center gap-2">
                  {reuploadLoading ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-upload" />}
                  {reuploadLoading ? 'Subiendo...' : 'Subir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL VER DETALLES — SIN BORDE EXTRA ═══ */}
      {modalVer && solicitud && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
             onClick={() => setModalVer(false)}>
          <div className="bg-admin-card rounded-2xl w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto"
               onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-admin-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <i className="fas fa-eye text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold">Detalle Solicitud</h3>
                  <p className="text-admin-muted text-xs">
                    Enviada el <DataCell value={formatDate(solicitud.created_at)} loading={loading} />
                  </p>
                </div>
              </div>
              <button onClick={() => setModalVer(false)} className="w-8 h-8 rounded-lg hover:bg-admin-border flex items-center justify-center text-gray-400 hover:text-white">
                <i className="fas fa-xmark" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-sm">Estado</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
                  <i className="fas fa-clock text-[0.6rem]" />
                  {solicitud.estado === 'enviado' ? 'Pendiente' : 'En Revisión'}
                </span>
              </div>

              {solicitud.comprobante_pago && (
                <div className="rounded-xl p-3">
                  <div className="text-gray-500 text-xs mb-2">Comprobante de pago</div>
                  <a href={`/${solicitud.comprobante_pago}`} data-fancybox="vip-comprobante">
                    <img
                      src={`/${solicitud.comprobante_pago}`}
                      alt="Comprobante"
                      className="w-full rounded-lg max-h-48 object-contain bg-black/30 cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  </a>
                </div>
              )}

              <div className="rounded-xl p-3">
                <div className="text-gray-500 text-xs mb-1">Fecha de envío</div>
                <div className="text-white text-sm">
                  <DataCell value={formatDate(solicitud.created_at)} loading={loading} />
                </div>
              </div>

              {solicitud.fecha_respuesta && (
                <div className="rounded-xl p-3">
                  <div className="text-gray-500 text-xs mb-1">Fecha de respuesta</div>
                  <div className="text-white text-sm">
                    <DataCell value={formatDate(solicitud.fecha_respuesta)} loading={loading} />
                  </div>
                </div>
              )}

              {solicitud.admin_notas && (
                <div className="rounded-xl p-3">
                  <div className="text-gray-500 text-xs mb-1">Notas del admin</div>
                  <div className="text-white text-sm">{solicitud.admin_notas}</div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-admin-border">
              <button
                onClick={() => setModalVer(false)}
                className="w-full py-2.5 rounded-xl bg-admin-border text-white text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
        cancelText="Cancelar"
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
      />
    </div>
  );
}