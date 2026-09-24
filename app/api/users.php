<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

$conn = getConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        getUsers($conn);
        break;
    case 'PUT':
        updateUser($conn);
        break;
    case 'DELETE':
        deleteUser($conn);
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();

// ── GET Users ─────────────────────────────────────────────
function getUsers($conn) {
    $userId = $_GET['user_id'] ?? null;
    $typeId = $_GET['user_type_id'] ?? null;
    $search = $_GET['search'] ?? null;

    if ($userId) {
        $stmt = $conn->prepare(
            "SELECT u.user_id, u.user_type_id, u.fname, u.lname, u.mname,
                    u.contact_number, u.has_seen_demo, u.created_at,
                    ut.type_name,
                    a.barangay, a.municipality, a.province, a.country, a.zip_code
             FROM tbl_user u
             JOIN tbl_user_type ut ON u.user_type_id = ut.user_type_id
             LEFT JOIN tbl_address a ON u.user_id = a.user_id
             WHERE u.user_id = ?"
        );
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();

        if ($user) {
            echo json_encode($user);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
        }
        $stmt->close();
        return;
    }

    $sql = "SELECT u.user_id, u.user_type_id, u.fname, u.lname, u.mname,
                   u.contact_number, u.has_seen_demo, u.created_at,
                   ut.type_name
            FROM tbl_user u
            JOIN tbl_user_type ut ON u.user_type_id = ut.user_type_id
            WHERE 1=1";
    $params = [];
    $types = "";

    if ($typeId) {
        $sql .= " AND u.user_type_id = ?";
        $params[] = $typeId;
        $types .= "i";
    }
    if ($search) {
        $sql .= " AND (u.fname LIKE ? OR u.lname LIKE ? OR u.contact_number LIKE ?)";
        $searchTerm = "%$search%";
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $types .= "sss";
    }

    $sql .= " ORDER BY u.created_at DESC";

    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }

    echo json_encode($users);
    $stmt->close();
}

// ── PUT Update User ───────────────────────────────────────
function updateUser($conn) {
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['user_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'user_id is required']);
        return;
    }

    $fields = [];
    $params = [];
    $types = "";

    if (isset($data['fname'])) {
        $fields[] = "fname = ?";
        $params[] = $data['fname'];
        $types .= "s";
    }
    if (isset($data['lname'])) {
        $fields[] = "lname = ?";
        $params[] = $data['lname'];
        $types .= "s";
    }
    if (isset($data['mname'])) {
        $fields[] = "mname = ?";
        $params[] = $data['mname'];
        $types .= "s";
    }
    if (isset($data['contact_number'])) {
        $fields[] = "contact_number = ?";
        $params[] = $data['contact_number'];
        $types .= "s";
    }
    if (isset($data['user_type_id'])) {
        $fields[] = "user_type_id = ?";
        $params[] = $data['user_type_id'];
        $types .= "i";
    }
    if (isset($data['has_seen_demo'])) {
        $fields[] = "has_seen_demo = ?";
        $params[] = $data['has_seen_demo'];
        $types .= "i";
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['error' => 'No fields to update']);
        return;
    }

    $sql = "UPDATE tbl_user SET " . implode(', ', $fields) . " WHERE user_id = ?";
    $params[] = $data['user_id'];
    $types .= "i";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);

    if ($stmt->execute()) {
        // Update address if provided
        if (isset($data['barangay']) || isset($data['municipality']) || isset($data['province']) || isset($data['zip_code'])) {
            $addrCheck = $conn->prepare("SELECT id FROM tbl_address WHERE user_id = ?");
            $addrCheck->bind_param("i", $data['user_id']);
            $addrCheck->execute();
            $hasAddr = $addrCheck->get_result()->num_rows > 0;
            $addrCheck->close();

            $barangay = $data['barangay'] ?? '';
            $municipality = $data['municipality'] ?? '';
            $province = $data['province'] ?? '';
            $country = $data['country'] ?? 'Philippines';
            $zip_code = $data['zip_code'] ?? '';

            if ($hasAddr) {
                $addrStmt = $conn->prepare(
                    "UPDATE tbl_address SET barangay = ?, municipality = ?, province = ?, country = ?, zip_code = ? WHERE user_id = ?"
                );
                $addrStmt->bind_param("sssssi", $barangay, $municipality, $province, $country, $zip_code, $data['user_id']);
            } else {
                $addrStmt = $conn->prepare(
                    "INSERT INTO tbl_address (user_id, barangay, municipality, province, country, zip_code) VALUES (?, ?, ?, ?, ?, ?)"
                );
                $addrStmt->bind_param("isssss", $data['user_id'], $barangay, $municipality, $province, $country, $zip_code);
            }
            $addrStmt->execute();
            $addrStmt->close();
        }

        echo json_encode(['message' => 'User updated successfully']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update user: ' . $stmt->error]);
    }
    $stmt->close();
}

// ── DELETE User ───────────────────────────────────────────
function deleteUser($conn) {
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['user_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'user_id is required']);
        return;
    }

    $stmt = $conn->prepare("DELETE FROM tbl_user WHERE user_id = ?");
    $stmt->bind_param("i", $data['user_id']);

    if ($stmt->execute() && $stmt->affected_rows > 0) {
        echo json_encode(['message' => 'User deleted successfully']);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
    }
    $stmt->close();
}
