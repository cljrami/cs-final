<?php
ini_set('display_errors',0); error_reporting(E_ALL);
try { require_once __DIR__ . '/api/bootstrap.php'; if (!defined('SITE_URL')) require_once __DIR__ . '/api/config/mail.php'; } catch (Throwable $e) {}
$siteName = 'ConsexVIP';
?>
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Publica tu banner | Consexvip</title>
<link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/_astro/escort-profile.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>*{font-family:'Inter',sans-serif}body{background:#0a0a0f;color:#e2e2e2}.bg-card{background:#13131a!important;border-color:rgba(255,255,255,0.05)!important}.rounded-2xl{border-radius:1rem}.p-6{padding:1.5rem}.w-full{width:100%}.text-white{color:#fff}.text-gray-400{color:#9ca3af}.text-red-400{color:#f87171}.text-green-400{color:#4ade80}.text-xs{font-size:0.75rem}.mb-1{margin-bottom:0.25rem}.mb-2{margin-bottom:0.5rem}.mt-1{margin-top:0.25rem}.hidden{display:none}.cursor-pointer{cursor:pointer}.bg-red-500{background:#ef4444!important}.bg-red-600{background:#dc2626!important}.text-red-500{color:#ef4444}input,select{color:#fff;background:#12121a;border:1px solid rgba(255,255,255,0.1);border-radius:0.5rem;padding:0.625rem 0.75rem;font-size:0.875rem;width:100%;outline:none;transition:border-color .2s}input:focus,select:focus{border-color:#ef4444;box-shadow:0 0 0 1px #ef4444}button[type="submit"]{width:100%;padding:0.75rem 1.5rem;background:#dc2626;color:#fff;border-radius:0.5rem;font-weight:500;border:none;cursor:pointer;transition:background .2s;box-shadow:0 4px 14px rgba(220,38,38,0.3)}button[type="submit"]:hover{background:#b91c1c}.drop-zone{border:2px dashed rgba(255,255,255,0.25);background:rgba(255,255,255,0.03);transition:all .2s;border-radius:1rem;padding:1.5rem;text-align:center}.gap-4{gap:1rem}.drop-zone:hover{border-color:rgba(255,255,255,0.55);background:rgba(255,255,255,0.06)}.bg-raise{background-color:#12121a!important}.border-inp{border-color:rgba(255,255,255,0.12)!important}.border-card{border-color:rgba(255,255,255,0.08)!important}.hover\:bg-red-700:hover{background:#b91c1c!important}nav a{text-decoration:none;color:inherit}nav a.text-red-400{color:#f87171!important}nav a.text-gray-400{color:#9ca3af!important}nav a.text-white{color:#fff!important}</style>
</head>
<body class="min-h-screen">
<header class="sticky top-0 z-40 bg-[#0a0a0f]/95 backdrop-blur border-b border-white/5"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div class="flex items-center justify-between h-16"><a href="/" class="flex items-center gap-1 shrink-0"><span class="text-red-500 font-bold text-xl">Consex</span><span class="text-white font-bold text-xl">VIP</span></a><button onclick="document.getElementById('navLinks').classList.toggle('hidden'); document.getElementById('navLinks').classList.toggle('md:flex');" class="md:hidden text-white text-xl p-2" aria-label="Menu"><i class="fas fa-bars"></i></button><nav id="navLinks" class="hidden md:flex flex-wrap items-center gap-4 md:gap-6 text-sm text-gray-300"><a href="/" class="hover:text-white transition"><i class="fas fa-home mr-1 text-xs text-red-400"></i>Inicio</a><a href="/ciudades" class="hover:text-white transition"><i class="fas fa-map-marker-alt mr-1 text-xs text-red-400"></i>Ciudades</a><a href="/negocios" class="hover:text-white transition">Negocios</a><a href="/publicidad" class="font-medium text-red-400">Publicidad</a><a href="/blog" class="hover:text-white transition">Blog</a></nav><div class="flex items-center gap-3"><a href="/ingresar" class="text-sm text-gray-300 hover:text-white transition">Ingresar</a><a href="/publicar" class="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition shadow-lg shadow-red-900/20"><i class="fas fa-plus mr-1"></i>Publicar</a></div></div></div></header>
<main class="max-w-2xl mx-auto px-4 py-8">
<h1 class="text-3xl font-bold text-white mb-2">Publica tu banner</h1>
<p class="text-gray-400 mb-6">Night clubs, discotecas, sex shops y negocios del rubro: muestra tu aviso y recibe visitas directas.</p>
<form id="anForm" class="bg-card border-card rounded-2xl p-6 space-y-4" onsubmit="event.preventDefault(); submitBanner();">
<div class="grid sm:grid-cols-2 gap-4">
<div><label class="block text-sm text-gray-400 mb-1">Nombre del negocio *</label><input id="f-anunciante" type="text" class="w-full bg-raise border border-inp rounded-lg px-3 py-2.5 text-white text-sm" required></div>
<div><label class="block text-sm text-gray-400 mb-1">CategorÃ­a</label><select id="f-categoria" class="w-full bg-raise border border-inp rounded-lg px-3 py-2.5 text-white text-sm"><option value="night_club">Night club</option><option value="discoteca">Discoteca</option><option value="sex_shop">Sex shop</option><option value="bar">Bar</option><option value="sauna">Sauna</option><option value="otro">Otro</option></select></div>
</div>
<div class="grid sm:grid-cols-2 gap-4">
<div><label class="block text-sm text-gray-400 mb-1">Whatsapp o email</label><input id="f-contacto" type="text" class="w-full bg-raise border border-inp rounded-lg px-3 py-2.5 text-white text-sm"></div>
<div><label class="block text-sm text-gray-400 mb-1">Sitio web</label><input id="f-web" type="text" placeholder="https://..." class="w-full bg-raise border border-inp rounded-lg px-3 py-2.5 text-white text-sm"></div>
</div>
<div><label class="block text-sm text-gray-400 mb-1">TÃ­tulo del aviso</label><input id="f-titulo" type="text" placeholder="Ej: Night Club Divino" class="w-full bg-raise border border-inp rounded-lg px-3 py-2.5 text-white text-sm"></div>
<div><label class="block text-sm text-gray-400 mb-1">Texto corto (opcional)</label><input id="f-texto" type="text" placeholder="Ej: Opens 8PM" class="w-full bg-raise border border-inp rounded-lg px-3 py-2.5 text-white text-sm"></div>
<div><label class="block text-sm text-gray-400 mb-1">Enlace de destino</label><input id="f-enlace_url" type="text" placeholder="https://wa.me/569..." class="w-full bg-raise border border-inp rounded-lg px-3 py-2.5 text-white text-sm"></div>

<div>
<label class="block text-sm text-gray-400 mb-1">Imagen del banner * (mÃ¡x 4 MB)</label>
<div ondragover="event.preventDefault(); this.style.borderColor='#ef4444'; this.style.background='rgba(255,255,255,0.08)';" ondragleave="this.style.borderColor='rgba(255,255,255,0.25)'; this.style.background='rgba(255,255,255,0.03)';" ondrop="event.preventDefault(); this.style.borderColor='rgba(255,255,255,0.25)'; this.style.background='rgba(255,255,255,0.03)'; var f=event.dataTransfer.files[0]; if(f){var inp=document.getElementById('f-file'); var dt=new DataTransfer(); dt.items.add(f); inp.files=dt.files; handleFile(inp);}" class="drop-zone relative" style="background:#13131a; border:2px dashed rgba(255,255,255,0.25); border-radius:1rem; padding:1.5rem; text-align:center;">
  <input type="file" id="f-file" accept="image/*" class="hidden" onchange="handleFile(this)">
  <div id="dropZoneLabel">
    <i class="fas fa-cloud-upload-alt text-3xl text-red-400 mb-2"></i>
    <p class="text-sm text-gray-300">Arrastra tu imagen aquÃ­ o <span class="text-red-400 underline cursor-pointer" onclick="document.getElementById('f-file').click()">haz clic</span></p>
    <p class="text-xs text-gray-500 mt-1">MÃ¡x 4 MB (PNG, JPG, WEBP)</p>
  </div>
  <div id="previewArea" class="hidden flex items-center justify-center gap-3 mt-2">
    <img id="previewImg" src="" alt="Banner" class="h-16 w-auto rounded-lg border border-white/10 object-cover" />
    <button type="button" onclick="document.getElementById('f-imagen_url').value=''; document.getElementById('previewImg').src=''; document.getElementById('previewArea').classList.add('hidden'); document.getElementById('dropZoneLabel').classList.remove('hidden'); document.getElementById('f-file').value='';" class="w-8 h-8 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full text-xs" title="Eliminar imagen">Ã—</button>
  </div>
  <span id="uploadStatus" class="text-xs text-gray-400"></span>
</div>
<input id="f-imagen_url" type="hidden">
<p id="err-imagen" class="text-red-400 text-xs mt-1 hidden">Debes subir la imagen del banner</p>
</div>

<button type="submit" id="btnSend" class="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"><i class="fas fa-paper-plane mr-2"></i>Enviar mi banner</button>
<p id="msgOk" class="hidden text-green-400 text-sm text-center mt-2">Â¡Solicitud enviada! Revisaremos tu banner.</p>
</form>
</main>
<footer class="border-t border-card mt-8"><div class="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-gray-500"><p>&copy; <?= date('Y') ?> ConsexVIP. Todos los derechos reservados.</p></div></footer>
<script>
let imgUrl = '';
function handleFile(inp){
  const file = inp.files?.[0]; if(!file) return;
  document.getElementById('uploadStatus').textContent = 'Subiendo...';
  const fd = new FormData(); fd.append('imagen', file);
  fetch('/api/admin/banners-subir-imagen.php', {method:'POST', headers:{'Authorization':'Bearer '+(localStorage.getItem('admin_token')||'')}, body:fd})
  .then(r=>r.json()).then(d=>{ if(d.success){ imgUrl = d.url; document.getElementById('f-imagen_url').value = imgUrl; document.getElementById('previewImg').src = imgUrl; document.getElementById('dropZoneLabel').classList.add('hidden'); document.getElementById('previewArea').classList.remove('hidden'); document.getElementById('uploadStatus').textContent = ''; } else { alert(d.error||'Error al subir'); document.getElementById('uploadStatus').textContent = ''; } })
  .catch(()=>{ document.getElementById('uploadStatus').textContent = ''; });
}
async function submitBanner(){
  const payload = { anunciante: document.getElementById('f-anunciante').value, categoria: document.getElementById('f-categoria').value, contacto: document.getElementById('f-contacto').value, web: document.getElementById('f-web').value, titulo: document.getElementById('f-titulo').value, texto: document.getElementById('f-texto').value, enlace_url: document.getElementById('f-enlace_url').value, imagen_url: imgUrl || document.getElementById('f-imagen_url').value };
  if(!payload.imagen_url || !payload.imagen_url.trim()){ document.getElementById('err-imagen').classList.remove('hidden'); return; }
  document.getElementById('err-imagen').classList.add('hidden');
  document.getElementById('btnSend').disabled = true; document.getElementById('btnSend').innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Enviando...';
  try {
    const res = await fetch('/api/banners/solicitud.php', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    const data = await res.json();
    if(data.success){ document.getElementById('msgOk').classList.remove('hidden'); document.getElementById('anForm').reset(); imgUrl=''; document.getElementById('dropZoneLabel').classList.remove('hidden'); document.getElementById('previewArea').classList.add('hidden'); document.getElementById('f-imagen_url').value=''; document.getElementById('previewImg').src=''; }
    else { alert(data.error || 'Revisa los datos'); }
  } catch(e){ alert('Error de conexiÃ³n'); } finally { document.getElementById('btnSend').disabled = false; document.getElementById('btnSend').innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Enviar mi banner'; }
}
</script>
</body></html>





