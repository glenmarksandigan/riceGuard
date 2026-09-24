<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

$conn = getConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    getDiagnosis($conn);
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();

// ── GET AI Diagnosis for a report ─────────────────────────
function getDiagnosis($conn) {
    $reportId = $_GET['report_id'] ?? null;

    if (!$reportId) {
        http_response_code(400);
        echo json_encode(['error' => 'report_id is required']);
        return;
    }

    $stmt = $conn->prepare(
        "SELECT ad.*, d.disease_name, d.scientific_name, d.common_symptoms
         FROM tbl_ai_diagnosis ad
         JOIN tbl_disease d ON ad.disease_id = d.disease_id
         WHERE ad.report_id = ?
         ORDER BY ad.confidence_score DESC"
    );
    $stmt->bind_param("i", $reportId);
    $stmt->execute();
    $result = $stmt->get_result();

    $diagnoses = [];
    while ($row = $result->fetch_assoc()) {
        $diagnoses[] = $row;
    }

    echo json_encode($diagnoses);
    $stmt->close();
}
