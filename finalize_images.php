<?php
require_once 'app/config/db.php';
$conn = getConnection();
echo "Finalizing disease library images...\n";

// 1. Ensure "Healthy" exists in the database
$checkHealthy = $conn->query("SELECT disease_id FROM tbl_disease WHERE disease_name = 'Healthy'");
if ($checkHealthy->num_rows === 0) {
    $sqlInsert = "INSERT INTO tbl_disease (disease_id, disease_name, scientific_name, common_symptoms, reference_image) 
                  VALUES (99, 'Healthy', 'N/A', 'No disease detected. The plant appears healthy.', 'uploads/diseases/healthy.png')";
    $conn->query($sqlInsert);
}

// 2. Update all other missing images
$updates = [
    'Rice Grassy Stunt' => 'uploads/diseases/grassy_stunt.png',
    'Leaf Scald' => 'uploads/diseases/leaf_scald.png',
    'Narrow Brown Spot' => 'uploads/diseases/narrow_brown.png',
    'Healthy' => 'uploads/diseases/healthy.png'
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
