<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

$conn = getConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $action = $_GET['action'] ?? 'treatments';
        if ($action === 'recommendations') {
            getRecommendations($conn);
        } else {
            getTreatments($conn);
        }
        break;
    case 'POST':
        createRecommendation($conn);
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();

// ── GET Treatments for a Disease ──────────────────────────
function getTreatments($conn) {
    $diseaseId = $_GET['disease_id'] ?? null;

    $sql = "SELECT t.*, d.disease_name
            FROM tbl_treatment t
            JOIN tbl_disease d ON t.disease_id = d.disease_id";
    $params = [];
    $types = "";

    if ($diseaseId) {
        $sql .= " WHERE t.disease_id = ?";
        $params[] = $diseaseId;
        $types .= "i";
    }

    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    $treatments = [];
    while ($row = $result->fetch_assoc()) {
        $treatments[] = $row;
    }

    echo json_encode($treatments);
    $stmt->close();
}

// ── GET Recommendations for a Report ──────────────────────
function getRecommendations($conn) {
    $reportId = $_GET['report_id'] ?? null;

    if (!$reportId) {
        http_response_code(400);
        echo json_encode(['error' => 'report_id is required']);
        return;
    }

     $stmt = $conn->prepare(
        "SELECT tr.*, t.treatment_id as db_treatment_id, t.treatment_type, t.pesticide_name, t.dosage,
                t.application_method, t.estimated_cost,
                u.fname, u.lname
         FROM tbl_treatment_recommendation tr
         LEFT JOIN tbl_treatment t ON tr.treatment_id = t.treatment_id
         JOIN tbl_user u ON tr.recommended_by = u.user_id
         WHERE tr.report_id = ?
         ORDER BY tr.recommended_at DESC"
    );
    $stmt->bind_param("i", $reportId);
    $stmt->execute();
    $result = $stmt->get_result();

    $recommendations = [];
    while ($row = $result->fetch_assoc()) {
        $recommendations[] = $row;
    }

    echo json_encode($recommendations);
    $stmt->close();
}

// ── POST Create Recommendation ────────────────────────────
function createRecommendation($conn) {
    $data = json_decode(file_get_contents('php://input'), true);

    $required = ['report_id', 'recommended_by', 'recommendation_source'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "Missing required field: $field"]);
            return;
        }
    }

    $treatmentId = $data['treatment_id'] ?? null;

    $notes = $data['additional_notes'] ?? '';

    $stmt = $conn->prepare(
        "INSERT INTO tbl_treatment_recommendation
            (report_id, treatment_id, recommended_by, recommendation_source, additional_notes)
         VALUES (?, ?, ?, ?, ?)"
    );
    $stmt->bind_param(
        "iiiss",
        $data['report_id'],
        $treatmentId,
        $data['recommended_by'],
        $data['recommendation_source'],
        $notes
    );

    if ($stmt->execute()) {
        http_response_code(201);
        echo json_encode([
            'message' => 'Recommendation created',
            'recommendation_id' => $stmt->insert_id
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create recommendation: ' . $stmt->error]);
    }
    $stmt->close();
}
