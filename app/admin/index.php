<?php
session_start();
require_once __DIR__ . '/../config/db.php';

// Handle login
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $conn = getConnection();
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    $stmt = $conn->prepare(
        "SELECT u.*, ut.type_name FROM tbl_user u
         JOIN tbl_user_type ut ON u.user_type_id = ut.user_type_id
         WHERE (u.username = ? OR u.contact_number = ?) AND ut.type_name = 'Admin'"
    );
    // Allow both username OR contact number for flexibility, but label it as Username
    $stmt->bind_param("ss", $username, $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $admin = $result->fetch_assoc();
        if (password_verify($password, $admin['password'])) {
            $_SESSION['admin_id'] = $admin['user_id'];
            $_SESSION['admin_name'] = $admin['fname'] . ' ' . $admin['lname'];
            $_SESSION['admin_type'] = $admin['type_name'];
            header('Location: dashboard.php');
            exit;
        }
    }
    $error = 'Access Denied: Invalid credentials or insufficient privileges.';
    $conn->close();
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RiceGuard Admin — Secure Entrance</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
        rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css" rel="stylesheet">
    <style>
        :root {
            --primary: #1B5E20;
            --secondary: #2E7D32;
            --accent: #4CAF50;
            --error: #DC2626;
            --glass: rgba(255, 255, 255, 0.9);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            background: radial-gradient(circle at top right, #2E7D32, #1B5E20);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
        }

        /* Ambient background elements */
        body::before {
            content: "";
            position: absolute;
            top: -10%;
            left: -10%;
            width: 40%;
            height: 40%;
            background: rgba(129, 199, 132, 0.2);
            filter: blur(100px);
            border-radius: 50%;
            z-index: 0;
        }

        .login-container {
            width: 100%;
            max-width: 440px;
            padding: 20px;
            position: relative;
            z-index: 10;
        }

        .login-card {
            background: var(--glass);
            backdrop-filter: blur(20px);
            border-radius: 32px;
            padding: 56px 44px;
            box-shadow: 0 40px 100px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
            animation: cardEntrance 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes cardEntrance {
            from {
                opacity: 0;
                transform: translateY(40px) scale(0.95);
            }

            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        .branding {
            text-align: center;
            margin-bottom: 40px;
        }

        .logo-box {
            width: 72px;
            height: 72px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            box-shadow: 0 10px 20px rgba(27, 94, 32, 0.3);
            transform: rotate(-3deg);
            transition: transform 0.3s ease;
        }

        .logo-box:hover {
            transform: rotate(0deg) scale(1.05);
        }

        .logo-box i {
            font-size: 38px;
            color: white;
        }

        h1 {
            font-size: 32px;
            font-weight: 900;
            color: #1A1A2E;
            letter-spacing: -1px;
            margin-bottom: 8px;
        }

        .subtitle {
            font-size: 15px;
            font-weight: 600;
            color: #7F8C8D;
            letter-spacing: 0.2px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            font-size: 11px;
            font-weight: 800;
            color: #95A5A6;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
            padding-left: 4px;
        }

        .input-pill {
            display: flex;
            align-items: center;
            background: white;
            border: 2px solid #F1F4F1;
            border-radius: 16px;
            padding: 0 18px;
            height: 56px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .input-pill:focus-within {
            border-color: var(--secondary);
            box-shadow: 0 4px 20px rgba(46, 125, 50, 0.12);
            background: #F8FAF8;
            transform: translateY(-1px);
        }

        .input-pill i.input-icon {
            font-size: 20px;
            color: #BDC3C7;
            margin-right: 14px;
            transition: all 0.3s ease;
        }

        .input-pill:focus-within i.input-icon {
            color: var(--secondary);
            transform: scale(1.1);
        }

        .input-pill input {
            flex: 1;
            border: none;
            background: none;
            outline: none;
            font-size: 15px;
            font-weight: 600;
            color: #2C3E50;
            font-family: inherit;
        }

        .input-pill input::placeholder {
            color: #BDC3C7;
            font-weight: 500;
        }

        .password-toggle {
            cursor: pointer;
            color: #BDC3C7;
            transition: color 0.2s ease, transform 0.2s ease;
            font-size: 20px;
            margin-left: 10px;
            padding: 4px;
        }

        .password-toggle:hover {
            color: var(--secondary);
            transform: scale(1.1);
        }

        .error-alert {
            background: #FEF2F2;
            border: 1px solid #FEE2E2;
            color: var(--error);
            padding: 14px 18px;
            border-radius: 16px;
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: shake 0.4s cubic-bezier(.36, .07, .19, .97) both;
        }

        @keyframes shake {

            10%,
            90% {
                transform: translate3d(-1px, 0, 0);
            }

            20%,
            80% {
                transform: translate3d(2px, 0, 0);
            }

            30%,
            50%,
            70% {
                transform: translate3d(-4px, 0, 0);
            }

            40%,
            60% {
                transform: translate3d(4px, 0, 0);
            }
        }

        .login-btn {
            width: 100%;
            height: 56px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            border: none;
            border-radius: 18px;
            color: white;
            font-size: 16px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            box-shadow: 0 10px 30px rgba(27, 94, 32, 0.2);
        }

        .login-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 40px rgba(27, 94, 32, 0.3);
        }

        .login-btn:active {
            transform: translateY(0);
        }

        .footer-note {
            text-align: center;
            margin-top: 32px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.6);
            font-weight: 600;
            letter-spacing: 0.5px;
        }
    </style>
</head>

<body>
    <div class="login-container">
        <div class="login-card">
            <div class="branding">
                <div class="logo-box">
                    <i class="ri-shield-cross-fill"></i>
                </div>
                <h1>RiceGuard</h1>
                <p class="subtitle">Administrative Portal Oversight</p>
            </div>

            <?php if (!empty($error)): ?>
                <div class="error-alert">
                    <i class="ri-error-warning-fill"></i>
                    <span><?= htmlspecialchars($error) ?></span>
                </div>
            <?php endif; ?>

            <form method="POST">
                <div class="form-group">
                    <label>Digital Identifier</label>
                    <div class="input-pill">
                        <i class="ri-fingerprint-line input-icon username-icon"></i>
                        <input type="text" name="username" placeholder="Username or Phone" required
                            autocomplete="username">
                    </div>
                </div>

                <div class="form-group">
                    <label>Security Key</label>
                    <div class="input-pill">
                        <i class="ri-key-2-line input-icon password-icon"></i>
                        <input type="password" name="password" placeholder="••••••••" required
                            autocomplete="current-password">
                        <i class="ri-eye-line password-toggle" id="togglePassword" title="Show Password"></i>
                    </div>
                </div>

                <button type="submit" class="login-btn">
                    Authorize Access
                    <i class="ri-arrow-right-line"></i>
                </button>
            </form>
        </div>

        <p class="footer-note">
            &copy; <?= date('Y') ?> RiceGuard Environmental Intelligence. Secure Monitoring Active.
        </p>
    </div>
    <script>
        const togglePassword = document.querySelector('#togglePassword');
        const passwordInput = document.querySelector('input[name="password"]');

        togglePassword.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            this.classList.toggle('ri-eye-line');
            this.classList.toggle('ri-eye-off-line');
            this.setAttribute('title', type === 'password' ? 'Show Password' : 'Hide Password');
        });

        // Dynamic icon color feedback
        const usernameInput = document.querySelector('input[name="username"]');
        const usernameIcon = document.querySelector('.username-icon');
        const passwordIcon = document.querySelector('.password-icon');

        usernameInput.addEventListener('input', function() {
            if (this.value.trim().length > 3) {
                usernameIcon.style.color = 'var(--secondary)';
            } else {
                usernameIcon.style.color = '';
            }
        });

        passwordInput.addEventListener('input', function() {
            if (this.value.length > 5) {
                passwordIcon.style.color = 'var(--secondary)';
            } else {
                passwordIcon.style.color = '';
            }
        });
    </script>
</body>

</html>