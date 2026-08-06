<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();
    $rol = $tokenData['rol'] ?? '';
    if (!in_array($rol, ['superadmin', 'admin', 'moderador'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'No autorizado']);
        exit;
    }

    $pdo = getDBConnection();
    $input = json_decode(file_get_contents('php://input'), true);

    $escortId = $input['escort_id'] ?? 0;
    $usuarioId = $input['usuario_id'] ?? $tokenData['id'];
    $rating = $input['rating'] ?? 0;
    $comentario = $input['comentario'] ?? null;
    $anonimo = $input['anonimo'] ?? 0;
    $citaVerificada = $input['cita_verificada'] ?? 0;
    $puntualidad = $input['puntualidad'] ?? null;
    $aspecto = $input['aspecto'] ?? null;
    $trato = $input['trato'] ?? null;
    $lugar = $input['lugar'] ?? null;

    if ($escortId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Escort ID requerido']);
        exit;
    }

    if ($rating < 1 || $rating > 5) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'La calificación debe ser entre 1 y 5']);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT id, aprobado
        FROM valoraciones
        WHERE escort_id = ? AND usuario_id = ?
    ");
    $stmt->execute([$escortId, $usuarioId]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        $stmtUpdate = $pdo->prepare("
            UPDATE valoraciones
            SET general = ?,
                comentario = ?,
                anonimo = ?,
                cita_verificada = ?,
                puntualidad = ?,
                aspecto = ?,
                trato = ?,
                lugar = ?,
                aprobado = 0,
                updated_at = NOW()
            WHERE id = ?
        ");
        $stmtUpdate->execute([$rating, $comentario, $anonimo, $citaVerificada, $puntualidad, $aspecto, $trato, $lugar, $existing['id']]);
        $message = 'Calificación actualizada';
    } else {
        $stmtInsert = $pdo->prepare("
            INSERT INTO valoraciones
            (escort_id, usuario_id, cita_verificada, puntualidad, aspecto, trato, lugar, general, comentario, anonimo, aprobado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ");
        $stmtInsert->execute([$escortId, $usuarioId, $citaVerificada, $puntualidad, $aspecto, $trato, $lugar, $rating, $comentario, $anonimo]);
        $message = 'Calificación enviada';
    }

    $stmtAvg = $pdo->prepare("
        SELECT AVG(general) as average, COUNT(*) as total
        FROM valoraciones
        WHERE escort_id = ? AND aprobado = 1
    ");
    $stmtAvg->execute([$escortId]);
    $avgResult = $stmtAvg->fetch(PDO::FETCH_ASSOC);
    $newRating = $avgResult['average'] ? (float)$avgResult['average'] : 0;
    $totalRatings = $avgResult['total'] ? (int)$avgResult['total'] : 0;

    $stmtUpdateEscort = $pdo->prepare("
        UPDATE escorts
        SET rating = ?, total_valoraciones = ?
        WHERE id = ?
    ");
    $stmtUpdateEscort->execute([$newRating, $totalRatings, $escortId]);

    echo json_encode([
        'success' => true,
        'message' => $message,
        'rating' => $rating,
        'new_escort_rating' => $newRating,
        'new_escort_total_ratings' => $totalRatings
    ]);

} catch (PDOException $e) {
    error_log("Error submit-rating.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error de base de datos'
    ]);
} catch (Exception $e) {
    error_log("Error submit-rating.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
