import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
    Image, Modal, Dimensions, ActivityIndicator, Animated, LayoutAnimation,
    Platform, UIManager, Linking,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS, STATUS_CONFIG } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { reportService, verificationService, treatmentService } from '../../services/api.service';
import { API_CONFIG } from '../../services/api.config';
import { useFadeIn, usePressScale } from '../../constants/animations';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Animated Filter Pill ────────────────────────────────
function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    const { scale, onPressIn, onPressOut } = usePressScale(0.9);
    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <TouchableOpacity
                style={[styles.filterBtn, active && styles.filterBtnActive]}
                onPress={onPress}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                activeOpacity={1}
            >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function ReportsScreen() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [reports, setReports] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('All');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [details, setDetails] = useState<any>({});
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [zoomImage, setZoomImage] = useState<string | null>(null);

    const headerFade = useFadeIn(0, 500);

    const getImageUrl = (path: string) => {
        const base = API_CONFIG.PHP_BASE_URL.replace('/app/api', '');
        return `${base}/${path}`;
    };

    const loadReports = async () => {
        try {
            if ((user as any)?.user_id) {
                const data = await reportService.getReports({ user_id: (user as any).user_id });
                setReports(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.log('Failed to load reports:', err);
        }
    };

    useFocusEffect(useCallback(() => { loadReports(); }, [user]));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadReports();
        setRefreshing(false);
    };

    const handleFilter = (f: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setFilter(f);
    };

    const toggleExpand = async (report: any) => {
        const id = report.report_id;

        // Smooth expand/collapse with LayoutAnimation
        LayoutAnimation.configureNext({
            duration: 300,
            update: { type: LayoutAnimation.Types.easeInEaseOut },
            create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
            delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        });

        if (expandedId === id) { setExpandedId(null); return; }
        setExpandedId(id);

        if (!details[id]) {
            setLoadingDetail(true);
            try {
                const [vData, rData] = await Promise.all([
                    verificationService.getVerifications(id),
                    treatmentService.getRecommendations(id),
                ]);
                setDetails((prev: any) => ({
                    ...prev,
                    [id]: {
                        verifications: Array.isArray(vData) ? vData : [],
                        recommendations: Array.isArray(rData) ? rData : [],
                    },
                }));
            } catch (err) {
                console.log('Failed to load details:', err);
            } finally {
                setLoadingDetail(false);
            }
        }
    };

    const filteredReports = filter === 'All' ? reports : reports.filter((r) => r.status === filter);

    const renderReport = ({ item, index }: { item: any; index: number }) => {
        const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.Pending;
        const isExpanded = expandedId === item.report_id;
        const detail = details[item.report_id];

        return (
            <ReportCard
                item={item}
                config={config}
                isExpanded={isExpanded}
                detail={detail}
                loadingDetail={loadingDetail && expandedId === item.report_id}
                onToggle={() => toggleExpand(item)}
                onImagePress={setZoomImage}
                getImageUrl={getImageUrl}
                index={index}
                t={t}
            />
        );
    };

    return (
        <View style={styles.container}>
            <Animated.View style={headerFade}>
                <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.header}>
                    <Text style={styles.headerTitle}>📋 {t('myReports')}</Text>
                    <Text style={styles.headerSub}>
                        {reports.length} {t('totalReports').toLowerCase()}
                    </Text>
                </LinearGradient>
            </Animated.View>

            {/* Animated Filters */}
            <View style={styles.filterRow}>
                {['All', 'Pending', 'Verified', 'Treated'].map((f) => (
                    <FilterPill key={f} label={f} active={filter === f} onPress={() => handleFilter(f)} />
                ))}
            </View>

            <FlatList
                data={filteredReports}
                keyExtractor={(item) => item.report_id.toString()}
                renderItem={renderReport}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="document-text-outline" size={48} color={COLORS.textMuted} />
                        <Text style={styles.emptyText}>{t('noReportsYet')}</Text>
                    </View>
                }
            />

            {/* Full-Screen Image Zoom */}
            <Modal visible={!!zoomImage} transparent animationType="fade">
                <View style={styles.zoomOverlay}>
                    <TouchableOpacity style={styles.zoomClose} onPress={() => setZoomImage(null)}>
                        <Ionicons name="close-circle" size={36} color={COLORS.white} />
                    </TouchableOpacity>
                    {zoomImage && <Image source={{ uri: zoomImage }} style={styles.zoomImage} resizeMode="contain" />}
                </View>
            </Modal>
        </View>
    );
}

// ── Report Card with animations ─────────────────────────
function ReportCard({ item, config, isExpanded, detail, loadingDetail, onToggle, onImagePress, getImageUrl, index, t }: any) {
    const { scale, onPressIn, onPressOut } = usePressScale(0.97);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const chevronRotation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1, duration: 350, delay: index * 60,
            useNativeDriver: true,
        }).start();
    }, []);

    useEffect(() => {
        Animated.timing(chevronRotation, {
            toValue: isExpanded ? 1 : 0, duration: 250,
            useNativeDriver: true,
        }).start();
    }, [isExpanded]);

    const rotate = chevronRotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    return (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale }] }}>
            <TouchableOpacity
                style={styles.reportCard}
                activeOpacity={1}
                onPress={onToggle}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
            >
                <View style={styles.cardTop}>
                    <View style={[styles.statusDot, { backgroundColor: config.color }]} />
                    <Text style={styles.reportId}>Report #{item.report_id}</Text>
                    <View style={[styles.badge, { backgroundColor: config.color + '15' }]}>
                        <Ionicons name={config.icon} size={12} color={config.color} />
                        <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
                    </View>
                </View>

                {item.field_location && (
                    <View style={styles.infoRow}>
                        <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
                        <Text style={styles.infoText} numberOfLines={1}>{item.field_location}</Text>
                    </View>
                )}

                <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.infoText}>{new Date(item.reported_at).toLocaleDateString()}</Text>
                    <Ionicons name="camera-outline" size={14} color={COLORS.textMuted} style={{ marginLeft: 16 }} />
                    <Text style={styles.infoText}>{item.image_count || 0} photo(s)</Text>
                </View>

                {/* Expanded Details with smooth transition */}
                {isExpanded && (
                    <View style={styles.expandedSection}>
                        {item.images && item.images.length > 0 && (
                            <View style={styles.imageRow}>
                                {item.images.map((img: string, idx: number) => (
                                    <TouchableOpacity key={idx} onPress={() => onImagePress(getImageUrl(img))}>
                                        <Image source={{ uri: getImageUrl(img) }} style={styles.imageThumbnail} resizeMode="cover" />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* ── Direct GPS Link (Replaces Crashing MapView) ── */}
                        {item.latitude && item.longitude && (
                            <View style={styles.mapActionContainer}>
                                <TouchableOpacity
                                    style={styles.mapFullBtn}
                                    onPress={() => {
                                        const url = `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`;
                                        Linking.openURL(url);
                                    }}
                                >
                                    <View style={styles.mapActionBtnLarge}>
                                        <Ionicons name="navigate-circle" size={24} color={COLORS.white} />
                                        <View>
                                            <Text style={styles.mapActionTextLarge}>View Location on Maps</Text>
                                            <Text style={styles.mapActionSubText}>{item.latitude}, {item.longitude}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        )}

                        {loadingDetail ? (
                            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: SPACING.md }} />
                        ) : detail ? (
                            <>
                                {detail.verifications.length > 0 && (
                                    <View style={styles.detailBlock}>
                                        <Text style={styles.detailLabel}>✅ {t('verification')}</Text>
                                        {detail.verifications.map((v: any, i: number) => (
                                            <View key={i} style={styles.detailItem}>
                                                <Text style={styles.detailText}>
                                                    <Text style={styles.bold}>{v.disease_name}</Text> — verified by {v.fname} {v.lname}
                                                </Text>
                                                <Text style={styles.detailMeta}>
                                                    {v.verification_method} • {new Date(v.verified_at).toLocaleDateString()}
                                                </Text>
                                                {v.notes ? <Text style={styles.detailNotes}>📝 {v.notes}</Text> : null}
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {detail.recommendations.length > 0 && (
                                    <View style={styles.detailBlock}>
                                        <Text style={styles.detailLabel}>💊 {t('treatments')}</Text>
                                        {detail.recommendations.map((r: any, i: number) => (
                                            <View key={i} style={styles.treatmentItem}>
                                                <Text style={styles.treatmentName}>{r.pesticide_name || r.treatment_type || 'Manual Recommendation'}</Text>
                                                <Text style={styles.detailMeta}>{r.treatment_type || 'General Guidance'} • By {r.fname} {r.lname}</Text>
                                                {r.dosage && <Text style={styles.treatmentInfo}>💊 Dosage: {r.dosage}</Text>}
                                                {r.application_method && <Text style={styles.treatmentInfo}>🔧 Method: {r.application_method}</Text>}
                                                {r.estimated_cost > 0 && <Text style={styles.treatmentInfo}>💰 Est. Cost: ₱{parseFloat(r.estimated_cost).toLocaleString()}/ha</Text>}
                                                {r.additional_notes ? <Text style={styles.detailNotes}>📝 {r.additional_notes}</Text> : null}
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {detail.verifications.length === 0 && detail.recommendations.length === 0 && (
                                    <Text style={styles.pendingNote}>⏳ {t('awaitingReview')}</Text>
                                )}
                            </>
                        ) : null}
                    </View>
                )}

                {/* Animated Chevron */}
                <View style={styles.expandHint}>
                    <Animated.View style={{ transform: [{ rotate }] }}>
                        <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
                    </Animated.View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { paddingTop: 60, paddingBottom: SPACING.lg, paddingHorizontal: SPACING.lg, borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl },
    headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.white },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    filterRow: { flexDirection: 'row', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: SPACING.sm },
    filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
    filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    filterText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
    filterTextActive: { color: COLORS.white },
    list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
    reportCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.small },
    cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    reportId: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
    badgeText: { fontSize: 11, fontWeight: '600' },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    infoText: { fontSize: 12, color: COLORS.textMuted },

    mapActionContainer: { marginBottom: SPACING.md, borderRadius: RADIUS.md, overflow: 'hidden', ...SHADOWS.small },
    mapFullBtn: { backgroundColor: COLORS.primary, padding: SPACING.md },
    mapActionBtnLarge: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    mapActionTextLarge: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
    mapActionSubText: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },

    expandHint: { alignItems: 'center', marginTop: SPACING.sm },

    // Expanded details
    expandedSection: { marginTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.md },
    imageRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
    imageThumbnail: { width: 70, height: 70, borderRadius: RADIUS.md, backgroundColor: COLORS.border },
    detailBlock: { marginBottom: SPACING.md },
    detailLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
    detailItem: { backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: 4 },
    detailText: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 18 },
    bold: { fontWeight: '700' },
    detailMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
    detailNotes: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, fontStyle: 'italic' },
    treatmentItem: { backgroundColor: '#E8F5E9', borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: 4 },
    treatmentName: { fontSize: 13, fontWeight: '700', color: '#2E7D32' },
    treatmentInfo: { fontSize: 11, color: '#4CAF50', marginTop: 2 },
    pendingNote: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.sm },

    // Zoom
    zoomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    zoomClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
    zoomImage: { width: SCREEN_WIDTH - 20, height: SCREEN_WIDTH - 20 },

    empty: { alignItems: 'center', marginTop: 60 },
    emptyText: { fontSize: 16, color: COLORS.textMuted, marginTop: SPACING.md },
});
