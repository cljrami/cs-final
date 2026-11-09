<?php
// public/api/lib/banners.php
// Helpers del módulo de banners publicitarios.
// Uso:
//   require_once __DIR__ . '/bootstrap.php';   // debe cargarse antes
//   require_once __DIR__ . '/lib/banners.php';

if (!defined('BANNERS_LIB')) {
    define('BANNERS_LIB', true);

    // Placements soportados (clave => [etiqueta, ancho max, alto max, numero de carriles])
    // Medida máxima del banner: 970 x 125 px.
    // Cada posición puede tener varios CARRILES (lanes): el footer tiene 2 para poder
    // vender 2 anunciantes sin que se pisen. Dentro de un carril hay EXCLUSIVIDAD:
    // solo se muestra una campaña a la vez (la de mayor prioridad).
    // Nota: no hay placements de sidebar (descuadraban el layout del sitio).
    function banners_placements(): array
    {
        return [
            'home_top'             => ['Home - Banner superior', 970, 125, 1],
            'home_entre_secciones' => ['Home - Entre secciones', 970, 125, 1],
            'ciudad_top'           => ['Ciudad - Banner superior', 970, 125, 1],
            'perfil_top'           => ['Perfil - Banner superior', 970, 125, 1],
            'perfil_pre_footer'    => ['Perfil - Antes del pie', 970, 125, 1],
            'blog_articulo'        => ['Blog - Dentro del artículo', 970, 125, 1],
            'selector_ciudad'      => ['Entrada - Selector ciudad', 970, 125, 1],
            'footer'               => ['Footer', 970, 125, 2],
        ];
    }

    function banners_placement_valido(?string $p): bool
    {
        return $p !== null && array_key_exists($p, banners_placements());
    }

    /**
     * Número de carriles de un placement.
     */
    function banners_lanes(string $placement): int
    {
        $p = banners_placements();
        return isset($p[$placement]) ? (int)$p[$placement][3] : 0;
    }

    /**
     * Banner vigente para un placement y carril (exclusividad: el de mayor prioridad).
     * $ciudad: nombre de la ciudad de la página (null = páginas sin ciudad: home, footer, blog).
     *          Las campañas con ciudad sólo se muestran en esa ciudad.
     */
    function banners_obtener(string $placement, ?string $ciudad = null, int $lane = 1): ?array
    {
        if (!banners_placement_valido($placement)) return null;
        if ($lane < 1) $lane = 1;
        if ($lane > banners_lanes($placement)) return null;
        try {
            $pdo = getDBConnection();
            $params = [$placement, $lane];
            if ($ciudad !== null && $ciudad !== '') {
                // Campañas nacionales (ciudad_id NULL) + campañas de esa ciudad
                $ciudadCond = ' AND (b.ciudad_id IS NULL OR LOWER(TRIM(c.nombre)) = LOWER(?))';
                $params[] = $ciudad;
            } else {
                // Sin contexto de ciudad: solo campañas nacionales
                $ciudadCond = ' AND b.ciudad_id IS NULL';
            }
            $sql = "
                SELECT b.*, c.nombre AS ciudad_nombre
                FROM banners b
                LEFT JOIN ciudades c ON c.id = b.ciudad_id
                WHERE b.placement = ?
                  AND b.lane = ?
                  AND b.estado = 'activo'
                  AND b.fecha_inicio <= CURDATE()
                  AND b.fecha_fin >= CURDATE()
                  {$ciudadCond}
                ORDER BY b.orden DESC, b.id DESC
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (!$filas) return null;
            if (count($filas) > 1) {
                // Conflicto de fechas en el mismo carril: gana el de mayor prioridad
                error_log('banners: conflicto en ' . $placement . ' carril ' . $lane . ' (' . count($filas) . ' campañas)');
            }
            return $filas[0];
        } catch (Throwable $e) {
            error_log('banners_obtener error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Campaña que ocupa un carril (para el aviso de ocupación del panel admin).
     */
    function banners_ocupacion(string $placement, int $lane = 1, ?string $desde = null, ?string $hasta = null): ?array
    {
        if (!banners_placement_valido($placement)) return null;
        if ($lane < 1) $lane = 1;
        if ($lane > banners_lanes($placement)) return null;
        try {
            $pdo = getDBConnection();
            $params = [$placement, $lane];
            $rango = '';
            if ($desde && $hasta) {
                $rango = ' AND b.fecha_inicio <= ? AND b.fecha_fin >= ?';
                $params[] = $desde;
                $params[] = $hasta;
            }
            $stmt = $pdo->prepare("
                SELECT b.id, b.anunciante, b.titulo, b.estado, b.estado_pago, b.fecha_inicio, b.fecha_fin,
                       b.ciudad_id, c.nombre AS ciudad_nombre
                FROM banners b
                LEFT JOIN ciudades c ON c.id = b.ciudad_id
                WHERE b.placement = ? AND b.lane = ?
                  AND b.estado IN ('activo','pendiente_pago','presupuesto','solicitud') {$rango}
                ORDER BY b.orden DESC, b.id DESC
                LIMIT 1
            ");
            $stmt->execute($params);
            $fila = $stmt->fetch(PDO::FETCH_ASSOC);
            return $fila ?: null;
        } catch (Throwable $e) {
            error_log('banners_ocupacion error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Campañas que se solapan con un carril en un rango de fechas (detección de conflictos).
     */
    function banners_conflictos(string $placement, int $lane, string $desde, string $hasta, int $excluirId = 0): array
    {
        if (!banners_placement_valido($placement)) return [];
        try {
            $pdo = getDBConnection();
            $stmt = $pdo->prepare("
                SELECT b.id, b.anunciante, b.titulo, b.estado, b.fecha_inicio, b.fecha_fin, b.orden
                FROM banners b
                WHERE b.placement = ? AND b.lane = ?
                  AND b.estado IN ('activo','pendiente_pago','presupuesto')
                  AND b.id <> ?
                  AND b.fecha_inicio <= ?
                  AND b.fecha_fin >= ?
                ORDER BY b.orden DESC, b.id DESC
            ");
            $stmt->execute([$placement, $lane, $excluirId, $hasta, $desde]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {
            error_log('banners_conflictos error: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Registra una impresión (dedupe por cookie 6h, igual que tracking/visita.php).
     */
    function banners_registrar_impresion(int $bannerId, string $placement): void
    {
        if ($bannerId <= 0) return;
        try {
            $cookie = 'bimp_' . $bannerId;
            if (!empty($_COOKIE[$cookie])) return;
            $pdo = getDBConnection();
            $pdo->prepare("
                INSERT INTO banners_stats (banner_id, fecha, impresiones, clicks)
                VALUES (?, CURDATE(), 1, 0)
                ON DUPLICATE KEY UPDATE impresiones = impresiones + 1
            ")->execute([$bannerId]);
            setcookie($cookie, '1', [
                'expires'  => time() + 21600,
                'path'     => '/',
                'secure'   => true,
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
        } catch (Throwable $e) {
            error_log('banners_registrar_impresion error: ' . $e->getMessage());
        }
    }

    /**
     * Registra un click.
     */
    function banners_registrar_click(int $bannerId, string $placement): void
    {
        if ($bannerId <= 0) return;
        try {
            $pdo = getDBConnection();
            $pdo->prepare("
                INSERT INTO banners_stats (banner_id, fecha, impresiones, clicks)
                VALUES (?, CURDATE(), 0, 1)
                ON DUPLICATE KEY UPDATE clicks = clicks + 1
            ")->execute([$bannerId]);
        } catch (Throwable $e) {
            error_log('banners_registrar_click error: ' . $e->getMessage());
        }
    }

    /**
     * Genera un código de acceso al portal del cliente (8 caracteres, único).
     */
    function banners_generar_codigo(): string
    {
        $alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        do {
            $codigo = '';
            for ($i = 0; $i < 8; $i++) {
                $codigo .= $alfabeto[random_int(0, strlen($alfabeto) - 1)];
            }
            try {
                $pdo = getDBConnection();
                $stmt = $pdo->prepare("SELECT COUNT(*) FROM banners WHERE codigo_acceso = ?");
                $stmt->execute([$codigo]);
                if ((int)$stmt->fetchColumn() === 0) return $codigo;
            } catch (Throwable $e) {
                return $codigo;
            }
        } while (true);
    }

    /**
     * URL segura de redirección (sólo http/https).
     */
    function banners_url_segura(?string $url): string
    {
        $url = trim((string)$url);
        if ($url === '') return '';
        if (!preg_match('#^https?://#i', $url)) return '';
        return $url;
    }

    /**
     * Markup del slot (idéntico al que genera el componente React).
     * Medida máxima del banner: 970 x 125 px.
     */
    function banners_html(string $placement, ?string $ciudad = null, string $claseExtra = '', int $lane = 1): string
    {
        $banner = banners_obtener($placement, $ciudad, $lane);
        if (!$banner) return '';

        $etiqueta = banners_etiqueta_publicidad();
        $href = '/api/banners/click.php?id=' . (int)$banner['id'] . '&p=' . rawurlencode($placement);
        $imagen = htmlspecialchars((string)$banner['imagen_url'], ENT_QUOTES, 'UTF-8');
        $titulo = htmlspecialchars((string)$banner['titulo'], ENT_QUOTES, 'UTF-8');
        $texto = !empty($banner['texto'])
            ? '<span class="block mt-1 text-[11px] text-gray-400">' . htmlspecialchars((string)$banner['texto'], ENT_QUOTES, 'UTF-8') . '</span>'
            : '';
        $clase = trim('banners-slot ' . $claseExtra);

        $html = '<div class="' . htmlspecialchars($clase, ENT_QUOTES, 'UTF-8') . '">';
        $html .= '<a href="' . htmlspecialchars($href, ENT_QUOTES, 'UTF-8') . '" target="_blank" rel="sponsored nofollow noopener" '
            . 'data-banner-id="' . (int)$banner['id'] . '" data-banner-placement="' . htmlspecialchars($placement, ENT_QUOTES, 'UTF-8') . '">';
        $html .= '<img src="' . $imagen . '" alt="' . $titulo . '" loading="lazy" decoding="async" '
            . 'class="mx-auto w-auto max-w-full max-h-[125px] object-contain rounded-xl border border-white/5" />';
        $html .= $texto;
        $html .= '<span class="block mt-1 text-[10px] uppercase tracking-wider text-gray-600">' . htmlspecialchars($etiqueta, ENT_QUOTES, 'UTF-8') . '</span>';
        $html .= '</a>';
        $html .= '<script>(function(){var a=document.currentScript;if(!a)return;'
            . 'var p=a.parentNode;var img=p.querySelector("img");if(!img)return;'
            . 'try{var io=new IntersectionObserver(function(e){if(e[0].isIntersecting){io.disconnect();'
            . 'fetch("/api/banners/impresion.php",{method:"POST",headers:{"Content-Type":"application/json"},'
            . 'body:JSON.stringify({banner_id:p.querySelector("a").getAttribute("data-banner-id"),placement:p.querySelector("a").getAttribute("data-banner-placement")}),keepalive:true}).catch(function(){});}},{threshold:0.5});'
            . 'io.observe(img);}catch(e){}})();</script>';
        $html .= '</div>';

        return $html;
    }

    /**
     * Texto de la etiqueta "Publicidad" (configurable en Admin > Contenido).
     */
    function banners_etiqueta_publicidad(): string
    {
        static $etiqueta = null;
        if ($etiqueta !== null) return $etiqueta;
        $etiqueta = 'Publicidad';
        try {
            $pdo = getDBConnection();
            $stmt = $pdo->prepare("SELECT valor FROM configuracion WHERE clave = 'banner_etiqueta_publicidad' LIMIT 1");
            $stmt->execute();
            $v = trim((string)($stmt->fetchColumn() ?: ''));
            if ($v !== '') $etiqueta = $v;
        } catch (Throwable $e) {
            // no-op
        }
        return $etiqueta;
    }
}
