<?php
require_once 'app/config/db.php';
$conn = getConnection();
echo "Adding reference_image column...\n";
$sql = "ALTER TABLE tbl_disease ADD COLUMN reference_image VARCHAR(255) NULL AFTER common_symptoms";
if ($conn->query($sql)) {
    echo "Success!\n";
} else {
    echo "Error: " . $conn->error . "\n";
}
$conn->close();
?>
