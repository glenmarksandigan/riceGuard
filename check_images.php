<?php
require_once 'app/config/db.php';
$conn = getConnection();
$res = $conn->query("SELECT disease_name, reference_image FROM tbl_disease");
while($r = $res->fetch_assoc()) {
    echo $r['disease_name'] . " | " . ($r['reference_image'] ?? 'NULL') . "\n";
}
$conn->close();
?>
