<?php
require_once 'auth_check.php';
require_once __DIR__ . '/../config/db.php';
$conn = getConnection();

// Fetch stats
$totalUsers = $conn->query("SELECT COUNT(*) as c FROM tbl_user")->fetch_assoc()['c'];
$totalFarmers = $conn->query("SELECT COUNT(*) as c FROM tbl_user WHERE user_type_id = 1")->fetch_assoc()['c'];
$totalTechs = $conn->query("SELECT COUNT(*) as c FROM tbl_user WHERE user_type_id = 2")->fetch_assoc()['c'];
$totalReports = $conn->query("SELECT COUNT(*) as c FROM tbl_disease_report")->fetch_assoc()['c'];
$pendingReports = $conn->query("SELECT COUNT(*) as c FROM tbl_disease_report WHERE status='Pending'")->fetch_assoc()['c'];
$verifiedReports = $conn->query("SELECT COUNT(*) as c FROM tbl_disease_report WHERE status='Verified'")->fetch_assoc()['c'];
$totalDiagnoses = $conn->query("SELECT COUNT(*) as c FROM tbl_ai_diagnosis")->fetch_assoc()['c'];
$totalClaims = $conn->query("SELECT COUNT(*) as c FROM tbl_insurance_claim")->fetch_assoc()['c'];
$pendingClaims = $conn->query("SELECT COUNT(*) as c FROM tbl_insurance_claim WHERE status='Pending'")->fetch_assoc()['c'];
$paidClaims = $conn->query("SELECT COUNT(*) as c FROM tbl_insurance_claim WHERE status='Paid'")->fetch_assoc()['c'];
$totalVerifications = $conn->query("SELECT COUNT(*) as c FROM tbl_verification")->fetch_assoc()['c'];

// 1. Disease Distribution (from verifications)
$diseaseDist = $conn->query(
    "SELECT d.disease_name, COUNT(v.verification_id) as cnt
     FROM tbl_verification v JOIN tbl_disease d ON v.disease_id = d.disease_id
     GROUP BY v.disease_id ORDER BY cnt DESC"
);
$diseaseLabels = []; $diseaseCounts = [];
while($row = $diseaseDist->fetch_assoc()) {
    $diseaseLabels[] = $row['disease_name'];
    $diseaseCounts[] = (int)$row['cnt'];
}

// 2. Reporting Trends (last 14 days)
$trends = $conn->query(
    "SELECT DATE(reported_at) as d, COUNT(*) as cnt
     FROM tbl_disease_report
     WHERE reported_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
     GROUP BY DATE(reported_at) ORDER BY d ASC"
);
$trendLabels = []; $trendCounts = [];
// Fill gaps with 0
for ($i = 13; $i >= 0; $i--) {
    $date = date('Y-m-d', strtotime("-$i days"));
    $trendLabels[] = date('M d', strtotime($date));
    $trendCounts[$date] = 0;
}
while($row = $trends->fetch_assoc()) {
    $trendCounts[$row['d']] = (int)$row['cnt'];
}
$trendValues = array_values($trendCounts);

// 3. Claim Status Distribution
$claimDist = $conn->query("SELECT status, COUNT(*) as cnt FROM tbl_insurance_claim GROUP BY status");
$claimLabels = []; $claimCounts = [];
while($row = $claimDist->fetch_assoc()) {
    $claimLabels[] = $row['status'];
    $claimCounts[] = (int)$row['cnt'];
}

// 4. KPI: Verification Rate
$vRate = ($totalReports > 0) ? round(($totalVerifications / $totalReports) * 100, 1) : 0;
// 5. KPI: Average AI Confidence
$avgConf = $conn->query("SELECT AVG(confidence_score) as a FROM tbl_ai_diagnosis")->fetch_assoc()['a'];
$avgConf = $avgConf ? round($avgConf, 1) : 0;

// Recent reports
$recentReports = $conn->query(
    "SELECT r.report_id, r.status, r.reported_at, r.field_location, u.fname, u.lname
     FROM tbl_disease_report r JOIN tbl_user u ON r.user_id = u.user_id
     ORDER BY r.reported_at DESC LIMIT 6"
);

// Recent claims
$recentClaims = $conn->query(
    "SELECT ic.claim_id, ic.status, ic.damage_type, ic.created_at,
            u.fname, u.lname, r.field_location
     FROM tbl_insurance_claim ic
     JOIN tbl_user u ON ic.user_id = u.user_id
     JOIN tbl_disease_report r ON ic.report_id = r.report_id
     ORDER BY ic.created_at DESC LIMIT 6"
);

$conn->close();

// Greeting based on time
$hour = (int)date('G');
if ($hour < 12) $greeting = '☀️ Good Morning';
elseif ($hour < 18) $greeting = '🌤️ Good Afternoon';
else $greeting = '🌙 Good Evening';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard — RiceGuard Admin</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #F5F7F5; color: #1A1A2E; }

        .page-header { margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
        .page-header h1 { font-size: 32px; font-weight: 800; color: #1B5E20; letter-spacing: -1px; }
        .page-header p { color: #666; font-size: 15px; margin-top: 6px; font-weight: 500; }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
        .stat-card {
            background: white; border-radius: 20px; padding: 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.02); transition: all 0.3s ease;
            border: 1px solid rgba(0,0,0,0.03);
            position: relative; overflow: hidden;
        }
        .stat-card:hover { transform: translateY(-5px); box-shadow: 0 15px 35px rgba(0,0,0,0.06); }
        .stat-card::before {
            content: ''; position: absolute; top: 0; right: 0; width: 100px; height: 100px;
            background: linear-gradient(135deg, rgba(46, 125, 50, 0.03) 0%, transparent 100%);
            border-radius: 0 0 0 100%;
        }

        .stat-icon {
            width: 50px; height: 50px; border-radius: 14px;
            display: flex; align-items: center; justify-content: center;
            font-size: 24px; margin-bottom: 16px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.05);
        }
        .stat-value { font-size: 32px; font-weight: 800; color: #1A1A2E; letter-spacing: -0.5px; }
        .stat-label { font-size: 13px; color: #666; margin-top: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .stat-sub { font-size: 11px; color: #999; margin-top: 4px; font-weight: 500; }

        .kpi-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 30px; }
        .kpi-card { 
            border-radius: 20px; padding: 24px; color: white; display: flex; align-items: center; gap: 20px;
            box-shadow: 0 12px 30px rgba(0,0,0,0.1); position: relative;
        }
        .kpi-card::after {
            content: ''; position: absolute; top: 0; right: 0; bottom: 0; left: 0;
            background: url("https://www.transparenttextures.com/patterns/carbon-fibre.png");
            opacity: 0.05; pointer-events: none;
        }
        .kpi-icon { font-size: 40px; opacity: 0.9; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.2)); }
        .kpi-data h4 { font-size: 11px; opacity: 0.7; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin-bottom: 4px; }
        .kpi-data div { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }

        .grid-charts { 
            display: grid; 
            grid-template-columns: 1.3fr 0.85fr 0.85fr; 
            gap: 24px; 
            margin-bottom: 30px; 
        }
        
        .grid-tables { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        
        .card { 
            background: white; border-radius: 20px; padding: 28px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.02); 
            border: 1px solid rgba(0,0,0,0.03);
            display: flex;
            flex-direction: column;
        }
        .chart-container { position: relative; height: 260px; width: 100%; margin-top: 10px; }
        .card-title { font-size: 16px; font-weight: 700; margin-bottom: 24px; display: flex; align-items: center; gap: 10px; color: #2C3E50; }
        .card-title i { color: #2E7D32; font-size: 22px; width: 36px; height: 36px; background: rgba(46, 125, 50, 0.05); display: flex; align-items: center; justify-content: center; border-radius: 10px; }
        .card-title a { font-size: 12px; color: #2E7D32; text-decoration: none; margin-left: auto; font-weight: 700; background: rgba(46, 125, 50, 0.05); padding: 6px 12px; border-radius: 8px; transition: all 0.2s; }
        .card-title a:hover { background: #2E7D32; color: white; }

        .table { width: 100%; border-collapse: separate; border-spacing: 0 8px; margin-top: -8px; }
        .table th { text-align: left; padding: 12px 16px; font-size: 11px; color: #95A5A6; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; }
        .table td { padding: 16px; font-size: 14px; background: #FDFDFD; border-top: 1px solid #F5F6F7; border-bottom: 1px solid #F5F6F7; }
        .table td:first-child { border-left: 1px solid #F5F6F7; border-top-left-radius: 12px; border-bottom-left-radius: 12px; }
        .table td:last-child { border-right: 1px solid #F5F6F7; border-top-right-radius: 12px; border-bottom-right-radius: 12px; }
        .table tr:hover td { background: #F8FAF8; border-color: #E8F5E9; }

        .status-badge { display: inline-block; padding: 5px 12px; border-radius: 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-pending { background: #FFF4E5; color: #D35400; }
        .status-verified { background: #EBF5FF; color: #2980B9; }
        .status-treated { background: #ECFDF5; color: #10B981; }
        .status-paid { background: #F5F3FF; color: #7C3AED; }

        canvas { width: 100% !important; }
    </style>
</head>
<body>
    <?php include 'sidebar.php'; ?>

    <div class="main-content">
        <div class="page-header">
            <div>
                <h1><?= $greeting ?>, Administrator</h1>
                <p>Welcome back to your command center. Everything looks healthy.</p>
            </div>
            <div style="background: white; padding: 10px 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.02); display: flex; align-items: center; gap: 10px;">
                <i class="ri-calendar-event-line" style="color: #2E7D32; font-size: 18px;"></i>
                <span style="font-weight: 600; font-size: 14px; color: #333;"><?= date('l, F d, Y') ?></span>
            </div>
        </div>

        <!-- KPIs -->
        <div class="kpi-row">
            <div class="kpi-card" style="background: linear-gradient(135deg, #1B5E20 0%, #388E3C 100%);">
                <div class="kpi-icon"><i class="ri-shield-flash-line"></i></div>
                <div class="kpi-data">
                    <h4>Overall Verification Rate</h4>
                    <div><?= $vRate ?>%</div>
                </div>
                <div style="margin-left: auto; background: rgba(255,255,255,0.15); padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 600;">System Health: Optimal</div>
            </div>
            <div class="kpi-card" style="background: linear-gradient(135deg, #0A2E52 0%, #1565C0 100%);">
                <div class="kpi-icon"><i class="ri-instance-line"></i></div>
                <div class="kpi-data">
                    <h4>AI Engine Confidence Avg.</h4>
                    <div><?= $avgConf ?>%</div>
                </div>
                 <div style="margin-left: auto; background: rgba(255,255,255,0.15); padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 600;">Model: v4.2 Stable</div>
            </div>
        </div>

        <!-- Primary Stats -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(46, 125, 50, 0.1); color:#2E7D32;"><i class="ri-group-line"></i></div>
                <div class="stat-value"><?= $totalUsers ?></div>
                <div class="stat-label">Platform Users</div>
                <div class="stat-sub"><?= $totalFarmers ?> farmers · <?= $totalTechs ?> technicians</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(255, 152, 0, 0.1); color:#E65100;"><i class="ri-file-list-3-line"></i></div>
                <div class="stat-value"><?= $totalReports ?></div>
                <div class="stat-label">Active Reports</div>
                <div class="stat-sub"><?= $pendingReports ?> pending · <?= $verifiedReports ?> verified</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(33, 150, 243, 0.1); color:#1565C0;"><i class="ri-cpu-line"></i></div>
                <div class="stat-value"><?= $totalDiagnoses ?></div>
                <div class="stat-label">AI Diagnoses</div>
                <div class="stat-sub"><?= $totalVerifications ?> expert-verified results</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(233, 30, 99, 0.1); color:#C2185B;"><i class="ri-verified-badge-line"></i></div>
                <div class="stat-value"><?= $totalClaims ?></div>
                <div class="stat-label">Insurance Claims</div>
                <div class="stat-sub"><?= $pendingClaims ?> processing · <?= $paidClaims ?> settled</div>
            </div>
        </div>

        <!-- Charts Row -->
        <div class="grid-charts">
            <div class="card">
                <div class="card-title"><i class="ri-line-chart-line"></i> Detection Activity Trends</div>
                <div class="chart-container">
                    <canvas id="trendChart"></canvas>
                </div>
            </div>
            <div class="card">
                <div class="card-title"><i class="ri-pie-chart-2-line"></i> Disease Prevalence</div>
                <div class="chart-container">
                    <canvas id="diseaseChart"></canvas>
                </div>
            </div>
            <div class="card">
                <div class="card-title"><i class="ri-donut-chart-line"></i> Claim Fulfillment</div>
                <div class="chart-container">
                    <canvas id="claimChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Tables Row -->
        <div class="grid-tables">
            <div class="card">
                <div class="card-title"><i class="ri-notification-3-line"></i> Real-time Activity <a href="reports.php">Details</a></div>
                <table class="table">
                    <thead><tr><th>Farmer Account</th><th>Status</th><th>Time</th></tr></thead>
                    <tbody>
                        <?php while ($r = $recentReports->fetch_assoc()): ?>
                        <tr>
                            <td>
                                <div style="font-weight:700; color: #2C3E50;"><?= htmlspecialchars($r['fname'] . ' ' . $r['lname']) ?></div>
                                <div style="font-size:11px; color:#7F8C8D; margin-top: 2px;"><i class="ri-map-pin-line"></i> <?= htmlspecialchars($r['field_location'] ?: 'Not Specified') ?></div>
                            </td>
                            <td><span class="status-badge status-<?= strtolower($r['status']) ?>"><?= $r['status'] ?></span></td>
                            <td style="font-weight: 600; color: #7F8C8D; font-size: 12px;"><?= date('M d, H:i', strtotime($r['reported_at'])) ?></td>
                        </tr>
                        <?php endwhile; ?>
                    </tbody>
                </table>
            </div>

            <div class="card">
                <div class="card-title"><i class="ri-money-dollar-circle-line"></i> Claim Queue <a href="claims.php">Queue</a></div>
                <table class="table">
                    <thead><tr><th>Applicant</th><th>Diagnosis</th><th>Status</th></tr></thead>
                    <tbody>
                        <?php while ($c = $recentClaims->fetch_assoc()): ?>
                        <tr>
                            <td>
                                <div style="font-weight:700; color: #2C3E50;"><?= htmlspecialchars($c['fname'] . ' ' . $c['lname']) ?></div>
                                <div style="font-size:11px; color:#7F8C8D; margin-top: 2px;">Claim #<?= $c['claim_id'] ?></div>
                            </td>
                            <td style="font-weight: 600; color: #34495E;"><?= htmlspecialchars($c['damage_type']) ?></td>
                            <td><span class="status-badge status-<?= strtolower($c['status']) ?>"><?= $c['status'] ?></span></td>
                        </tr>
                        <?php endwhile; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
    // 1. Trend Chart
    new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
            labels: <?= json_encode($trendLabels) ?>,
            datasets: [{
                label: 'Reports',
                data: <?= json_encode($trendValues) ?>,
                borderColor: '#2E7D32',
                backgroundColor: 'rgba(46, 125, 50, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#2E7D32'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });

    // 2. Disease Chart
    new Chart(document.getElementById('diseaseChart'), {
        type: 'doughnut',
        data: {
            labels: <?= json_encode($diseaseLabels) ?>,
            datasets: [{
                data: <?= json_encode($diseaseCounts) ?>,
                backgroundColor: ['#2E7D32', '#4CAF50', '#81C784', '#A5D6A7', '#C8E6C9'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } }
            },
            cutout: '70%'
        }
    });

    // 3. Claim Chart
    new Chart(document.getElementById('claimChart'), {
        type: 'pie',
        data: {
            labels: <?= json_encode($claimLabels) ?>,
            datasets: [{
                data: <?= json_encode($claimCounts) ?>,
                backgroundColor: ['#BF360C', '#1B5E20', '#0D47A1', '#4A148C'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } }
            }
        }
    });
    </script>
</body>
</html>
