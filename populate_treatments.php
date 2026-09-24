<?php
require_once __DIR__ . '/app/config/db.php';
$conn = getConnection();

// Clear existing treatments to ensure we have only the official PhilRice ones
$conn->query("SET FOREIGN_KEY_CHECKS = 0;");
$conn->query("TRUNCATE TABLE tbl_treatment;");
$conn->query("SET FOREIGN_KEY_CHECKS = 1;");

$treatments = [
    // 1. Bacterial Leaf Blight
    [
        'disease_name' => 'Bacterial Leaf Blight',
        'entries' => [
            ['Cultural', 'Resistant Varieties', 'N/A', 'Plant varieties like NSIC Rc222 or Rc160; reduce plant injury during transplanting.', 0],
            ['Chemical', 'Copper Hydroxide', '2 tbsp per 16L', 'Apply copper-based fungicides before 40-50 days after sowing (DAS) if symptoms persist.', 450],
            ['Integrated', 'Nitrogen Management', 'Balanced', 'Avoid high nitrogen fertilization; apply balanced amounts to prevent lush growth.', 0]
        ]
    ],
    // 2. Rice Blast
    [
        'disease_name' => 'Rice Blast',
        'entries' => [
            ['Cultural', 'Synchronous Planting', 'N/A', 'Plow under rice stubbles immediately after harvest to eradicate inoculum.', 0],
            ['Chemical', 'Tricyclazole', '15g per 16L', 'Preventive spray at seedling stage; or Azoxystrobin at booting stage for neck blast.', 550],
            ['Integrated', 'Silicate Application', 'Soil Amendment', 'Apply soil amendments like silicate fertilizer with compost to strengthen plant walls.', 300]
        ]
    ],
    // 3. Brown Spot
    [
        'disease_name' => 'Brown Spot',
        'entries' => [
            ['Cultural', 'Nutrient Balance', 'K-rich', 'Ensure adequate potassium (K) fertilization and keep farmland free from weeds.', 0],
            ['Chemical', 'Mancozeb', '30g per 16L', 'Apply at the onset of symptoms, especially in nutrient-deficient soils.', 400],
            ['Integrated', 'Seed Health', 'Certified', 'Use certified healthy seeds; practice field sanitation and good water management.', 0]
        ]
    ],
    // 4. Sheath Blight
    [
        'disease_name' => 'Sheath Blight',
        'entries' => [
            ['Cultural', 'Deep Plowing', 'N/A', 'Plow deeply to bury infected stubbles and weeds; expose soil to intense sunlight.', 0],
            ['Biological', 'Aspergillus sp.', 'Bio-agent', 'Use PhilRice-recommended biological control agents to retard fungal growth.', 350],
            ['Chemical', 'Validamycin', '40ml per 16L', 'Apply at leaf sheath during stem elongation to booting stage if needed.', 480]
        ]
    ],
    // 5. Tungro
    [
        'disease_name' => 'Tungro',
        'entries' => [
            ['Integrated', 'Vector Management', 'Fallow', 'Control Green Leafhoppers (GLH) through synchronous planting and 30-day fallow periods.', 0],
            ['Cultural', 'Rogueing', 'N/A', 'Immediately pull out and bury diseased plants (stunted/orange) during the first 6 weeks.', 0],
            ['Cultural', 'Resistant Varieties', 'N/A', 'Plant varieties resistant to both the virus and the GLH vector.', 0]
        ]
    ],
    // 6. Rice Grassy Stunt
    [
        'disease_name' => 'Rice Grassy Stunt',
        'entries' => [
            ['Integrated', 'BPH Control', '1-month break', 'Plant in synchrony and maintain a 1-month rice-free period to break Brown Planthopper (BPH) cycle.', 0],
            ['Chemical', 'Pymetrozine', '12.5g per 16L', 'Spray to control BPH if population exceeds threshold to prevent virus transmission.', 620],
            ['Cultural', 'Field Cleanup', 'N/A', 'Dry the field after harvest to destroy weeds and stubbles that host the virus.', 0]
        ]
    ],
    // 7. Leaf Scald
    [
        'disease_name' => 'Leaf Scald',
        'entries' => [
            ['Cultural', 'Optimal Spacing', '20x20cm', 'Increase plant spacing during transplanting and remove weeds around the field.', 0],
            ['Integrated', 'Silicon & Nitrogen', 'Split Dose', 'Keep silicon levels high and avoid excessive nitrogen; split N applications.', 0],
            ['Chemical', 'Copper Oxychloride', '3 tbsp per 16L', 'Apply foliar spray if symptoms appear on more than 20% of leaves.', 460]
        ]
    ],
    // 8. Narrow Brown Spot
    [
        'disease_name' => 'Narrow Brown Spot',
        'entries' => [
            ['Cultural', 'Field Cleanliness', 'N/A', 'Remove weeds and weedy rice to eliminate alternate hosts; plow after harvest.', 0],
            ['Chemical', 'Propiconazole', '15ml per 16L', 'Spray at booting to heading stages if disease risk is high.', 520],
            ['Integrated', 'Potassium Application', 'Balanced', 'Use balanced nutrients ensuring adequate potassium is applied to strengthen cell walls.', 0]
        ]
    ]
];

$successCount = 0;
$errorCount = 0;

foreach ($treatments as $tGroup) {
    $dName = $conn->real_escape_string($tGroup['disease_name']);
    $res = $conn->query("SELECT disease_id FROM tbl_disease WHERE disease_name = '$dName' LIMIT 1");
    
    if ($row = $res->fetch_assoc()) {
        $did = $row['disease_id'];
        foreach ($tGroup['entries'] as $e) {
            $type = $e[0];
            $pest = $conn->real_escape_string($e[1]);
            $dose = $conn->real_escape_string($e[2]);
            $app = $conn->real_escape_string($e[3]);
            $cost = $e[4];
            
            $sql = "INSERT INTO tbl_treatment (disease_id, treatment_type, pesticide_name, dosage, application_method, estimated_cost) 
                    VALUES ($did, '$type', '$pest', '$dose', '$app', $cost)";
            
            if ($conn->query($sql)) {
                $successCount++;
            } else {
                echo "Error inserting for $dName: " . $conn->error . "\n";
                $errorCount++;
            }
        }
    } else {
        echo "Disease not found in DB: $dName\n";
        $errorCount++;
    }
}

echo "\n--- PhilRice Treatment Population Finished ---\n";
echo "Successfully added: $successCount official treatments\n";
echo "Errors: $errorCount\n";

$conn->close();
