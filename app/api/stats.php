<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

$conn = getConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $action = $_GET['action'] ?? 'overview';
    switch ($action) {
        case 'overview':
            getOverview($conn);
            break;
        case 'disease_stats':
            getDiseaseStats($conn);
            break;
        case 'diseases':
            getDiseases($conn);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();

// ── Dashboard Overview Stats ──────────────────────────────
function getOverview($conn) {
    $stats = [];

    // Total users by type
    $result = $conn->query(
        "SELECT ut.type_name, COUNT(u.user_id) as count
         FROM tbl_user_type ut
         LEFT JOIN tbl_user u ON ut.user_type_id = u.user_type_id
         GROUP BY ut.user_type_id"
    );
    $stats['users'] = [];
    while ($row = $result->fetch_assoc()) {
        $stats['users'][$row['type_name']] = (int)$row['count'];
    }

    // Total reports by status
    $result = $conn->query(
        "SELECT status, COUNT(*) as count FROM tbl_disease_report GROUP BY status"
    );
    $stats['reports'] = [];
    while ($row = $result->fetch_assoc()) {
        $stats['reports'][$row['status']] = (int)$row['count'];
    }
    $stats['reports']['total'] = array_sum($stats['reports']);

    // Total verifications
    $result = $conn->query("SELECT COUNT(*) as count FROM tbl_verification");
    $stats['total_verifications'] = (int)$result->fetch_assoc()['count'];

    // Total AI diagnoses
    $result = $conn->query("SELECT COUNT(*) as count FROM tbl_ai_diagnosis");
    $stats['total_ai_diagnoses'] = (int)$result->fetch_assoc()['count'];

    // Insurance claims by status
    $result = $conn->query(
        "SELECT status, COUNT(*) as count FROM tbl_insurance_claim GROUP BY status"
    );
    $stats['claims'] = [];
    while ($row = $result->fetch_assoc()) {
        $stats['claims'][$row['status']] = (int)$row['count'];
    }

    // Top diseases (most reported via AI diagnosis)
    $result = $conn->query(
        "SELECT d.disease_name, COUNT(ad.ai_diagnosis_id) as diagnosis_count
         FROM tbl_ai_diagnosis ad
         JOIN tbl_disease d ON ad.disease_id = d.disease_id
         GROUP BY ad.disease_id
         ORDER BY diagnosis_count DESC
         LIMIT 5"
    );
    $stats['top_diseases'] = [];
    while ($row = $result->fetch_assoc()) {
        $stats['top_diseases'][] = $row;
    }

    // Recent reports
    $result = $conn->query(
        "SELECT r.report_id, r.status, r.reported_at, r.field_location,
                u.fname, u.lname
         FROM tbl_disease_report r
         JOIN tbl_user u ON r.user_id = u.user_id
         ORDER BY r.reported_at DESC
         LIMIT 10"
    );
    $stats['recent_reports'] = [];
    while ($row = $result->fetch_assoc()) {
        $stats['recent_reports'][] = $row;
    }

    echo json_encode($stats);
}

// ── Disease Statistics by Period ──────────────────────────
function getDiseaseStats($conn) {
    $diseaseId = $_GET['disease_id'] ?? null;

    $sql = "SELECT ds.*, d.disease_name
            FROM tbl_disease_stats ds
            JOIN tbl_disease d ON ds.disease_id = d.disease_id";
    $params = [];
    $types = "";

    if ($diseaseId) {
        $sql .= " WHERE ds.disease_id = ?";
        $params[] = $diseaseId;
        $types .= "i";
    }

    $sql .= " ORDER BY ds.created_at DESC";

    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    $stats = [];
    while ($row = $result->fetch_assoc()) {
        $stats[] = $row;
    }

    echo json_encode($stats);
    $stmt->close();
}

// ── List All Diseases ─────────────────────────────────────
function getDiseases($conn) {
    $result = $conn->query(
        "SELECT * FROM tbl_disease ORDER BY disease_name ASC"
    );

    $diseases = [];
    while ($row = $result->fetch_assoc()) {
        $diseases[] = $row;
    }

    echo json_encode($diseases);
}
