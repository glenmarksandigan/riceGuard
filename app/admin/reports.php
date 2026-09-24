<?php
require_once 'auth_check.php';
require_once __DIR__ . '/../config/db.php';
$conn = getConnection();

// Handle status update
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['report_id'], $_POST['new_status'])) {
    $stmt = $conn->prepare("UPDATE tbl_disease_report SET status = ? WHERE report_id = ?");
    $stmt->bind_param("si", $_POST['new_status'], $_POST['report_id']);
    $stmt->execute();
    $stmt->close();
    header('Location: reports.php?msg=updated');
    exit;
}

$status = $_GET['status'] ?? '';
$range = $_GET['range'] ?? '';
$diseaseFilter = $_GET['disease_id'] ?? '';
$barangayFilter = $_GET['barangay'] ?? '';
$searchFilter = $_GET['search'] ?? '';

// Build base where clauses for filtering
$baseFilterSql = "";

if ($range) {
    if ($range === 'today') {
        $baseFilterSql .= " AND DATE(r.reported_at) = CURDATE()";
    } elseif ($range === 'week') {
        $baseFilterSql .= " AND YEARWEEK(r.reported_at, 1) = YEARWEEK(CURDATE(), 1)";
    } elseif ($range === 'month') {
        $baseFilterSql .= " AND MONTH(r.reported_at) = MONTH(CURDATE()) AND YEAR(r.reported_at) = YEAR(CURDATE())";
    } elseif ($range === 'year') {
        $baseFilterSql .= " AND YEAR(r.reported_at) = YEAR(CURDATE())";
    } elseif (preg_match('/^\d{4}-\d{2}$/', $range)) {
        $baseFilterSql .= " AND DATE_FORMAT(r.reported_at, '%Y-%m') = '" . $conn->real_escape_string($range) . "'";
    }
}

if ($diseaseFilter) {
    $baseFilterSql .= " AND (
        EXISTS (SELECT 1 FROM tbl_verification v WHERE v.report_id = r.report_id AND v.disease_id = " . intval($diseaseFilter) . ")
        OR (
            NOT EXISTS (SELECT 1 FROM tbl_verification v WHERE v.report_id = r.report_id)
            AND EXISTS (SELECT 1 FROM tbl_ai_diagnosis ad WHERE ad.report_id = r.report_id AND ad.disease_id = " . intval($diseaseFilter) . ")
        )
    )";
}

if ($barangayFilter) {
    $baseFilterSql .= " AND a.barangay = '" . $conn->real_escape_string($barangayFilter) . "'";
}

if ($searchFilter) {
    $cleanSearch = $conn->real_escape_string($searchFilter);
    if (is_numeric($searchFilter)) {
        $baseFilterSql .= " AND (r.report_id = " . intval($searchFilter) . " OR u.contact_number LIKE '%$cleanSearch%')";
    } else {
        $baseFilterSql .= " AND (u.fname LIKE '%$cleanSearch%' OR u.lname LIKE '%$cleanSearch%' OR r.field_location LIKE '%$cleanSearch%')";
    }
}

// Query current reports list
$sql = "SELECT r.*, u.fname, u.lname, u.contact_number,
               COALESCE(a.barangay,'') as barangay, COALESCE(a.municipality,'') as municipality,
               (SELECT COUNT(*) FROM tbl_disease_image di WHERE di.report_id = r.report_id) as img_count,
               (SELECT COUNT(*) FROM tbl_ai_diagnosis ad WHERE ad.report_id = r.report_id) as diag_count,
               (SELECT COUNT(*) FROM tbl_verification v WHERE v.report_id = r.report_id) as verify_count
        FROM tbl_disease_report r
        JOIN tbl_user u ON r.user_id = u.user_id
        LEFT JOIN tbl_address a ON u.user_id = a.user_id
        WHERE 1=1" . $baseFilterSql;

if ($status) {
    $sql .= " AND r.status = '" . $conn->real_escape_string($status) . "'";
}

$sql .= " ORDER BY r.reported_at DESC";
$reports = $conn->query($sql);

// Counts for header (respecting the filter conditions except status itself)
$countAllQuery = "SELECT COUNT(*) as c FROM tbl_disease_report r JOIN tbl_user u ON r.user_id = u.user_id LEFT JOIN tbl_address a ON u.user_id = a.user_id WHERE 1=1" . $baseFilterSql;
$countAll = $conn->query($countAllQuery)->fetch_assoc()['c'];
$countPending = $conn->query($countAllQuery . " AND r.status='Pending'")->fetch_assoc()['c'];
$countVerified = $conn->query($countAllQuery . " AND r.status='Verified'")->fetch_assoc()['c'];
$countTreated = $conn->query($countAllQuery . " AND r.status='Treated'")->fetch_assoc()['c'];

// Fetch all available months for dropdown
$monthsList = $conn->query("SELECT DISTINCT DATE_FORMAT(reported_at, '%Y-%m') as ym, DATE_FORMAT(reported_at, '%M %Y') as label FROM tbl_disease_report ORDER BY ym DESC");
$availableMonths = [];
while ($m = $monthsList->fetch_assoc()) {
    $availableMonths[] = $m;
}

// Fetch all unique barangays for dropdown
$barangaysList = $conn->query("SELECT DISTINCT barangay FROM tbl_address WHERE barangay IS NOT NULL AND barangay != '' ORDER BY barangay ASC");
$availableBarangays = [];
while ($b = $barangaysList->fetch_assoc()) {
    $availableBarangays[] = $b['barangay'];
}

// Fetch all diseases for dropdown
$diseaseList = $conn->query("SELECT disease_id, disease_name FROM tbl_disease ORDER BY disease_name ASC");
$availableDiseases = [];
while ($d = $diseaseList->fetch_assoc()) {
    $availableDiseases[] = $d;
}

$conn->close();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reports — RiceGuard Admin</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css" rel="stylesheet">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #F8FAF8; color: #1A1A2E; }

        .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; }
        .page-header h1 { font-size: 28px; font-weight: 800; color: #1B5E20; letter-spacing: -0.5px; }
        
        .header-stats { display: flex; gap: 16px; }
        .header-stat {
            background: white; border-radius: 14px; padding: 12px 20px;
            min-width: 100px; box-shadow: 0 4px 15px rgba(0,0,0,0.02);
            border: 1px solid rgba(0,0,0,0.03); text-align: center;
        }
        .header-stat span { display: block; font-size: 24px; font-weight: 800; margin-bottom: 2px; }
        .header-stat label { font-size: 11px; font-weight: 700; color: #95A5A6; text-transform: uppercase; letter-spacing: 0.5px; }

        .toolbar { display: flex; gap: 12px; margin-bottom: 24px; align-items: center; justify-content: space-between; }
        
        .filter-group { display: flex; gap: 6px; background: rgba(0,0,0,0.03); padding: 5px; border-radius: 12px; }
        .filter-btn {
            padding: 8px 16px; border-radius: 10px; border: none;
            background: transparent; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s;
            text-decoration: none; color: #7F8C8D; display: flex; align-items: center; gap: 8px;
        }
        .filter-btn:hover { color: #2E7D32; }
        .filter-btn.active { background: white; color: #2E7D32; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .filter-count { background: rgba(46, 125, 50, 0.08); border-radius: 6px; padding: 2px 6px; font-size: 10px; font-weight: 800; }
        .filter-btn.active .filter-count { background: #E8F5E9; }

        .card { background: white; border-radius: 20px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.03); }
        
        .table { width: 100%; border-collapse: separate; border-spacing: 0 8px; margin-top: -8px; }
        .table th { text-align: left; padding: 12px 20px; font-size: 11px; color: #95A5A6; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
        .table td { padding: 16px 20px; font-size: 14px; background: #FDFDFD; border-top: 1px solid #F5F6F7; border-bottom: 1px solid #F5F6F7; vertical-align: middle; }
        .table td:first-child { border-left: 1px solid #F5F6F7; border-top-left-radius: 14px; border-bottom-left-radius: 14px; }
        .table td:last-child { border-right: 1px solid #F5F6F7; border-top-right-radius: 14px; border-bottom-right-radius: 14px; }
        .table tr { cursor: pointer; }
        .table tr:hover td { background: #F8FAF8; border-color: #E8F5E9; }

        .status-badge { display: inline-block; padding: 5px 12px; border-radius: 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-pending { background: #FFF4E5; color: #D35400; }
        .status-verified { background: #EBF5FF; color: #2980B9; }
        .status-treated { background: #ECFDF5; color: #10B981; }

        .info-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; background: #F1F4F1; color: #7F8C8D; margin-right: 4px; }
        .info-pill i { font-size: 14px; }

        /* Enhanced Filters styling */
        .search-box {
            position: relative;
            width: 320px;
        }
        .search-box input {
            width: 100%;
            height: 44px;
            padding: 0 16px 0 42px;
            border: 1.5px solid #E2E8F0;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
            outline: none;
            color: #2C3E50;
            background: white;
            transition: all 0.2s ease;
        }
        .search-box input:focus {
            border-color: #2E7D32;
            box-shadow: 0 4px 15px rgba(46, 125, 50, 0.08);
            background: white;
        }
        .search-box .search-icon {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            color: #94A3B8;
            font-size: 18px;
            pointer-events: none;
        }

        .filter-controls-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            flex-wrap: wrap;
            gap: 16px;
        }
        .filter-select-group {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }
        .select-wrapper {
            position: relative;
            display: flex;
            align-items: center;
        }
        .select-wrapper .select-icon {
            position: absolute;
            left: 14px;
            color: #7F8C8D;
            font-size: 18px;
            pointer-events: none;
        }
        .status-select-enhanced {
            padding: 10px 38px 10px 42px;
            border-radius: 12px;
            border: 1.5px solid #E2E8F0;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            appearance: none;
            background: white url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237F8C8D' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 14px center;
            transition: all 0.2s ease;
            min-width: 180px;
            color: #2C3E50;
        }
        .status-select-enhanced:focus {
            outline: none;
            border-color: #2E7D32;
            box-shadow: 0 4px 15px rgba(46, 125, 50, 0.08);
        }
        .clear-filters-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 10px 18px;
            border-radius: 12px;
            background: rgba(220, 38, 38, 0.05);
            color: #DC2626;
            text-decoration: none;
            font-size: 13px;
            font-weight: 700;
            transition: all 0.2s ease;
            border: 1px solid rgba(220, 38, 38, 0.1);
        }
        .clear-filters-btn:hover {
            background: #DC2626;
            color: white;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.15);
        }

        .status-select { 
            padding: 8px 32px 8px 12px; border-radius: 10px; border: 1.5px solid #F1F4F1; font-size: 13px; font-weight: 600; 
            cursor: pointer; appearance: none; background: #FDFDFD url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237F8C8D' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 10px center;
        }
        .status-select:focus { outline: none; border-color: #2E7D32; background-color: white; }
        
        .btn-update {
            padding: 8px 16px; border-radius: 10px; border: none;
            background: linear-gradient(135deg, #1B5E20, #2E7D32); color: white; font-size: 12px; cursor: pointer; font-weight: 700; transition: all 0.2s;
        }
        .btn-update:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(46,125,50,0.2); }
        
        .msg { background: #ECFDF5; color: #065F46; padding: 14px 20px; border-radius: 14px; margin-bottom: 24px; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 10px; border: 1px solid rgba(16, 185, 129, 0.2); animation: slideDown 0.3s ease; }
        @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        /* ── Modal ────────────────────────────── */
        .modal-overlay {
            display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(26, 43, 26, 0.6); backdrop-filter: blur(8px); z-index: 10000;
            justify-content: center; align-items: flex-start; padding: 40px 20px;
            overflow-y: auto;
        }
        .modal-overlay.active { display: flex; }
        .modal-card {
            background: white; border-radius: 24px; width: 100%; max-width: 860px;
            box-shadow: 0 30px 60px rgba(0,0,0,0.15); animation: modalIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1);
            margin: auto; overflow: hidden;
        }
        @keyframes modalIn { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }

        .modal-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 28px 32px; background: #FDFDFD; border-bottom: 1px solid #F1F4F1;
        }
        .modal-header h2 { font-size: 22px; font-weight: 800; color: #1B5E20; letter-spacing: -0.5px; }
        .modal-close {
            width: 40px; height: 40px; border-radius: 12px; border: none;
            background: #F1F4F1; cursor: pointer; font-size: 20px; color: #7F8C8D;
            display: flex; align-items: center; justify-content: center; transition: all 0.2s;
        }
        .modal-close:hover { background: #E11D48; color: white; transform: rotate(90deg); }
        .modal-body { padding: 0; }

        /* Tabs */
        .modal-tabs { display: flex; gap: 0; background: #FDFDFD; padding: 0 20px; border-bottom: 1px solid #F1F4F1; }
        .modal-tab {
            padding: 18px 24px; font-size: 13px; font-weight: 700; cursor: pointer;
            color: #95A5A6; border-bottom: 3px solid transparent; transition: all 0.3s;
            display: flex; align-items: center; gap: 8px;
        }
        .modal-tab:hover { color: #2E7D32; }
        .modal-tab.active { color: #2E7D32; border-bottom-color: #2E7D32; background: rgba(46, 125, 50, 0.02); }
        .modal-tab i { font-size: 18px; }
        
        .tab-content-area { padding: 32px; min-height: 400px; }
        .tab-pane { display: none; animation: fadeIn 0.3s ease; }
        .tab-pane.active { display: block; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* Info Grid */
        .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .info-item { background: #F8FAF8; border: 1px solid #F1F4F1; border-radius: 16px; padding: 16px 20px; transition: all 0.2s; }
        .info-item:hover { border-color: #E8F5E9; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
        .info-label { font-size: 11px; color: #95A5A6; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 6px; }
        .info-value { font-size: 15px; font-weight: 700; color: #2C3E50; }

        /* Image gallery */
        .image-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
        .gallery-img {
            border-radius: 16px; overflow: hidden; aspect-ratio: 1; cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.05); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 3px solid white;
        }
        .gallery-img:hover { transform: scale(1.04) translateY(-4px); box-shadow: 0 12px 25px rgba(0,0,0,0.1); border-color: #E8F5E9; }
        .gallery-img img { width: 100%; height: 100%; object-fit: cover; }

        /* Detail cards */
        .detail-card {
            background: #FDFDFD; border-radius: 20px; padding: 24px;
            margin-bottom: 16px; border: 1.5px solid #F1F4F1;
            position: relative; overflow: hidden;
        }
        .detail-card.ai { border-left: 5px solid #2980B9; background: #F0F7FF; }
        .detail-card.verification { border-left: 5px solid #10B981; background: #F0FDF4; }
        .detail-card.treatment { border-left: 5px solid #F59E0B; background: #FFFBEB; }
        
        .detail-card-title { font-size: 17px; font-weight: 800; color: #2C3E50; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; }
        .detail-card-meta { font-size: 12px; color: #7F8C8D; font-weight: 600; margin-bottom: 12px; }
        .detail-card-body { font-size: 14px; color: #34495E; line-height: 1.6; font-weight: 500; }

        .confidence-container { margin-top: 16px; background: rgba(255,255,255,0.5); padding: 12px; border-radius: 12px; }
        .confidence-label { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
        .confidence-bar { height: 10px; background: rgba(0,0,0,0.05); border-radius: 5px; overflow: hidden; }
        .confidence-fill { height: 100%; border-radius: 5px; transition: width 1s cubic-bezier(0.1, 0.5, 0.5, 1); }

        .empty-state { text-align: center; padding: 60px 40px; color: #BDC3C7; }
        .empty-state i { font-size: 48px; display: block; margin-bottom: 16px; opacity: 0.5; }
        .empty-state p { font-size: 15px; font-weight: 500; }

        .loading-spinner { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; color: #2E7D32; }
        .spinner-icon { font-size: 40px; animation: spin 1s linear infinite; margin-bottom: 16px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <?php include 'sidebar.php'; ?>

    <div class="main-content">
        <div class="page-header">
            <h1>📋 Disease Reports</h1>
            <div class="header-stats">
                <div class="header-stat">
                    <span style="color:#D35400"><?= $countPending ?></span>
                    <label>In Queue</label>
                </div>
                <div class="header-stat">
                    <span style="color:#2980B9"><?= $countVerified ?></span>
                    <label>Verified</label>
                </div>
                <div class="header-stat">
                    <span style="color:#10B981"><?= $countTreated ?></span>
                    <label>Solved</label>
                </div>
            </div>
        </div>

        <?php if (isset($_GET['msg'])): ?>
            <div class="msg">
                <i class="ri-checkbox-circle-fill"></i>
                <span>Report status updated successfully.</span>
            </div>
        <?php endif; ?>

        <form method="GET" action="reports.php" id="filterForm">
            <!-- Hidden status input -->
            <input type="hidden" name="status" id="statusField" value="<?= htmlspecialchars($status) ?>">

            <div class="toolbar">
                <div class="filter-group">
                    <button type="button" onclick="setStatus('')" class="filter-btn <?= !$status ? 'active' : '' ?>">
                        All <span class="filter-count"><?= $countAll ?></span>
                    </button>
                    <button type="button" onclick="setStatus('Pending')" class="filter-btn <?= $status === 'Pending' ? 'active' : '' ?>">
                        Pending <span class="filter-count"><?= $countPending ?></span>
                    </button>
                    <button type="button" onclick="setStatus('Verified')" class="filter-btn <?= $status === 'Verified' ? 'active' : '' ?>">
                        Verified <span class="filter-count"><?= $countVerified ?></span>
                    </button>
                    <button type="button" onclick="setStatus('Treated')" class="filter-btn <?= $status === 'Treated' ? 'active' : '' ?>">
                        Solved <span class="filter-count"><?= $countTreated ?></span>
                    </button>
                </div>

                <div class="search-box">
                    <i class="ri-search-line search-icon"></i>
                    <input type="text" name="search" value="<?= htmlspecialchars($searchFilter) ?>" placeholder="Search farmer name, location, ID..." onchange="this.form.submit()">
                </div>
            </div>

            <div class="filter-controls-row">
                <div class="filter-select-group">
                    <div class="select-wrapper">
                        <i class="ri-calendar-event-line select-icon"></i>
                        <select name="range" onchange="this.form.submit()" class="status-select-enhanced">
                            <option value="">Any Time</option>
                            <optgroup label="Relative Range">
                                <option value="today" <?= ($range === 'today') ? 'selected' : '' ?>>Today</option>
                                <option value="week" <?= ($range === 'week') ? 'selected' : '' ?>>This Week</option>
                                <option value="month" <?= ($range === 'month') ? 'selected' : '' ?>>This Month</option>
                                <option value="year" <?= ($range === 'year') ? 'selected' : '' ?>>This Year</option>
                            </optgroup>
                            <optgroup label="Specific Month">
                                <?php foreach ($availableMonths as $m): ?>
                                    <option value="<?= $m['ym'] ?>" <?= ($range === $m['ym']) ? 'selected' : '' ?>>
                                        <?= htmlspecialchars($m['label']) ?>
                                    </option>
                                <?php endforeach; ?>
                            </optgroup>
                        </select>
                    </div>

                    <div class="select-wrapper">
                        <i class="ri-virus-line select-icon"></i>
                        <select name="disease_id" onchange="this.form.submit()" class="status-select-enhanced">
                            <option value="">All Pathogens</option>
                            <?php foreach ($availableDiseases as $d): ?>
                                <option value="<?= $d['disease_id'] ?>" <?= ($diseaseFilter == $d['disease_id']) ? 'selected' : '' ?>>
                                    <?= htmlspecialchars($d['disease_name']) ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="select-wrapper">
                        <i class="ri-map-pin-line select-icon"></i>
                        <select name="barangay" onchange="this.form.submit()" class="status-select-enhanced">
                            <option value="">All Barangays</option>
                            <?php foreach ($availableBarangays as $b): ?>
                                <option value="<?= htmlspecialchars($b) ?>" <?= ($barangayFilter === $b) ? 'selected' : '' ?>>
                                    <?= htmlspecialchars($b) ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                </div>

                <?php if ($range || $diseaseFilter || $barangayFilter || $searchFilter || $status): ?>
                    <a href="reports.php" class="clear-filters-btn">
                        <i class="ri-refresh-line"></i> Clear Filters
                    </a>
                <?php endif; ?>
            </div>
        </form>

        <script>
            function setStatus(statusVal) {
                document.getElementById('statusField').value = statusVal;
                document.getElementById('filterForm').submit();
            }
        </script>

        <div class="card" style="padding: 10px;">
            <table class="table">
                <thead>
                    <tr>
                        <th style="width: 80px;">Report</th>
                        <th>Farmer Details</th>
                        <th>Field Info</th>
                        <th>Evidence</th>
                        <th>State</th>
                        <th>Reported</th>
                        <th style="text-align:right">Control</th>
                    </tr>
                </thead>
                <tbody>
                    <?php while ($r = $reports->fetch_assoc()): ?>
                    <tr onclick="openReportModal(<?= $r['report_id'] ?>)">
                        <td><strong style="color:#2E7D32">#<?= $r['report_id'] ?></strong></td>
                        <td>
                            <div style="font-weight:700; color:#2C3E50;"><?= htmlspecialchars($r['fname'] . ' ' . $r['lname']) ?></div>
                            <div style="font-size:12px; color:#95A5A6; font-weight:500;"><?= htmlspecialchars($r['contact_number']) ?></div>
                        </td>
                        <td>
                            <div style="font-weight:600; color:#34495E;"><?= htmlspecialchars($r['field_location'] ?: '—') ?></div>
                            <div style="font-size:11px; color:#BDC3C7; text-transform:uppercase; font-weight:700;"><?= $r['barangay'] ?: 'Location Unknown' ?></div>
                        </td>
                        <td>
                            <span class="info-pill" title="Photos"><i class="ri-image-2-line"></i> <?= $r['img_count'] ?></span>
                            <span class="info-pill" title="AI Runs"><i class="ri-robot-2-line"></i> <?= $r['diag_count'] ?></span>
                        </td>
                        <td><span class="status-badge status-<?= strtolower($r['status']) ?>"><?= $r['status'] ?></span></td>
                        <td style="color:#7F8C8D; font-size:13px; font-weight:500;"><?= date('M j, Y', strtotime($r['reported_at'])) ?></td>
                        <td onclick="event.stopPropagation()" style="text-align:right">
                            <form method="POST" style="display:flex; gap:8px; justify-content:flex-end; align-items:center">
                                <input type="hidden" name="report_id" value="<?= $r['report_id'] ?>">
                                <select name="new_status" class="status-select" style="padding: 6px 28px 6px 12px; font-size:12px;">
                                    <option value="Pending" <?= $r['status']==='Pending'?'selected':'' ?>>Pending</option>
                                    <option value="Verified" <?= $r['status']==='Verified'?'selected':'' ?>>Verified</option>
                                    <option value="Treated" <?= $r['status']==='Treated'?'selected':'' ?>>Treated</option>
                                </select>
                                <button type="submit" class="btn-update">Update</button>
                            </form>
                        </td>
                    </tr>
                    <?php endwhile; ?>
                    <?php if ($reports->num_rows == 0): ?>
                    <tr><td colspan="7" class="empty-state"><i class="ri-inbox-line"></i><p>No reports found matching your criteria</p></td></tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>

    <!-- ── Report Detail Modal ────────────────────────── -->
    <div class="modal-overlay" id="reportModal">
        <div class="modal-card">
            <div class="modal-header">
                <h2 id="modalTitle">Report #—</h2>
                <button class="modal-close" onclick="closeModal()"><i class="ri-close-line"></i></button>
            </div>
            <div class="modal-body">
                <div class="modal-tabs">
                    <div class="modal-tab active" onclick="switchTab('overview', event)"><i class="ri-dashboard-3-line"></i> Overview</div>
                    <div class="modal-tab" onclick="switchTab('images', event)"><i class="ri-image-line"></i> Evidence</div>
                    <div class="modal-tab" onclick="switchTab('diagnosis', event)"><i class="ri-robot-line"></i> AI Analysis</div>
                    <div class="modal-tab" onclick="switchTab('verification', event)"><i class="ri-shield-check-line"></i> Expert</div>
                    <div class="modal-tab" onclick="switchTab('treatments', event)"><i class="ri-medicine-bottle-line"></i> Solutions</div>
                </div>

                <div class="tab-content-area">
                    <div id="tab-overview" class="tab-pane active"></div>
                    <div id="tab-images" class="tab-pane"></div>
                    <div id="tab-diagnosis" class="tab-pane"></div>
                    <div id="tab-verification" class="tab-pane"></div>
                    <div id="tab-treatments" class="tab-pane"></div>
                </div>
            </div>
        </div>
    </div>

    <script>
    const API_BASE = '../api';

    function closeModal() {
        document.getElementById('reportModal').classList.remove('active');
    }

    function switchTab(name, e) {
        document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));
        document.getElementById('tab-' + name).classList.add('active');

        if (e && e.target) {
            document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
            const tabBtn = e.target.closest('.modal-tab');
            if (tabBtn) tabBtn.classList.add('active');
        }

        if (name === 'overview' && window.currentReportCoords) {
            setTimeout(() => {
                const mapEl = document.getElementById('reportMap');
                if (mapEl) {
                    initDetailMap(window.currentReportCoords);
                    if (detailMapObj) detailMapObj.invalidateSize();
                }
            }, 100);
        }
    }

    async function openReportModal(reportId) {
        const modal = document.getElementById('reportModal');
        modal.classList.add('active');
        document.getElementById('modalTitle').textContent = 'Report #' + reportId;

        document.querySelectorAll('.tab-pane').forEach(p => p.innerHTML = `
            <div class="loading-spinner">
                <i class="ri-loader-4-line spinner-icon"></i>
                <p>Retrieving report data...</p>
            </div>
        `);
        
        switchTab('overview');

        try {
            const [reportRes, diagRes, verRes, treatRes] = await Promise.all([
                fetch(`${API_BASE}/reports.php?report_id=${reportId}`),
                fetch(`${API_BASE}/diagnosis.php?report_id=${reportId}`),
                fetch(`${API_BASE}/verification.php?report_id=${reportId}`),
                fetch(`${API_BASE}/treatments.php?action=recommendations&report_id=${reportId}`)
            ]);

            const report = await reportRes.json();
            const diagnoses = await diagRes.json();
            const verifications = await verRes.json();
            const treatments = await treatRes.json();

            // 1. Overview Tab
            const bestDiag = diagnoses && diagnoses.length > 0 ? diagnoses[0] : null;
            let overviewHtml = `
                <div class="info-grid">
                    <div class="info-item"><div class="info-label">Farmer</div><div class="info-value">${report.fname} ${report.lname}</div></div>
                    <div class="info-item"><div class="info-label">Contact</div><div class="info-value">${report.contact_number || '—'}</div></div>
                    <div class="info-item"><div class="info-label">Current Status</div><div class="info-value"><span class="status-badge status-${report.status.toLowerCase()}">${report.status}</span></div></div>
                    <div class="info-item"><div class="info-label">Reporting Method</div><div class="info-value">${report.report_method}</div></div>
                    <div class="info-item" style="grid-column: span 2"><div class="info-label">Submission Date</div><div class="info-value">${new Date(report.reported_at).toLocaleString()}</div></div>
                    <div class="info-item" style="grid-column:span 3"><div class="info-label">Farmer's Observation</div><div class="info-value" style="font-weight:500; color:#555;">${report.description || 'No description provided.'}</div></div>
                </div>
            `;

            if (bestDiag) {
                const score = parseFloat(bestDiag.confidence_score) || 0;
                const colors = score >= 85 ? ['#059669', '#10B981'] : score >= 70 ? ['#D97706', '#F59E0B'] : ['#DC2626', '#EF4444'];
                overviewHtml += `
                    <div class="detail-card ai" style="margin-top: 24px; border-left-color: ${colors[0]}">
                        <div class="detail-card-title"><i class="ri-robot-2-line"></i> Primary AI Diagnosis</div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:12px">
                            <div>
                                <div style="font-size:22px; font-weight:800; color:${colors[0]}">${bestDiag.disease_name}</div>
                                <div style="font-size:12px; font-weight:600; color:#95A5A6; margin-top:4px">Model: ${bestDiag.model_version || 'v1.0-prod'}</div>
                            </div>
                            <div style="text-align:right">
                                <div style="font-size:20px; font-weight:800; color:${colors[0]}">${score}%</div>
                                <div style="font-size:10px; font-weight:700; color:#95A5A6; text-transform:uppercase;">Certainty Score</div>
                            </div>
                        </div>
                        <div class="confidence-container">
                            <div class="confidence-bar"><div class="confidence-fill" style="width:${score}%; background:linear-gradient(90deg, ${colors[0]}, ${colors[1]})"></div></div>
                        </div>
                    </div>
                `;
            }

            overviewHtml += `
                <div style="margin-top: 24px;">
                    <div class="info-label" style="margin-bottom:12px">📍 Field Location</div>
                    ${report.latitude && report.longitude ? `
                        <div id="reportMap" style="height: 280px; border-radius: 16px; border: 1px solid #F1F4F1; background: #f0f0f0; overflow:hidden"></div>
                        <div style="font-size: 11px; color: #95A5A6; text-align: center; margin-top: 10px; font-weight:600;">COORDS: ${report.latitude}, ${report.longitude}</div>
                    ` : '<div class="empty-state" style="background:#F8FAF8; border-radius:16px;"><i class="ri-map-pin-2-line"></i><p>GPS tracking was not enabled for this report</p></div>'}
                </div>
            `;
            document.getElementById('tab-overview').innerHTML = overviewHtml;

            if (report.latitude && report.longitude) {
                window.currentReportCoords = [report.latitude, report.longitude];
                setTimeout(() => initDetailMap(window.currentReportCoords), 100);
            }

            // 2. Images Tab
            const images = report.images || [];
            if (images.length > 0) {
                document.getElementById('tab-images').innerHTML = `
                    <div class="image-gallery">
                        ${images.map(img => `
                            <div class="gallery-img" onclick="window.open('../../${img}', '_blank')">
                                <img src="../../${img}" alt="Report Photo" loading="lazy">
                            </div>
                        `).join('')}
                    </div>
                    <p style="text-align:center; margin-top:24px; font-size:12px; color:#95A5A6; font-weight:600;"><i class="ri-information-line"></i> Click an image to view full resolution</p>
                `;
            } else {
                document.getElementById('tab-images').innerHTML = '<div class="empty-state"><i class="ri-image-line"></i><p>No visual evidence was uploaded</p></div>';
            }

            // 3. AI Diagnosis Tab
            if (diagnoses && diagnoses.length > 0) {
                document.getElementById('tab-diagnosis').innerHTML = diagnoses.map(d => {
                    const score = parseFloat(d.confidence_score) || 0;
                    const colors = score >= 85 ? ['#059669', '#10B981'] : score >= 70 ? ['#D97706', '#F59E0B'] : ['#DC2626', '#EF4444'];
                    return `
                        <div class="detail-card ai" style="border-left-color: ${colors[0]}">
                            <div class="detail-card-title"><i class="ri-robot-line"></i> ${d.disease_name || 'Generic AI Result'}</div>
                            <div class="detail-card-meta">Processed by RiceGuard AI Engine • ${d.inference_time_ms ? d.inference_time_ms + 'ms' : 'N/A'} latency</div>
                            <div class="confidence-container" style="background:transparent; padding:0; margin-top:0">
                                <div class="confidence-label">
                                    <span>Model Confidence</span>
                                    <span>${score}%</span>
                                </div>
                                <div class="confidence-bar"><div class="confidence-fill" style="width:${score}%; background:linear-gradient(90deg, ${colors[0]}, ${colors[1]})"></div></div>
                            </div>
                            <div style="font-size:11px; color:#95A5A6; margin-top:12px; font-weight:600;">Engine version: ${d.model_version || '1.0'}</div>
                        </div>
                    `;
                }).join('');
            } else {
                document.getElementById('tab-diagnosis').innerHTML = '<div class="empty-state"><i class="ri-robot-line"></i><p>No automated analysis results found</p></div>';
            }

            // 4. Verifications Tab
            if (verifications && verifications.length > 0) {
                document.getElementById('tab-verification').innerHTML = verifications.map(v => `
                    <div class="detail-card verification">
                        <div class="detail-card-title"><i class="ri-shield-check-line"></i> Expert Consensus: ${v.disease_name}</div>
                        <div class="detail-card-meta">Verified by ${v.fname} ${v.lname} • ${v.verification_method} • ${new Date(v.verified_at).toLocaleDateString()}</div>
                        ${v.notes ? `<div class="detail-card-body" style="background:white; padding:12px; border-radius:12px; margin-top:12px"><strong>Expert Notes:</strong><br>${v.notes}</div>` : ''}
                    </div>
                `).join('');
            } else {
                document.getElementById('tab-verification').innerHTML = '<div class="empty-state"><i class="ri-shield-user-line"></i><p>This report has not been verified by a technologist yet</p></div>';
            }

            // 5. Treatments Tab
            if (treatments && treatments.length > 0) {
                document.getElementById('tab-treatments').innerHTML = treatments.map(t => `
                    <div class="detail-card treatment">
                        <div class="detail-card-title"><i class="ri-medicine-bottle-line"></i> Recommended Treatment</div>
                        <div class="detail-card-meta">Issued by RiceGuard Specialist • ${new Date(t.recommended_at).toLocaleDateString()}</div>
                        <div class="detail-card-body">
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px">
                                <div style="background:white; padding:10px; border-radius:10px;">
                                    <div class="info-label">Medication/Type</div>
                                    <div class="info-value" style="color:#B45309">${t.pesticide_name || t.treatment_type}</div>
                                </div>
                                <div style="background:white; padding:10px; border-radius:10px;">
                                    <div class="info-label">Application Method</div>
                                    <div class="info-value">${t.application_method || 'Standard'}</div>
                                </div>
                            </div>
                            ${t.dosage ? `<div style="margin-bottom:8px"><strong>Dosage Guideline:</strong> ${t.dosage}</div>` : ''}
                            ${t.estimated_cost > 0 ? `<div style="margin-bottom:8px"><strong>Estimated Cost:</strong> ₱${parseFloat(t.estimated_cost).toLocaleString()}</div>` : ''}
                            ${t.additional_notes ? `<div style="font-style:italic; border-top:1px dashed #FCD34D; padding-top:10px; margin-top:10px">"${t.additional_notes}"</div>` : ''}
                        </div>
                    </div>
                `).join('');
            } else {
                document.getElementById('tab-treatments').innerHTML = '<div class="empty-state"><i class="ri-microscope-line"></i><p>No treatment plans have been finalized for this case</p></div>';
            }

        } catch (err) {
            console.error('Error in openReportModal:', err);
            document.querySelectorAll('.tab-pane.active').forEach(p => {
                p.innerHTML = '<div class="empty-state"><i class="ri-error-warning-line"></i><p>Transmission failed. Please check your connection.</p></div>';
            });
        }
    }

    // Modal behavior
    document.getElementById('reportModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModal();
    });

    // Map logic
    let detailMapObj = null;
    function initDetailMap(coords) {
        if (typeof L === 'undefined') return;
        if (!detailMapObj) {
            detailMapObj = L.map('reportMap', { zoomControl: false }).setView(coords, 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(detailMapObj);
            L.marker(coords).addTo(detailMapObj);
            L.control.zoom({ position: 'bottomright' }).addTo(detailMapObj);
        } else {
            detailMapObj.setView(coords, 15);
            detailMapObj.eachLayer((layer) => {
                if (layer instanceof L.Marker) detailMapObj.removeLayer(layer);
            });
            L.marker(coords).addTo(detailMapObj);
            detailMapObj.invalidateSize();
        }
    }
    </script>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
</body>
</html>
