// RiceGuard Theme — Design System
export const COLORS = {
    // Primary green palette (rice/agriculture)
    primary: '#2E7D32',
    primaryLight: '#4CAF50',
    primaryDark: '#1B5E20',
    primaryFaded: 'rgba(46, 125, 50, 0.1)',

    // Accent gold (rice grain)
    accent: '#F9A825',
    accentLight: '#FFD54F',
    accentDark: '#F57F17',

    // Semantic
    success: '#43A047',
    warning: '#FB8C00',
    danger: '#E53935',
    info: '#1E88E5',

    // Neutrals
    white: '#FFFFFF',
    background: '#F5F7F5',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    border: '#E0E5E0',
    textPrimary: '#1A1A2E',
    textSecondary: '#5A6A5A',
    textMuted: '#9CA89C',
    overlay: 'rgba(0, 0, 0, 0.5)',

    // Status colors
    statusPending: '#FB8C00',
    statusVerified: '#1E88E5',
    statusTreated: '#43A047',
    statusRejected: '#E53935',
    statusPaid: '#7B1FA2',

    // Gradients
    gradientStart: '#1B5E20',
    gradientEnd: '#4CAF50',
} as const;

export const FONTS = {
    regular: { fontSize: 14, color: COLORS.textPrimary },
    medium: { fontSize: 16, fontWeight: '500' as const, color: COLORS.textPrimary },
    bold: { fontSize: 16, fontWeight: '700' as const, color: COLORS.textPrimary },
    h1: { fontSize: 28, fontWeight: '800' as const, color: COLORS.textPrimary },
    h2: { fontSize: 22, fontWeight: '700' as const, color: COLORS.textPrimary },
    h3: { fontSize: 18, fontWeight: '600' as const, color: COLORS.textPrimary },
    caption: { fontSize: 12, color: COLORS.textSecondary },
    small: { fontSize: 11, color: COLORS.textMuted },
} as const;

export const SHADOWS = {
    small: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    medium: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    large: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8,
    },
} as const;

export const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
} as const;

export const RADIUS = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 50,
} as const;

export const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
    Pending: { color: COLORS.statusPending, icon: 'time-outline', label: 'Pending' },
    Verified: { color: COLORS.statusVerified, icon: 'checkmark-circle-outline', label: 'Verified' },
    Treated: { color: COLORS.statusTreated, icon: 'medical-outline', label: 'Treated' },
    Paid: { color: COLORS.statusPaid, icon: 'cash-outline', label: 'Paid' },
    Rejected: { color: COLORS.statusRejected, icon: 'close-circle-outline', label: 'Rejected' },
};

export const MODEL_CONFIG: Record<string, { key: string; name: string; icon: string; color: string; description: string; accuracy: string }> = {
    mobilenetv2: {
        key: 'mobilenetv2',
        name: 'MobileNetV2',
        icon: 'phone-portrait-outline',
        color: '#1E88E5',
        description: 'Fast & lightweight — 89.24% accuracy',
        accuracy: '89.24%',
    },
    densenet201: {
        key: 'densenet201',
        name: 'DenseNet201',
        icon: 'git-network-outline',
        color: '#7B1FA2',
        description: 'Deep and accurate — 91.60%',
        accuracy: '91.60%',
    },
    efficientnetv2s: {
        key: 'efficientnetv2s',
        name: 'EfficientNetV2S',
        icon: 'analytics-outline',
        color: '#E65100',
        description: 'Best accuracy — 93.70%',
        accuracy: '93.70%',
    },
};
