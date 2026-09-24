import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
    Alert, RefreshControl, ActivityIndicator, Image, Modal, Dimensions,
    Animated, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { fieldVisitService } from '../../services/api.service';
import { API_CONFIG } from '../../services/api.config';
import { useFadeIn } from '../../constants/animations';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const VISIT_STATUS_CONFIG: Record<string, { color: string; icon: string }> = {
    Pending: { color: '#FB8C00', icon: 'time-outline' },
    Accepted: { color: '#1E88E5', icon: 'checkmark-circle-outline' },
    Completed: { color: '#43A047', icon: 'checkmark-done-outline' },
    Declined: { color: '#E53935', icon: 'close-circle-outline' },
};

// Quick date options for tech to set their own visit date
function getQuickDates() {
    const dates = [];
    const today = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 1; i <= 10; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const label = i === 1 ? 'Tomorrow' : `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}`;
        const value = d.toISOString().split('T')[0];
        dates.push({ label, value, day: d.getDate(), month: monthNames[d.getMonth()] });
    }
    return dates;
}

export default function TechVisitsScreen() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [visits, setVisits] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [updatingVisit, setUpdatingVisit] = useState<number | null>(null);
    const [filter, setFilter] = useState<string>('Pending');
    const [zoomImage, setZoomImage] = useState<string | null>(null);

    // Accept modal state
    const [showAcceptModal, setShowAcceptModal] = useState(false);
    const [acceptingVisit, setAcceptingVisit] = useState<any>(null);
    const [acceptDate, setAcceptDate] = useState('');
    const [acceptNotes, setAcceptNotes] = useState('');

    const headerFade = useFadeIn(0, 500);
    const quickDates = getQuickDates();

    const getImageUrl = (path: string) => {
        const base = API_CONFIG.PHP_BASE_URL.replace('/app/api', '');
        return `${base}/${path}`;
    };

    const loadData = async () => {
        try {
            const query: any = filter ? { status: filter } : {};
            // If checking anything except Pending, filter by the current tech's ID
            if (filter && filter !== 'Pending' && user?.user_id) {
                query.tech_id = user.user_id;
            }
            const data = await fieldVisitService.getVisits(query);
            setVisits(Array.isArray(data) ? data : []);
        } catch (err) {
            console.log('Failed to load visits:', err);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, [filter]));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const openAcceptModal = (visit: any) => {
        setAcceptingVisit(visit);
        setAcceptDate(visit.preferred_date || '');
        setAcceptNotes('');
        setShowAcceptModal(true);
    };

    const confirmAccept = async () => {
        if (!acceptingVisit) return;
        setUpdatingVisit(acceptingVisit.visit_id);
        try {
            const result = await fieldVisitService.updateVisit({
                visit_id: acceptingVisit.visit_id,
                status: 'Accepted',
                tech_id: (user as any)?.user_id,
                preferred_date: acceptDate || null,
                tech_notes: acceptNotes || null,
            });
            if (result.error) {
                Alert.alert(t('error'), result.error);
            } else {
                Alert.alert(t('success'), 'You have accepted this field visit request. You are now assigned.');
                setShowAcceptModal(false);
                loadData();
            }
        } catch (err) {
            Alert.alert(t('error'), t('failed'));
        } finally {
            setUpdatingVisit(null);
        }
    };

    const handleDecline = (visit: any) => {
        Alert.alert(
            t('declineVisit'),
            'Are you sure you want to decline this field visit request?',
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('declineVisit'), style: 'destructive',
                    onPress: async () => {
                        setUpdatingVisit(visit.visit_id);
                        try {
                            await fieldVisitService.updateVisit({
                                visit_id: visit.visit_id,
                                status: 'Declined',
                                tech_id: (user as any)?.user_id,
                                tech_notes: 'Declined by technologist',
                            });
                            loadData();
                        } catch (err) {
                            Alert.alert(t('error'), t('failed'));
                        } finally {
                            setUpdatingVisit(null);
                        }
                    },
                },
            ]
        );
    };

    const handleComplete = (visit: any) => {
        Alert.alert(
            t('completeVisit'),
            'Mark this field visit as completed?',
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('completeVisit'),
                    onPress: async () => {
                        setUpdatingVisit(visit.visit_id);
                        try {
                            await fieldVisitService.updateVisit({
                                visit_id: visit.visit_id,
                                status: 'Completed',
                                tech_id: (user as any)?.user_id,
                                tech_notes: 'Field visit completed',
                            });
                            loadData();
                        } catch (err) {
                            Alert.alert(t('error'), t('failed'));
                        } finally {
                            setUpdatingVisit(null);
                        }
                    },
                },
            ]
        );
    };

    const allCount = visits.length;
    const filters = [
        { key: 'Pending', label: t('visitPending'), color: '#FB8C00' },
        { key: 'Accepted', label: t('visitAccepted'), color: '#1E88E5' },
        { key: 'Completed', label: t('visitCompleted'), color: '#43A047' },
        { key: 'Declined', label: t('visitDeclined'), color: '#E53935' },
    ];

    return (
        <View style={styles.container}>
            <Animated.View style={headerFade}>
                <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.header}>
                    <Text style={styles.headerTitle}>🏕️ {t('fieldVisitRequests')}</Text>
                    <Text style={styles.headerSub}>{allCount} request(s)</Text>
                </LinearGradient>
            </Animated.View>

            {/* Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
                {filters.map((f) => (
                    <TouchableOpacity
                        key={f.key}
                        style={[styles.filterChip, filter === f.key && { backgroundColor: f.color, borderColor: f.color }]}
                        onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setFilter(filter === f.key ? '' : f.key);
                        }}
                    >
                        <Text style={[styles.filterChipText, filter === f.key && { color: COLORS.white }]}>{f.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                contentContainerStyle={styles.scrollContent}
            >
                {visits.length === 0 ? (
                    <View style={styles.empty}>
                        <Ionicons name="walk-outline" size={52} color={COLORS.textMuted} />
                        <Text style={styles.emptyTitle}>{t('noVisitRequests')}</Text>
                    </View>
                ) : (
                    visits.map((visit, index) => (
                        <TechVisitCard
                            key={visit.visit_id}
                            visit={visit}
                            index={index}
                            getImageUrl={getImageUrl}
                            onImagePress={setZoomImage}
                            onAccept={() => openAcceptModal(visit)}
                            onDecline={() => handleDecline(visit)}
                            onComplete={() => handleComplete(visit)}
                            updatingVisit={updatingVisit}
                            t={t}
                        />
                    ))
                )}
                <View style={{ height: 30 }} />
            </ScrollView>

            {/* ── Accept Confirmation Modal ── */}
            <Modal visible={showAcceptModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>✅ {t('acceptVisit')}</Text>
                            <TouchableOpacity onPress={() => setShowAcceptModal(false)}>
                                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.confirmText}>
                            Are you sure you want to accept this field visit request?
                            You will be assigned as the technologist for Report #{acceptingVisit?.report_id}.
                        </Text>

                        {/* Farmer Info */}
                        {acceptingVisit && (
                            <View style={styles.farmerInfoBox}>
                                <Ionicons name="person-outline" size={16} color={COLORS.primary} />
                                <Text style={styles.farmerInfoText}>
                                    👨‍🌾 {acceptingVisit.farmer_fname} {acceptingVisit.farmer_lname}
                                    {acceptingVisit.farmer_contact ? ` • ${acceptingVisit.farmer_contact}` : ''}
                                </Text>
                            </View>
                        )}

                        {/* Change visit date */}
                        <Text style={styles.modalLabel}>📅 {t('preferredDate')} (you can change)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.dateRow}>
                                {quickDates.map((d) => (
                                    <TouchableOpacity
                                        key={d.value}
                                        style={[styles.dateChip, acceptDate === d.value && styles.dateChipActive]}
                                        onPress={() => setAcceptDate(acceptDate === d.value ? '' : d.value)}
                                    >
                                        <Text style={[styles.dateChipDay, acceptDate === d.value && styles.dateChipTextActive]}>{d.day}</Text>
                                        <Text style={[styles.dateChipMonth, acceptDate === d.value && styles.dateChipTextActive]}>{d.month}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        {/* Tech Notes */}
                        <Text style={styles.modalLabel}>📝 Notes (optional)</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Add any notes for the farmer..."
                            placeholderTextColor={COLORS.textMuted}
                            value={acceptNotes}
                            onChangeText={setAcceptNotes}
                            multiline
                        />

                        {/* Confirm Buttons */}
                        <View style={styles.modalBtnRow}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAcceptModal(false)}>
                                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalAcceptBtn} onPress={confirmAccept} disabled={updatingVisit !== null}>
                                <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.modalAcceptGrad}>
                                    {updatingVisit ? (
                                        <ActivityIndicator size="small" color={COLORS.white} />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-outline" size={18} color={COLORS.white} />
                                            <Text style={styles.modalAcceptText}>{t('acceptVisit')}</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Full-Screen Image Zoom ── */}
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

// ── Tech Visit Card ──────────────────────────────────────
function TechVisitCard({ visit, index, getImageUrl, onImagePress, onAccept, onDecline, onComplete, updatingVisit, t }: any) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [expanded, setExpanded] = useState(false);
    const config = VISIT_STATUS_CONFIG[visit.status] || VISIT_STATUS_CONFIG.Pending;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1, duration: 350, delay: index * 60,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View style={{ opacity: fadeAnim }}>
            <TouchableOpacity
                style={[styles.visitCard, { borderLeftColor: config.color }]}
                activeOpacity={0.9}
                onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setExpanded(!expanded);
                }}
            >
                {/* Header */}
                <View style={styles.visitCardTop}>
                    <View style={[styles.statusDot, { backgroundColor: config.color }]} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.visitCardTitle}>Report #{visit.report_id}</Text>
                        <Text style={styles.visitCardFarmer}>
                            👨‍🌾 {visit.farmer_fname} {visit.farmer_lname}
                            {visit.farmer_contact ? ` • ${visit.farmer_contact}` : ''}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: config.color + '15' }]}>
                        <Ionicons name={config.icon as any} size={12} color={config.color} />
                        <Text style={[styles.statusBadgeText, { color: config.color }]}>{visit.status}</Text>
                    </View>
                </View>

                {/* Reason */}
                {visit.reason && (
                    <View style={styles.reasonBlock}>
                        <Ionicons name="chatbox-ellipses-outline" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.reasonText} numberOfLines={expanded ? undefined : 2}>{visit.reason}</Text>
                    </View>
                )}

                {/* Meta row */}
                <View style={styles.metaRow}>
                    {visit.field_location && (
                        <View style={styles.metaItem}>
                            <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
                            <Text style={styles.metaText}>{visit.field_location}</Text>
                        </View>
                    )}
                    {visit.preferred_date && (
                        <View style={styles.metaItem}>
                            <Ionicons name="calendar-outline" size={12} color={COLORS.textMuted} />
                            <Text style={styles.metaText}>{new Date(visit.preferred_date).toLocaleDateString()}</Text>
                        </View>
                    )}
                    {visit.image_count > 0 && (
                        <View style={styles.metaItem}>
                            <Ionicons name="camera-outline" size={12} color={COLORS.textMuted} />
                            <Text style={styles.metaText}>{visit.image_count} photo(s)</Text>
                        </View>
                    )}
                </View>

                {/* Expanded: show photos, notes, timestamps */}
                {expanded && (
                    <View style={styles.expandedSection}>
                        {/* Report description */}
                        {visit.report_description && (
                            <View style={styles.detailBlock}>
                                <Text style={styles.detailLabel}>📋 Report Description</Text>
                                <Text style={styles.detailText}>{visit.report_description}</Text>
                            </View>
                        )}

                        {/* Proof Photos - viewable by tech */}
                        {visit.images && visit.images.length > 0 && (
                            <View style={styles.detailBlock}>
                                <Text style={styles.detailLabel}>📸 Proof Photos ({visit.images.length})</Text>
                                <View style={styles.imagesRow}>
                                    {visit.images.map((img: string, idx: number) => (
                                        <TouchableOpacity key={idx} onPress={() => onImagePress(getImageUrl(img))}>
                                            <Image source={{ uri: getImageUrl(img) }} style={styles.thumbImg} resizeMode="cover" />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Timestamps */}
                        <Text style={styles.timestampText}>
                            Requested: {new Date(visit.created_at).toLocaleString()}
                        </Text>
                    </View>
                )}

                {/* Action Buttons */}
                {visit.status === 'Pending' && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={styles.declineBtn}
                            onPress={onDecline}
                            disabled={updatingVisit === visit.visit_id}
                        >
                            {updatingVisit === visit.visit_id ? (
                                <ActivityIndicator size="small" color={COLORS.danger} />
                            ) : (
                                <>
                                    <Ionicons name="close-outline" size={16} color={COLORS.danger} />
                                    <Text style={styles.declineBtnText}>{t('declineVisit')}</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.acceptBtn}
                            onPress={onAccept}
                            disabled={updatingVisit === visit.visit_id}
                        >
                            <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.acceptBtnGrad}>
                                {updatingVisit === visit.visit_id ? (
                                    <ActivityIndicator size="small" color={COLORS.white} />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-outline" size={16} color={COLORS.white} />
                                        <Text style={styles.acceptBtnText}>{t('acceptVisit')}</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}

                {visit.status === 'Accepted' && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.acceptBtn, { flex: 1 }]}
                            onPress={onComplete}
                            disabled={updatingVisit === visit.visit_id}
                        >
                            <LinearGradient colors={['#1565C0', '#1E88E5']} style={styles.acceptBtnGrad}>
                                <Ionicons name="checkmark-done-outline" size={16} color={COLORS.white} />
                                <Text style={styles.acceptBtnText}>{t('completeVisit')}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Expand hint */}
                <View style={styles.expandHint}>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        paddingTop: 60, paddingBottom: SPACING.lg, paddingHorizontal: SPACING.lg,
        borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl,
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.white },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

    filterScroll: { maxHeight: 50, marginTop: SPACING.sm },
    filterRow: { paddingHorizontal: SPACING.lg, gap: SPACING.sm, flexDirection: 'row' },
    filterChip: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full,
        borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white,
    },
    filterChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },

    scrollContent: { padding: SPACING.lg },

    // Visit cards
    visitCard: {
        backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginBottom: SPACING.sm,
        borderLeftWidth: 3, ...SHADOWS.small,
    },
    visitCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
    statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
    visitCardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
    visitCardFarmer: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full,
    },
    statusBadgeText: { fontSize: 11, fontWeight: '600' },

    reasonBlock: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 6,
        backgroundColor: '#E8F5E9', borderRadius: RADIUS.md,
        padding: SPACING.sm, marginBottom: SPACING.sm,
    },
    reasonText: { flex: 1, fontSize: 13, color: COLORS.primaryDark, lineHeight: 18 },

    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: SPACING.xs },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 11, color: COLORS.textMuted },

    expandedSection: {
        marginTop: SPACING.md, borderTopWidth: 1,
        borderTopColor: COLORS.border, paddingTop: SPACING.md,
    },
    detailBlock: { marginBottom: SPACING.md },
    detailLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6 },
    detailText: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 18 },
    imagesRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
    thumbImg: { width: 75, height: 75, borderRadius: RADIUS.md, backgroundColor: COLORS.border },
    timestampText: { fontSize: 11, color: COLORS.textMuted },
    expandHint: { alignItems: 'center', marginTop: SPACING.xs },

    actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
    declineBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        paddingVertical: 10, borderRadius: RADIUS.md,
        borderWidth: 1.5, borderColor: COLORS.danger,
    },
    declineBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.danger },
    acceptBtn: { flex: 1, borderRadius: RADIUS.md, overflow: 'hidden' },
    acceptBtnGrad: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        paddingVertical: 10,
    },
    acceptBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.white },

    // Empty
    empty: { alignItems: 'center', marginTop: 60 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: COLORS.textSecondary, marginTop: SPACING.md },

    // Accept Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
        padding: SPACING.lg, maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: SPACING.md, paddingBottom: SPACING.sm,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    confirmText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.md },
    farmerInfoBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: COLORS.primaryFaded, borderRadius: RADIUS.md,
        padding: SPACING.md, marginBottom: SPACING.md,
    },
    farmerInfoText: { fontSize: 13, fontWeight: '600', color: COLORS.primaryDark },
    modalLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, marginTop: SPACING.sm },

    dateRow: { flexDirection: 'row', gap: SPACING.sm, paddingBottom: 8 },
    dateChip: {
        width: 52, height: 60, borderRadius: RADIUS.md,
        backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
        alignItems: 'center', justifyContent: 'center',
    },
    dateChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    dateChipDay: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
    dateChipMonth: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, marginTop: 1 },
    dateChipTextActive: { color: COLORS.white },

    modalInput: {
        backgroundColor: COLORS.background, borderRadius: RADIUS.md,
        padding: SPACING.md, fontSize: 14, color: COLORS.textPrimary,
        borderWidth: 1, borderColor: COLORS.border,
        minHeight: 60, textAlignVertical: 'top',
    },
    modalBtnRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
    modalCancelBtn: {
        flex: 1, paddingVertical: 14, borderRadius: RADIUS.md,
        borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center',
    },
    modalCancelText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
    modalAcceptBtn: { flex: 1, borderRadius: RADIUS.md, overflow: 'hidden' },
    modalAcceptGrad: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 14,
    },
    modalAcceptText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

    // Zoom
    zoomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    zoomClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
    zoomImage: { width: SCREEN_WIDTH - 20, height: SCREEN_WIDTH - 20 },
});
