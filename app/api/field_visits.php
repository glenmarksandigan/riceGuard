<?php
// Field Visit Requests API
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

$conn = getConnection();

// Auto-create tables if they don't exist
@$conn->query("CREATE TABLE IF NOT EXISTS `tbl_field_visit_request` (
    `visit_id` INT(11) NOT NULL AUTO_INCREMENT,
    `report_id` INT(11) NOT NULL,
    `farmer_id` INT(11) NOT NULL,
    `tech_id` INT(11) DEFAULT NULL,
    `reason` TEXT,
    `preferred_date` DATE DEFAULT NULL,
    `status` ENUM('Pending','Accepted','Completed','Declined') DEFAULT 'Pending',
    `farmer_notes` TEXT,
    `tech_notes` TEXT,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`visit_id`),
    FOREIGN KEY (`report_id`) REFERENCES `tbl_disease_report`(`report_id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`farmer_id`) REFERENCES `tbl_user`(`user_id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`tech_id`) REFERENCES `tbl_user`(`user_id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

@$conn->query("CREATE TABLE IF NOT EXISTS `tbl_visit_image` (
    `visit_image_id` INT(11) NOT NULL AUTO_INCREMENT,
    `visit_id` INT(11) NOT NULL,
    `image_path` VARCHAR(255) NOT NULL,
    `uploaded_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`visit_image_id`),
    FOREIGN KEY (`visit_id`) REFERENCES `tbl_field_visit_request`(`visit_id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        getVisits($conn);
        break;
    case 'POST':
        createVisit($conn);
        break;
    case 'PUT':
        updateVisit($conn);
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();

// ── GET Field Visits ──────────────────────────────────────
function getVisits($conn) {
    $farmerId = $_GET['farmer_id'] ?? null;
    $reportId = $_GET['report_id'] ?? null;
    $status   = $_GET['status'] ?? null;
    $visitId  = $_GET['visit_id'] ?? null;

    // Single visit lookup
    if ($visitId) {
        $stmt = $conn->prepare(
            "SELECT fv.*, 
                    farmer.fname AS farmer_fname, farmer.lname AS farmer_lname, farmer.contact_number AS farmer_contact,
                    tech.fname AS tech_fname, tech.lname AS tech_lname,
                    r.field_location, r.status AS report_status, r.description AS report_description,
                    r.reported_at,
                    (SELECT GROUP_CONCAT(vi.image_path SEPARATOR ',')
                     FROM tbl_visit_image vi WHERE vi.visit_id = fv.visit_id) AS visit_images
             FROM tbl_field_visit_request fv
             JOIN tbl_user farmer ON fv.farmer_id = farmer.user_id
             JOIN tbl_disease_report r ON fv.report_id = r.report_id
             LEFT JOIN tbl_user tech ON fv.tech_id = tech.user_id
             WHERE fv.visit_id = ?"
        );
        $stmt->bind_param("i", $visitId);
        $stmt->execute();
        $result = $stmt->get_result();
        $visit = $result->fetch_assoc();

        if ($visit) {
            $visit['images'] = $visit['visit_images'] ? explode(',', $visit['visit_images']) : [];
            unset($visit['visit_images']);
            echo json_encode($visit);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Visit request not found']);
        }
        $stmt->close();
        return;
    }

    // List visits with filters
    $sql = "SELECT fv.*, 
                   farmer.fname AS farmer_fname, farmer.lname AS farmer_lname, farmer.contact_number AS farmer_contact,
                   tech.fname AS tech_fname, tech.lname AS tech_lname,
                   r.field_location, r.status AS report_status, r.description AS report_description,
                   r.reported_at, r.latitude, r.longitude,
                   (SELECT GROUP_CONCAT(vi.image_path SEPARATOR ',')
                    FROM tbl_visit_image vi WHERE vi.visit_id = fv.visit_id) AS visit_images,
                   (SELECT COUNT(*) FROM tbl_visit_image vi2 WHERE vi2.visit_id = fv.visit_id) AS image_count
            FROM tbl_field_visit_request fv
            JOIN tbl_user farmer ON fv.farmer_id = farmer.user_id
            JOIN tbl_disease_report r ON fv.report_id = r.report_id
            LEFT JOIN tbl_user tech ON fv.tech_id = tech.user_id
            WHERE 1=1";
    $params = [];
    $types  = "";

    if ($farmerId) {
        $sql .= " AND fv.farmer_id = ?";
        $params[] = $farmerId;
        $types .= "i";
    }
    if ($reportId) {
        $sql .= " AND fv.report_id = ?";
        $params[] = $reportId;
        $types .= "i";
    }
    if ($status) {
        $sql .= " AND fv.status = ?";
        $params[] = $status;
        $types .= "s";
    }
    if (isset($_GET['tech_id'])) {
        $sql .= " AND fv.tech_id = ?";
        $params[] = $_GET['tech_id'];
        $types .= "i";
    }

    $sql .= " ORDER BY fv.created_at DESC";

    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    $visits = [];
    while ($row = $result->fetch_assoc()) {
        $row['images'] = $row['visit_images'] ? explode(',', $row['visit_images']) : [];
        unset($row['visit_images']);
        $visits[] = $row;
    }

    echo json_encode($visits);
    $stmt->close();
}

// ── POST Create Visit Request ─────────────────────────────
function createVisit($conn) {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (strpos($contentType, 'multipart/form-data') !== false) {
        $data = $_POST;
    } else {
        $data = json_decode(file_get_contents('php://input'), true);
    }

    $required = ['farmer_id', 'report_id'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "Missing required field: $field"]);
            return;
        }
    }

    // Check that farmer hasn't already requested a visit for this report
    $dupCheck = $conn->prepare(
        "SELECT visit_id FROM tbl_field_visit_request 
         WHERE report_id = ? AND farmer_id = ? AND status IN ('Pending','Accepted')"
    );
    $dupCheck->bind_param("ii", $data['report_id'], $data['farmer_id']);
    $dupCheck->execute();
    if ($dupCheck->get_result()->num_rows > 0) {
        http_response_code(409);
        echo json_encode(['error' => 'You already have an active visit request for this report']);
        $dupCheck->close();
        return;
    }
    $dupCheck->close();

    $reason        = $data['reason'] ?? '';
    $preferredDate = !empty($data['preferred_date']) ? $data['preferred_date'] : null;
    $farmerNotes   = $data['farmer_notes'] ?? '';

    $stmt = $conn->prepare(
        "INSERT INTO tbl_field_visit_request (report_id, farmer_id, reason, preferred_date, farmer_notes, status)
         VALUES (?, ?, ?, ?, ?, 'Pending')"
    );
    $stmt->bind_param("iisss", $data['report_id'], $data['farmer_id'], $reason, $preferredDate, $farmerNotes);

    if ($stmt->execute()) {
        $visitId = $stmt->insert_id;

        // Handle proof image uploads
        if (!empty($_FILES['proof_images'])) {
            $uploadDir = __DIR__ . '/../../uploads/visits/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }

            $files = $_FILES['proof_images'];
            $fileCount = is_array($files['name']) ? count($files['name']) : 1;

            for ($i = 0; $i < $fileCount; $i++) {
                $tmpName = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
                $originalName = is_array($files['name']) ? $files['name'][$i] : $files['name'];
                $error = is_array($files['error']) ? $files['error'][$i] : $files['error'];

                if ($error !== UPLOAD_ERR_OK) continue;

                $ext = pathinfo($originalName, PATHINFO_EXTENSION);
                $filename = 'visit_' . $visitId . '_' . time() . '_' . $i . '.' . $ext;
                $filepath = $uploadDir . $filename;

                if (move_uploaded_file($tmpName, $filepath)) {
                    $relativePath = 'uploads/visits/' . $filename;
                    $imgStmt = $conn->prepare(
                        "INSERT INTO tbl_visit_image (visit_id, image_path) VALUES (?, ?)"
                    );
                    $imgStmt->bind_param("is", $visitId, $relativePath);
                    $imgStmt->execute();
                    $imgStmt->close();
                }
            }
        }

        http_response_code(201);
        echo json_encode([
            'message'  => 'Field visit request submitted',
            'visit_id' => $visitId,
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create visit request: ' . $stmt->error]);
    }
    $stmt->close();
}

// ── PUT Update Visit (Accept / Decline / Complete / Assign) ─
function updateVisit($conn) {
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['visit_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'visit_id is required']);
        return;
    }

    $validStatuses = ['Pending', 'Accepted', 'Completed', 'Declined'];

    // If status update
    if (!empty($data['status'])) {
        if (!in_array($data['status'], $validStatuses)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid status. Use: ' . implode(', ', $validStatuses)]);
            return;
        }

        $techId    = $data['tech_id'] ?? null;
        $techNotes = $data['tech_notes'] ?? null;
        $prefDate  = $data['preferred_date'] ?? null;
        $status    = $data['status'];

        // ── Ownership check ──
        if (in_array($status, ['Completed', 'Declined'])) {
            if (!$techId) {
                http_response_code(400);
                echo json_encode(['error' => 'tech_id is required to update status to ' . $status]);
                return;
            }

            $ownerCheck = $conn->prepare(
                "SELECT tech_id, status FROM tbl_field_visit_request WHERE visit_id = ?"
            );
            $ownerCheck->bind_param("i", $data['visit_id']);
            $ownerCheck->execute();
            $visit = $ownerCheck->get_result()->fetch_assoc();
            $ownerCheck->close();

            if ($visit && $visit['tech_id'] && (int)$visit['tech_id'] !== (int)$techId) {
                http_response_code(403);
                echo json_encode(['error' => 'Only the assigned technologist can update this visit']);
                return;
            }
        }

        // When a tech accepts, assign them (and optionally change date)
        if ($status === 'Accepted' && $techId) {
            // Check visit is still Pending (not already accepted by another tech)
            $pendCheck = $conn->prepare(
                "SELECT status, tech_id FROM tbl_field_visit_request WHERE visit_id = ?"
            );
            $pendCheck->bind_param("i", $data['visit_id']);
            $pendCheck->execute();
            $current = $pendCheck->get_result()->fetch_assoc();
            $pendCheck->close();

            if ($current && $current['status'] === 'Accepted' && $current['tech_id'] && (int)$current['tech_id'] !== (int)$techId) {
                http_response_code(409);
                echo json_encode(['error' => 'This visit has already been accepted by another technologist']);
                return;
            }

            if ($prefDate) {
                $stmt = $conn->prepare(
                    "UPDATE tbl_field_visit_request SET status = ?, tech_id = ?, tech_notes = ?, preferred_date = ? WHERE visit_id = ?"
                );
                $stmt->bind_param("sissi", $status, $techId, $techNotes, $prefDate, $data['visit_id']);
            } else {
                $stmt = $conn->prepare(
                    "UPDATE tbl_field_visit_request SET status = ?, tech_id = ?, tech_notes = ? WHERE visit_id = ?"
                );
                $stmt->bind_param("sisi", $status, $techId, $techNotes, $data['visit_id']);
            }
        }
        // Admin can assign a tech_id without changing status (or with)
        elseif ($techId) {
            $stmt = $conn->prepare(
                "UPDATE tbl_field_visit_request SET status = ?, tech_id = ?, tech_notes = ? WHERE visit_id = ?"
            );
            $stmt->bind_param("sisi", $status, $techId, $techNotes, $data['visit_id']);
        } else {
            // No tech_id — only allow if the requesting tech is the assigned one
            // (this handles Complete without passing tech_id)
            $stmt = $conn->prepare(
                "UPDATE tbl_field_visit_request SET status = ?, tech_notes = ? WHERE visit_id = ?"
            );
            $stmt->bind_param("ssi", $status, $techNotes, $data['visit_id']);
        }

        if ($stmt->execute() && $stmt->affected_rows > 0) {
            echo json_encode(['message' => 'Visit request updated']);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Visit not found or no changes made']);
        }
        $stmt->close();
        return;
    }

    // Admin assign tech without changing status explicitly → auto-accept
    if (!empty($data['tech_id'])) {
        $stmt = $conn->prepare(
            "UPDATE tbl_field_visit_request SET tech_id = ?, status = 'Accepted' WHERE visit_id = ?"
        );
        $stmt->bind_param("ii", $data['tech_id'], $data['visit_id']);

        if ($stmt->execute() && $stmt->affected_rows > 0) {
            echo json_encode(['message' => 'Technologist assigned to visit']);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Visit not found or no changes made']);
        }
        $stmt->close();
        return;
    }

    http_response_code(400);
    echo json_encode(['error' => 'Provide status or tech_id to update']);
}
