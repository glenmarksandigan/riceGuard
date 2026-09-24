<?php
require_once 'auth_check.php';
require_once __DIR__ . '/../config/db.php';
$conn = getConnection();

// Handle delete
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_user_id'])) {
    $stmt = $conn->prepare("DELETE FROM tbl_user WHERE user_id = ?");
    $stmt->bind_param("i", $_POST['delete_user_id']);
    $stmt->execute();
    $stmt->close();
    header('Location: users.php?msg=deleted');
    exit;
}

// Handle add technologist
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['add_tech'])) {
    $fname = trim($_POST['tech_fname'] ?? '');
    $lname = trim($_POST['tech_lname'] ?? '');
    $mname = trim($_POST['tech_mname'] ?? '');
    $contact = trim($_POST['tech_contact'] ?? '');
    $password = $_POST['tech_password'] ?? '';

    if ($fname && $lname && $contact && $password) {
        // Check if contact exists
        $check = $conn->prepare("SELECT user_id FROM tbl_user WHERE contact_number = ?");
        $check->bind_param("s", $contact);
        $check->execute();
        if ($check->get_result()->num_rows > 0) {
            $check->close();
            header('Location: users.php?msg=contact_exists');
            exit;
        }
        $check->close();

        $hashed = password_hash($password, PASSWORD_DEFAULT);
        $typeId = 2; // Technologist
        $stmt = $conn->prepare(
            "INSERT INTO tbl_user (user_type_id, fname, lname, mname, contact_number, password, has_seen_demo)
             VALUES (?, ?, ?, ?, ?, ?, 0)"
        );
        $stmt->bind_param("isssss", $typeId, $fname, $lname, $mname, $contact, $hashed);
        if ($stmt->execute()) {
            $stmt->close();
            header('Location: users.php?msg=tech_added');
            exit;
        }
        $stmt->close();
    }
    header('Location: users.php?msg=tech_error');
    exit;
}

$filter = $_GET['type'] ?? '';
$search = $_GET['search'] ?? '';

$sql = "SELECT u.*, ut.type_name FROM tbl_user u JOIN tbl_user_type ut ON u.user_type_id = ut.user_type_id WHERE 1=1";
if ($filter) $sql .= " AND u.user_type_id = " . intval($filter);
if ($search) $sql .= " AND (u.fname LIKE '%" . $conn->real_escape_string($search) . "%' OR u.lname LIKE '%" . $conn->real_escape_string($search) . "%' OR u.contact_number LIKE '%" . $conn->real_escape_string($search) . "%')";
$sql .= " ORDER BY u.created_at DESC";
$users = $conn->query($sql);
$conn->close();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Users — RiceGuard Admin</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #F8FAF8; color: #1A1A2E; }
        
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
        .page-header h1 { font-size: 28px; font-weight: 800; color: #1B5E20; letter-spacing: -0.5px; }
        
        .toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 24px; flex-wrap: wrap; }
        
        .search-box {
            display: flex; align-items: center; background: white; border: 1px solid rgba(0,0,0,0.05);
            border-radius: 14px; padding: 0 16px; height: 46px; min-width: 320px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.02); transition: all 0.2s;
        }
        .search-box:focus-within { border-color: #2E7D32; box-shadow: 0 4px 15px rgba(46,125,50,0.1); }
        .search-box input { border: none; outline: none; font-size: 14px; flex: 1; font-family: inherit; margin-left: 10px; color: #2C3E50; }
        .search-box i { color: #95A5A6; font-size: 18px; }

        .filter-group { display: flex; gap: 8px; background: rgba(0,0,0,0.03); padding: 5px; border-radius: 12px; }
        .filter-btn {
            padding: 8px 16px; border-radius: 10px; border: none;
            background: transparent; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s;
            text-decoration: none; color: #7F8C8D;
        }
        .filter-btn:hover { color: #2E7D32; }
        .filter-btn.active { background: white; color: #2E7D32; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }

        .card { background: white; border-radius: 20px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.03); }
        
        .table { width: 100%; border-collapse: separate; border-spacing: 0 8px; margin-top: -8px; }
        .table th { text-align: left; padding: 12px 20px; font-size: 11px; color: #95A5A6; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
        .table td { padding: 16px 20px; font-size: 14px; background: #FDFDFD; border-top: 1px solid #F5F6F7; border-bottom: 1px solid #F5F6F7; vertical-align: middle; }
        .table td:first-child { border-left: 1px solid #F5F6F7; border-top-left-radius: 14px; border-bottom-left-radius: 14px; }
        .table td:last-child { border-right: 1px solid #F5F6F7; border-top-right-radius: 14px; border-bottom-right-radius: 14px; }
        .table tr:hover td { background: #F8FAF8; border-color: #E8F5E9; }

        .user-info { display: flex; align-items: center; gap: 12px; }
        .user-avatar { width: 36px; height: 36px; border-radius: 10px; background: #E8F5E9; color: #2E7D32; display: flex; align-items: center; justify-content: center; font-weight: 700; }

        .role-badge { display: inline-block; padding: 5px 12px; border-radius: 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        .role-farmer { background: #ECFDF5; color: #10B981; }
        .role-technologist { background: #EBF5FF; color: #2980B9; }
        .role-admin { background: #FFF1F2; color: #E11D48; }

        .btn-delete {
            background: rgba(225, 29, 72, 0.05); border: none; color: #E11D48; cursor: pointer; font-size: 18px;
            width: 36px; height: 36px; border-radius: 10px; transition: all 0.2s;
            display: flex; align-items: center; justify-content: center;
        }
        .btn-delete:hover { background: #E11D48; color: white; transform: scale(1.05); }

        .msg { padding: 14px 20px; border-radius: 14px; margin-bottom: 24px; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 10px; animation: slideDown 0.3s ease; }
        @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .msg-success { background: #ECFDF5; color: #065F46; border: 1px solid rgba(16, 185, 129, 0.2); }
        .msg-error { background: #FFF1F2; color: #9F1239; border: 1px solid rgba(225, 29, 72, 0.2); }

        /* Add Tech Button */
        .btn-add-tech {
            display: inline-flex; align-items: center; gap: 10px;
            padding: 12px 24px; border-radius: 14px; border: none;
            background: linear-gradient(135deg, #1B5E20, #2E7D32);
            color: white; font-size: 14px; font-weight: 600; cursor: pointer;
            transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(46,125,50,0.2);
        }
        .btn-add-tech:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(46,125,50,0.3); }

        /* Modal */
        .modal-overlay {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(26, 43, 26, 0.6); backdrop-filter: blur(8px); z-index: 10000; 
            justify-content: center; align-items: center; padding: 20px;
        }
        .modal-overlay.active { display: flex; }
        .modal {
            background: white; border-radius: 24px; padding: 36px; width: 100%; max-width: 500px;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            animation: modalPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes modalPop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        .modal h2 { font-size: 24px; font-weight: 800; color: #1B5E20; margin-bottom: 6px; }
        .modal .subtitle { font-size: 14px; color: #7F8C8D; margin-bottom: 28px; }
        
        .form-group { margin-bottom: 20px; }
        .modal label { display: block; font-size: 13px; font-weight: 700; color: #2C3E50; margin-bottom: 8px; }
        .modal input {
            width: 100%; padding: 12px 16px; border: 1.5px solid #F1F4F1; border-radius: 12px;
            font-size: 14px; font-family: inherit; transition: all 0.2s; background: #FDFDFD;
        }
        .modal input:focus { outline: none; border-color: #2E7D32; background: white; box-shadow: 0 0 0 4px rgba(46,125,50,0.1); }
        
        .modal-actions { display: flex; gap: 12px; margin-top: 32px; }
        .btn-cancel {
            flex: 1; padding: 14px; border: 1.5px solid #F1F4F1; border-radius: 12px;
            background: white; font-size: 14px; font-weight: 600; cursor: pointer;
            color: #7F8C8D; transition: all 0.2s;
        }
        .btn-cancel:hover { background: #F8FAF8; color: #2C3E50; border-color: #E8F5E9; }
        .btn-submit {
            flex: 1; padding: 14px; border: none; border-radius: 12px; font-size: 14px;
            font-weight: 600; cursor: pointer; color: white;
            background: linear-gradient(135deg, #1B5E20, #2E7D32);
            transition: all 0.3s; box-shadow: 0 4px 12px rgba(46,125,50,0.2);
        }
        .btn-submit:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(46,125,50,0.3); }

        .info-card {
            background: #F0FDF4; border: 1px solid #DCFCE7; padding: 16px;
            border-radius: 16px; display: flex; gap: 12px; margin-bottom: 24px;
        }
        .info-card i { color: #16A34A; font-size: 20px; }
        .info-card p { font-size: 13px; color: #166534; line-height: 1.5; font-weight: 500; }

    </style>
</head>
<body>
    <?php include 'sidebar.php'; ?>

    <div class="main-content">
        <div class="page-header">
            <h1>👥 User Management</h1>
            <button class="btn-add-tech" onclick="document.getElementById('techModal').classList.add('active')">
                <i class="ri-user-add-line"></i> Add Technologist
            </button>
        </div>

        <?php if (isset($_GET['msg'])): ?>
            <?php if ($_GET['msg'] === 'deleted'): ?>
                <div class="msg msg-success"><i class="ri-checkbox-circle-line"></i> User deleted successfully.</div>
            <?php elseif ($_GET['msg'] === 'tech_added'): ?>
                <div class="msg msg-success"><i class="ri-checkbox-circle-line"></i> Technologist account created successfully!</div>
            <?php elseif ($_GET['msg'] === 'contact_exists'): ?>
                <div class="msg msg-error"><i class="ri-error-warning-line"></i> Contact number already registered.</div>
            <?php elseif ($_GET['msg'] === 'tech_error'): ?>
                <div class="msg msg-error"><i class="ri-error-warning-line"></i> Failed to create technologist. Check all fields.</div>
            <?php endif; ?>
        <?php endif; ?>

        <div class="toolbar">
            <form class="search-box" method="GET">
                <i class="ri-search-line"></i>
                <input type="hidden" name="type" value="<?= htmlspecialchars($filter) ?>">
                <input type="text" name="search" placeholder="Search by name or contact..." value="<?= htmlspecialchars($search) ?>">
                <button type="submit" style="display:none"></button>
            </form>
            
            <div class="filter-group">
                <a href="users.php" class="filter-btn <?= !$filter ? 'active' : '' ?>">All Souls</a>
                <a href="users.php?type=1" class="filter-btn <?= $filter == '1' ? 'active' : '' ?>">Farmers</a>
                <a href="users.php?type=2" class="filter-btn <?= $filter == '2' ? 'active' : '' ?>">Technologists</a>
                <a href="users.php?type=3" class="filter-btn <?= $filter == '3' ? 'active' : '' ?>">Admins</a>
            </div>
        </div>

        <div class="card">
            <table class="table">
                <thead>
                    <tr><th>User</th><th>Username</th><th>Contact</th><th>Role</th><th>Joined</th><th style="text-align:right">Actions</th></tr>
                </thead>
                <tbody>
                    <?php while ($u = $users->fetch_assoc()): ?>
                    <tr>
                        <td>
                            <div class="user-info">
                                <div class="user-avatar"><?= strtoupper(substr($u['fname'], 0, 1)) ?></div>
                                <div>
                                    <div style="font-weight:700; color:#2C3E50;"><?= htmlspecialchars($u['fname'] . ' ' . $u['lname']) ?></div>
                                    <div style="font-size:11px; color:#95A5A6;">UID: #<?= $u['user_id'] ?></div>
                                </div>
                            </div>
                        </td>
                        <td><span style="color:#7F8C8D; font-family:'JetBrains Mono', monospace; font-size:12px;"><?= htmlspecialchars($u['username'] ?? '—') ?></span></td>
                        <td style="font-weight:600; color:#34495E;"><?= htmlspecialchars($u['contact_number']) ?></td>
                        <td><span class="role-badge role-<?= strtolower($u['type_name']) ?>"><?= $u['type_name'] ?></span></td>
                        <td style="color:#7F8C8D; font-size:12px;"><?= date('M d, Y', strtotime($u['created_at'])) ?></td>
                        <td style="text-align:right">
                            <form method="POST" style="display:inline" onsubmit="return confirm('Archive/Delete this user account?')">
                                <input type="hidden" name="delete_user_id" value="<?= $u['user_id'] ?>">
                                <button type="submit" class="btn-delete" title="Delete User">
                                    <i class="ri-delete-bin-7-line"></i>
                                </button>
                            </form>
                        </td>
                    </tr>
                    <?php endwhile; ?>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Add Technologist Modal -->
    <div class="modal-overlay" id="techModal">
        <div class="modal">
            <h2>🔬 New Technologist</h2>
            <p class="subtitle">Assign an expert to the RiceGuard platform</p>

            <div class="info-card">
                <i class="ri-information-line"></i>
                <p>Technician accounts are special. They can perform expert verifications on disease reports via the mobile application.</p>
            </div>

            <form method="POST">
                <input type="hidden" name="add_tech" value="1">

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                    <div class="form-group">
                        <label>First Name</label>
                        <input type="text" name="tech_fname" required placeholder="Ex: Juan">
                    </div>
                    <div class="form-group">
                        <label>Last Name</label>
                        <input type="text" name="tech_lname" required placeholder="Ex: Dela Cruz">
                    </div>
                </div>

                <div class="form-group">
                    <label>Middle Name (Optional)</label>
                    <input type="text" name="tech_mname" placeholder="Leave blank if none">
                </div>

                <div class="form-group">
                    <label>Contact Number (Login Mobile)</label>
                    <input type="text" name="tech_contact" required placeholder="09xxxxxxxxx">
                </div>

                <div class="form-group">
                    <label>Assigned Password</label>
                    <input type="password" name="tech_password" required placeholder="Secure access phrase" minlength="6">
                </div>

                <div class="modal-actions">
                    <button type="button" class="btn-cancel" onclick="document.getElementById('techModal').classList.remove('active')">Dismiss</button>
                    <button type="submit" class="btn-submit">Register Expert</button>
                </div>
            </form>
        </div>
    </div>

    <script>
        // Close modal on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') document.getElementById('techModal').classList.remove('active');
        });

        // Close modal on overlay click
        document.getElementById('techModal').addEventListener('click', function(e) {
            if (e.target === this) this.classList.remove('active');
        });
    </script>
</body>
</html>
