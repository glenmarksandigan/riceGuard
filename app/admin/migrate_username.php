<?php
require_once __DIR__ . '/../config/db.php';
$conn = getConnection();

echo "Running migration...<br>";

// 1. Add username column if it doesn't exist
$check = $conn->query("SHOW COLUMNS FROM `tbl_user` LIKE 'username'");
if ($check->num_rows == 0) {
    if ($conn->query("ALTER TABLE `tbl_user` ADD COLUMN `username` VARCHAR(50) UNIQUE AFTER `contact_number`")) {
        echo "✅ Column 'username' added to tbl_user.<br>";
    } else {
        echo "❌ Error adding column: " . $conn->error . "<br>";
    }
} else {
    echo "ℹ️ Column 'username' already exists.<br>";
}

// 2. Set default username for existing admins
$admins = $conn->query("SELECT user_id FROM tbl_user WHERE user_type_id = 3 AND (username IS NULL OR username = '')");
if ($admins->num_rows > 0) {
    while ($admin = $admins->fetch_assoc()) {
        $id = $admin['user_id'];
        // For the first admin, use 'admin', for others use admin_ID
        $newUsername = ($id == 1 || $admins->num_rows == 1) ? 'admin' : 'admin' . $id;
        $conn->query("UPDATE tbl_user SET username = '$newUsername' WHERE user_id = $id");
        echo "✅ Set username to '$newUsername' for Admin ID $id.<br>";
    }
} else {
    echo "ℹ️ No admin users need username initialization.<br>";
}

echo "<br>Migration complete. <b>Please delete this file for security.</b>";
$conn->close();
?>
