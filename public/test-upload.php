<?php
$dir = __DIR__ . '/uploads/verificaciones/';
echo "Directorio: $dir<br>";

if (!is_dir($dir)) {
    $created = mkdir($dir, 0755, true);
    echo "Creado: " . ($created ? 'SI' : 'NO') . "<br>";
} else {
    echo "Ya existe<br>";
}

echo "Escribible: " . (is_writable($dir) ? 'SI' : 'NO') . "<br>";
echo "Permisos: " . substr(sprintf('%o', fileperms($dir)), -4) . "<br>";
