<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

$conn = getConnection();
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'register':
        handleRegister($conn);
        break;
    case 'login':
        handleLogin($conn);
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action. Use ?action=register or ?action=login']);
}

$conn->close();

// ── Register ──────────────────────────────────────────────
function handleRegister($conn) {
    $data = json_decode(file_get_contents('php://input'), true);

    $required = ['user_type_id', 'fname', 'lname', 'contact_number', 'password'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "Missing required field: $field"]);
            return;
        }
    }

    // Check if contact number already exists
    $check = $conn->prepare("SELECT user_id FROM tbl_user WHERE contact_number = ?");
    $check->bind_param("s", $data['contact_number']);
    $check->execute();
    if ($check->get_result()->num_rows > 0) {
        http_response_code(409);
        echo json_encode(['error' => 'Contact number already registered']);
        return;
    }
    $check->close();

    $hashedPassword = password_hash($data['password'], PASSWORD_DEFAULT);
    $mname = $data['mname'] ?? '';
    $suffix = $data['suffix'] ?? '';

    $stmt = $conn->prepare(
        "INSERT INTO tbl_user (user_type_id, fname, lname, mname, suffix, contact_number, password, has_seen_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)"
    );
    $stmt->bind_param(
        "issssss",
        $data['user_type_id'],
        $data['fname'],
        $data['lname'],
        $mname,
        $suffix,
        $data['contact_number'],
        $hashedPassword
    );

    if ($stmt->execute()) {
        $userId = $stmt->insert_id;

        // Insert address if provided
        if (!empty($data['barangay']) || !empty($data['municipality'])) {
            $addrStmt = $conn->prepare(
                "INSERT INTO tbl_address (user_id, barangay, municipality, province, country, zip_code)
                 VALUES (?, ?, ?, ?, ?, ?)"
            );
            $barangay = $data['barangay'] ?? '';
            $municipality = $data['municipality'] ?? '';
            $province = $data['province'] ?? '';
            $country = $data['country'] ?? 'Philippines';
            $zip_code = $data['zip_code'] ?? '';
            $addrStmt->bind_param("isssss", $userId, $barangay, $municipality, $province, $country, $zip_code);
            $addrStmt->execute();
            $addrStmt->close();
        }

        http_response_code(201);
        echo json_encode([
            'message' => 'Registration successful',
            'user_id' => $userId
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Registration failed: ' . $stmt->error]);
    }
    $stmt->close();
}

// ── Login ─────────────────────────────────────────────────
function handleLogin($conn) {
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['contact_number']) || empty($data['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Contact number and password are required']);
        return;
    }

    $stmt = $conn->prepare(
        "SELECT u.*, ut.type_name,
                a.barangay, a.municipality, a.province, a.country, a.zip_code
         FROM tbl_user u
         JOIN tbl_user_type ut ON u.user_type_id = ut.user_type_id
         LEFT JOIN tbl_address a ON u.user_id = a.user_id
         WHERE u.contact_number = ?"
    );
    $stmt->bind_param("s", $data['contact_number']);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid contact number or password']);
        return;
    }

    $user = $result->fetch_assoc();

    if (!password_verify($data['password'], $user['password'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid contact number or password']);
        return;
    }

    // Remove password from response
    unset($user['password']);

    echo json_encode([
        'message' => 'Login successful',
        'user' => $user
    ]);
    $stmt->close();
}
