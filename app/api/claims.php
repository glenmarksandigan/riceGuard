<?php
// Log errors to file instead of displaying HTML
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

$conn = getConnection();

// Auto-create tbl_claim_image if it doesn't exist (suppress errors gracefully)
@$conn->query("CREATE TABLE IF NOT EXISTS `tbl_claim_image` (
    `claim_image_id` INT(11) NOT NULL AUTO_INCREMENT,
    `claim_id` INT(11) NOT NULL,
    `image_path` VARCHAR(255) NOT NULL,
    `image_type` ENUM('Field Damage', 'Affected Area', 'Supporting Document', 'Other') DEFAULT 'Other',
    `uploaded_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`claim_image_id`),
    FOREIGN KEY (`claim_id`) REFERENCES `tbl_insurance_claim`(`claim_id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// Auto-add rejection_reason column if it doesn't exist
$colCheck = @$conn->query("SHOW COLUMNS FROM tbl_insurance_claim LIKE 'rejection_reason'");
if ($colCheck && $colCheck->num_rows === 0) {
    @$conn->query("ALTER TABLE tbl_insurance_claim ADD COLUMN `rejection_reason` TEXT AFTER `damage_type`");
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        getClaims($conn);
        break;
    case 'POST':
        createClaim($conn);
        break;
    case 'PUT':
        updateClaim($conn);
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();

// ── GET Claims ────────────────────────────────────────────
function getClaims($conn) {
    $userId = $_GET['user_id'] ?? null;
    $status = $_GET['status'] ?? null;
    $claimId = $_GET['claim_id'] ?? null;

    if ($claimId) {
        $stmt = $conn->prepare(
            "SELECT ic.*, u.fname, u.lname, u.contact_number,
                    COALESCE(a.barangay,'') as barangay, COALESCE(a.municipality,'') as municipality,
                    r.description as report_description, r.field_location, r.status as report_status,
                    (SELECT GROUP_CONCAT(CONCAT(ci.image_path, '|', ci.image_type) SEPARATOR ',')
                     FROM tbl_claim_image ci WHERE ci.claim_id = ic.claim_id) as claim_images
             FROM tbl_insurance_claim ic
             JOIN tbl_user u ON ic.user_id = u.user_id
             JOIN tbl_disease_report r ON ic.report_id = r.report_id
             LEFT JOIN tbl_address a ON u.user_id = a.user_id
             WHERE ic.claim_id = ?"
        );
        $stmt->bind_param("i", $claimId);
        $stmt->execute();
        $result = $stmt->get_result();
        $claim = $result->fetch_assoc();

        if ($claim) {
            $claim['proof_images'] = parseClaimImages($claim['claim_images'] ?? '');
            unset($claim['claim_images']);
            echo json_encode($claim);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Claim not found']);
        }
        $stmt->close();
        return;
    }

    $sql = "SELECT ic.*, u.fname, u.lname, u.contact_number,
                   COALESCE(a.barangay,'') as barangay, COALESCE(a.municipality,'') as municipality,
                   r.field_location, r.status as report_status,
                   (SELECT GROUP_CONCAT(CONCAT(ci.image_path, '|', ci.image_type) SEPARATOR ',')
                    FROM tbl_claim_image ci WHERE ci.claim_id = ic.claim_id) as claim_images
            FROM tbl_insurance_claim ic
            JOIN tbl_user u ON ic.user_id = u.user_id
            JOIN tbl_disease_report r ON ic.report_id = r.report_id
            LEFT JOIN tbl_address a ON u.user_id = a.user_id
            WHERE 1=1";
    $params = [];
    $types = "";

    if ($userId) {
        $sql .= " AND ic.user_id = ?";
        $params[] = $userId;
        $types .= "i";
    }
    if ($status) {
        $sql .= " AND ic.status = ?";
        $params[] = $status;
        $types .= "s";
    }

    $sql .= " ORDER BY ic.created_at DESC";

    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    $claims = [];
    while ($row = $result->fetch_assoc()) {
        $row['proof_images'] = parseClaimImages($row['claim_images'] ?? '');
        unset($row['claim_images']);
        $claims[] = $row;
    }

    echo json_encode($claims);
    $stmt->close();
}

// Helper: parse "path|type,path|type" into array of objects
function parseClaimImages($raw) {
    if (!$raw) return [];
    $images = [];
    foreach (explode(',', $raw) as $entry) {
        $parts = explode('|', $entry);
        $images[] = [
            'image_path' => $parts[0] ?? '',
            'image_type' => $parts[1] ?? 'Other',
        ];
    }
    return $images;
}

// ── POST Create Claim ─────────────────────────────────────
function createClaim($conn) {
    // Support both JSON and multipart/form-data
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (strpos($contentType, 'multipart/form-data') !== false) {
        $data = $_POST;
    } else {
        $data = json_decode(file_get_contents('php://input'), true);
    }

    $required = ['user_id', 'report_id', 'damage_type'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "Missing required field: $field"]);
            return;
        }
    }

    // Verify report is in Verified status
    $check = $conn->prepare("SELECT status FROM tbl_disease_report WHERE report_id = ?");
    $check->bind_param("i", $data['report_id']);
    $check->execute();
    $reportResult = $check->get_result()->fetch_assoc();
    $check->close();

    if (!$reportResult) {
        http_response_code(404);
        echo json_encode(['error' => 'Report not found']);
        return;
    }
    if ($reportResult['status'] !== 'Verified') {
        http_response_code(400);
        echo json_encode(['error' => 'Report must be verified before filing an insurance claim']);
        return;
    }

    $rsbsa = $data['rsbsa_num'] ?? '';
    $policy = $data['policy_num'] ?? '';

    $stmt = $conn->prepare(
        "INSERT INTO tbl_insurance_claim (user_id, report_id, rsbsa_num, policy_num, damage_type, status)
         VALUES (?, ?, ?, ?, ?, 'Pending')"
    );
    $stmt->bind_param("iisss", $data['user_id'], $data['report_id'], $rsbsa, $policy, $data['damage_type']);

    if ($stmt->execute()) {
        $claimId = $stmt->insert_id;

        // Handle proof image uploads
        if (!empty($_FILES['proof_images'])) {
            $uploadDir = __DIR__ . '/../../uploads/claims/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }

            $files = $_FILES['proof_images'];
            $fileCount = is_array($files['name']) ? count($files['name']) : 1;

            // Parse image types if provided (comma-separated or array)
            $imageTypes = [];
            if (!empty($data['image_types'])) {
                $imageTypes = is_array($data['image_types'])
                    ? $data['image_types']
                    : explode(',', $data['image_types']);
            }

            for ($i = 0; $i < $fileCount; $i++) {
                $tmpName = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
                $originalName = is_array($files['name']) ? $files['name'][$i] : $files['name'];
                $ext = pathinfo($originalName, PATHINFO_EXTENSION);
                $filename = 'claim_' . $claimId . '_' . time() . '_' . $i . '.' . $ext;
                $filepath = $uploadDir . $filename;

                if (move_uploaded_file($tmpName, $filepath)) {
                    $relativePath = 'uploads/claims/' . $filename;
                    $imgType = $imageTypes[$i] ?? 'Other';

                    // Validate image_type enum
                    $validTypes = ['Field Damage', 'Affected Area', 'Supporting Document', 'Other'];
                    if (!in_array($imgType, $validTypes)) $imgType = 'Other';

                    $imgStmt = $conn->prepare(
                        "INSERT INTO tbl_claim_image (claim_id, image_path, image_type) VALUES (?, ?, ?)"
                    );
                    $imgStmt->bind_param("iss", $claimId, $relativePath, $imgType);
                    $imgStmt->execute();
                    $imgStmt->close();
                }
            }
        }

        http_response_code(201);
        echo json_encode([
            'message' => 'Insurance claim submitted',
            'claim_id' => $claimId
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to submit claim: ' . $stmt->error]);
    }
    $stmt->close();
}

// ── PUT Update Claim Status ───────────────────────────────
function updateClaim($conn) {
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['claim_id']) || empty($data['status'])) {
        http_response_code(400);
        echo json_encode(['error' => 'claim_id and status are required']);
        return;
    }

    $valid = ['Pending', 'Verified', 'Paid', 'Rejected'];
    if (!in_array($data['status'], $valid)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid status. Use: ' . implode(', ', $valid)]);
        return;
    }

    // Save rejection reason when status is Rejected
    $rejectionReason = ($data['status'] === 'Rejected') ? ($data['rejection_reason'] ?? '') : null;

    $stmt = $conn->prepare("UPDATE tbl_insurance_claim SET status = ?, rejection_reason = ? WHERE claim_id = ?");
    $stmt->bind_param("ssi", $data['status'], $rejectionReason, $data['claim_id']);

    if ($stmt->execute() && $stmt->affected_rows > 0) {
        echo json_encode(['message' => 'Claim status updated']);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Claim not found or status unchanged']);
    }
    $stmt->close();
}
