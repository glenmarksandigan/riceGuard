<?php
require_once 'auth_check.php';
require_once __DIR__ . '/../config/db.php';
$conn = getConnection();
$diseases = $conn->query("SELECT d.*, (SELECT COUNT(*) FROM tbl_ai_diagnosis ad WHERE ad.disease_id = d.disease_id) as diag_count, (SELECT COUNT(*) FROM tbl_treatment t WHERE t.disease_id = d.disease_id) as treatment_count FROM tbl_disease d ORDER BY d.disease_name");
$conn->close();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pathogens — RiceGuard Admin</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #F8FAF8; color: #1A1A2E; }

        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
        .page-header h1 { font-size: 28px; font-weight: 800; color: #1B5E20; letter-spacing: -0.5px; }
        
        .header-actions { display: flex; gap: 12px; }
        .btn-add {
            padding: 10px 20px; border-radius: 12px; border: none;
            background: linear-gradient(135deg, #1B5E20, #2E7D32); color: white;
            font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px;
            transition: all 0.2s; box-shadow: 0 4px 12px rgba(46,125,50,0.2);
        }
        .btn-add:hover { transform: translateY(-1px); box-shadow: 0 6px 15px rgba(46,125,50,0.3); }

        .diseases-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 24px; }
        
        .disease-card {
            background: white; border-radius: 20px; padding: 28px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.03);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex; flex-direction: column; position: relative; overflow: hidden;
        }
        .disease-card::before { content: ""; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #2E7D32; opacity: 0.1; }
        .disease-card:hover { transform: translateY(-5px); box-shadow: 0 20px 40px rgba(0,0,0,0.05); border-color: #E8F5E9; }
        .disease-card:hover::before { opacity: 1; }

        .disease-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .disease-name { font-size: 20px; font-weight: 800; color: #2C3E50; letter-spacing: -0.3px; }
        .disease-id { font-size: 10px; font-weight: 800; color: #BDC3C7; text-transform: uppercase; background: #F8FAF8; padding: 4px 8px; border-radius: 6px; }

        .disease-sci { font-size: 13px; color: #2E7D32; font-style: italic; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 6px; }
        .disease-sci i { font-size: 16px; opacity: 0.7; }

        .disease-symptoms { 
            font-size: 14px; color: #5F6368; line-height: 1.6; margin-bottom: 24px; 
            display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
            font-weight: 500;
        }

        .disease-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 20px; border-top: 1px dashed #F1F4F1; }
        
        .disease-stats { display: flex; gap: 8px; }
        .disease-stat {
            display: flex; align-items: center; gap: 6px;
            padding: 6px 12px; border-radius: 10px; background: #F8FAF8;
            font-size: 11px; font-weight: 700; color: #7F8C8D; border: 1px solid #F1F4F1;
        }
        .disease-stat.ai { color: #2980B9; background: #F0F7FF; border-color: #EBF5FF; }
        .disease-stat.med { color: #D97706; background: #FFFBEB; border-color: #FEF3C7; }

        .btn-details {
            width: 36px; height: 36px; border-radius: 10px; border: none;
            background: #F1F4F1; color: #7F8C8D; cursor: pointer;
            display: flex; align-items: center; justify-content: center; transition: all 0.2s;
        }
        .btn-details:hover { background: #E8F5E9; color: #2E7D32; }
    </style>
</head>
<body>
    <?php include 'sidebar.php'; ?>

    <div class="main-content">
        <div class="page-header">
            <h1>🔬 Pathogen Library</h1>
            <div class="header-actions">
                <button class="btn-add"><i class="ri-add-line"></i> New Disease Profile</button>
            </div>
        </div>

        <div class="diseases-grid">
            <?php while ($d = $diseases->fetch_assoc()): ?>
            <div class="disease-card">
                <div class="disease-header">
                    <div class="disease-name"><?= htmlspecialchars($d['disease_name']) ?></div>
                    <div class="disease-id">ID #<?= $d['disease_id'] ?></div>
                </div>
                
                <div class="disease-sci">
                    <i class="ri-microscope-line"></i>
                    <?= htmlspecialchars($d['scientific_name'] ?: 'No scientific name assigned') ?>
                </div>

                <div class="disease-symptoms" title="<?= htmlspecialchars($d['common_symptoms']) ?>">
                    <?= htmlspecialchars($d['common_symptoms']) ?>
                </div>

                <div class="disease-footer">
                    <div class="disease-stats">
                        <div class="disease-stat ai" title="AI Training Association">
                            <i class="ri-robot-2-line"></i>
                            <?= $d['diag_count'] ?> Reports
                        </div>
                        <div class="disease-stat med" title="Recommended Treatment Options">
                            <i class="ri-medicine-bottle-line"></i>
                            <?= $d['treatment_count'] ?> Treatments
                        </div>
                    </div>
                    
                    <button class="btn-details" title="Edit Profile">
                        <i class="ri-pencil-line"></i>
                    </button>
                </div>
            </div>
            <?php endwhile; ?>
        </div>
    </div>
</body>
</html>
