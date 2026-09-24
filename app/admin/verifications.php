<?php
require_once 'auth_check.php';
require_once __DIR__ . '/../config/db.php';
$conn = getConnection();

$sql = "SELECT v.*, d.disease_name, 
               u_tech.fname as tech_fname, u_tech.lname as tech_lname,
               u_farmer.fname as farmer_fname, u_farmer.lname as farmer_lname,
               u_farmer.contact_number as farmer_contact,
               r.field_location, r.status as report_status,
               COALESCE(a.barangay,'') as barangay
        FROM tbl_verification v
        JOIN tbl_disease d ON v.disease_id = d.disease_id
        JOIN tbl_user u_tech ON v.user_id = u_tech.user_id
        JOIN tbl_disease_report r ON v.report_id = r.report_id
        JOIN tbl_user u_farmer ON r.user_id = u_farmer.user_id
        LEFT JOIN tbl_address a ON u_farmer.user_id = a.user_id
        ORDER BY v.verified_at DESC";
$verifications = $conn->query($sql);

$totalCount = $conn->query("SELECT COUNT(*) as c FROM tbl_verification")->fetch_assoc()['c'];
$conn->close();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verifications — RiceGuard Admin</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #F8FAF8; color: #1A1A2E; }

        .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; }
        .page-header h1 { font-size: 28px; font-weight: 800; color: #1B5E20; letter-spacing: -0.5px; }
        
        .stat-badge {
            background: white; border-radius: 12px; padding: 10px 18px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.03);
            display: flex; align-items: center; gap: 10px;
        }
        .stat-badge i { font-size: 20px; color: #2E7D32; background: #E8F5E9; padding: 8px; border-radius: 10px; }
        .stat-info { display: flex; flex-direction: column; }
        .stat-value { font-size: 20px; font-weight: 800; color: #2C3E50; line-height: 1; }
        .stat-label { font-size: 10px; font-weight: 700; color: #95A5A6; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }

        .card { background: white; border-radius: 20px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.03); }
        
        .table { width: 100%; border-collapse: separate; border-spacing: 0 8px; margin-top: -8px; }
        .table th { text-align: left; padding: 12px 20px; font-size: 11px; color: #95A5A6; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
        .table td { padding: 16px 20px; font-size: 14px; background: #FDFDFD; border-top: 1px solid #F5F6F7; border-bottom: 1px solid #F5F6F7; vertical-align: middle; }
        .table td:first-child { border-left: 1px solid #F5F6F7; border-top-left-radius: 14px; border-bottom-left-radius: 14px; }
        .table td:last-child { border-right: 1px solid #F5F6F7; border-top-right-radius: 14px; border-bottom-right-radius: 14px; }
        .table tr:hover td { background: #F8FAF8; border-color: #E8F5E9; }

        .status-badge { display: inline-block; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-pending { background: #FFF4E5; color: #D35400; }
        .status-verified { background: #EBF5FF; color: #2980B9; }
        .status-treated { background: #ECFDF5; color: #10B981; }

        .disease-tag {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 6px 12px; border-radius: 10px; font-size: 13px; font-weight: 700;
            background: #FEF2F2; color: #991B1B; border: 1.5px solid #FEE2E2;
        }

        .tech-info { display: flex; align-items: center; gap: 10px; }
        .tech-avatar { width: 32px; height: 32px; border-radius: 8px; background: #E8F5E9; color: #2E7D32; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; }

        .method-pill { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 10px; font-size: 11px; font-weight: 700; background: #F1F4F1; color: #7F8C8D; }
        
        .empty-state { text-align: center; padding: 60px 40px; color: #BDC3C7; }
        .empty-state i { font-size: 48px; display: block; margin-bottom: 16px; opacity: 0.5; }
        .empty-state p { font-size: 15px; font-weight: 500; }

        .notes-preview { font-size: 12px; color: #7F8C8D; font-weight: 500; margin-top: 6px; display: flex; align-items: flex-start; gap: 4px; }
        .notes-preview i { font-size: 14px; margin-top: 1px; }
    </style>
</head>
<body>
    <?php include 'sidebar.php'; ?>

    <div class="main-content">
        <div class="page-header">
            <h1>✅ Expert Verifications</h1>
            <div class="stat-badge">
                <i class="ri-shield-check-line"></i>
                <div class="stat-info">
                    <span class="stat-value"><?= $totalCount ?></span>
                    <span class="stat-label">Confirmed Cases</span>
                </div>
            </div>
        </div>

        <div class="card" style="padding: 10px;">
            <?php if ($totalCount > 0): ?>
            <table class="table">
                <thead>
                    <tr>
                        <th style="width: 100px;">Verification</th>
                        <th>Report</th>
                        <th>Farmer</th>
                        <th>Confession (Pathogen)</th>
                        <th>Expert Member</th>
                        <th style="text-align:right">Timestamp & Notes</th>
                    </tr>
                </thead>
                <tbody>
                    <?php while ($v = $verifications->fetch_assoc()): ?>
                    <tr>
                        <td><strong style="color:#2E7D32">#V-<?= $v['verification_id'] ?></strong></td>
                        <td>
                            <div style="font-weight:700; color:#2C3E50;">Report #<?= $v['report_id'] ?></div>
                            <div style="font-size:12px; color:#95A5A6; font-weight:600;"><?= htmlspecialchars($v['field_location'] ?: 'No Location') ?></div>
                        </td>
                        <td>
                            <div style="font-weight:700; color:#34495E;"><?= htmlspecialchars($v['farmer_fname'] . ' ' . $v['farmer_lname']) ?></div>
                            <div style="font-size:11px; color:#BDC3C7; text-transform:uppercase; font-weight:700;"><?= $v['barangay'] ?: 'Unknown Area' ?></div>
                        </td>
                        <td>
                            <span class="disease-tag"><i class="ri-microscope-line"></i> <?= htmlspecialchars($v['disease_name']) ?></span>
                        </td>
                        <td>
                            <div class="tech-info">
                                <div class="tech-avatar"><?= strtoupper(substr($v['tech_fname'], 0, 1)) ?></div>
                                <div style="font-weight:700; color:#2C3E50; font-size:13px;"><?= htmlspecialchars($v['tech_fname'] . ' ' . $v['tech_lname']) ?></div>
                            </div>
                        </td>
                        <td style="text-align:right">
                            <div style="color:#2C3E50; font-weight:700; font-size:13px;"><?= date('M j, Y', strtotime($v['verified_at'])) ?></div>
                            <div style="font-size:11px; color:#95A5A6; font-weight:600; margin-top:2px;"><?= date('h:i A', strtotime($v['verified_at'])) ?></div>
                            
                            <?php if ($v['notes']): ?>
                                <div class="notes-preview" style="justify-content:flex-end;">
                                    <i class="ri-chat-1-line"></i>
                                    <span><?= htmlspecialchars(substr($v['notes'], 0, 40)) ?><?= strlen($v['notes']) > 40 ? '...' : '' ?></span>
                                </div>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endwhile; ?>
                </tbody>
            </table>
            <?php else: ?>
            <div class="empty-state">
                <i class="ri-shield-user-line"></i>
                <p>No expert evaluations have been recorded yet.</p>
                <div style="margin-top:8px; font-size:12px; color:#95A5A6; font-weight:600;">Verifications appear here once technologists review farmer cases.</div>
            </div>
            <?php endif; ?>
        </div>
    </div>
</body>
</html>
