import { useState, useRef, useMemo, useEffect } from 'react';

const ICON_CATEGORIES = {
  'Generales': [
    'fa-tag', 'fa-tags', 'fa-heart', 'fa-star', 'fa-gem', 'fa-crown', 'fa-fire',
    'fa-bolt', 'fa-moon', 'fa-sun', 'fa-spa', 'fa-glass-cheers', 'fa-music',
    'fa-film', 'fa-camera', 'fa-image', 'fa-palette', 'fa-paint-brush', 'fa-sparkles'
  ],
  'Usuarios & Social': [
    'fa-user', 'fa-users', 'fa-user-friends', 'fa-user-group', 'fa-user-plus',
    'fa-user-check', 'fa-user-shield', 'fa-user-tie', 'fa-user-secret',
    'fa-handshake', 'fa-hand-holding-heart', 'fa-hands-helping',
    'fa-comments', 'fa-comment', 'fa-comment-dots', 'fa-comment-alt',
    'fa-envelope', 'fa-paper-plane', 'fa-share-alt', 'fa-share',
    'fa-bell', 'fa-bell-slash', 'fa-bullhorn', 'fa-bullseye'
  ],
  'Seguridad & VIP': [
    'fa-shield-alt', 'fa-shield', 'fa-lock', 'fa-lock-open', 'fa-key',
    'fa-fingerprint', 'fa-id-card', 'fa-id-badge', 'fa-passport',
    'fa-certificate', 'fa-award', 'fa-medal', 'fa-trophy', 'fa-star-half-alt',
    'fa-crown', 'fa-gem', 'fa-ring', 'fa-ribbon', 'fa-badge-check'
  ],
  'Servicios & Experiencias': [
    'fa-glass-martini-alt', 'fa-wine-glass', 'fa-cocktail', 'fa-beer',
    'fa-coffee', 'fa-utensils', 'fa-hamburger', 'fa-pizza-slice',
    'fa-concierge-bell', 'fa-bed', 'fa-hotel', 'fa-swimming-pool',
    'fa-hot-tub', 'fa-dumbbell', 'fa-running', 'fa-bicycle',
    'fa-car', 'fa-taxi', 'fa-plane', 'fa-map-marked-alt', 'fa-map-marker-alt'
  ],
  'Romance & Encuentros': [
    'fa-heart', 'fa-heart-broken', 'fa-kiss', 'fa-kiss-wink-heart',
    'fa-grin-hearts', 'fa-grin-wink', 'fa-grin-stars', 'fa-grin-tongue-wink',
    'fa-glass-cheers', 'fa-gift', 'fa-box-open', 'fa-birthday-cake',
    'fa-ring', 'fa-venus', 'fa-venus-mars', 'fa-transgender-alt',
    'fa-mars', 'fa-female', 'fa-male', 'fa-restroom'
  ],
  'Estilo & Moda': [
    'fa-tshirt', 'fa-shoe-prints', 'fa-shopping-bag', 'fa-shopping-cart',
    'fa-gem', 'fa-ring', 'fa-glasses', 'fa-sunglasses', 'fa-hat-cowboy',
    'fa-mask', 'fa-theater-masks', 'fa-couch', 'fa-chair'
  ],
  'Tecnología & Web': [
    'fa-wifi', 'fa-signal', 'fa-broadcast-tower', 'fa-mobile-alt',
    'fa-laptop', 'fa-desktop', 'fa-tablet-alt', 'fa-camera-retro',
    'fa-video', 'fa-video-slash', 'fa-microphone', 'fa-microphone-alt',
    'fa-headphones', 'fa-headset', 'fa-gamepad', 'fa-robot'
  ],
  'Dinero & Negocios': [
    'fa-dollar-sign', 'fa-euro-sign', 'fa-pound-sign', 'fa-yen-sign',
    'fa-credit-card', 'fa-wallet', 'fa-money-bill-wave', 'fa-coins',
    'fa-chart-line', 'fa-chart-bar', 'fa-chart-pie', 'fa-percentage',
    'fa-receipt', 'fa-file-invoice-dollar', 'fa-hand-holding-usd'
  ],
  'Tiempo & Eventos': [
    'fa-calendar', 'fa-calendar-alt', 'fa-calendar-check', 'fa-calendar-day',
    'fa-clock', 'fa-hourglass', 'fa-hourglass-half', 'fa-hourglass-end',
    'fa-history', 'fa-redo', 'fa-undo', 'fa-sync', 'fa-sync-alt',
    'fa-stopwatch', 'fa-bell', 'fa-bell-slash'
  ],
  'Estados & Estados de ánimo': [
    'fa-smile', 'fa-smile-beam', 'fa-smile-wink', 'fa-grin',
    'fa-grin-alt', 'fa-grin-beam', 'fa-grin-squint', 'fa-grin-tears',
    'fa-frown', 'fa-frown-open', 'fa-meh', 'fa-meh-rolling-eyes',
    'fa-sad-cry', 'fa-sad-tear', 'fa-angry', 'fa-dizzy', 'fa-flushed'
  ]
};

const ALL_ICONS = Object.values(ICON_CATEGORIES).flat();

interface Props {
  value: string;
  onChange: (icon: string) => void;
  error?: boolean;
}

export default function IconPicker({ value, onChange, error }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const pickerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const filteredIcons = useMemo(() => {
    let icons = activeCategory === 'Todos' ? ALL_ICONS : ICON_CATEGORIES[activeCategory as keyof typeof ICON_CATEGORIES] || [];
    if (search.trim()) {
      const q = search.toLowerCase().replace(/^fa-/, '');
      icons = ALL_ICONS.filter(icon => icon.toLowerCase().includes(q));
    }
    return icons;
  }, [search, activeCategory]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const categories = ['Todos', ...Object.keys(ICON_CATEGORIES)];

  return (
    <div ref={pickerRef} className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-1.5">Icono</label>
      <button type="button" onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 px-4 py-2.5 bg-[#0f0f23] border rounded-lg text-white transition-colors ${error ? 'border-red-500' : 'border-gray-700 hover:border-gray-500'}`}>
        <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
          <i className={`fas ${value} text-yellow-400`}></i>
        </div>
        <span className="text-sm text-gray-300">{value}</span>
        <i className={`fas fa-chevron-down ml-auto text-gray-500 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-[#1a1a2e] border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-3 border-b border-gray-700">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar icono..."
                className="w-full pl-8 pr-3 py-2 bg-[#0f0f23] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500" autoFocus />
            </div>
          </div>
          <div className="flex gap-1 p-2 overflow-x-auto border-b border-gray-700 scrollbar-thin">
            {categories.map(cat => (
              <button key={cat} onClick={() => { setActiveCategory(cat); setSearch(''); }}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${activeCategory === cat ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-[#2d2d44] text-gray-400 hover:text-white border border-transparent'}`}>
                {cat}
              </button>
            ))}
          </div>
          <div className="max-h-64 overflow-y-auto p-3">
            {filteredIcons.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm"><i className="fas fa-search mb-2 block text-lg opacity-50"></i>No se encontraron iconos</div>
            ) : (
              <div className="grid grid-cols-6 gap-1.5">
                {filteredIcons.map(icon => (
                  <button key={icon} type="button" onClick={() => { onChange(icon); setIsOpen(false); setSearch(''); }}
                    className={`aspect-square rounded-lg flex items-center justify-center text-lg transition-all ${value === icon ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' : 'bg-[#2d2d44] text-gray-400 hover:bg-[#3d3d5c] hover:text-white border border-transparent'}`} title={icon}>
                    <i className={`fas ${icon}`}></i>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="px-3 py-2 border-t border-gray-700 bg-[#0f0f23]/50">
            <p className="text-xs text-gray-500 text-center">{filteredIcons.length} de {ALL_ICONS.length} iconos</p>
          </div>
        </div>
      )}
    </div>
  );
}
