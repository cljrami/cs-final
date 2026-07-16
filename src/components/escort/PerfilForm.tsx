import { useState, useEffect, useRef, useCallback } from 'react';
import SearchAutocomplete from '../ui/SearchAutocomplete';

const API_BASE = '/api/escort';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('escort_token') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

interface Ciudad {
  id: number;
  nombre: string;
}

interface Servicio {
  id: number;
  nombre: string;
  grupo: string;
  color: string;
  icono: string;
  tipicamente_adicional: number;
}

interface EscortServicio {
  id: number;
  nombre: string;
  grupo: string;
  color: string;
  icono: string;
  incluido: number;
}

interface EscortPerfil {
  id: number;
  nombre: string;
  altura: number;
  peso: number;
  medidas: string;
  edad: number;
  ciudad: string;
  whatsapp: string;
  telefono: string;
  descripcion_corta: string;
  descripcion_larga: string;
  servicios: EscortServicio[];
}

const GRUPOS_SERVICIOS: Record<string, { label: string; icon: string }> = {
  sexual: { label: 'Sexual', icon: 'fa-heart' },
  relajacion: { label: 'Relajación', icon: 'fa-spa' },
  acompanamiento: { label: 'Acompañamiento', icon: 'fa-glass-cheers' },
  experiencia: { label: 'Experiencia', icon: 'fa-star' },
  adicional: { label: 'Adicional', icon: 'fa-plus-circle' },
  lugar: { label: 'Lugar', icon: 'fa-map-marker-alt' },
  tiempo: { label: 'Tiempo', icon: 'fa-clock' },
  especial: { label: 'Especial', icon: 'fa-fire' },
  virtual: { label: 'Virtual', icon: 'fa-video' },
};

// ============ UTILIDADES DE VALIDACIÓN ============

const PAIS_FLAG = '🇨🇱';
const PAIS_CODIGO = '+56';
const TELEFONO_MIN = 11;
const TELEFONO_MAX = 15;

function validarTelefono(valor: string): { valido: boolean; error?: string } {
  if (!valor.trim()) return { valido: false, error: 'Número requerido' };
  if (!valor.startsWith('+')) return { valido: false, error: 'Debe comenzar con +' };
  const soloNumsYPlus = /^\+[\d\s]+$/.test(valor);
  if (!soloNumsYPlus) return { valido: false, error: 'Solo números y espacios después del +' };
  const nums = valor.replace(/\D/g, '');
  if (nums.length < TELEFONO_MIN) return { valido: false, error: `Mínimo ${TELEFONO_MIN} dígitos` };
  if (nums.length > TELEFONO_MAX) return { valido: false, error: `Máximo ${TELEFONO_MAX} dígitos` };
  return { valido: true };
}

function formatearTelefono(valor: string): string {
  // Si empieza con +56, formatea como +56 9 XXXX XXXX
  const limpio = valor.replace(/\D/g, '');
  if (limpio.startsWith('56') && limpio.length >= 11) {
    const resto = limpio.slice(2);
    if (resto.length === 9) {
      return `+56 ${resto.slice(0, 1)} ${resto.slice(1, 5)} ${resto.slice(5)}`;
    }
  }
  return valor;
}

function soloNumerosYPlus(valor: string): string {
  // Permite + al inicio, luego solo números y espacios
  let result = valor.replace(/[^\d\s+]/g, '');
  // Solo un + al inicio
  const parts = result.split('+');
  if (parts.length > 1) {
    result = '+' + parts.slice(1).join('');
  }
  return result;
}

export default function PerfilForm() {
  const [perfil, setPerfil] = useState<EscortPerfil | null>(null);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [serviciosLoaded, setServiciosLoaded] = useState(false);
  const [opciones, setOpciones] = useState<Record<string, { id: number; nombre: string }[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Autocomplete ciudades
  const [ciudadInput, setCiudadInput] = useState('');
  const [ciudadSugerencias, setCiudadSugerencias] = useState<Ciudad[]>([]);
  const [showCiudadSugerencias, setShowCiudadSugerencias] = useState(false);
  const [ciudadSelectedIndex, setCiudadSelectedIndex] = useState(-1);
  const ciudadInputRef = useRef<HTMLInputElement>(null);
  const ciudadSugerenciasRef = useRef<HTMLDivElement>(null);

  // Autocomplete servicios
  const [servicioInput, setServicioInput] = useState('');
  const [servicioSugerencias, setServicioSugerencias] = useState<Servicio[]>([]);
  const [showServicioSugerencias, setShowServicioSugerencias] = useState(false);
  const [servicioSelectedIndex, setServicioSelectedIndex] = useState(-1);
  const servicioInputRef = useRef<HTMLInputElement>(null);
  const servicioSugerenciasRef = useRef<HTMLDivElement>(null);

  // Modal de tipo de servicio
  const [showServicioModal, setShowServicioModal] = useState(false);
  const [selectedServicioForModal, setSelectedServicioForModal] = useState<Servicio | null>(null);

  const [form, setForm] = useState({
    nombre: '',
    altura: '',
    peso: '',
    medidas: '',
    edad: '',
    ciudadId: '',
    ciudadNombre: '',
    nacionalidad: '',
    etnia: '',
    color_ojos: '',
    color_pelo: '',
    orientacion: '',
    estilo: '',
    whatsapp: '',
    telefono: '',
    descripcionCorta: '',
    descripcionLarga: '',
    servicios: [] as { id: number; incluido: number }[],
  });

  // Estados de validación en tiempo real
  const [edadTouched, setEdadTouched] = useState(false);
  const [whatsappTouched, setWhatsappTouched] = useState(false);
  const [telefonoTouched, setTelefonoTouched] = useState(false);

  // Editor HTML (Quill)
  const editorRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<any>(null);
  const [quillReady, setQuillReady] = useState(false);
  const contenidoCargadoRef = useRef(false);

  const cargarQuill = () => {
    if ((window as any).Quill) { setQuillReady(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js';
    script.onload = () => setQuillReady(true);
    document.body.appendChild(script);
  };

  useEffect(() => {
    fetchData();
    cargarQuill();
  }, []);

  // Inicializar Quill una sola vez cuando el script esté listo
  useEffect(() => {
    if (!quillReady || !editorRef.current || quillRef.current) return;
    const Quill = (window as any).Quill;
    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      placeholder: 'Describe tu personalidad, lo que te gusta, horarios de atención, etc...',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          [{ font: [] }],
          [{ size: ['small', false, 'large', 'huge'] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }],
          [{ align: [] }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['blockquote', 'code-block'],
          ['link', 'image', 'video'],
          ['table'],
          ['clean']
        ]
      }
    });
    quill.on('text-change', () => {
      setForm((prev) => ({ ...prev, descripcionLarga: quill.root.innerHTML }));
    });
    quillRef.current = quill;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quillReady]);

  // Cargar el contenido guardado en Quill SOLO cuando ya esté disponible
  // y no haya sido cargado previamente (evita duplicados y pérdida de datos)
  useEffect(() => {
    if (!quillRef.current || contenidoCargadoRef.current) return;
    if (form.descripcionLarga === undefined || form.descripcionLarga === null) return;
    quillRef.current.clipboard.dangerouslyPasteHTML(form.descripcionLarga || '');
    contenidoCargadoRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quillReady, form.descripcionLarga]);

  const fetchData = async () => {
    try {
      const [perfilRes, ciudadesRes, serviciosRes] = await Promise.all([
        fetch(`${API_BASE}/perfil-completo.php`, { headers: getAuthHeaders() }),
        fetch('/api/ciudades.php'),
        fetch('/api/servicios.php?activos=1')
      ]);

      const perfilData = await perfilRes.json();
      const ciudadesData = await ciudadesRes.json();
      const serviciosData = await serviciosRes.json();

      if (perfilData.success) {
        const p = perfilData.perfil;
        setPerfil(p);
        
        const ciudadEncontrada = ciudadesData.ciudades?.find((c: Ciudad) => c.nombre === p.ciudad);
        
        const whatsappFormateado = p.whatsapp ? formatearTelefono(p.whatsapp) : '';
        const telefonoFormateado = p.telefono ? formatearTelefono(p.telefono) : '';
        
        setForm({
          nombre: p.nombre || '',
          altura: p.altura?.toString() || '',
          peso: p.peso?.toString() || '',
          medidas: p.medidas || '',
          edad: p.edad?.toString() || '',
          ciudadId: ciudadEncontrada?.id?.toString() || '',
          ciudadNombre: ciudadEncontrada?.nombre || p.ciudad || '',
          nacionalidad: p.nacionalidad || '',
          etnia: p.etnia || '',
          color_ojos: p.color_ojos || '',
          color_pelo: p.color_pelo || '',
          orientacion: p.orientacion || '',
          estilo: p.estilo || '',
          whatsapp: whatsappFormateado,
          telefono: telefonoFormateado,
          descripcionCorta: p.descripcion_corta || '',
          descripcionLarga: p.descripcion_larga || '',
          servicios: p.servicios?.map((s: any) => ({
            id: typeof s === 'object' ? s.id : s,
            incluido: typeof s === 'object' ? (s.incluido ?? 1) : 1
          })) || [],
        });
        
        if (ciudadEncontrada) {
          setCiudadInput(ciudadEncontrada.nombre);
        }
      }

      if (ciudadesData.success) setCiudades(ciudadesData.ciudades || []);
      if (serviciosData.success) {
        setServicios(serviciosData.servicios || []);
      }
      setServiciosLoaded(true);

    } catch (err: any) {
      setError(err.message);
    }

    // Cargar opciones aparte para no bloquear el formulario
    try {
      const res = await fetch(`${API_BASE}/opciones-perfil.php`);
      const data = await res.json();
      if (data.success) setOpciones(data);
      else console.error('❌ opciones-perfil.php error:', data.error);
    } catch (err) {
      console.error('❌ Error al cargar opciones-perfil.php:', err);
    }
  };

  // ========== AUTOCOMPLETE CIUDADES ==========
  const filtrarCiudades = useCallback((input: string) => {
    if (!input.trim()) {
      setCiudadSugerencias([]);
      return;
    }
    const filtrados = ciudades.filter(c => 
      c.nombre.toLowerCase().includes(input.toLowerCase())
    );
    setCiudadSugerencias(filtrados.slice(0, 6));
    setCiudadSelectedIndex(-1);
  }, [ciudades]);

  useEffect(() => {
    filtrarCiudades(ciudadInput);
  }, [ciudadInput, filtrarCiudades]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ciudadSugerenciasRef.current && !ciudadSugerenciasRef.current.contains(e.target as Node) &&
          ciudadInputRef.current && !ciudadInputRef.current.contains(e.target as Node)) {
        setShowCiudadSugerencias(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectCiudad = (ciudad: Ciudad) => {
    setForm(prev => ({
      ...prev,
      ciudadId: ciudad.id.toString(),
      ciudadNombre: ciudad.nombre
    }));
    setCiudadInput(ciudad.nombre);
    setShowCiudadSugerencias(false);
    setFieldErrors(prev => {
      const { ciudad, ...rest } = prev;
      return rest;
    });
  };

  const handleCiudadKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCiudadSelectedIndex(prev => Math.min(prev + 1, ciudadSugerencias.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCiudadSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (ciudadSelectedIndex >= 0 && ciudadSugerencias[ciudadSelectedIndex]) {
        selectCiudad(ciudadSugerencias[ciudadSelectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowCiudadSugerencias(false);
    }
  };

  // ========== AUTOCOMPLETE SERVICIOS ==========
  const filtrarServicios = useCallback((input: string) => {
    if (!input.trim()) {
      setServicioSugerencias([]);
      return;
    }
    const idsSeleccionados = form.servicios.map(s => s.id);
    const filtrados = servicios.filter(s => 
      s.nombre.toLowerCase().includes(input.toLowerCase()) &&
      !idsSeleccionados.includes(s.id)
    );
    setServicioSugerencias(filtrados.slice(0, 8));
    setServicioSelectedIndex(-1);
  }, [servicios, form.servicios]);

  useEffect(() => {
    filtrarServicios(servicioInput);
  }, [servicioInput, filtrarServicios]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (servicioSugerenciasRef.current && !servicioSugerenciasRef.current.contains(e.target as Node) &&
          servicioInputRef.current && !servicioInputRef.current.contains(e.target as Node)) {
        setShowServicioSugerencias(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addServicio = (servicioId: number, incluido: number) => {
    const yaExiste = form.servicios.some(s => s.id === servicioId);
    if (!yaExiste) {
      setForm(prev => ({ 
        ...prev, 
        servicios: [...prev.servicios, { id: servicioId, incluido }] 
      }));
    }
    setServicioInput('');
    setShowServicioSugerencias(false);
    servicioInputRef.current?.focus();
  };

  const removeServicio = (servicioId: number) => {
    setForm(prev => ({
      ...prev,
      servicios: prev.servicios.filter(s => s.id !== servicioId)
    }));
  };

  const toggleServicioTipo = (servicioId: number) => {
    setForm(prev => ({
      ...prev,
      servicios: prev.servicios.map(s => 
        s.id === servicioId 
          ? { ...s, incluido: s.incluido === 1 ? 0 : 1 } 
          : s
      )
    }));
  };

  const handleServicioKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setServicioSelectedIndex(prev => Math.min(prev + 1, servicioSugerencias.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setServicioSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (servicioSelectedIndex >= 0 && servicioSugerencias[servicioSelectedIndex]) {
        setSelectedServicioForModal(servicioSugerencias[servicioSelectedIndex]);
        setShowServicioModal(true);
      }
    } else if (e.key === 'Escape') {
      setShowServicioSugerencias(false);
    }
  };

  // ========== HANDLERS DE TELÉFONO ==========
  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Si está vacío y el usuario borró, permitir
    if (!raw.trim()) {
      setForm(prev => ({ ...prev, whatsapp: '' }));
      return;
    }
    // Si no empieza con +, agregar +56 automáticamente
    let valor = raw;
    if (!valor.startsWith('+')) {
      valor = '+' + valor.replace(/^\+/, '');
    }
    valor = soloNumerosYPlus(valor);
    setForm(prev => ({ ...prev, whatsapp: valor }));
  };

  const handleTelefonoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw.trim()) {
      setForm(prev => ({ ...prev, telefono: '' }));
      return;
    }
    let valor = raw;
    if (!valor.startsWith('+')) {
      valor = '+' + valor.replace(/^\+/, '');
    }
    valor = soloNumerosYPlus(valor);
    setForm(prev => ({ ...prev, telefono: valor }));
  };

  const handleWhatsappBlur = () => {
    setWhatsappTouched(true);
    const formateado = formatearTelefono(form.whatsapp);
    setForm(prev => ({ ...prev, whatsapp: formateado }));
  };

  const handleTelefonoBlur = () => {
    setTelefonoTouched(true);
    const formateado = formatearTelefono(form.telefono);
    setForm(prev => ({ ...prev, telefono: formateado }));
  };

  // ========== HANDLER EDAD ==========
  const handleEdadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Solo permitir números
    const nums = val.replace(/\D/g, '');
    setForm(prev => ({ ...prev, edad: nums }));
  };

  const edadError = edadTouched && (form.edad && parseInt(form.edad) < 18) 
    ? 'Debes ser mayor de 18 años' 
    : null;
  const edadNum = parseInt(form.edad || '0');
  const edadInvalida = edadTouched && edadNum > 0 && edadNum < 18;

  const whatsappValidacion = whatsappTouched ? validarTelefono(form.whatsapp) : { valido: true };
  const telefonoValidacion = telefonoTouched ? validarTelefono(form.telefono) : { valido: true };

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar todo antes de enviar
    const errors: Record<string, string> = {};
    
    if (!form.nombre.trim()) errors.nombre = 'Nombre artístico requerido';
    
    if (!form.edad || parseInt(form.edad) < 18) {
      errors.edad = 'Debes ser mayor de 18 años';
    }
    
    if (!form.ciudadId) errors.ciudad = 'Selecciona una ciudad';
    
    const waVal = validarTelefono(form.whatsapp);
    if (!waVal.valido) errors.whatsapp = waVal.error!;
    
    const telVal = validarTelefono(form.telefono);
    if (!telVal.valido) errors.telefono = telVal.error!;
    
    if (form.servicios.length === 0) errors.servicios = 'Selecciona al menos un servicio';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setEdadTouched(true);
      setWhatsappTouched(true);
      setTelefonoTouched(true);
      return;
    }

    setFieldErrors({});
    setSaving(true);
    setError('');

    // Sincronizar el HTML más reciente del editor antes de enviar
    if (quillRef.current) {
      form.descripcionLarga = quillRef.current.root.innerHTML;
    }

    try {
      const res = await fetch(`${API_BASE}/perfil-guardar.php`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...form,
          ciudadId: parseInt(form.ciudadId)
        })
      });
      const data = await res.json();

      if (!data.success) {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
          setSaving(false);
          return;
        }
        throw new Error(data.error || 'Error al guardar');
      }

      showNotification('Perfil guardado correctamente');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Servicios seleccionados con datos completos
  const serviciosSeleccionados = servicios
    .filter(s => form.servicios.some(fs => fs.id === s.id))
    .map(s => {
      const formServicio = form.servicios.find(fs => fs.id === s.id)!;
      return { ...s, incluido: formServicio.incluido };
    });

  const serviciosIncluidos = serviciosSeleccionados.filter(s => s.incluido === 1);
  const serviciosAdicionales = serviciosSeleccionados.filter(s => s.incluido === 0);

  const groupByGrupo = (servs: typeof serviciosSeleccionados) => {
    return servs.reduce((acc, s) => {
      if (!acc[s.grupo]) acc[s.grupo] = [];
      acc[s.grupo].push(s);
      return acc;
    }, {} as Record<string, typeof servs>);
  };

  const incluidosGrouped = groupByGrupo(serviciosIncluidos);
  const adicionalesGrouped = groupByGrupo(serviciosAdicionales);

  return (
    <div className="space-y-6 md:space-y-8 w-full max-w-full">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
          <i className="fas fa-user-edit text-red-500"></i>
          Editar mi Perfil
        </h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">Completa tu ficha para aparecer en el directorio</p>
      </div>

      {/* On Tour - Intro */}
      <div className="bg-gradient-to-r from-purple-900/40 via-fuchsia-900/30 to-purple-900/40 border border-purple-500/30 rounded-2xl p-5 md:p-7">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/20">
            <i className="fas fa-plane-departure text-white text-xl md:text-2xl"></i>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
              ¿Estás de viaje?
              <span className="text-xs font-normal text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full">NUEVO</span>
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Activa el modo <strong className="text-purple-300">En Gira</strong> para mostrar que estás disponible en otra ciudad. 
              Los clientes podrán ver tu ubicación actual y tus fechas disponibles.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-fuchsia-600"></div>
            <span className="ms-3 text-sm font-medium text-purple-300">En Gira</span>
          </label>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl flex items-center gap-2 animate-pulse text-sm">
          <i className="fas fa-check-circle"></i>{successMsg}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <i className="fas fa-exclamation-triangle"></i>{error}
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-300">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        {/* Sección 1: Información básica */}
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-4 md:p-6">
          <h2 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-4 md:mb-6 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-xs">1</span>
            Información Básica
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
            {/* Nombre */}
            <div>
              <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">Nombre Artístico</label>
              <div className="relative">
                <i className="fas fa-star absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => {
                    setForm({ ...form, nombre: e.target.value });
                    if (fieldErrors.nombre) {
                      setFieldErrors(prev => { const { nombre, ...r } = prev; return r; });
                    }
                  }}
                  placeholder="Cómo te verán los clientes"
                  className={`w-full bg-[#1a1a24] border ${fieldErrors.nombre ? 'border-red-500 ring-1 ring-red-500/20' : 'border-gray-700'} rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all text-sm`}
                />
              </div>
              {fieldErrors.nombre && (
                <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1.5 animate-pulse">
                  <i className="fas fa-exclamation-circle"></i>{fieldErrors.nombre}
                </p>
              )}
            </div>

            {/* EDAD con validación visual */}
            <div>
              <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">Edad</label>
              <div className="relative">
                <i className="fas fa-birthday-cake absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.edad}
                  onChange={handleEdadChange}
                  onBlur={() => setEdadTouched(true)}
                  placeholder="25"
                  className={`w-full bg-[#1a1a24] border ${
                    edadInvalida || fieldErrors.edad 
                      ? 'border-red-500 ring-1 ring-red-500/20' 
                      : edadTouched && edadNum >= 18 
                        ? 'border-green-500/50' 
                        : 'border-gray-700'
                  } rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all text-sm`}
                />
                {/* Icono de validación */}
                {edadTouched && edadNum >= 18 && (
                  <i className="fas fa-check-circle absolute right-4 top-1/2 -translate-y-1/2 text-green-500 text-sm"></i>
                )}
                {edadInvalida && (
                  <i className="fas fa-exclamation-circle absolute right-4 top-1/2 -translate-y-1/2 text-red-500 text-sm animate-bounce"></i>
                )}
              </div>
              {/* Mensaje de error animado */}
              <div className={`overflow-hidden transition-all duration-300 ${edadInvalida || fieldErrors.edad ? 'max-h-8 opacity-100 mt-1.5' : 'max-h-0 opacity-0'}`}>
                <p className="text-red-400 text-xs flex items-center gap-1.5">
                  <i className="fas fa-ban"></i>
                  {fieldErrors.edad || edadError}
                </p>
              </div>
              {/* Hint cuando es válido */}
              {edadTouched && edadNum >= 18 && (
                <p className="text-green-500/70 text-xs mt-1 flex items-center gap-1">
                  <i className="fas fa-check"></i> Edad válida
                </p>
              )}
            </div>

            {/* Altura */}
            <div>
              <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">Altura (cm)</label>
              <div className="relative">
                <i className="fas fa-ruler-vertical absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                <input
                  type="number"
                  value={form.altura}
                  onChange={(e) => setForm({ ...form, altura: e.target.value })}
                  placeholder="170"
                  className="w-full bg-[#1a1a24] border border-gray-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all text-sm"
                />
              </div>
            </div>

            {/* Peso */}
            <div>
              <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">Peso (kg)</label>
              <div className="relative">
                <i className="fas fa-weight-scale absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                <input
                  type="number"
                  value={form.peso}
                  onChange={(e) => setForm({ ...form, peso: e.target.value })}
                  placeholder="60"
                  className="w-full bg-[#1a1a24] border border-gray-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all text-sm"
                />
              </div>
            </div>

            {/* Medidas */}
            <div>
              <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">Medidas</label>
              <div className="relative">
                <i className="fas fa-ruler-combined absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                <input
                  type="text"
                  value={form.medidas}
                  onChange={(e) => setForm({ ...form, medidas: e.target.value })}
                  placeholder="90-60-90"
                  className="w-full bg-[#1a1a24] border border-gray-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all text-sm"
                />
              </div>
            </div>

            {/* WHATSAPP con bandera y validación */}
            <div>
              <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">WhatsApp</label>
              <div className="relative">
                {/* Bandera del país */}
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg select-none" title="Chile">
                  {PAIS_FLAG}
                </span>
                <input
                  type="text"
                  value={form.whatsapp}
                  onChange={handleWhatsappChange}
                  onBlur={handleWhatsappBlur}
                  placeholder="+56 9 1234 5678"
                  className={`w-full bg-[#1a1a24] border ${
                    !whatsappValidacion.valido && whatsappTouched
                      ? 'border-red-500 ring-1 ring-red-500/20'
                      : whatsappTouched && whatsappValidacion.valido && form.whatsapp
                        ? 'border-green-500/50'
                        : 'border-gray-700'
                  } rounded-xl py-3 pl-11 pr-10 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all text-sm`}
                />
                {/* Icono estado */}
                {whatsappTouched && form.whatsapp && (
                  <i className={`fas ${whatsappValidacion.valido ? 'fa-check-circle text-green-500' : 'fa-exclamation-circle text-red-500 animate-bounce'} absolute right-4 top-1/2 -translate-y-1/2 text-sm`}></i>
                )}
              </div>
              {/* Error animado */}
              <div className={`overflow-hidden transition-all duration-300 ${!whatsappValidacion.valido && whatsappTouched ? 'max-h-8 opacity-100 mt-1.5' : 'max-h-0 opacity-0'}`}>
                <p className="text-red-400 text-xs flex items-center gap-1.5">
                  <i className="fas fa-phone-slash"></i>{whatsappValidacion.error}
                </p>
              </div>
              {/* Hint */}
              {whatsappTouched && whatsappValidacion.valido && form.whatsapp && (
                <p className="text-green-500/70 text-xs mt-1 flex items-center gap-1">
                  <i className="fas fa-check"></i> Formato correcto
                </p>
              )}
              <p className="text-gray-600 text-[10px] mt-1">Incluye el código de país (ej: +56)</p>
            </div>

            {/* TELÉFONO con bandera y validación */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">Teléfono Llamadas</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg select-none" title="Chile">
                  {PAIS_FLAG}
                </span>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={handleTelefonoChange}
                  onBlur={handleTelefonoBlur}
                  placeholder="+56 9 1234 5678"
                  className={`w-full bg-[#1a1a24] border ${
                    !telefonoValidacion.valido && telefonoTouched
                      ? 'border-red-500 ring-1 ring-red-500/20'
                      : telefonoTouched && telefonoValidacion.valido && form.telefono
                        ? 'border-green-500/50'
                        : 'border-gray-700'
                  } rounded-xl py-3 pl-11 pr-10 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all text-sm`}
                />
                {telefonoTouched && form.telefono && (
                  <i className={`fas ${telefonoValidacion.valido ? 'fa-check-circle text-green-500' : 'fa-exclamation-circle text-red-500 animate-bounce'} absolute right-4 top-1/2 -translate-y-1/2 text-sm`}></i>
                )}
              </div>
              <div className={`overflow-hidden transition-all duration-300 ${!telefonoValidacion.valido && telefonoTouched ? 'max-h-8 opacity-100 mt-1.5' : 'max-h-0 opacity-0'}`}>
                <p className="text-red-400 text-xs flex items-center gap-1.5">
                  <i className="fas fa-phone-slash"></i>{telefonoValidacion.error}
                </p>
              </div>
              {telefonoTouched && telefonoValidacion.valido && form.telefono && (
                <p className="text-green-500/70 text-xs mt-1 flex items-center gap-1">
                  <i className="fas fa-check"></i> Formato correcto
                </p>
              )}
              <p className="text-gray-600 text-[10px] mt-1">Incluye el código de país (ej: +56)</p>
            </div>
          </div>
        </div>

        {/* Sección 2: Ubicación con Autocomplete */}
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-4 md:p-6">
          <h2 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-4 md:mb-6 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-xs">2</span>
            Ubicación
          </h2>

          <div className="max-w-md relative" ref={ciudadSugerenciasRef}>
            <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
              Ciudad donde atiendes
              {fieldErrors.ciudad && (
                <span className="text-red-400 ml-2 text-xs normal-case">
                  <i className="fas fa-exclamation-circle"></i> {fieldErrors.ciudad}
                </span>
              )}
            </label>
            <div className="relative">
              <i className="fas fa-map-marker-alt absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
              <input
                ref={ciudadInputRef}
                type="text"
                value={ciudadInput}
                onChange={(e) => {
                  setCiudadInput(e.target.value);
                  setShowCiudadSugerencias(true);
                  if (!e.target.value.trim()) {
                    setForm(prev => ({ ...prev, ciudadId: '', ciudadNombre: '' }));
                  }
                }}
                onFocus={() => setShowCiudadSugerencias(true)}
                onKeyDown={handleCiudadKeyDown}
                placeholder="Escribe para buscar tu ciudad..."
                className={`w-full bg-[#1a1a24] border ${fieldErrors.ciudad ? 'border-red-500 ring-1 ring-red-500/20' : 'border-gray-700'} rounded-xl py-3 pl-11 pr-10 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all text-sm`}
              />
              {ciudadInput && (
                <button
                  type="button"
                  onClick={() => { 
                    setCiudadInput(''); 
                    setForm(prev => ({ ...prev, ciudadId: '', ciudadNombre: '' }));
                    setShowCiudadSugerencias(false); 
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>

            {/* Dropdown ciudades */}
            {showCiudadSugerencias && ciudadSugerencias.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-[#1a1a24] border border-gray-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden max-h-64 overflow-y-auto">
                {ciudadSugerencias.map((ciudad, index) => (
                  <button
                    key={ciudad.id}
                    type="button"
                    onClick={() => selectCiudad(ciudad)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                      index === ciudadSelectedIndex 
                        ? 'bg-red-500/10 text-red-400' 
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <i className="fas fa-city text-gray-500 text-xs"></i>
                    <span className="flex-1 text-sm">{ciudad.nombre}</span>
                  </button>
                ))}
              </div>
            )}

            {showCiudadSugerencias && ciudadInput && ciudadSugerencias.length === 0 && (
              <div className="absolute z-50 w-full mt-1 bg-[#1a1a24] border border-gray-700 rounded-xl shadow-2xl p-4 text-center text-gray-500 text-sm">
                <i className="fas fa-search mb-2 block text-lg"></i>
                No se encontraron ciudades
              </div>
            )}
          </div>
        </div>

        {/* Sección 3: Características Físicas */}
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-4 md:p-6">
          <h2 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-4 md:mb-6 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-xs">3</span>
            Características Físicas
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
            <div className="relative">
              <SearchAutocomplete
                label="Nacionalidad"
                icon="fa-flag"
                itemIcon="fa-globe"
                placeholder="Busca tu nacionalidad..."
                options={opciones.nacionalidades || []}
                value={form.nacionalidad}
                onChange={(v) => setForm(prev => ({ ...prev, nacionalidad: v }))}
              />
            </div>
            <div className="relative">
              <SearchAutocomplete
                label="Etnia"
                icon="fa-users"
                itemIcon="fa-users"
                placeholder="Busca tu etnia..."
                options={opciones.etnias || []}
                value={form.etnia}
                onChange={(v) => setForm(prev => ({ ...prev, etnia: v }))}
              />
            </div>
            <div className="relative">
              <SearchAutocomplete
                label="Color de Ojos"
                icon="fa-eye"
                itemIcon="fa-eye"
                placeholder="Busca color de ojos..."
                options={opciones.colores_ojos || []}
                value={form.color_ojos}
                onChange={(v) => setForm(prev => ({ ...prev, color_ojos: v }))}
              />
            </div>
            <div className="relative">
              <SearchAutocomplete
                label="Color de Pelo"
                icon="fa-user"
                itemIcon="fa-user"
                placeholder="Busca color de pelo..."
                options={opciones.colores_pelo || []}
                value={form.color_pelo}
                onChange={(v) => setForm(prev => ({ ...prev, color_pelo: v }))}
              />
            </div>
            <div className="relative">
              <SearchAutocomplete
                label="Orientación"
                icon="fa-heart"
                itemIcon="fa-heart"
                placeholder="Busca tu orientación..."
                options={opciones.orientaciones || []}
                value={form.orientacion}
                onChange={(v) => setForm(prev => ({ ...prev, orientacion: v }))}
              />
            </div>
            <div className="relative">
              <SearchAutocomplete
                label="Estilo"
                icon="fa-sparkles"
                itemIcon="fa-sparkles"
                placeholder="Busca tu estilo..."
                options={opciones.estilos || []}
                value={form.estilo}
                onChange={(v) => setForm(prev => ({ ...prev, estilo: v }))}
              />
            </div>
          </div>
        </div>

        {/* Sección 4: Servicios */}
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-4 md:p-6">
          <h2 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-4 md:mb-6 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-xs">4</span>
            Servicios que ofreces
            {fieldErrors.servicios && (
              <span className="text-red-400 ml-2 text-xs normal-case">
                <i className="fas fa-exclamation-circle"></i> {fieldErrors.servicios}
              </span>
            )}
          </h2>

          {/* Input de búsqueda */}
          {!serviciosLoaded ? (
            <div className="flex items-center gap-3 py-4 text-gray-500">
              <i className="fas fa-circle-notch fa-spin"></i>
              <span className="text-sm">Cargando servicios...</span>
            </div>
          ) : (
          <div className="relative mb-4 md:mb-6" ref={servicioSugerenciasRef}>
            <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">Buscar y agregar servicios</label>
            <div className="relative">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
              <input
                ref={servicioInputRef}
                type="text"
                value={servicioInput}
                onChange={(e) => {
                  setServicioInput(e.target.value);
                  setShowServicioSugerencias(true);
                }}
                onFocus={() => setShowServicioSugerencias(true)}
                onKeyDown={handleServicioKeyDown}
                placeholder="Escribe para buscar servicios..."
                className="w-full bg-[#1a1a24] border border-gray-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all text-sm"
              />
              {servicioInput && (
                <button
                  type="button"
                  onClick={() => { setServicioInput(''); setShowServicioSugerencias(false); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>

            {showServicioSugerencias && servicioSugerencias.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-[#1a1a24] border border-gray-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden max-h-72 overflow-y-auto">
                {servicioSugerencias.map((servicio, index) => (
                  <div
                    key={servicio.id}
                    onClick={() => {
                      setSelectedServicioForModal(servicio);
                      setShowServicioModal(true);
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 transition-all cursor-pointer ${
                      index === servicioSelectedIndex 
                        ? 'bg-red-500/10' 
                        : 'hover:bg-gray-800'
                    }`}
                  >
                    <span 
                      className="w-2 h-2 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: servicio.color || '#6366f1' }}
                    ></span>
                    <span className="flex-1 text-sm text-gray-300">{servicio.nombre}</span>
                    <span className="text-[10px] text-gray-500 capitalize mr-1 hidden sm:inline">{GRUPOS_SERVICIOS[servicio.grupo]?.label || servicio.grupo}</span>
                    <span className="text-[11px] text-purple-400 font-semibold flex items-center gap-1">
                      <i className="fas fa-plus"></i> Elegir tipo
                    </span>
                  </div>
                ))}
              </div>
            )}

            {showServicioSugerencias && servicioInput && servicioSugerencias.length === 0 && (
              <div className="absolute z-50 w-full mt-1 bg-[#1a1a24] border border-gray-700 rounded-xl shadow-2xl p-4 text-center text-gray-500 text-sm">
                <i className="fas fa-search mb-2 block text-lg"></i>
                No se encontraron servicios
              </div>
            )}
          </div>
          )}

          {/* MODAL TIPO DE SERVICIO */}
          {showServicioModal && selectedServicioForModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
              <div className="bg-[#1a1a24] border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl shadow-black/50 overflow-hidden">
                <div className="px-5 pt-5 pb-2">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedServicioForModal.color || '#6366f1' }}></span>
                    <h3 className="text-lg font-bold text-white">Agregar servicio</h3>
                  </div>
                  <p className="text-gray-400 text-sm ml-6">
                    {selectedServicioForModal.nombre}
                  </p>
                </div>
                <div className="p-5 pt-3 space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      addServicio(selectedServicioForModal.id, 1);
                      setShowServicioModal(false);
                      setSelectedServicioForModal(null);
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <i className="fas fa-check-circle text-green-400 text-lg"></i>
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-semibold text-sm">Incluido</div>
                      <div className="text-gray-500 text-xs">Viene con el servicio base</div>
                    </div>
                    <i className="fas fa-chevron-right text-green-400/50 group-hover:text-green-400 transition-colors"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      addServicio(selectedServicioForModal.id, 0);
                      setShowServicioModal(false);
                      setSelectedServicioForModal(null);
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <i className="fas fa-plus-circle text-amber-400 text-lg"></i>
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-semibold text-sm">Adicional</div>
                      <div className="text-gray-500 text-xs">Se ofrece como extra</div>
                    </div>
                    <i className="fas fa-chevron-right text-amber-400/50 group-hover:text-amber-400 transition-colors"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowServicioModal(false);
                      setSelectedServicioForModal(null);
                    }}
                    className="w-full py-2.5 text-center text-gray-500 hover:text-gray-300 text-sm transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SERVICIOS INCLUIDOS */}
          {serviciosIncluidos.length > 0 && (
            <div className="mb-6">
              <h3 className="text-green-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                <i className="fas fa-check-circle"></i>
                Servicios Incluidos
                <span className="text-gray-600 font-normal normal-case">(vienen con el servicio base)</span>
              </h3>
              <div className="space-y-3">
                {Object.entries(incluidosGrouped).map(([grupo, servs]) => (
                  <div key={grupo}>
                    <h4 className="text-gray-500 text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <i className={`fas ${GRUPOS_SERVICIOS[grupo]?.icon || 'fa-circle'} text-gray-600 text-[10px]`}></i>
                      {GRUPOS_SERVICIOS[grupo]?.label || grupo}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {servs.map((servicio) => (
                        <span
                          key={servicio.id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-green-500/10 text-green-400 border border-green-500/20"
                        >
                          <span 
                            className="w-1.5 h-1.5 rounded-full" 
                            style={{ backgroundColor: servicio.color || '#6366f1' }}
                          ></span>
                          {servicio.nombre}
                          <button
                            type="button"
                            onClick={() => toggleServicioTipo(servicio.id)}
                            className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-500/20 text-green-300 hover:bg-amber-500/20 hover:text-amber-300 transition-all"
                            title="Cambiar a Adicional"
                          >
                            INCLUIDO
                          </button>
                          <button
                            type="button"
                            onClick={() => removeServicio(servicio.id)}
                            className="ml-1 text-green-400/60 hover:text-green-400 transition-colors"
                          >
                            <i className="fas fa-times text-xs"></i>
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SERVICIOS ADICIONALES */}
          {serviciosAdicionales.length > 0 && (
            <div>
              <h3 className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                <i className="fas fa-plus-circle"></i>
                Servicios Adicionales
                <span className="text-gray-600 font-normal normal-case">(se ofrecen como extra)</span>
              </h3>
              <div className="space-y-3">
                {Object.entries(adicionalesGrouped).map(([grupo, servs]) => (
                  <div key={grupo}>
                    <h4 className="text-gray-500 text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <i className={`fas ${GRUPOS_SERVICIOS[grupo]?.icon || 'fa-circle'} text-gray-600 text-[10px]`}></i>
                      {GRUPOS_SERVICIOS[grupo]?.label || grupo}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {servs.map((servicio) => (
                        <span
                          key={servicio.id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        >
                          <span 
                            className="w-1.5 h-1.5 rounded-full" 
                            style={{ backgroundColor: servicio.color || '#6366f1' }}
                          ></span>
                          {servicio.nombre}
                          <button
                            type="button"
                            onClick={() => toggleServicioTipo(servicio.id)}
                            className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 hover:bg-green-500/20 hover:text-green-300 transition-all"
                            title="Cambiar a Incluido"
                          >
                            ADICIONAL
                          </button>
                          <button
                            type="button"
                            onClick={() => removeServicio(servicio.id)}
                            className="ml-1 text-amber-400/60 hover:text-amber-400 transition-colors"
                          >
                            <i className="fas fa-times text-xs"></i>
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {serviciosSeleccionados.length === 0 && (
            <div className="text-center py-8 text-gray-600">
              <i className="fas fa-hand-sparkles text-3xl mb-3 block"></i>
              <p className="text-sm">No has seleccionado servicios aún</p>
              <p className="text-xs mt-1">Escribe arriba para buscar y agregar</p>
            </div>
          )}
        </div>

        {/* Sección 5: Descripción */}
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-4 md:p-6">
          <h2 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-4 md:mb-6 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-xs">5</span>
            Sobre ti
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">Descripción Corta</label>
              <input
                type="text"
                value={form.descripcionCorta}
                onChange={(e) => setForm({ ...form, descripcionCorta: e.target.value })}
                placeholder="Una frase que te describa..."
                maxLength={300}
                className="w-full bg-[#1a1a24] border border-gray-700 rounded-xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all text-sm"
              />
              <p className="text-gray-600 text-xs mt-1 text-right">{form.descripcionCorta.length}/300</p>
            </div>

            <div>
              <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">Descripción Larga</label>
              <div
                ref={editorRef}
                className="bg-[#1a1a24] border border-gray-700 rounded-xl text-white focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500/30 transition-all text-sm quill-dark"
              />
              <p className="text-gray-600 text-xs mt-1 text-right">{form.descripcionLarga.length} caracteres</p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-6 md:px-8 py-3 md:py-3.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2 text-sm md:text-base"
          >
            {saving && <i className="fas fa-circle-notch fa-spin"></i>}
            {saving ? 'Guardando...' : 'Guardar Perfil'}
          </button>
        </div>
      </form>
    </div>
  );
}