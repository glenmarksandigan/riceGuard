<?php
require_once 'app/config/db.php';
$conn = getConnection();
echo "Updating disease reference images...\n";

$updates = [
    'Bacterial Leaf Blight' => 'uploads/diseases/blb.png',
    'Rice Blast' => 'uploads/diseases/blast.png',
    'Brown Spot' => 'uploads/diseases/brown_spot.png',
    'Sheath Blight' => 'uploads/diseases/sheath_blight.png',
    'Tungro' => 'uploads/diseases/tungro.png'
];

foreach ($updates as $name => $path) {
    $stmt = $conn->prepare("UPDATE tbl_disease SET reference_image = ? WHERE disease_name = ?");
    $stmt->bind_param("ss", $path, $name);
    $stmt->execute();
    echo "Updated $name\n";
    $stmt->close();
}

$conn->close();
?>
