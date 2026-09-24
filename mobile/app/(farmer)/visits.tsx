import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
    Alert, RefreshControl, ActivityIndicator, Image, Modal, Dimensions,
    Animated, LayoutAnimation, Platform, UIManager, FlatList,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { reportService, fieldVisitService } from '../../services/api.service';
import { API_CONFIG } from '../../services/api.config';
import { useFadeIn, usePressScale } from '../../constants/animations';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const VISIT_STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
    Pending:   { color: '#FB8C00', icon: 'time-outline',              label: 'Pending' },
    Accepted:  { color: '#1E88E5', icon: 'checkmark-circle-outline',  label: 'Accepted' },
    Completed: { color: '#43A047', icon: 'checkmark-done-outline',    label: 'Completed' },
    Declined:  { color: '#E53935', icon: 'close-circle-outline',      label: 'Declined' },
};

// Generate quick date options for farmers (easy to pick)
function getQuickDates() {
    const dates = [];
    const today = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 1; i <= 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const label = i === 1 ? 'Tomorrow' : `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}`;
        const value = d.toISOString().split('T')[0]; // YYYY-MM-DD
        dates.push({ label, value, day: d.getDate(), month: monthNames[d.getMonth()] });
    }
    return dates;
}

export default function VisitsScreen() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [visits, setVisits] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [zoomImage, setZoomImage] = useState<string | null>(null);

    // Form state
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const [reason, setReason] = useState('');
    const [preferredDate, setPreferredDate] = useState('');
    const [proofImages, setProofImages] = useState<any[]>([]);
    const [showReportPicker, setShowReportPicker] = useState(false);

    const headerFade = useFadeIn(0, 500);
    const quickDates = getQuickDates();

    const getImageUrl = (path: string) => {
        const base = API_CONFIG.PHP_BASE_URL.replace('/app/api', '');
        return `${base}/${path}`;
    };

    const loadData = async () => {
        try {
            if (user?.user_id) {
                const [visitsData, reportsData] = await Promise.all([
                    fieldVisitService.getVisits({ farmer_id: user.user_id }),
                    reportService.getReports({ user_id: user.user_id }),
                ]);
                setVisits(Array.isArray(visitsData) ? visitsData : []);
                setReports(Array.isArray(reportsData) ? reportsData : []);
            }
        } catch (err) {
            console.log('Failed to load visits:', err);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, [user]));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('permissionNeeded'), t('galleryPermission'));
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            allowsMultipleSelection: true,
        });
        if (!result.canceled && result.assets) {
            setProofImages(prev => [...prev, ...result.assets.map(a => ({ uri: a.uri }))]);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('permissionNeeded'), t('cameraPermission'));
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            quality: 0.7,
        });
        if (!result.canceled && result.assets) {
            setProofImages(prev => [...prev, ...result.assets.map(a => ({ uri: a.uri }))]);
        }
    };

    const removeImage = (idx: number) => {
        setProofImages(prev => prev.filter((_, i) => i !== idx));
    };

    const resetForm = () => {
        setSelectedReport(null);
        setReason('');
        setPreferredDate('');
        setProofImages([]);
        setShowForm(false);
    };

    const submitRequest = async () => {
        if (!selectedReport) {
            Alert.alert(t('error'), t('selectReportForVisit'));
            return;
        }
        if (!reason.trim()) {
            Alert.alert(t('error'), t('visitReason'));
            return;
        }

        setLoading(true);
        try {
            const result = await fieldVisitService.createVisit(
                {
                    farmer_id: user?.user_id,
                    report_id: selectedReport.report_id,
                    reason: reason.trim(),
                    preferred_date: preferredDate || null,
                    farmer_notes: '',
                },
                proofImages
            );

            if (result.error) {
                Alert.alert(t('error'), result.error);
            } else {
                Alert.alert(t('requestSent'), t('requestSentMsg'));
                resetForm();
                loadData();
            }
        } catch (err) {
            Alert.alert(t('error'), t('failed'));
        } finally {
            setLoading(false);
        }
    };

    const pendingVisits = visits.filter(v => v.status === 'Pending');
    const activeVisits  = visits.filter(v => v.status === 'Accepted');
    const pastVisits    = visits.filter(v => v.status === 'Completed' || v.status === 'Declined');

    return (
        <View style={styles.container}>
            <Animated.View style={headerFade}>
                <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.header}>
                    <View style={styles.headerRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.headerTitle}>🏕️ {t('fieldVisits')}</Text>
                            <Text style={styles.headerSub}>
                                {visits.length} {t('totalReports').toLowerCase()}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.newRequestBtn}
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setShowForm(!showForm);
                            }}
                        >
                            <Ionicons name={showForm ? 'close' : 'add'} size={22} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>

                    {/* Quick Stats */}
                    <View style={styles.statsRow}>
                        <View style={styles.statBubble}>
                            <Text style={styles.statNumber}>{pendingVisits.length}</Text>
                            <Text style={styles.statLabel}>{t('pending')}</Text>
                        </View>
                        <View style={styles.statBubble}>
                            <Text style={styles.statNumber}>{activeVisits.length}</Text>
                            <Text style={styles.statLabel}>{t('visitAccepted')}</Text>
                        </View>
                        <View style={styles.statBubble}>
                            <Text style={styles.statNumber}>{pastVisits.length}</Text>
                            <Text style={styles.statLabel}>{t('done')}</Text>
                        </View>
                    </View>
                </LinearGradient>
            </Animated.View>

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                contentContainerStyle={styles.scrollContent}
            >
                {/* ── New Request Form ── */}
                {showForm && (
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>📝 {t('newRequest')}</Text>

                        {/* Report Picker */}
                        <Text style={styles.label}>{t('selectReportForVisit')} *</Text>
                        <TouchableOpacity
                            style={styles.pickerBtn}
                            onPress={() => setShowReportPicker(true)}
                        >
                            <Ionicons name="document-text-outline" size={18} color={selectedReport ? COLORS.primary : COLORS.textMuted} />
                            <Text style={[styles.pickerText, selectedReport && { color: COLORS.textPrimary }]}>
                                {selectedReport
                                    ? `Report #${selectedReport.report_id} — ${selectedReport.field_location || 'No location'}`
                                    : t('selectReportForVisit')
                                }
                            </Text>
                            <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
                        </TouchableOpacity>

                        {/* Reason */}
                        <Text style={styles.label}>{t('visitReason')} *</Text>
                        <TextInput
                            style={styles.textArea}
                            placeholder={t('reasonPlaceholder')}
                            placeholderTextColor={COLORS.textMuted}
                            value={reason}
                            onChangeText={setReason}
                            multiline
                            numberOfLines={3}
                        />

                        {/* Preferred Date - Easy tap buttons */}
                        <Text style={styles.label}>{t('preferredDate')}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                            <View style={styles.dateRow}>
                                {quickDates.map((d) => (
                                    <TouchableOpacity
                                        key={d.value}
                                        style={[styles.dateChip, preferredDate === d.value && styles.dateChipActive]}
                                        onPress={() => setPreferredDate(preferredDate === d.value ? '' : d.value)}
                                    >
                                        <Text style={[styles.dateChipDay, preferredDate === d.value && styles.dateChipTextActive]}>{d.day}</Text>
                                        <Text style={[styles.dateChipMonth, preferredDate === d.value && styles.dateChipTextActive]}>{d.month}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                        {preferredDate ? (
                            <Text style={styles.dateSelected}>✅ {quickDates.find(d => d.value === preferredDate)?.label || preferredDate}</Text>
                        ) : null}

                        {/* Photo Proof */}
                        <Text style={styles.label}>{t('additionalPhotos')}</Text>
                        <View style={styles.imageSection}>
                            {proofImages.length > 0 && (
                                <View style={styles.proofImagesGrid}>
                                    {proofImages.map((img, idx) => (
                                        <View key={idx} style={styles.proofImageWrap}>
                                            <Image source={{ uri: img.uri }} style={styles.proofImage} resizeMode="cover" />
                                            <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeImage(idx)}>
                                                <Ionicons name="close-circle" size={20} color={COLORS.danger} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                            <View style={styles.addPhotoRow}>
                                <TouchableOpacity style={styles.addPhotoBtn} onPress={takePhoto}>
                                    <Ionicons name="camera-outline" size={22} color={COLORS.primary} />
                                    <Text style={styles.addPhotoText}>{t('camera')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
                                    <Ionicons name="image-outline" size={22} color={COLORS.primary} />
                                    <Text style={styles.addPhotoText}>{t('gallery')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Submit */}
                        <TouchableOpacity style={styles.submitBtn} onPress={submitRequest} disabled={loading}>
                            <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.submitGrad}>
                                {loading ? (
                                    <ActivityIndicator color={COLORS.white} />
                                ) : (
                                    <>
                                        <Ionicons name="send-outline" size={18} color={COLORS.white} />
                                        <Text style={styles.submitText}>{t('submitRequest')}</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── Visit List ── */}
                {visits.length === 0 && !showForm ? (
                    <View style={styles.empty}>
                        <Ionicons name="walk-outline" size={52} color={COLORS.textMuted} />
                        <Text style={styles.emptyTitle}>{t('noVisitRequests')}</Text>
                        <Text style={styles.emptySubtext}>{t('noVisitRequestsSub')}</Text>
                        <TouchableOpacity
                            style={styles.emptyBtn}
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setShowForm(true);
                            }}
                        >
                            <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.emptyBtnGrad}>
                                <Ionicons name="add" size={18} color={COLORS.white} />
                                <Text style={styles.emptyBtnText}>{t('requestFieldVisit')}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                ) : (
                    visits.map((visit, index) => (
                        <VisitCard
                            key={visit.visit_id}
                            visit={visit}
                            index={index}
                            getImageUrl={getImageUrl}
                            onImagePress={setZoomImage}
                            t={t}
                        />
                    ))
                )}

                <View style={{ height: 30 }} />
            </ScrollView>

            {/* ── Report Picker Modal ── */}
            <Modal visible={showReportPicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('selectReportForVisit')}</Text>
                            <TouchableOpacity onPress={() => setShowReportPicker(false)}>
                                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={reports}
                            keyExtractor={(item) => item.report_id.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.reportPickerItem,
                                        selectedReport?.report_id === item.report_id && styles.reportPickerItemActive,
                                    ]}
                                    onPress={() => {
                                        setSelectedReport(item);
                                        setShowReportPicker(false);
                                    }}
                                >
                                    <View style={[styles.reportPickerDot, { backgroundColor: getStatusColor(item.status) }]} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.reportPickerTitle}>
                                            Report #{item.report_id}
                                        </Text>
                                        <Text style={styles.reportPickerSub}>
                                            {item.field_location || 'No location'} • {item.status}
                                        </Text>
                                        <Text style={styles.reportPickerDate}>
                                            {new Date(item.reported_at).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    {selectedReport?.report_id === item.report_id && (
                                        <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                                    )}
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={styles.empty}>
                                    <Text style={styles.emptySubtext}>{t('noReportsYet')}</Text>
                                </View>
                            }
                        />
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

// ── Visit Card Component ─────────────────────────────────
function VisitCard({ visit, index, getImageUrl, onImagePress, t }: any) {
    const { scale, onPressIn, onPressOut } = usePressScale(0.97);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1, duration: 350, delay: index * 60,
            useNativeDriver: true,
        }).start();
    }, []);

    const config = VISIT_STATUS_CONFIG[visit.status] || VISIT_STATUS_CONFIG.Pending;

    return (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale }] }}>
            <TouchableOpacity
                style={styles.visitCard}
                activeOpacity={1}
                onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setExpanded(!expanded);
                }}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
            >
                {/* Card Header */}
                <View style={styles.visitCardTop}>
                    <View style={[styles.statusDot, { backgroundColor: config.color }]} />
                    <Text style={styles.visitCardId}>Report #{visit.report_id}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: config.color + '15' }]}>
                        <Ionicons name={config.icon as any} size={12} color={config.color} />
                        <Text style={[styles.statusBadgeText, { color: config.color }]}>{config.label}</Text>
                    </View>
                </View>

                {/* Visit Reason */}
                {visit.reason && (
                    <View style={styles.visitInfoRow}>
                        <Ionicons name="chatbox-ellipses-outline" size={14} color={COLORS.textMuted} />
                        <Text style={styles.visitInfoText} numberOfLines={expanded ? undefined : 2}>{visit.reason}</Text>
                    </View>
                )}

                {/* Date Info */}
                <View style={styles.visitInfoRow}>
                    <Ionicons name="calendar-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.visitInfoText}>
                        {t('preferredDate')}: {visit.preferred_date ? new Date(visit.preferred_date).toLocaleDateString() : '—'}
                    </Text>
                </View>

                {/* Location */}
                {visit.field_location && (
                    <View style={styles.visitInfoRow}>
                        <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
                        <Text style={styles.visitInfoText}>{visit.field_location}</Text>
                    </View>
                )}

                {/* Expanded Details */}
                {expanded && (
                    <View style={styles.expandedSection}>
                        {/* Assigned Tech */}
                        {visit.tech_fname && (
                            <View style={styles.techAssigned}>
                                <Ionicons name="person-circle-outline" size={16} color={COLORS.info} />
                                <Text style={styles.techAssignedText}>
                                    {t('assignedTech')}: {visit.tech_fname} {visit.tech_lname}
                                </Text>
                            </View>
                        )}

                        {/* Tech Notes */}
                        {visit.tech_notes && (
                            <View style={styles.notesBlock}>
                                <Text style={styles.notesLabel}>📝 Tech Notes</Text>
                                <Text style={styles.notesText}>{visit.tech_notes}</Text>
                            </View>
                        )}

                        {/* Proof Images */}
                        {visit.images && visit.images.length > 0 && (
                            <View style={styles.visitImagesSection}>
                                <Text style={styles.notesLabel}>📸 {t('additionalPhotos')} ({visit.images.length})</Text>
                                <View style={styles.visitImagesRow}>
                                    {visit.images.map((img: string, idx: number) => (
                                        <TouchableOpacity key={idx} onPress={() => onImagePress(getImageUrl(img))}>
                                            <Image source={{ uri: getImageUrl(img) }} style={styles.visitThumb} resizeMode="cover" />
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

                {/* Expand hint */}
                <View style={styles.expandHint}>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} />
                </View>
            </TouchableOpacity>
        </Animated.View>
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

    // Header
    header: {
        paddingTop: 60, paddingBottom: SPACING.lg, paddingHorizontal: SPACING.lg,
        borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
    headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.white },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    newRequestBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center',
        ...SHADOWS.medium,
    },
    statsRow: { flexDirection: 'row', gap: SPACING.sm },
    statBubble: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center' },
    statNumber: { fontSize: 22, fontWeight: '800', color: COLORS.white },
    statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

    scrollContent: { padding: SPACING.lg },

    // Form
    formCard: {
        backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
        padding: SPACING.lg, marginBottom: SPACING.lg, ...SHADOWS.medium,
    },
    formTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
    label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: SPACING.sm },
    pickerBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: COLORS.background, borderRadius: RADIUS.md,
        padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
    },
    pickerText: { flex: 1, fontSize: 14, color: COLORS.textMuted },
    textArea: {
        backgroundColor: COLORS.background, borderRadius: RADIUS.md,
        padding: SPACING.md, fontSize: 14, color: COLORS.textPrimary,
        borderWidth: 1, borderColor: COLORS.border,
        minHeight: 80, textAlignVertical: 'top',
    },

    // Date picker chips
    dateScroll: { marginTop: 4 },
    dateRow: { flexDirection: 'row', gap: SPACING.sm, paddingVertical: 4 },
    dateChip: {
        width: 56, height: 64, borderRadius: RADIUS.md,
        backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
        alignItems: 'center', justifyContent: 'center',
    },
    dateChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    dateChipDay: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
    dateChipMonth: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, marginTop: 1 },
    dateChipTextActive: { color: COLORS.white },
    dateSelected: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 6 },

    imageSection: { marginTop: 4 },
    proofImagesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
    proofImageWrap: { position: 'relative' },
    proofImage: { width: 80, height: 80, borderRadius: RADIUS.md, backgroundColor: COLORS.border },
    removeImgBtn: { position: 'absolute', top: -6, right: -6 },
    addPhotoRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
    addPhotoBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 12, borderRadius: RADIUS.md,
        borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed',
    },
    addPhotoText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
    submitBtn: { marginTop: SPACING.lg, borderRadius: RADIUS.md, overflow: 'hidden' },
    submitGrad: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        height: 52,
    },
    submitText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

    // Visit cards
    visitCard: {
        backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.small,
    },
    visitCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    visitCardId: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full,
    },
    statusBadgeText: { fontSize: 11, fontWeight: '600' },
    visitInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 },
    visitInfoText: { fontSize: 12, color: COLORS.textMuted, flex: 1 },

    expandedSection: {
        marginTop: SPACING.md, borderTopWidth: 1,
        borderTopColor: COLORS.border, paddingTop: SPACING.md,
    },
    techAssigned: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#E3F2FD', borderRadius: RADIUS.md,
        padding: SPACING.sm, marginBottom: SPACING.sm,
    },
    techAssignedText: { fontSize: 13, fontWeight: '600', color: COLORS.info },
    notesBlock: { marginBottom: SPACING.sm },
    notesLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 },
    notesText: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 18 },
    visitImagesSection: { marginBottom: SPACING.sm },
    visitImagesRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
    visitThumb: { width: 65, height: 65, borderRadius: RADIUS.md, backgroundColor: COLORS.border },
    timestampText: { fontSize: 11, color: COLORS.textMuted, marginTop: SPACING.xs },
    expandHint: { alignItems: 'center', marginTop: SPACING.xs },

    // Empty state
    empty: { alignItems: 'center', marginTop: 60 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: COLORS.textSecondary, marginTop: SPACING.md },
    emptySubtext: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },
    emptyBtn: { borderRadius: RADIUS.md, overflow: 'hidden', marginTop: SPACING.lg },
    emptyBtnGrad: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 24, paddingVertical: 14,
    },
    emptyBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },

    // Report Picker Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
        maxHeight: '70%', padding: SPACING.lg,
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: SPACING.md, paddingBottom: SPACING.sm,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
    reportPickerItem: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        padding: SPACING.md, borderRadius: RADIUS.md,
        marginBottom: SPACING.xs, borderWidth: 1, borderColor: COLORS.border,
    },
    reportPickerItemActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFaded },
    reportPickerDot: { width: 8, height: 8, borderRadius: 4 },
    reportPickerTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
    reportPickerSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
    reportPickerDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },

    // Zoom
    zoomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    zoomClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
    zoomImage: { width: SCREEN_WIDTH - 20, height: SCREEN_WIDTH - 20 },
});
