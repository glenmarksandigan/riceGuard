<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

$conn = getConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $conn->prepare("SELECT * FROM tbl_disease ORDER BY disease_name ASC");
    $stmt->execute();
    $result = $stmt->get_result();
    
    $diseases = [];
    while ($row = $result->fetch_assoc()) {
        $diseases[] = $row;
    }
    
    echo json_encode($diseases);
    $stmt->close();
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();
