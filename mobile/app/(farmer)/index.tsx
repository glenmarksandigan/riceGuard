import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, Dimensions, Animated, Alert, ActivityIndicator
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { reportService } from '../../services/api.service';
import { syncService } from '../../services/sync.service';
import { useFadeIn, usePressScale, useAnimatedCounter } from '../../constants/animations';

const { width } = Dimensions.get('window');

// ── Animated Stat Counter Component ─────────────────────
function AnimatedStat({ target, label }: { target: number; label: string }) {
    const animValue = useAnimatedCounter(target, 800, 400);
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        const id = animValue.addListener(({ value }) => setDisplay(Math.round(value)));
        return () => animValue.removeListener(id);
    }, [animValue]);

    return (
        <View style={styles.statBubble}>
            <Text style={styles.statNumber}>{display}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

// ── Animated Action Card Component ──────────────────────
function ActionCard({ action, index, onPress }: { action: any; index: number; onPress: () => void }) {
    const { scale, onPressIn, onPressOut } = usePressScale(0.94);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1, duration: 400, delay: 200 + index * 100,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0, duration: 400, delay: 200 + index * 100,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale }] }}>
            <TouchableOpacity
                style={styles.actionCard}
                onPress={onPress}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                activeOpacity={1}
            >
                <View style={[styles.actionIcon, { backgroundColor: action.color + '15' }]}>
                    <Ionicons name={action.icon as any} size={26} color={action.color} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

// ── Animated Report Card ────────────────────────────────
function ReportCard({ report, index }: { report: any; index: number }) {
    const { scale, onPressIn, onPressOut } = usePressScale(0.97);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1, duration: 350, delay: 400 + index * 80,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale }] }}>
            <TouchableOpacity
                style={styles.reportCard}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                activeOpacity={1}
            >
                <View style={styles.reportLeft}>
                    <Ionicons name="document-text" size={20} color={COLORS.primary} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={styles.reportTitle} numberOfLines={1}>
                            {report.field_location || 'Report #' + report.report_id}
                        </Text>
                        <Text style={styles.reportDate}>
                            {new Date(report.reported_at).toLocaleDateString()}
                        </Text>
                    </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(report.status) }]}>
                        {report.status}
                    </Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function FarmerHomeScreen() {
    const { user, logout } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();
    const [reports, setReports] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);

    // Header fade-in
    const headerFade = useFadeIn(0, 600);

    const loadReports = async () => {
        try {
            if (user?.user_id) {
                const data = await reportService.getReports({ user_id: user.user_id });
                setReports(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.log('Error:', err);
        }
    };

    const checkSyncQueue = async () => {
        const queue = await syncService.getQueue();
        setPendingSyncCount(queue.length);
        if (queue.length > 0) {
            // Auto-sync if internet is detected (implicit via handleSync try/catch)
            handleSync();
        }
    };

    const handleSync = async () => {
        if (syncing) return;
        setSyncing(true);
        try {
            const result = await syncService.syncQueue();
            if (result && result.synced && result.synced > 0) {
                Alert.alert(t('syncSuccess'), t('syncSuccessMsg'));
                loadReports();
            }
            setPendingSyncCount(result ? (result.remaining || 0) : 0);
        } catch (e) {
            console.warn('Sync failed:', e);
        } finally {
            setSyncing(false);
        }
    };

    useFocusEffect(useCallback(() => {
        loadReports();
        checkSyncQueue();
    }, [user]));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadReports();
        setRefreshing(false);
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return t('goodMorning');
        if (hour < 18) return t('goodAfternoon');
        return t('goodEvening');
    };

    const pendingCount = reports.filter((r: any) => r.status === 'Pending').length;
    const verifiedCount = reports.filter((r: any) => r.status === 'Verified').length;

    const quickActions = [
        { icon: 'scan-circle', label: t('scanDisease'), color: COLORS.primary, route: '/(farmer)/scan' },
        { icon: 'leaf-outline', label: t('tabDiseases'), color: '#43A047', route: '/(farmer)/diseases' },
        { icon: 'document-text-outline', label: t('myReports'), color: COLORS.info, route: '/(farmer)/reports' },
        { icon: 'walk-outline', label: t('requestFieldVisit'), color: '#E65100', route: '/(farmer)/visits' },
        { icon: 'shield-checkmark-outline', label: t('claims'), color: COLORS.danger, route: '/(farmer)/claims' },
    ];

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        >
            {/* Header with fade-in */}
            <Animated.View style={headerFade}>
                <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.header}>
                    <View style={styles.headerRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.greeting}>{getGreeting()} 👋</Text>
                            <Text style={styles.userName}>{user?.fname} {user?.lname}</Text>
                        </View>

                        {/* Sync Indicator */}
                        {pendingSyncCount > 0 && (
                            <TouchableOpacity
                                style={styles.syncBtn}
                                onPress={handleSync}
                                disabled={syncing}
                                activeOpacity={0.7}
                            >
                                {syncing ? (
                                    <ActivityIndicator color={COLORS.white} size="small" />
                                ) : (
                                    <View style={styles.syncBadgeWrap}>
                                        <Ionicons name="cloud-upload-outline" size={26} color={COLORS.white} />
                                        <View style={styles.syncBadge}>
                                            <Text style={styles.syncBadgeText}>{pendingSyncCount}</Text>
                                        </View>
                                    </View>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Animated Stats */}
                    <View style={styles.statsRow}>
                        <AnimatedStat target={reports.length} label={t('totalReports')} />
                        <AnimatedStat target={pendingCount} label={t('pending')} />
                        <AnimatedStat target={verifiedCount} label={t('verified')} />
                    </View>
                </LinearGradient>
            </Animated.View>

            {/* Quick Actions with staggered entrance */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('quickActions')}</Text>
                <View style={styles.actionsGrid}>
                    {quickActions.map((action, i) => (
                        <ActionCard
                            key={i}
                            action={action}
                            index={i}
                            onPress={() => router.push(action.route as any)}
                        />
                    ))}
                </View>
            </View>

            {/* Recent Reports with staggered entrance */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('recentReports')}</Text>
                    <TouchableOpacity onPress={() => router.push('/(farmer)/reports')}>
                        <Text style={styles.seeAll}>{t('seeAll')}</Text>
                    </TouchableOpacity>
                </View>

                {reports.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="leaf-outline" size={48} color={COLORS.textMuted} />
                        <Text style={styles.emptyText}>{t('noReportsYet')}</Text>
                        <Text style={styles.emptySubtext}>{t('noReportsSub')}</Text>
                    </View>
                ) : (
                    reports.slice(0, 5).map((report: any, i: number) => (
                        <ReportCard key={report.report_id} report={report} index={i} />
                    ))
                )}
            </View>

            <View style={{ height: 30 }} />
        </ScrollView>
    );
}

function getStatusColor(status: string) {
    switch (status) {
        case 'Pending': return '#FB8C00';
        case 'Verified': return '#1E88E5';
        case 'Treated': return '#43A047';
        default: return COLORS.textMuted;
    }
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { paddingTop: 60, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
    greeting: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
    userName: { fontSize: 24, fontWeight: '800', color: COLORS.white, marginTop: 2 },
    logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    statsRow: { flexDirection: 'row', gap: SPACING.sm },
    statBubble: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center' },
    statNumber: { fontSize: 22, fontWeight: '800', color: COLORS.white },
    statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

    // Sync UI
    syncBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    syncBadgeWrap: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
    syncBadge: {
        position: 'absolute', top: -4, right: -4,
        backgroundColor: COLORS.danger, borderRadius: 9,
        minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1.5, borderColor: COLORS.white,
    },
    syncBadgeText: { color: COLORS.white, fontSize: 9, fontWeight: '800' },

    section: { paddingHorizontal: SPACING.lg, marginTop: SPACING.lg },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
    seeAll: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
    actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    actionCard: {
        width: (width - SPACING.lg * 2 - SPACING.sm) / 2 - 1,
        backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md,
        alignItems: 'center', ...SHADOWS.small,
    },
    actionIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
    actionLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center' },
    emptyCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: 'center', ...SHADOWS.small },
    emptyText: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary, marginTop: SPACING.md },
    emptySubtext: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
    reportCard: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md,
        marginBottom: SPACING.sm, ...SHADOWS.small,
    },
    reportLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    reportTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
    reportDate: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
    statusText: { fontSize: 11, fontWeight: '700' },
});
