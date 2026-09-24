<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

$conn = getConnection();
$method = $_SERVER['REQUEST_METHOD'];

function debug_log($msg) {
    file_put_contents(__DIR__ . '/debug_upload.log', date('[Y-m-d H:i:s] ') . $msg . PHP_EOL, FILE_APPEND);
}

debug_log("Request Method: $method");
if ($method === 'POST') {
    debug_log("POST: " . print_r($_POST, true));
    debug_log("FILES: " . print_r($_FILES, true));
}

switch ($method) {
    case 'GET':
        getReports($conn);
        break;
    case 'POST':
        createReport($conn);
        break;
    case 'PUT':
        updateReport($conn);
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();

// ── GET Reports ───────────────────────────────────────────
function getReports($conn) {
    $userId = $_GET['user_id'] ?? null;
    $status = $_GET['status'] ?? null;
    $reportId = $_GET['report_id'] ?? null;

    // Single report with details
    if ($reportId) {
        $stmt = $conn->prepare(
            "SELECT r.*, u.fname, u.lname, u.contact_number,
                    COALESCE(a.barangay,'') as barangay, COALESCE(a.municipality,'') as municipality, COALESCE(a.province,'') as province,
                    GROUP_CONCAT(di.image_path) as images
             FROM tbl_disease_report r
             JOIN tbl_user u ON r.user_id = u.user_id
             LEFT JOIN tbl_address a ON u.user_id = a.user_id
             LEFT JOIN tbl_disease_image di ON r.report_id = di.report_id
             WHERE r.report_id = ?
             GROUP BY r.report_id"
        );
        $stmt->bind_param("i", $reportId);
        $stmt->execute();
        $result = $stmt->get_result();
        $report = $result->fetch_assoc();

        if ($report) {
            $report['images'] = $report['images'] ? explode(',', $report['images']) : [];
            echo json_encode($report);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Report not found']);
        }
        $stmt->close();
        return;
    }

    // List reports
    $sql = "SELECT r.*, u.fname, u.lname, u.contact_number,
                   COALESCE(a.barangay,'') as barangay, COALESCE(a.municipality,'') as municipality, COALESCE(a.province,'') as province,
                   (SELECT COUNT(*) FROM tbl_disease_image di WHERE di.report_id = r.report_id) as image_count,
                   (SELECT GROUP_CONCAT(di2.image_path) FROM tbl_disease_image di2 WHERE di2.report_id = r.report_id) as images
            FROM tbl_disease_report r
            JOIN tbl_user u ON r.user_id = u.user_id
            LEFT JOIN tbl_address a ON u.user_id = a.user_id
            WHERE 1=1";
    $params = [];
    $types = "";

    if ($userId) {
        $sql .= " AND r.user_id = ?";
        $params[] = $userId;
        $types .= "i";
    }
    if ($status) {
        $sql .= " AND r.status = ?";
        $params[] = $status;
        $types .= "s";
    }

    $sql .= " ORDER BY r.reported_at DESC";

    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    $reports = [];
    while ($row = $result->fetch_assoc()) {
        $row['images'] = $row['images'] ? explode(',', $row['images']) : [];
        $reports[] = $row;
    }

    echo json_encode($reports);
    $stmt->close();
}

// ── POST Create Report ────────────────────────────────────
function createReport($conn) {
    debug_log("Starting createReport");

    $userId = $_POST['user_id'] ?? null;
    $reportMethod = $_POST['report_method'] ?? 'Photo';
    $description = $_POST['description'] ?? '';
    $fieldLocation = $_POST['field_location'] ?? '';
    $affectedArea = $_POST['affected_area'] ?? 0;
    $latitude = $_POST['latitude'] ?? null;
    $longitude = $_POST['longitude'] ?? null;

    if (!$userId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'user_id is required']);
        return;
    }

    $stmt = $conn->prepare(
        "INSERT INTO tbl_disease_report (user_id, report_method, description, field_location, affected_area, latitude, longitude, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')"
    );
    $stmt->bind_param("isssddd", $userId, $reportMethod, $description, $fieldLocation, $affectedArea, $latitude, $longitude);

    if ($stmt->execute()) {
        $reportId = $stmt->insert_id;
        debug_log("New Report Created ID: " . $reportId);

        // Handle image uploads
        if (!empty($_FILES['images'])) {
            $uploadDir = __DIR__ . '/../../uploads/reports/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }

            $files = $_FILES['images'];
            // Normalize single vs multiple files
            if (isset($files['name']) && !is_array($files['name'])) {
                $files = [
                    'name' => [$files['name']],
                    'type' => [$files['type']],
                    'tmp_name' => [$files['tmp_name']],
                    'error' => [$files['error']],
                    'size' => [$files['size']]
                ];
            }

            $fileCount = count($files['name']);
            debug_log("Processing $fileCount images for report $reportId");

            for ($i = 0; $i < $fileCount; $i++) {
                if ($files['error'][$i] !== UPLOAD_ERR_OK) {
                    debug_log("File upload error code: " . $files['error'][$i]);
                    continue;
                }

                $tmpName = $files['tmp_name'][$i];
                $originalName = $files['name'][$i];
                $ext = pathinfo($originalName, PATHINFO_EXTENSION);
                if (empty($ext)) $ext = 'jpg';
                
                $filename = 'report_' . $reportId . '_' . time() . '_' . $i . '.' . $ext;
                $filepath = $uploadDir . $filename;

                if (move_uploaded_file($tmpName, $filepath)) {
                    $relativePath = 'uploads/reports/' . $filename;
                    $imgStmt = $conn->prepare(
                        "INSERT INTO tbl_disease_image (report_id, image_path) VALUES (?, ?)"
                    );
                    $imgStmt->bind_param("is", $reportId, $relativePath);
                    $imgStmt->execute();
                    $imgStmt->close();
                    debug_log("Image saved: " . $relativePath);
                } else {
                    debug_log("Failed to move uploaded file to: " . $filepath);
                }
            }
        }

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Report submitted successfully',
            'report_id' => $reportId
        ]);
    } else {
        debug_log("MySQL Prep Error: " . $conn->error);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to create report: ' . $stmt->error]);
    }
    if ($stmt) $stmt->close();
}

// ── PUT Update Report Status ──────────────────────────────
function updateReport($conn) {
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['report_id']) || empty($data['status'])) {
        http_response_code(400);
        echo json_encode(['error' => 'report_id and status are required']);
        return;
    }

    $valid = ['Pending', 'Verified', 'Treated'];
    if (!in_array($data['status'], $valid)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid status. Use: ' . implode(', ', $valid)]);
        return;
    }

    $stmt = $conn->prepare("UPDATE tbl_disease_report SET status = ? WHERE report_id = ?");
    $stmt->bind_param("si", $data['status'], $data['report_id']);

    if ($stmt->execute() && $stmt->affected_rows > 0) {
        echo json_encode(['message' => 'Report status updated']);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Report not found or status unchanged']);
    }
    $stmt->close();
}
