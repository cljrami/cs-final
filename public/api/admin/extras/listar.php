<?php
// Este endpoint fue reemplazado por /api/admin/suscripciones.php?tipo=extra
header('Content-Type: application/json');
http_response_code(410);
echo json_encode(['success' => false, 'error' => 'Endpoint obsoleto. Usa /api/admin/suscripciones.php?tipo=extra']);
