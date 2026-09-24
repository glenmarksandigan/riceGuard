<?php
// Admin auth guard — include in every admin page
session_start();
if (!isset($_SESSION['admin_id'])) {
    header('Location: index.php');
    exit;
}
$adminName = $_SESSION['admin_name'] ?? 'Admin';
$adminId = $_SESSION['admin_id'];
?>
