<?php
require_once 'auth_check.php';
require_once __DIR__ . '/../config/db.php';
$conn = getConnection();

// Handle status update
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['claim_id'], $_POST['new_status'])) {
    $rejectionReason = ($_POST['new_status'] === 'Rejected') ? ($_POST['rejection_reason'] ?? '') : null;
    $stmt = $conn->prepare("UPDATE tbl_insurance_claim SET status = ?, rejection_reason = ? WHERE claim_id = ?");
    $stmt->bind_param("ssi", $_POST['new_status'], $rejectionReason, $_POST['claim_id']);
    $stmt->execute();
    $stmt->close();
    header('Location: claims.php?msg=updated');
    exit;
}

$filter = $_GET['status'] ?? '';
$sql = "SELECT ic.*, u.fname, u.lname, u.contact_number,
               COALESCE(a.barangay,'') as barangay, COALESCE(a.municipality,'') as municipality,
               r.field_location, r.status as report_status, r.description as report_desc,
               r.reported_at,
               (SELECT GROUP_CONCAT(di.image_path) FROM tbl_disease_image di WHERE di.report_id = r.report_id) as images,
               (SELECT GROUP_CONCAT(CONCAT(ci.image_path, '|', ci.image_type) SEPARATOR ',') FROM tbl_claim_image ci WHERE ci.claim_id = ic.claim_id) as claim_images,
               (SELECT d2.disease_name FROM tbl_ai_diagnosis ad2 JOIN tbl_disease d2 ON ad2.disease_id = d2.disease_id WHERE ad2.report_id = ic.report_id ORDER BY ad2.confidence_score DESC LIMIT 1) as ai_disease
        FROM tbl_insurance_claim ic
        JOIN tbl_user u ON ic.user_id = u.user_id
        JOIN tbl_disease_report r ON ic.report_id = r.report_id
        LEFT JOIN tbl_address a ON u.user_id = a.user_id
        WHERE 1=1";
if ($filter) $sql .= " AND ic.status = '" . $conn->real_escape_string($filter) . "'";
$sql .= " ORDER BY ic.created_at DESC";
$claims = $conn->query($sql);

// Counts
$countAll = $conn->query("SELECT COUNT(*) as c FROM tbl_insurance_claim")->fetch_assoc()['c'];
$countPending = $conn->query("SELECT COUNT(*) as c FROM tbl_insurance_claim WHERE status='Pending'")->fetch_assoc()['c'];
$countVerified = $conn->query("SELECT COUNT(*) as c FROM tbl_insurance_claim WHERE status='Verified'")->fetch_assoc()['c'];
$countPaid = $conn->query("SELECT COUNT(*) as c FROM tbl_insurance_claim WHERE status='Paid'")->fetch_assoc()['c'];
$countRejected = $conn->query("SELECT COUNT(*) as c FROM tbl_insurance_claim WHERE status='Rejected'")->fetch_assoc()['c'];

$conn->close();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Insurance Claims — RiceGuard Admin</title>
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
        .table td { padding: 16px 20px; font-size: 14px; background: #FDFDFD; border-top: 1px solid #F5F6F7; border-bottom: 1px solid #F5F6F7; vertical-align: middle; cursor: pointer; }
        .table td:first-child { border-left: 1px solid #F5F6F7; border-top-left-radius: 14px; border-bottom-left-radius: 14px; }
        .table td:last-child { border-right: 1px solid #F5F6F7; border-top-right-radius: 14px; border-bottom-right-radius: 14px; }
        .table tr:hover td { background: #F8FAF8; border-color: #E8F5E9; }

        .status-badge { display: inline-block; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-pending { background: #FFF4E5; color: #D35400; }
        .status-verified { background: #EBF5FF; color: #2980B9; }
        .status-paid { background: #ECFDF5; color: #10B981; }
        .status-rejected { background: #FEF2F2; color: #991B1B; }

        .btn-update { 
            padding: 7px 14px; border-radius: 8px; border: none; 
            background: #E8F5E9; color: #2E7D32; font-size: 11px; 
            cursor: pointer; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
            transition: all 0.2s;
        }
        .btn-update:hover { background: #2E7D32; color: white; }

        .msg { background: #ECFDF5; color: #059669; padding: 12px 20px; border-radius: 14px; margin-bottom: 24px; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 10px; border: 1px solid #D1FAE5; }

        /* ── Modern Modals ── */
        .modal-overlay {
            display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(26, 26, 46, 0.6); backdrop-filter: blur(8px); z-index: 200;
            justify-content: center; align-items: flex-start; padding: 60px 20px; overflow-y: auto;
        }
        .modal-overlay.active { display: flex; }
        .modal-card {
            background: white; border-radius: 24px; width: 100%; max-width: 800px;
            box-shadow: 0 40px 100px rgba(0,0,0,0.15); animation: modalIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            position: relative; overflow: hidden;
        }
        @keyframes modalIn { from { opacity: 0; transform: translateY(30px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        
        .modal-header { padding: 24px 32px; border-bottom: 1px solid #F1F4F1; display: flex; justify-content: space-between; align-items: center; }
        .modal-header h2 { font-size: 20px; font-weight: 800; color: #2C3E50; }
        .modal-close { width: 40px; height: 40px; border-radius: 12px; border: none; background: #F8FAF8; color: #7F8C8D; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .modal-close:hover { background: #FEF2F2; color: #991B1B; }

        .modal-body { padding: 32px; }

        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 32px; }
        .info-item { background: #F8FAF8; border-radius: 16px; padding: 16px; border: 1px solid rgba(0,0,0,0.02); }
        .info-label { font-size: 10px; color: #95A5A6; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 6px; }
        .info-value { font-size: 14px; font-weight: 700; color: #2C3E50; }

        .section-title { font-size: 14px; font-weight: 800; color: #2E7D32; margin: 32px 0 16px; display: flex; align-items: center; gap: 8px; }
        .section-title::after { content: ""; flex: 1; height: 1px; background: #E8F5E9; }

        .proof-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
        .proof-item { border-radius: 16px; overflow: hidden; background: #FDFDFD; border: 1px solid #F1F4F1; cursor: pointer; transition: all 0.2s; }
        .proof-item:hover { transform: scale(1.02); box-shadow: 0 10px 20px rgba(0,0,0,0.05); }
        .proof-item img { width: 100%; height: 100px; object-fit: cover; }
        .proof-label { font-size: 11px; font-weight: 700; color: #7F8C8D; text-align: center; padding: 8px; }

        .timeline { position: relative; padding-left: 32px; margin-top: 16px; }
        .timeline::before { content: ''; position: absolute; left: 11px; top: 4px; bottom: 4px; width: 2px; background: #F1F4F1; }
        .timeline-item { position: relative; margin-bottom: 24px; padding-bottom: 4px; }
        .timeline-dot {
            position: absolute; left: -32px; top: 2px; width: 24px; height: 24px;
            border-radius: 8px; background: white; border: 2px solid #F1F4F1;
            display: flex; align-items: center; justify-content: center; font-size: 14px; color: #BDC3C7;
        }
        .timeline-item.active .timeline-dot { border-color: #2E7D32; background: #E8F5E9; color: #2E7D32; }
        .timeline-item.rejected .timeline-dot { border-color: #C62828; background: #FEF2F2; color: #C62828; }
        
        .timeline-content { padding-left: 12px; }
        .timeline-label { font-size: 14px; font-weight: 700; color: #2C3E50; }
        .timeline-date { font-size: 11px; color: #95A5A6; font-weight: 600; margin-top: 2px; }

        .rejection-notice {
            background: #FEF2F2; border-radius: 16px; padding: 20px; border: 1px solid #FEE2E2;
            color: #991B1B; margin-top: 24px;
        }
        .rejection-notice h4 { font-size: 13px; font-weight: 800; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .rejection-notice p { font-size: 14px; font-weight: 500; line-height: 1.5; }

        /* ── Update Status Form ── */
        .status-form { display: grid; gap: 20px; }
        .form-group label { display: block; font-size: 11px; font-weight: 800; color: #95A5A6; text-transform: uppercase; margin-bottom: 8px; }
        .form-select, .form-textarea {
            width: 100%; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #F1F4F1;
            font-size: 14px; font-weight: 600; font-family: inherit; transition: all 0.2s;
        }
        .form-select:focus, .form-textarea:focus { outline: none; border-color: #2E7D32; background: #F8FAF8; }
        .form-textarea { min-height: 100px; resize: none; background: #FFF; }
        .btn-submit {
            padding: 14px; border-radius: 12px; border: none; background: #1B5E20; color: white;
            font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(27,94,32,0.2);
        }
        .btn-submit:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(27,94,32,0.3); }
    </style>
</head>
<body>
    <?php include 'sidebar.php'; ?>

    <div class="main-content">
        <div class="page-header">
            <h1>🛡️ Claims Monitoring</h1>
            <div class="header-stats">
                <div class="header-stat"><span><?= $countPending ?></span><label>In Queue</label></div>
                <div class="header-stat"><span><?= $countVerified ?></span><label>Audited</label></div>
                <div class="header-stat"><span><?= $countPaid ?></span><label>Disbursed</label></div>
            </div>
        </div>

        <?php if (isset($_GET['msg'])): ?>
            <div class="msg"><i class="ri-checkbox-circle-fill"></i> Claim resolution was saved successfully.</div>
        <?php endif; ?>

        <div class="toolbar">
            <div class="filter-group">
                <a href="claims.php" class="filter-btn <?= !$filter ? 'active' : '' ?>">
                    All <span class="filter-count"><?= $countAll ?></span>
                </a>
                <a href="claims.php?status=Pending" class="filter-btn <?= $filter === 'Pending' ? 'active' : '' ?>">Pending</a>
                <a href="claims.php?status=Verified" class="filter-btn <?= $filter === 'Verified' ? 'active' : '' ?>">Audited</a>
                <a href="claims.php?status=Paid" class="filter-btn <?= $filter === 'Paid' ? 'active' : '' ?>">Paid</a>
                <a href="claims.php?status=Rejected" class="filter-btn <?= $filter === 'Rejected' ? 'active' : '' ?>">Rejected</a>
            </div>
        </div>

        <div class="card" style="padding: 10px;">
            <table class="table">
                <thead>
                    <tr>
                        <th style="width: 80px;">Claim</th>
                        <th>Farmer / Member</th>
                        <th>Associated Report</th>
                        <th>Damage Profile</th>
                        <th>Status</th>
                        <th>Date Filed</th>
                        <th style="text-align:right">Action</th>
                    </tr>
                </thead>
                <tbody>
                    <?php while ($c = $claims->fetch_assoc()):
                        $claimData = htmlspecialchars(json_encode($c), ENT_QUOTES, 'UTF-8');
                    ?>
                    <tr onclick='openClaimModal(<?= $claimData ?>)'>
                        <td><strong style="color:#2E7D32">#C-<?= $c['claim_id'] ?></strong></td>
                        <td>
                            <div style="font-weight:700; color:#2C3E50;"><?= htmlspecialchars($c['fname'] . ' ' . $c['lname']) ?></div>
                            <div style="font-size:12px; color:#95A5A6; font-weight:500;"><?= htmlspecialchars($c['contact_number']) ?></div>
                        </td>
                        <td>
                            <div style="font-weight:600; color:#34495E;">Report #<?= $c['report_id'] ?></div>
                            <div style="font-size:11px; color:#BDC3C7; text-transform:uppercase; font-weight:700;"><?= $c['barangay'] ?: 'Unknown Area' ?></div>
                        </td>
                        <td>
                            <div style="font-weight:700; color:#2C3E50; font-size:13px;"><?= htmlspecialchars($c['damage_type']) ?></div>
                            <?php if ($c['ai_disease']): ?>
                                <div style="font-size:11px; font-weight:700; color:#1565C0; margin-top:2px;"><i class="ri-robot-2-line"></i> <?= htmlspecialchars($c['ai_disease']) ?></div>
                            <?php endif; ?>
                        </td>
                        <td><span class="status-badge status-<?= strtolower($c['status']) ?>"><?= $c['status'] ?></span></td>
                        <td style="color:#7F8C8D; font-size:13px; font-weight:500;"><?= date('M j, Y', strtotime($c['created_at'])) ?></td>
                        <td onclick="event.stopPropagation()" style="text-align:right">
                            <button class="btn-update" onclick="openUpdateModal(<?= $c['claim_id'] ?>, '<?= $c['status'] ?>', '<?= htmlspecialchars(addslashes($c['rejection_reason'] ?? ''), ENT_QUOTES, 'UTF-8') ?>')">Update Status</button>
                        </td>
                    </tr>
                    <?php endwhile; ?>
                    <?php if ($countAll == 0): ?>
                    <tr><td colspan="7" style="text-align:center; color:#95A5A6; padding:60px; font-size:14px; font-weight:600;"><i class="ri-inbox-line" style="font-size:32px; display:block; margin-bottom:12px; opacity:0.3"></i> No insurance claims reported</td></tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>

    <!-- ── Claim Detail Modal ── -->
    <div class="modal-overlay" id="claimModal">
        <div class="modal-card">
            <div class="modal-header">
                <h2 id="claimModalTitle">Claim Detailed View</h2>
                <button class="modal-close" onclick="closeClaimModal()"><i class="ri-close-line"></i></button>
            </div>
            <div class="modal-body" id="claimModalBody"></div>
        </div>
    </div>

    <!-- ── Update Status Modal ── -->
    <div class="modal-overlay" id="updateModal">
        <div class="modal-card" style="max-width: 440px;">
            <div class="modal-header">
                <h2>Modify Claim State</h2>
                <button class="modal-close" onclick="closeUpdateModal()"><i class="ri-close-line"></i></button>
            </div>
            <div class="modal-body">
                <form method="POST" class="status-form">
                    <input type="hidden" name="claim_id" id="updateClaimId">
                    <div class="form-group">
                        <label>Operational Status</label>
                        <select name="new_status" id="updateStatusSelect" class="form-select" onchange="toggleRejectArea()">
                            <option value="Pending">Pending Audit</option>
                            <option value="Verified">Verified Case</option>
                            <option value="Paid">Payment Issued</option>
                            <option value="Rejected">Rejected</option>
                        </select>
                    </div>
                    <div id="rejectionArea" style="display:none">
                        <div class="form-group">
                            <label>Internal Rejection Comment</label>
                            <textarea name="rejection_reason" id="updateRejectReason" class="form-textarea" placeholder="Provide reason for rejecting this claim..."></textarea>
                        </div>
                    </div>
                    <button type="submit" class="btn-submit">Finalize Status Update</button>
                </form>
            </div>
        </div>
    </div>

    <script>
    function closeModal(id) { document.getElementById(id).classList.remove('active'); }
    function closeClaimModal() { closeModal('claimModal'); }
    function closeUpdateModal() { closeModal('updateModal'); }

    function openClaimModal(c) {
        const modal = document.getElementById('claimModal');
        modal.classList.add('active');
        document.getElementById('claimModalTitle').textContent = 'Audit Claim #C-' + c.claim_id;

        const images = c.images ? c.images.split(',') : [];
        const isActive = (s) => ['Verified','Paid'].includes(c.status) || c.status === s;
        const isPaid = c.status === 'Paid';
        const isRejected = c.status === 'Rejected';

        let html = `
            <div class="info-grid">
                <div class="info-item"><div class="info-label">Member Name</div><div class="info-value">${c.fname} ${c.lname}</div></div>
                <div class="info-item"><div class="info-label">Contact Node</div><div class="info-value">${c.contact_number || '—'}</div></div>
                <div class="info-item"><div class="info-label">RSBSA Reference</div><div class="info-value">${c.rsbsa_num || 'Not Provided'}</div></div>
                <div class="info-item"><div class="info-label">Insurance Policy</div><div class="info-value">${c.policy_num || 'Not Provided'}</div></div>
                <div class="info-item"><div class="info-label">Property Location</div><div class="info-value">${c.municipality}, ${c.barangay}</div></div>
                <div class="info-item"><div class="info-label">Current State</div><div class="info-value"><span class="status-badge status-${c.status.toLowerCase()}">${c.status}</span></div></div>
            </div>

            <div class="section-title"><i class="ri-file-list-3-line"></i> Linked Investigation #${c.report_id}</div>
            <div class="info-grid">
                <div class="info-item" style="grid-column: span 2"><div class="info-label">Incident Description</div><div class="info-value" style="color:#5F6368">${c.report_desc || 'No farmer observation recorded.'}</div></div>
                <div class="info-item"><div class="info-label">Field GPS Reference</div><div class="info-value">${c.field_location || '—'}</div></div>
                <div class="info-item"><div class="info-label">Incident Date</div><div class="info-value">${new Date(c.reported_at).toLocaleDateString()}</div></div>
            </div>
        `;

        if (images.length > 0) {
            html += `
                <div class="proof-grid" style="margin-top: 10px;">
                    ${images.map(img => `
                        <div class="proof-item" onclick="window.open('../../${img}','_blank')">
                            <img src="../../${img}" alt="Damage Photo">
                            <div class="proof-label">Report Photo</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        html += `<div class="section-title"><i class="ri-shield-user-line"></i> Compliance Documentation (Proof)</div>`;
        const claimImgs = c.claim_images ? c.claim_images.split(',').map(entry => {
            const [path, type] = entry.split('|');
            return { path: path || '', type: type || 'Supporting' };
        }) : [];

        if (claimImgs.length > 0) {
            html += `<div class="proof-grid">`;
            claimImgs.forEach(img => {
                html += `
                    <div class="proof-item" onclick="window.open('../../${img.path}','_blank')">
                        <img src="../../${img.path}" alt="${img.type}">
                        <div class="proof-label">${img.type}</div>
                    </div>`;
            });
            html += `</div>`;
        } else {
            html += `<div style="text-align:center; padding:32px; background:#F8FAF8; border-radius:16px; border:1px dashed #E8F5E9; color:#95A5A6; font-size:13px; font-weight:600;">No digitized compliance documents found.</div>`;
        }

        html += `
            <div class="section-title"><i class="ri-history-line"></i> Lifecycle Timeline</div>
            <div class="timeline">
                <div class="timeline-item active">
                    <div class="timeline-dot"><i class="ri-file-edit-line"></i></div>
                    <div class="timeline-content">
                        <div class="timeline-label">Application Filed</div>
                        <div class="timeline-date">Farmer submitted claim on ${new Date(c.created_at).toLocaleString()}</div>
                    </div>
                </div>
                <div class="timeline-item ${isActive('Verified') ? 'active' : ''}">
                    <div class="timeline-dot"><i class="ri-search-eye-line"></i></div>
                    <div class="timeline-content">
                        <div class="timeline-label">Audit Review</div>
                        <div class="timeline-date">${isActive('Verified') ? 'Compliance review completed by Admin' : 'Awaiting administrative verification'}</div>
                    </div>
                </div>
                <div class="timeline-item ${isPaid ? 'active' : ''} ${isRejected ? 'rejected' : ''}">
                    <div class="timeline-dot"><i class="ri-${isRejected ? 'close' : 'bank-card'}-line"></i></div>
                    <div class="timeline-content">
                        <div class="timeline-label">${isRejected ? 'Application Denied' : 'Settlement Disbursed'}</div>
                        <div class="timeline-date">${isPaid ? 'Payment finalized and issued' : isRejected ? 'Exclusion criteria met' : 'Pending final settlement'}</div>
                    </div>
                </div>
            </div>
        `;

        if (isRejected && c.rejection_reason) {
            html += `
                <div class="rejection-notice">
                    <h4><i class="ri-error-warning-line"></i> Rejection Rationale</h4>
                    <p>${c.rejection_reason}</p>
                </div>
            `;
        }

        document.getElementById('claimModalBody').innerHTML = html;
    }

    function openUpdateModal(claimId, currentStatus, rejectionReason) {
        document.getElementById('updateClaimId').value = claimId;
        document.getElementById('updateStatusSelect').value = currentStatus;
        document.getElementById('updateRejectReason').value = rejectionReason || '';
        toggleRejectArea();
        document.getElementById('updateModal').classList.add('active');
    }

    function toggleRejectArea() {
        const area = document.getElementById('rejectionArea');
        const select = document.getElementById('updateStatusSelect');
        area.style.display = (select.value === 'Rejected') ? 'block' : 'none';
    }

    // Modal dismiss shortcuts
    window.onclick = function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            closeClaimModal();
            closeUpdateModal();
        }
    }
    document.onkeydown = function(e) {
        if (e.key === 'Escape') {
            closeClaimModal();
            closeUpdateModal();
        }
    }
    </script>
</body>
</html>
