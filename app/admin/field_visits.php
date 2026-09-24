<?php
require_once 'auth_check.php';
require_once __DIR__ . '/../config/db.php';
$conn = getConnection();

// Handle status update
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $visitId = $_POST['visit_id'] ?? null;
    $action = $_POST['action'] ?? '';

    if ($visitId) {
        if ($action === 'update_status' && !empty($_POST['new_status'])) {
            $stmt = $conn->prepare("UPDATE tbl_field_visit_request SET status = ? WHERE visit_id = ?");
            $stmt->bind_param("si", $_POST['new_status'], $visitId);
            $stmt->execute();
            $stmt->close();
        }
        if ($action === 'assign_tech' && !empty($_POST['tech_id'])) {
            $stmt = $conn->prepare("UPDATE tbl_field_visit_request SET tech_id = ?, status = 'Accepted' WHERE visit_id = ?");
            $stmt->bind_param("ii", $_POST['tech_id'], $visitId);
            $stmt->execute();
            $stmt->close();
        }
    }
    header('Location: field_visits.php?msg=updated');
    exit;
}

// Filters
$filter = $_GET['status'] ?? '';
$sql = "SELECT fv.*, 
               farmer.fname AS farmer_fname, farmer.lname AS farmer_lname, farmer.contact_number AS farmer_contact,
               tech.fname AS tech_fname, tech.lname AS tech_lname,
               r.field_location, r.status AS report_status, r.description AS report_description,
               (SELECT COUNT(*) FROM tbl_visit_image vi WHERE vi.visit_id = fv.visit_id) AS image_count
        FROM tbl_field_visit_request fv
        JOIN tbl_user farmer ON fv.farmer_id = farmer.user_id
        JOIN tbl_disease_report r ON fv.report_id = r.report_id
        LEFT JOIN tbl_user tech ON fv.tech_id = tech.user_id
        WHERE 1=1";
if ($filter) $sql .= " AND fv.status = '" . $conn->real_escape_string($filter) . "'";
$sql .= " ORDER BY fv.created_at DESC";
$visits = $conn->query($sql);

// Counts
$countAll      = $conn->query("SELECT COUNT(*) as c FROM tbl_field_visit_request")->fetch_assoc()['c'];
$countPending  = $conn->query("SELECT COUNT(*) as c FROM tbl_field_visit_request WHERE status='Pending'")->fetch_assoc()['c'];
$countAccepted = $conn->query("SELECT COUNT(*) as c FROM tbl_field_visit_request WHERE status='Accepted'")->fetch_assoc()['c'];
$countCompleted = $conn->query("SELECT COUNT(*) as c FROM tbl_field_visit_request WHERE status='Completed'")->fetch_assoc()['c'];

// Technologists list for assignment dropdown
$techs = $conn->query("SELECT user_id, fname, lname FROM tbl_user WHERE user_type_id = 2 ORDER BY fname ASC");
$techList = [];
while ($t = $techs->fetch_assoc()) $techList[] = $t;

$conn->close();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Field Visits — RiceGuard Admin</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #F8FAF8; color: #1A1A2E; }

        .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; }
        .page-header h1 { font-size: 28px; font-weight: 800; color: #1B5E20; letter-spacing: -0.5px; }

        .header-stats { display: flex; gap: 12px; }
        .header-stat {
            background: white; border-radius: 14px; padding: 12px 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.03);
            display: flex; flex-direction: column; min-width: 120px;
        }
        .header-stat span { font-size: 22px; font-weight: 800; color: #2C3E50; line-height: 1; }
        .header-stat label { font-size: 10px; font-weight: 700; color: #95A5A6; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px; }

        .toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 24px; }
        .filter-group { 
            display: flex; background: white; padding: 4px; border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.05);
        }
        .filter-btn {
            padding: 8px 16px; border-radius: 9px; font-size: 13px; font-weight: 700;
            text-decoration: none; color: #7F8C8D; transition: all 0.2s;
            display: flex; align-items: center; gap: 6px;
        }
        .filter-btn:hover { color: #2E7D32; background: #F0F7F0; }
        .filter-btn.active { background: #2E7D32; color: white; box-shadow: 0 4px 12px rgba(46,125,50,0.2); }
        .filter-count { background: rgba(0,0,0,0.05); padding: 1px 6px; border-radius: 6px; font-size: 10px; opacity: 0.8; }
        .filter-btn.active .filter-count { background: rgba(255,255,255,0.2); }

        .card { background: white; border-radius: 20px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.03); }
        
        .table { width: 100%; border-collapse: separate; border-spacing: 0 8px; margin-top: -8px; }
        .table th { text-align: left; padding: 12px 20px; font-size: 11px; color: #95A5A6; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
        .table td { padding: 16px 20px; font-size: 14px; background: #FDFDFD; border-top: 1px solid #F5F6F7; border-bottom: 1px solid #F5F6F7; vertical-align: middle; }
        .table td:first-child { border-left: 1px solid #F5F6F7; border-top-left-radius: 14px; border-bottom-left-radius: 14px; }
        .table td:last-child { border-right: 1px solid #F5F6F7; border-top-right-radius: 14px; border-bottom-right-radius: 14px; }
        .table tr:hover td { background: #F8FAF8; border-color: #E8F5E9; }

        .status-badge { display: inline-block; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-pending { background: #FFF4E5; color: #D35400; }
        .status-accepted { background: #EBF5FF; color: #2980B9; }
        .status-completed { background: #ECFDF5; color: #10B981; }
        .status-declined { background: #FEF2F2; color: #991B1B; }

        .btn-update { 
            padding: 7px 14px; border-radius: 8px; border: none; 
            background: #E8F5E9; color: #2E7D32; font-size: 11px; 
            cursor: pointer; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
            transition: all 0.2s;
        }
        .btn-update:hover { background: #2E7D32; color: white; }

        .btn-assign {
            padding: 7px 12px; border-radius: 8px; border: none;
            background: #2D3436; color: white; font-size: 10px; font-weight: 800;
            text-transform: uppercase; cursor: pointer; transition: all 0.2s;
        }
        .btn-assign:hover { background: #000; }

        .status-select { 
            padding: 6px 12px; border-radius: 8px; border: 1.5px solid #F1F4F1; 
            font-size: 12px; font-weight: 600; font-family: inherit; transition: all 0.2s;
            background: white; cursor: pointer;
        }
        .status-select:focus { outline: none; border-color: #2E7D32; }

        .tech-pill {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 4px 10px; border-radius: 10px; background: #EBF5FF;
            color: #2980B9; font-size: 12px; font-weight: 700; border: 1px solid #D1E9FF;
        }

        .img-thumb {
            width: 44px; height: 44px; border-radius: 10px; object-fit: cover;
            border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.05);
            cursor: pointer; transition: transform 0.2s;
        }
        .img-thumb:hover { transform: scale(1.15) rotate(2deg); z-index: 10; }
        .img-stack { display: flex; align-items: center; margin-left: 0; }
        .img-stack .img-thumb { margin-left: -12px; }
        .img-stack .img-thumb:first-child { margin-left: 0; }

        .msg { background: #ECFDF5; color: #059669; padding: 12px 20px; border-radius: 14px; margin-bottom: 24px; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 10px; border: 1px solid #D1FAE5; }

        /* Zoom Modal */
        .zoom-overlay {
            display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(26, 26, 46, 0.9); backdrop-filter: blur(10px); z-index: 300;
            justify-content: center; align-items: center; padding: 40px; cursor: zoom-out;
        }
        .zoom-overlay.active { display: flex; }
        .zoom-overlay img { max-width: 100%; max-height: 100%; border-radius: 20px; box-shadow: 0 50px 100px rgba(0,0,0,0.5); transform: scale(0.9); transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .zoom-overlay.active img { transform: scale(1); }
    </style>
</head>
<body>
    <?php include 'sidebar.php'; ?>

    <div class="main-content">
        <div class="page-header">
            <h1>⛺ Field Visit Logistics</h1>
            <div class="header-stats">
                <div class="header-stat"><span><?= $countPending ?></span><label>New Requests</label></div>
                <div class="header-stat"><span><?= $countAccepted ?></span><label>Assigned</label></div>
                <div class="header-stat"><span><?= $countCompleted ?></span><label>Concluded</label></div>
            </div>
        </div>

        <?php if (isset($_GET['msg'])): ?>
            <div class="msg"><i class="ri-checkbox-circle-fill"></i> Field assignment updated successfully.</div>
        <?php endif; ?>

        <div class="toolbar">
            <div class="filter-group">
                <a href="field_visits.php" class="filter-btn <?= !$filter ? 'active' : '' ?>">
                    All <span class="filter-count"><?= $countAll ?></span>
                </a>
                <a href="field_visits.php?status=Pending" class="filter-btn <?= $filter === 'Pending' ? 'active' : '' ?>">New</a>
                <a href="field_visits.php?status=Accepted" class="filter-btn <?= $filter === 'Accepted' ? 'active' : '' ?>">Live</a>
                <a href="field_visits.php?status=Completed" class="filter-btn <?= $filter === 'Completed' ? 'active' : '' ?>">Done</a>
                <a href="field_visits.php?status=Declined" class="filter-btn <?= $filter === 'Declined' ? 'active' : '' ?>">Declined</a>
            </div>
        </div>

        <div class="card" style="padding: 10px;">
            <table class="table">
                <thead>
                    <tr>
                        <th style="width: 80px;">Visit ID</th>
                        <th>Farmer Details</th>
                        <th>Site & Incident</th>
                        <th>Preferred Date</th>
                        <th>Outcome / Evidence</th>
                        <th>Expert Assignment</th>
                        <th style="text-align:right">Management</th>
                    </tr>
                </thead>
                <tbody>
                    <?php while ($v = $visits->fetch_assoc()):
                        $conn2 = getConnection();
                        $imgRes = $conn2->query("SELECT image_path FROM tbl_visit_image WHERE visit_id = " . intval($v['visit_id']));
                        $images = [];
                        while ($img = $imgRes->fetch_assoc()) $images[] = $img['image_path'];
                        $conn2->close();
                    ?>
                    <tr>
                        <td><strong style="color:#2E7D32">#V-<?= $v['visit_id'] ?></strong></td>
                        <td>
                            <div style="font-weight:700; color:#2C3E50;"><?= htmlspecialchars($v['farmer_fname'] . ' ' . $v['farmer_lname']) ?></div>
                            <div style="font-size:12px; color:#95A5A6; font-weight:500;"><?= htmlspecialchars($v['farmer_contact'] ?? '') ?></div>
                        </td>
                        <td>
                            <div style="font-weight:600; color:#34495E;">Report #<?= $v['report_id'] ?></div>
                            <div style="font-size:11px; color:#BDC3C7; text-transform:uppercase; font-weight:700;"><?= $v['field_location'] ?: 'Unknown Field' ?></div>
                        </td>
                        <td>
                            <div style="color:#2C3E50; font-weight:700; font-size:13px;"><?= $v['preferred_date'] ? date('M j, Y', strtotime($v['preferred_date'])) : '—' ?></div>
                            <div style="font-size:11px; color:#A7B1B7; font-weight:600;"><?= $v['preferred_date'] ? date('l', strtotime($v['preferred_date'])) : 'DATE UNSET' ?></div>
                        </td>
                        <td>
                            <?php if (!empty($images)): ?>
                                <div class="img-stack">
                                    <?php foreach ($images as $imgPath): ?>
                                        <img src="../../<?= htmlspecialchars($imgPath) ?>" class="img-thumb" onclick="zoomImage('../../<?= htmlspecialchars($imgPath) ?>')">
                                    <?php endforeach; ?>
                                </div>
                            <?php else: ?>
                                <span class="status-badge" style="background:#F8FAF8; color:#BDC3C7; border:1px dashed #E8F5E9;">No Media</span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if ($v['tech_fname']): ?>
                                <div class="tech-pill" style="margin-bottom:8px">
                                    <i class="ri-user-follow-line"></i>
                                    <?= htmlspecialchars($v['tech_fname'] . ' ' . $v['tech_lname']) ?>
                                </div>
                            <?php endif; ?>

                            <form method="POST" style="display:flex; gap:6px; align-items:center">
                                <input type="hidden" name="visit_id" value="<?= $v['visit_id'] ?>">
                                <input type="hidden" name="action" value="assign_tech">
                                <select name="tech_id" class="status-select" style="font-size:11px; padding:4px 8px;">
                                    <option value="">Assign Specialist...</option>
                                    <?php foreach ($techList as $tech): ?>
                                        <option value="<?= $tech['user_id'] ?>" <?= ($v['tech_id'] == $tech['user_id']) ? 'selected' : '' ?>>
                                            <?= htmlspecialchars($tech['fname'] . ' ' . $tech['lname']) ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                                <button type="submit" class="btn-assign">Set</button>
                            </form>
                        </td>
                        <td style="text-align:right">
                            <div style="margin-bottom:8px"><span class="status-badge status-<?= strtolower($v['status']) ?>"><?= $v['status'] ?></span></div>
                            <form method="POST" style="display:flex; gap:6px; justify-content:flex-end; align-items:center">
                                <input type="hidden" name="visit_id" value="<?= $v['visit_id'] ?>">
                                <input type="hidden" name="action" value="update_status">
                                <select name="new_status" class="status-select" style="font-size:11px; padding:4px 8px;">
                                    <option value="Pending" <?= $v['status']==='Pending'?'selected':'' ?>>Pending</option>
                                    <option value="Accepted" <?= $v['status']==='Accepted'?'selected':'' ?>>Accepted</option>
                                    <option value="Completed" <?= $v['status']==='Completed'?'selected':'' ?>>Completed</option>
                                    <option value="Declined" <?= $v['status']==='Declined'?'selected':'' ?>>Declined</option>
                                </select>
                                <button type="submit" class="btn-update">Update</button>
                            </form>
                        </td>
                    </tr>
                    <?php endwhile; ?>
                    <?php if ($countAll == 0): ?>
                    <tr><td colspan="7" style="text-align:center; color:#95A5A6; padding:60px; font-size:14px; font-weight:600;"><i class="ri-map-pin-user-line" style="font-size:32px; display:block; margin-bottom:12px; opacity:0.3"></i> No field visit requests found</td></tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Zoom Overlay -->
    <div class="zoom-overlay" id="zoomOverlay">
        <img id="zoomImg" src="" alt="Visit Detail Zoom">
    </div>

    <script>
    const overlay = document.getElementById('zoomOverlay');
    const zoomImg = document.getElementById('zoomImg');

    function zoomImage(src) {
        zoomImg.src = src;
        overlay.classList.add('active');
    }

    overlay.onclick = function() {
        overlay.classList.remove('active');
        setTimeout(() => { zoomImg.src = ''; }, 300);
    }
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') overlay.click();
    });
    </script>
</body>
</html>
