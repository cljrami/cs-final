# Kimi — App Web (Directorio de Escorts)

Plataforma web para un directorio de escorts, con paneles para **administradores**, **escorts** y **usuarios**. El front-end se construye con **Astro + React + Tailwind**, y el back-end de API es **PHP** (en `public/api/`), que se comunica con una base de datos MySQL/MariaDB.

## 🚀 Stack

- **Astro 6** (site estático, genera a `public_html/`)
- **React 19** (componentes interactivos, islas)
- **Tailwind CSS 4**
- **PHP** (API REST en `public/api/`)
- **basic-ftp** para despliegue por FTP

## 📁 Estructura

```text
/
├── public/            # Assets estáticos y API PHP (public/api)
├── src/
│   ├── components/    # Componentes React (admin, escort, usuario, ui)
│   ├── layouts/       # Layouts Astro (Admin, Escort, User, base)
│   ├── lib/           # Auth de escort/usuario, sanitización
│   ├── pages/         # Rutas Astro (admin, micuenta, públicas)
│   ├── providers/     # Providers React (ej. Skeleton)
│   ├── styles/        # Estilos globales
│   └── types/         # Tipos TypeScript
├── migrations/        # Migraciones de BD
├── sql/               # Scripts SQL utilitarios
├── scripts/           # deploy.js (FTP)
└── public_html/       # Salida del build (ignorada por git)
```

## 👥 Roles y áreas

- **Admin** (`/admin`): login, dashboard, gestión de escorts, usuarios, planes, suscripciones, pagos, verificaciones, VIP, valoraciones, comentarios, extras, categorías, ciudades, idiomas, nacionalidades, orientaciones, etnias, colores, estilos, auditoría, administradores.
- **Escort** (`/micuenta`): registro (wizard), login, perfil, fotos, historias, planes, mi plan (pausar/reactivar), verificación, solicitar VIP, extras, pagos, resumen, onboarding.
- **Usuario** (`/mi-cuenta`): registro/ingreso, mi perfil, favoritos, valoraciones, comentarios.
- **Público**: home, búsqueda (`/buscar`), perfiles (`/perfil`, `/{id}`), por ciudad (`/ciudad`), unirse (`/unirse`).

## 🧞 Comandos

Todos se ejecutan desde la raíz del proyecto:

| Comando            | Acción                                          |
| :----------------- | :---------------------------------------------- |
| `npm install`      | Instala dependencias                            |
| `npm run dev`      | Servidor de desarrollo en `localhost:4321`      |
| `npm run build`    | Genera el sitio estático a `./public_html/`     |
| `npm run preview`  | Previsualiza el build localmente                |
| `npm run deploy`   | Despliega `public_html/` por FTP (basic-ftp)    |
| `npm run build:deploy` | Build + deploy                             |

## 🔧 Configuración

1. Copiar/ajustar `public/api/config.php` y `public/api/config/site.php` con los datos de conexión a la BD y claves del sitio.
2. Aplicar las migraciones SQL de `migrations/` (y scripts de `sql/`) a la base de datos.
3. Configurar credenciales FTP en `scripts/deploy.js` para el despliegue.

> ⚠️ El archivo `key` (secreto de la app) y `public_html/` están en `.gitignore` y no se suben al repositorio.

## 📡 API (PHP)

Los endpoints viven en `public/api/`, organizados por rol:

- `public/api/admin/*` — gestión administrativa
- `public/api/escort/*` — área de escort (auth vía token)
- `public/api/escorts/*` — datos públicos de escorts (búsqueda, favorito, valorar, historias)
- `public/api/usuarios/*` y `public/api/comentarios/*` — área de usuario

Cada carpeta suele incluir su `.htaccess` para el enrutamiento/seguridad en el servidor.

## 🗄️ Base de datos

- Esquema inicial y utilidades en `sql/`.
- Migraciones incrementales numeradas en `migrations/` (ej. `001_add_hash_to_escort_fotos.sql`).
