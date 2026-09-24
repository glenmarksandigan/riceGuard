<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

$conn = getConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        getVerifications($conn);
        break;
    case 'POST':
        createVerification($conn);
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();

// ── GET Verifications ─────────────────────────────────────
function getVerifications($conn) {
    $reportId = $_GET['report_id'] ?? null;

    $sql = "SELECT v.*, d.disease_name, u.fname, u.lname
            FROM tbl_verification v
            JOIN tbl_disease d ON v.disease_id = d.disease_id
            JOIN tbl_user u ON v.user_id = u.user_id";
    $params = [];
    $types = "";

    if ($reportId) {
        $sql .= " WHERE v.report_id = ?";
        $params[] = $reportId;
        $types .= "i";
    }

    $sql .= " ORDER BY v.verified_at DESC";

    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    $verifications = [];
    while ($row = $result->fetch_assoc()) {
        $verifications[] = $row;
    }

    echo json_encode($verifications);
    $stmt->close();
}

// ── POST Create Verification ──────────────────────────────
function createVerification($conn) {
    $data = json_decode(file_get_contents('php://input'), true);

    $required = ['report_id', 'user_id', 'disease_id', 'verification_method'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "Missing required field: $field"]);
            return;
        }
    }

    $notes = $data['notes'] ?? '';

    $stmt = $conn->prepare(
        "INSERT INTO tbl_verification (report_id, user_id, disease_id, verification_method, notes)
         VALUES (?, ?, ?, ?, ?)"
    );
    $stmt->bind_param(
        "iiiss",
        $data['report_id'],
        $data['user_id'],
        $data['disease_id'],
        $data['verification_method'],
        $notes
    );

    if ($stmt->execute()) {
        // Update report status to Verified
        $updateStmt = $conn->prepare(
            "UPDATE tbl_disease_report SET status = 'Verified' WHERE report_id = ?"
        );
        $updateStmt->bind_param("i", $data['report_id']);
        $updateStmt->execute();
        $updateStmt->close();

        http_response_code(201);
        echo json_encode([
            'message' => 'Verification submitted successfully',
            'verification_id' => $stmt->insert_id
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to submit verification: ' . $stmt->error]);
    }
    $stmt->close();
}
