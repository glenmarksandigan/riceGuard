import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Auto-detect laptop IP from Expo Go (no manual IP editing needed when router changes IP)
const getLocalIp = () => {
    if (Platform.OS === 'web') return 'localhost';

    // Extract IP address from Expo bundler host URI
    const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
    if (hostUri) {
        return hostUri.split(':')[0];
    }

    // Default fallback IP if built as standalone app
    return '192.168.1.35';
};

const LOCAL_IP = getLocalIp();

// -----------------------------------------------------------------
// TUNNEL URL CONFIGURATION
// If using localtunnel/ngrok, paste your tunnel links below.
// If left empty (''), it automatically uses your laptop's local IP!
// -----------------------------------------------------------------
const PHP_TUNNEL_URL = 'https://lucky-carrots-find.loca.lt';    // e.g. 'https://your-php-tunnel.loca.lt' (Port 80)
const FLASK_TUNNEL_URL = 'https://silly-maps-drive.loca.lt';  // e.g. 'https://your-flask-tunnel.loca.lt' (Port 5000)

// PHP Apache Backend (XAMPP Port 80)
export const API_BASE_URL = PHP_TUNNEL_URL
    ? `${PHP_TUNNEL_URL}/rice_guard`
    : `http://${LOCAL_IP}/rice_guard`;

export const API_CONFIG = {
    PHP_BASE_URL: `${API_BASE_URL}/app/api`,
    FLASK_BASE_URL: FLASK_TUNNEL_URL || `http://${LOCAL_IP}:5000`,
};

export const ENDPOINTS = {
    // Auth
    LOGIN: `${API_CONFIG.PHP_BASE_URL}/auth.php?action=login`,
    REGISTER: `${API_CONFIG.PHP_BASE_URL}/auth.php?action=register`,

    // Reports
    REPORTS: `${API_CONFIG.PHP_BASE_URL}/reports.php`,

    // Diagnosis
    DIAGNOSIS: `${API_CONFIG.PHP_BASE_URL}/diagnosis.php`,
    DISEASES: `${API_CONFIG.PHP_BASE_URL}/diseases.php`,

    // Verification
    VERIFICATION: `${API_CONFIG.PHP_BASE_URL}/verification.php`,

    // Treatments
    TREATMENTS: `${API_CONFIG.PHP_BASE_URL}/treatments.php`,

    // Claims
    CLAIMS: `${API_CONFIG.PHP_BASE_URL}/claims.php`,

    // Field Visits
    FIELD_VISITS: `${API_CONFIG.PHP_BASE_URL}/field_visits.php`,

    // Users
    USERS: `${API_CONFIG.PHP_BASE_URL}/users.php`,

    // Stats
    STATS: `${API_CONFIG.PHP_BASE_URL}/stats.php`,

    // Flask AI
    AI_PREDICT: `${API_CONFIG.FLASK_BASE_URL}/predict`,
    AI_YOLO_PREDICT: `${API_CONFIG.FLASK_BASE_URL}/predict/yolo`,
    AI_COMPARE: `${API_CONFIG.FLASK_BASE_URL}/predict/compare`,
    AI_MODELS: `${API_CONFIG.FLASK_BASE_URL}/models`,
    
};
// Wrapper that automatically bypasses the localtunnel warning page
export const apiFetch = (url, options = {}) => {
    return fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Bypass-Tunnel-Reminder': 'true',
        },
    });
};