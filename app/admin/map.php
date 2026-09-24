<?php
session_start();
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/auth_check.php';

$adminName = $_SESSION['fname'] ?? 'Admin';
$conn = getConnection();

// Fetch options for filters
$monthsList = $conn->query("SELECT DISTINCT DATE_FORMAT(reported_at, '%Y-%m') as ym, DATE_FORMAT(reported_at, '%M %Y') as label FROM tbl_disease_report ORDER BY ym DESC");
$availableMonths = [];
while ($m = $monthsList->fetch_assoc()) {
    $availableMonths[] = $m;
}

$barangaysList = $conn->query("SELECT DISTINCT barangay FROM tbl_address WHERE barangay IS NOT NULL AND barangay != '' ORDER BY barangay ASC");
$availableBarangays = [];
while ($b = $barangaysList->fetch_assoc()) {
    $availableBarangays[] = $b['barangay'];
}

$diseaseList = $conn->query("SELECT disease_id, disease_name FROM tbl_disease ORDER BY disease_name ASC");
$availableDiseases = [];
while ($d = $diseaseList->fetch_assoc()) {
    $availableDiseases[] = $d;
}

$status = $_GET['status'] ?? '';
$range = $_GET['range'] ?? '';
$diseaseFilter = $_GET['disease_id'] ?? '';
$barangayFilter = $_GET['barangay'] ?? '';
$searchFilter = $_GET['search'] ?? '';

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

// Fetch reports with coordinates and filters
$sql = "SELECT r.*, u.fname, u.lname, 
               COALESCE(
                   (SELECT vd.disease_name FROM tbl_verification v JOIN tbl_disease vd ON v.disease_id = vd.disease_id WHERE v.report_id = r.report_id LIMIT 1),
                   (SELECT addi.disease_name FROM tbl_ai_diagnosis ad JOIN tbl_disease addi ON ad.disease_id = addi.disease_id WHERE ad.report_id = r.report_id ORDER BY ad.confidence_score DESC LIMIT 1),
                   'In Progress'
               ) as disease_name
        FROM tbl_disease_report r
        JOIN tbl_user u ON r.user_id = u.user_id
        LEFT JOIN tbl_address a ON u.user_id = a.user_id
        WHERE r.latitude IS NOT NULL AND r.longitude IS NOT NULL" . $baseFilterSql;

if ($status) {
    $sql .= " AND r.status = '" . $conn->real_escape_string($status) . "'";
}

$result = $conn->query($sql);
$reports = [];
while ($row = $result->fetch_assoc()) {
    $reports[] = $row;
}

// Counts for header (respecting the filter conditions except status itself)
$countAllQuery = "SELECT COUNT(*) as c FROM tbl_disease_report r JOIN tbl_user u ON r.user_id = u.user_id LEFT JOIN tbl_address a ON u.user_id = a.user_id WHERE r.latitude IS NOT NULL AND r.longitude IS NOT NULL" . $baseFilterSql;
$countAll = $conn->query($countAllQuery)->fetch_assoc()['c'];
$countPending = $conn->query($countAllQuery . " AND r.status='Pending'")->fetch_assoc()['c'];
$countVerified = $conn->query($countAllQuery . " AND r.status='Verified'")->fetch_assoc()['c'];
$countTreated = $conn->query($countAllQuery . " AND r.status='Treated'")->fetch_assoc()['c'];

$conn->close();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visitation Map | RiceGuard Admin</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css" rel="stylesheet">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        body { font-family: 'Inter', sans-serif; background: #F5F7F5; }
        .main-content { margin-left: 260px; padding: 30px; min-height: 100vh; }
        #map { height: 75vh; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 4px solid white; }
        .map-card { background: white; border-radius: 20px; padding: 25px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
        .page-header { margin-bottom: 25px; }
        .page-title { font-size: 24px; font-weight: 800; color: #1B5E20; }
        .legend { margin-top: 20px; display: flex; gap: 20px; }
        .legend-item { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #4E5D4E; }
        .dot { width: 12px; height: 12px; border-radius: 50%; }
        
        .custom-popup .leaflet-popup-content-wrapper { border-radius: 12px; padding: 5px; }
        .popup-title { font-weight: 800; color: #1B5E20; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .popup-info { font-size: 12px; color: #666; margin-bottom: 2px; }
        .popup-status { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; margin-top: 8px; }

        /* Enhanced Filters styling */
        .toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 16px;
        }
        .filter-group {
            display: flex;
            gap: 6px;
            background: rgba(0,0,0,0.03);
            padding: 5px;
            border-radius: 12px;
        }
        .filter-btn {
            padding: 8px 16px;
            border-radius: 10px;
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.2s;
            color: #7F8C8D;
        }
        .filter-btn:hover {
            color: #2E7D32;
        }
        .filter-btn.active {
            background: white;
            color: #2E7D32;
            box-shadow: 0 4px 10px rgba(0,0,0,0.05);
        }
        .filter-count {
            background: rgba(46, 125, 50, 0.08);
            border-radius: 6px;
            padding: 2px 6px;
            font-size: 10px;
            font-weight: 800;
            margin-left: 4px;
        }
        .filter-btn.active .filter-count {
            background: #E8F5E9;
        }
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
    </style>
</head>
<body>

    <?php include 'sidebar.php'; ?>

    <div class="main-content">
        <div class="page-header d-flex justify-content-between align-items-center mb-4">
            <div>
                <h1 class="page-title"><i class="ri-map-pin-2-fill me-2"></i>Field Visitation Hotspots</h1>
                <p class="text-secondary mb-0">Visualizing disease hotspots for targeted rice farm visitation.</p>
            </div>
            <div class="text-end">
                <span class="badge bg-success shadow-sm p-2 px-3"><?= count($reports) ?> Reports Mapped</span>
            </div>
        </div>

        <form method="GET" action="map.php" id="filterForm">
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
                    <a href="map.php" class="clear-filters-btn">
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

        <div class="map-card">
            <div id="map"></div>
            
            <div class="legend">
                <div class="legend-item">
                    <div class="dot" style="background: #FFC107;"></div> Pending
                </div>
                <div class="legend-item">
                    <div class="dot" style="background: #2E7D32;"></div> Verified
                </div>
                <div class="legend-item">
                    <div class="dot" style="background: #1976D2;"></div> Treated
                </div>
            </div>
        </div>
    </div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        // Initialize Map (Default centered on Philippines/Bohol context)
        const map = L.map('map').setView([9.8510, 124.1435], 11);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        const reports = <?= json_encode($reports) ?>;
        
        reports.forEach(report => {
            const color = report.status === 'Pending' ? '#FFC107' : (report.status === 'Verified' ? '#2E7D32' : '#1976D2');
            
            const marker = L.circleMarker([report.latitude, report.longitude], {
                radius: 8,
                fillColor: color,
                color: "#fff",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(map);

            const popupContent = `
                <div class="custom-popup">
                    <div class="popup-title">Report #${report.report_id}</div>
                    <div class="popup-info"><b>Farmer:</b> ${report.fname} ${report.lname}</div>
                    <div class="popup-info"><b>Detection:</b> ${report.disease_name || 'In Progress'}</div>
                    <div class="popup-info"><b>Date:</b> ${new Date(report.reported_at).toLocaleDateString()}</div>
                    <div class="popup-status" style="background: ${color}20; color: ${color}; border: 1px solid ${color}">
                        ${report.status}
                    </div>
                    <div class="mt-2 text-center">
                        <a href="reports.php?id=${report.report_id}" class="btn btn-sm btn-outline-success" style="font-size:10px">Details</a>
                    </div>
                </div>
            `;
            
            marker.bindPopup(popupContent);
        });

        // Auto-fit bounds if reports exist
        if (reports.length > 0) {
            const group = new L.featureGroup(reports.map(r => L.marker([r.latitude, r.longitude])));
            map.fitBounds(group.getBounds().pad(0.1));
        }
    </script>
</body>
</html>
