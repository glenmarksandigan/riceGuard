<!-- Admin Sidebar Component -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css" rel="stylesheet">
<style>
    :root {
        --sidebar-bg: linear-gradient(165deg, #1B5E20 0%, #2E7D32 100%);
        --sidebar-item-active: rgba(255, 255, 255, 0.12);
        --sidebar-item-hover: rgba(255, 255, 255, 0.06);
        --accent-green: #81C784;
    }

    .sidebar {
        width: 260px;
        height: 100vh;
        background: var(--sidebar-bg);
        position: fixed;
        left: 0;
        top: 0;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 4px 0 25px rgba(0,0,0,0.1);
        border-right: 1px solid rgba(255,255,255,0.05);
    }
    
    .sidebar-header {
        padding: 32px 24px 24px;
    }
    
    .sidebar-logo {
        display: flex;
        align-items: center;
        gap: 14px;
        text-decoration: none;
    }
    
    .sidebar-logo-icon {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05));
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    .sidebar-logo-icon i { font-size: 24px; color: var(--accent-green); filter: drop-shadow(0 0 8px rgba(129, 199, 132, 0.4)); }
    
    .sidebar-logo-text { 
        color: white; 
        font-size: 22px; 
        font-weight: 800; 
        letter-spacing: -0.5px; 
        margin-bottom: -4px;
    }
    .sidebar-logo-sub { color: rgba(255,255,255,0.45); font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; }

    .sidebar-nav { flex: 1; padding: 20px 16px; overflow-y: auto; scrollbar-width: none; }
    .sidebar-nav::-webkit-scrollbar { display: none; }
    
    .nav-section { 
        padding: 0 12px; 
        margin: 24px 0 12px; 
        font-size: 11px; 
        font-weight: 700; 
        color: rgba(255,255,255,0.3); 
        text-transform: uppercase; 
        letter-spacing: 1.5px; 
    }
    .nav-section:first-child { margin-top: 0; }

    .nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 12px;
        color: rgba(255,255,255,0.65);
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.3s ease;
        margin-bottom: 4px;
        border: 1px solid transparent;
    }
    
    .nav-item:hover { 
        background: var(--sidebar-item-hover); 
        color: white;
        transform: translateX(4px);
    }
    
    .nav-item.active {
        background: var(--sidebar-item-active);
        color: white;
        font-weight: 600;
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    }
    
    .nav-item i { 
        font-size: 20px; 
        width: 24px; 
        text-align: center; 
        transition: transform 0.3s ease;
    }
    .nav-item:hover i { transform: scale(1.1); }
    .nav-item.active i { color: var(--accent-green); }

    .sidebar-footer {
        padding: 24px 16px;
        background: rgba(0,0,0,0.05);
        border-top: 1px solid rgba(255,255,255,0.05);
    }
    
    .admin-info {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 4px 12px 16px;
    }
    
    .admin-avatar {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: rgba(255,255,255,0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255,255,255,0.1);
    }
    .admin-avatar i { font-size: 20px; color: white; }
    
    .admin-name { color: white; font-size: 14px; font-weight: 600; margin-bottom: -2px; }
    .admin-role { color: rgba(255,255,255,0.4); font-size: 11px; font-weight: 500; }

    .logout-btn {
        background: rgba(255, 138, 128, 0.1);
        color: #FF8A80 !important;
    }
    .logout-btn:hover {
        background: rgba(255, 138, 128, 0.2);
        color: #FF5252 !important;
    }

    .main-content {
        margin-left: 260px;
        min-height: 100vh;
        background: #F8FAF8;
        padding: 40px;
        transition: all 0.4s;
    }

    /* Active Highlight Bar */
    .nav-item.active::after {
        content: '';
        position: absolute;
        left: -16px;
        width: 4px;
        height: 20px;
        background: var(--accent-green);
        border-radius: 0 4px 4px 0;
        box-shadow: 0 0 10px rgba(129, 199, 132, 0.6);
    }
</style>

<div class="sidebar">
    <div class="sidebar-header">
        <a href="dashboard.php" class="sidebar-logo">
            <div class="sidebar-logo-icon"><i class="ri-leaf-fill"></i></div>
            <div>
                <div class="sidebar-logo-text">RiceGuard</div>
                <div class="sidebar-logo-sub">Monitoring System</div>
            </div>
        </a>
    </div>

    <nav class="sidebar-nav">
        <div class="nav-section">Main</div>
        <a href="dashboard.php" class="nav-item <?= basename($_SERVER['PHP_SELF']) === 'dashboard.php' ? 'active' : '' ?>">
            <i class="ri-dashboard-3-line"></i> Dashboard
        </a>

        <div class="nav-section">Management</div>
        <a href="users.php" class="nav-item <?= basename($_SERVER['PHP_SELF']) === 'users.php' ? 'active' : '' ?>">
            <i class="ri-group-line"></i> Users
        </a>
        <a href="reports.php" class="nav-item <?= basename($_SERVER['PHP_SELF']) === 'reports.php' ? 'active' : '' ?>">
            <i class="ri-file-list-3-line"></i> Disease Reports
        </a>
        <a href="verifications.php" class="nav-item <?= basename($_SERVER['PHP_SELF']) === 'verifications.php' ? 'active' : '' ?>">
            <i class="ri-verified-badge-line"></i> Verifications
        </a>
        <a href="diseases.php" class="nav-item <?= basename($_SERVER['PHP_SELF']) === 'diseases.php' ? 'active' : '' ?>">
            <i class="ri-virus-line"></i> Disease Library
        </a>
        <a href="claims.php" class="nav-item <?= basename($_SERVER['PHP_SELF']) === 'claims.php' ? 'active' : '' ?>">
            <i class="ri-shield-check-line"></i> Insurance Claims
        </a>
        <a href="field_visits.php" class="nav-item <?= basename($_SERVER['PHP_SELF']) === 'field_visits.php' ? 'active' : '' ?>">
            <i class="ri-map-pin-user-line"></i> Field Visits
        </a>
    </nav>

    <div class="sidebar-footer">
        <div class="admin-info">
            <div class="admin-avatar"><i class="ri-user-settings-line"></i></div>
            <div>
                <div class="admin-name"><?= htmlspecialchars($adminName) ?></div>
                <div class="admin-role">System Administrator</div>
            </div>
        </div>
        <a href="logout.php" class="nav-item logout-btn">
            <i class="ri-logout-circle-r-line"></i> Logout
        </a>
    </div>
</div>
