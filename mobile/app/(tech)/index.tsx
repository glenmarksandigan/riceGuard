import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS, STATUS_CONFIG } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { reportService, fieldVisitService } from '../../services/api.service';

const { width } = Dimensions.get('window');

export default function TechHomeScreen() {
    const { user, logout } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();
    const [reports, setReports] = useState<any[]>([]);
    const [visitCount, setVisitCount] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        try {
            const [reportsData, visitsData] = await Promise.all([
                reportService.getReports({}),
                fieldVisitService.getVisits({ status: 'Pending' }),
            ]);
            setReports(Array.isArray(reportsData) ? reportsData : []);
            setVisitCount(Array.isArray(visitsData) ? visitsData.length : 0);
        } catch (err) {
            console.log('Failed to load:', err);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const pendingReports = reports.filter((r) => r.status === 'Pending');
    const verifiedReports = reports.filter((r) => r.status === 'Verified');

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        >
            <LinearGradient colors={['#0D47A1', '#1E88E5']} style={styles.header}>
                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.greeting}>Technologist Dashboard</Text>
                        <Text style={styles.userName}>{user?.fname} {user?.lname}</Text>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statBubble}>
                        <Text style={styles.statNumber}>{reports.length}</Text>
                        <Text style={styles.statLabel}>Total</Text>
                    </View>
                    <View style={styles.statBubble}>
                        <Text style={styles.statNumber}>{pendingReports.length}</Text>
                        <Text style={styles.statLabel}>Pending</Text>
                    </View>
                    <View style={styles.statBubble}>
                        <Text style={styles.statNumber}>{visitCount}</Text>
                        <Text style={styles.statLabel}>{t('tabVisits')}</Text>
                    </View>
                    <View style={styles.statBubble}>
                        <Text style={styles.statNumber}>{verifiedReports.length}</Text>
                        <Text style={styles.statLabel}>Verified</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Visit Requests Alert Banner */}
            {visitCount > 0 && (
                <TouchableOpacity
                    style={styles.visitBanner}
                    onPress={() => router.push('/(tech)/visits')}
                    activeOpacity={0.8}
                >
                    <View style={styles.visitBannerIcon}>
                        <Ionicons name="walk" size={22} color={COLORS.white} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.visitBannerTitle}>
                            {visitCount} {t('incomingVisitRequests')}
                        </Text>
                        <Text style={styles.visitBannerSub}>Tap to review and accept or decline</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
                </TouchableOpacity>
            )}

            {/* Pending Reports */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>⏳ Pending Verification ({pendingReports.length})</Text>
                {pendingReports.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="checkmark-done-circle-outline" size={40} color={COLORS.textMuted} />
                        <Text style={styles.emptyText}>All caught up!</Text>
                    </View>
                ) : (
                    pendingReports.slice(0, 10).map((report) => (
                        <TouchableOpacity
                            key={report.report_id}
                            style={styles.reportCard}
                            onPress={() => router.push('/(tech)/verify')}
                            activeOpacity={0.7}
                        >
                            <View style={styles.reportLeft}>
                                <View style={[styles.statusDot, { backgroundColor: COLORS.statusPending }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.reportTitle}>Report #{report.report_id}</Text>
                                    <Text style={styles.reportSub}>
                                        By {report.fname} {report.lname} • {new Date(report.reported_at).toLocaleDateString()}
                                    </Text>
                                    {report.field_location && (
                                        <Text style={styles.reportLocation}>📍 {report.field_location}</Text>
                                    )}
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    ))
                )}
            </View>

            <View style={{ height: 30 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { paddingTop: 60, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
    greeting: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
    userName: { fontSize: 22, fontWeight: '800', color: COLORS.white, marginTop: 2 },
    statsRow: { flexDirection: 'row', gap: SPACING.sm },
    statBubble: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center' },
    statNumber: { fontSize: 22, fontWeight: '800', color: COLORS.white },
    statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    section: { padding: SPACING.lg },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
    emptyCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: 'center', ...SHADOWS.small },
    emptyText: { fontSize: 15, color: COLORS.textMuted, marginTop: SPACING.sm },

    // Visit banner
    visitBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginHorizontal: SPACING.lg, marginTop: SPACING.md,
        borderLeftWidth: 4, borderLeftColor: COLORS.primary,
        ...SHADOWS.medium,
    },
    visitBannerIcon: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    },
    visitBannerTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
    visitBannerSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

    // Report cards
    reportCard: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md,
        marginBottom: SPACING.sm, ...SHADOWS.small,
    },
    reportLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
    reportTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
    reportSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
    reportLocation: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
});
