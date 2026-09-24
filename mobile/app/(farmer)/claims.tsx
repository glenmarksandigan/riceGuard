import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
    Modal, TextInput, ScrollView, Alert, ActivityIndicator, Animated, Image,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, RADIUS, SHADOWS, STATUS_CONFIG } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { claimService, reportService } from '../../services/api.service';
import { useFadeIn, usePressScale } from '../../constants/animations';

const DAMAGE_TYPES = [
    'Bacterial Leaf Blight', 'Rice Blast', 'Brown Spot', 'Sheath Blight',
    'Tungro', 'Rice Grassy Stunt', 'Leaf Scald', 'Narrow Brown Spot', 'Other',
];

const IMAGE_TYPES = ['Field Damage', 'Affected Area', 'Supporting Document', 'Other'];
const MAX_PROOF_IMAGES = 5;

const CLAIM_STATUS_STYLES: Record<string, { bg: string; color: string; icon: string }> = {
    Pending: { bg: '#FFF3E0', color: '#E65100', icon: 'time-outline' },
    Verified: { bg: '#E3F2FD', color: '#1565C0', icon: 'checkmark-circle-outline' },
    Paid: { bg: '#F3E5F5', color: '#7B1FA2', icon: 'cash-outline' },
    Rejected: { bg: '#FFEBEE', color: '#C62828', icon: 'close-circle-outline' },
};

// ── Animated Claim Card ─────────────────────────────────
function ClaimCard({ item, st, index }: { item: any; st: any; index: number }) {
    const { scale, onPressIn, onPressOut } = usePressScale(0.97);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(16)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: index * 70, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 350, delay: index * 70, useNativeDriver: true }),
        ]).start();
    }, []);

    const proofCount = item.proof_images?.length || 0;

    return (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale }] }}>
            <TouchableOpacity
                style={styles.claimCard}
                activeOpacity={1}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
            >
                <View style={styles.claimHeader}>
                    <View style={styles.claimIdRow}>
                        <Ionicons name="shield-checkmark" size={18} color={COLORS.primary} />
                        <Text style={styles.claimId}>Claim #{item.claim_id}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                        <Ionicons name={st.icon as any} size={12} color={st.color} />
                        <Text style={[styles.statusText, { color: st.color }]}>{item.status}</Text>
                    </View>
                </View>

                <View style={styles.claimDetail}>
                    <Ionicons name="document-text-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.detailText}>Report #{item.report_id}</Text>
                </View>
                <View style={styles.claimDetail}>
                    <Ionicons name="bug-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.detailText}>{item.damage_type}</Text>
                </View>
                {item.field_location && (
                    <View style={styles.claimDetail}>
                        <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
                        <Text style={styles.detailText} numberOfLines={1}>{item.field_location}</Text>
                    </View>
                )}
                <View style={styles.claimFooter}>
                    <Text style={styles.dateText}>
                        {new Date(item.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                        })}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {proofCount > 0 && (
                            <View style={styles.proofCountBadge}>
                                <Ionicons name="camera" size={11} color={COLORS.info} />
                                <Text style={styles.proofCountText}>{proofCount} proof</Text>
                            </View>
                        )}
                        {item.rsbsa_num ? <Text style={styles.rsbsaTag}>RSBSA: {item.rsbsa_num}</Text> : null}
                    </View>
                </View>
                {item.status === 'Rejected' && item.rejection_reason ? (
                    <View style={styles.rejectionBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                            <Ionicons name="close-circle" size={14} color="#C62828" />
                            <Text style={styles.rejectionTitle}>Rejection Reason</Text>
                        </View>
                        <Text style={styles.rejectionText}>{item.rejection_reason}</Text>
                    </View>
                ) : null}
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function ClaimsScreen() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [claims, setClaims] = useState<any[]>([]);
    const [verifiedReports, setVerifiedReports] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form state
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const [showReportPicker, setShowReportPicker] = useState(false);
    const [damageType, setDamageType] = useState('');
    const [showDamagePicker, setShowDamagePicker] = useState(false);
    const [rsbsaNum, setRsbsaNum] = useState('');
    const [policyNum, setPolicyNum] = useState('');
    const [proofImages, setProofImages] = useState<{ uri: string; type: string }[]>([]);
    const [showImageTypePicker, setShowImageTypePicker] = useState<number | null>(null);

    // Animations
    const headerFade = useFadeIn(0, 500);
    const { scale: fileBtnScale, onPressIn: fileBtnIn, onPressOut: fileBtnOut } = usePressScale(0.96);

    const loadData = async () => {
        if (!user?.user_id) return;
        // Fetch independently so one failure doesn't block the other
        try {
            const claimsData = await claimService.getClaims({ user_id: user.user_id });
            setClaims(Array.isArray(claimsData) ? claimsData : []);
        } catch (err) {
            console.log('Failed to load claims:', err);
        }
        try {
            const reportsData = await reportService.getReports({ user_id: user.user_id, status: 'Verified' });
            setVerifiedReports(Array.isArray(reportsData) ? reportsData : []);
        } catch (err) {
            console.log('Failed to load verified reports:', err);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, [user]));

    const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

    const resetForm = () => {
        setSelectedReport(null);
        setDamageType('');
        setRsbsaNum('');
        setPolicyNum('');
        setProofImages([]);
    };

    // ── Image Picker ─────────────────────────────────
    const pickFromGallery = async () => {
        if (proofImages.length >= MAX_PROOF_IMAGES) {
            Alert.alert(t('error'), `Maximum ${MAX_PROOF_IMAGES} photos allowed`);
            return;
        }
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(t('error'), 'Gallery permission is required.');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.6,
                allowsEditing: false, // Avoid cropping crashes
            });
            if (!result.canceled && result.assets?.[0]) {
                const newImg = { uri: result.assets[0].uri, type: 'Other' };
                setProofImages(prev => [...prev, newImg].slice(0, MAX_PROOF_IMAGES));
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to open gallery');
            console.log(err);
        }
    };

    const takePhoto = async () => {
        if (proofImages.length >= MAX_PROOF_IMAGES) {
            Alert.alert(t('error'), `Maximum ${MAX_PROOF_IMAGES} photos allowed`);
            return;
        }
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(t('error'), 'Camera permission is required.');
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.6,
                allowsEditing: false,
            });
            if (!result.canceled && result.assets?.[0]) {
                setProofImages(prev => [...prev, { uri: result.assets[0].uri, type: 'Other' }]);
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to open camera');
            console.log(err);
        }
    };

    const removeImage = (index: number) => {
        setProofImages(prev => prev.filter((_, i) => i !== index));
    };

    const updateImageType = (index: number, type: string) => {
        setProofImages(prev => prev.map((img, i) => i === index ? { ...img, type } : img));
        setShowImageTypePicker(null);
    };

    const handleSubmit = async () => {
        if (!selectedReport) { Alert.alert(t('error'), t('selectReportError')); return; }
        if (!damageType) { Alert.alert(t('error'), t('selectDamageError')); return; }

        setLoading(true);
        try {
            const result = await claimService.createClaim({
                user_id: user!.user_id,
                report_id: selectedReport.report_id,
                damage_type: damageType,
                rsbsa_num: rsbsaNum,
                policy_num: policyNum,
            }, proofImages);
            if (result.error) { Alert.alert(t('failed'), result.error); }
            else { Alert.alert(t('success'), t('claimSuccess')); resetForm(); setShowForm(false); await loadData(); }
        } catch (err) {
            Alert.alert(t('error'), t('serverError'));
        } finally {
            setLoading(false);
        }
    };

    const renderClaim = ({ item, index }: { item: any; index: number }) => {
        const st = CLAIM_STATUS_STYLES[item.status] || CLAIM_STATUS_STYLES.Pending;
        return <ClaimCard item={item} st={st} index={index} />;
    };

    return (
        <View style={styles.container}>
            {/* Animated Header */}
            <Animated.View style={headerFade}>
                <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.header}>
                    <Text style={styles.headerTitle}>🛡️ {t('claims')}</Text>
                    <Text style={styles.headerSub}>
                        {claims.length} {t('claimsFiled')}
                    </Text>
                </LinearGradient>
            </Animated.View>

            {/* File a Claim with press scale */}
            <View style={styles.actionRow}>
                <Animated.View style={{ transform: [{ scale: fileBtnScale }] }}>
                    <TouchableOpacity
                        style={styles.fileClaimBtn}
                        onPress={() => { resetForm(); setShowForm(true); }}
                        onPressIn={fileBtnIn}
                        onPressOut={fileBtnOut}
                        activeOpacity={1}
                    >
                        <LinearGradient
                            colors={[COLORS.primary, COLORS.primaryLight]}
                            style={styles.fileClaimGradient}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        >
                            <Ionicons name="add-circle-outline" size={20} color={COLORS.white} />
                            <Text style={styles.fileClaimText}>{t('fileClaim')}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>
            </View>

            {/* Claims List */}
            <FlatList
                data={claims}
                keyExtractor={(item) => item.claim_id.toString()}
                renderItem={renderClaim}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <View style={styles.emptyIcon}>
                            <Ionicons name="shield-outline" size={48} color={COLORS.textMuted} />
                        </View>
                        <Text style={styles.emptyTitle}>{t('noClaimsYet')}</Text>
                        <Text style={styles.emptyText}>{t('noClaimsSub')}</Text>
                    </View>
                }
            />

            {/* ── File a Claim Modal ─────────────────────────── */}
            <Modal visible={showForm} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{t('fileClaim')}</Text>
                                <TouchableOpacity onPress={() => setShowForm(false)} style={styles.closeBtn}>
                                    <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.modalSubtitle}>{t('fileClaimSub')}</Text>

                            {/* Select Verified Report */}
                            <Text style={styles.formLabel}>{t('verifiedReport')} *</Text>
                            {verifiedReports.length === 0 ? (
                                <View style={styles.noReportsCard}>
                                    <Ionicons name="information-circle-outline" size={24} color={COLORS.info} />
                                    <Text style={styles.noReportsText}>{t('noVerifiedReports')}</Text>
                                </View>
                            ) : (
                                <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowReportPicker(true)}>
                                    <Ionicons name="document-text-outline" size={18} color={COLORS.textMuted} />
                                    <Text style={[styles.pickerText, selectedReport && { color: COLORS.textPrimary }]}>
                                        {selectedReport ? `Report #${selectedReport.report_id} — ${selectedReport.field_location || 'No location'}` : t('selectReport')}
                                    </Text>
                                    <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
                                </TouchableOpacity>
                            )}

                            {/* Damage Type */}
                            <Text style={styles.formLabel}>{t('damageType')} *</Text>
                            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDamagePicker(true)}>
                                <Ionicons name="bug-outline" size={18} color={COLORS.textMuted} />
                                <Text style={[styles.pickerText, damageType && { color: COLORS.textPrimary }]}>
                                    {damageType || t('selectDamageType')}
                                </Text>
                                <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
                            </TouchableOpacity>

                            {/* RSBSA Number */}
                            <Text style={styles.formLabel}>{t('rsbsaNumber')}</Text>
                            <View style={styles.inputContainer}>
                                <Ionicons name="card-outline" size={18} color={COLORS.textMuted} />
                                <TextInput style={styles.input} placeholder="e.g. 01-36-04-045-000001" placeholderTextColor={COLORS.textMuted} value={rsbsaNum} onChangeText={setRsbsaNum} />
                            </View>

                            {/* Policy Number */}
                            <Text style={styles.formLabel}>{t('policyNumber')}</Text>
                            <View style={styles.inputContainer}>
                                <Ionicons name="receipt-outline" size={18} color={COLORS.textMuted} />
                                <TextInput style={styles.input} placeholder="e.g. PCIC-2026-00001" placeholderTextColor={COLORS.textMuted} value={policyNum} onChangeText={setPolicyNum} />
                            </View>

                            {/* ── Proof Photos Section ─────────────────── */}
                            <Text style={styles.formLabel}>📸 Proof Photos ({proofImages.length}/{MAX_PROOF_IMAGES})</Text>
                            <Text style={styles.proofHint}>
                                Add photos of field damage, affected crop area, or supporting documents for a stronger claim.
                            </Text>

                            {/* Photo Action Buttons */}
                            <View style={styles.photoActions}>
                                <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                                    <LinearGradient
                                        colors={['#43A047', '#66BB6A']}
                                        style={styles.photoBtnGradient}
                                    >
                                        <Ionicons name="camera" size={20} color={COLORS.white} />
                                        <Text style={styles.photoBtnText}>Camera</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.photoBtn} onPress={pickFromGallery}>
                                    <LinearGradient
                                        colors={['#1E88E5', '#42A5F5']}
                                        style={styles.photoBtnGradient}
                                    >
                                        <Ionicons name="images" size={20} color={COLORS.white} />
                                        <Text style={styles.photoBtnText}>Gallery</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>

                            {/* Image Previews */}
                            {proofImages.length > 0 && (
                                <View style={styles.proofGrid}>
                                    {proofImages.map((img, idx) => (
                                        <View key={idx} style={styles.proofItem}>
                                            <Image source={{ uri: img.uri }} style={styles.proofImage} />
                                            {/* Remove button */}
                                            <TouchableOpacity
                                                style={styles.proofRemove}
                                                onPress={() => removeImage(idx)}
                                            >
                                                <Ionicons name="close-circle" size={22} color="#FF5252" />
                                            </TouchableOpacity>
                                            {/* Image type label */}
                                            <TouchableOpacity
                                                style={styles.proofTypeBtn}
                                                onPress={() => setShowImageTypePicker(idx)}
                                            >
                                                <Text style={styles.proofTypeText} numberOfLines={1}>
                                                    {img.type}
                                                </Text>
                                                <Ionicons name="chevron-down" size={12} color={COLORS.textMuted} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Info Box */}
                            <View style={styles.infoBox}>
                                <Ionicons name="information-circle" size={18} color={COLORS.info} />
                                <Text style={styles.infoText}>{t('claimInfoNote')}</Text>
                            </View>

                            {/* Submit */}
                            <TouchableOpacity
                                style={[styles.submitBtn, (loading || !selectedReport || !damageType) && styles.submitBtnDisabled]}
                                onPress={handleSubmit}
                                disabled={loading || !selectedReport || !damageType}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={(!selectedReport || !damageType) ? [COLORS.textMuted, COLORS.textMuted] : [COLORS.primary, COLORS.primaryLight]}
                                    style={styles.submitGradient}
                                >
                                    {loading ? <ActivityIndicator color={COLORS.white} /> : (
                                        <>
                                            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.white} />
                                            <Text style={styles.submitText}>{t('submitClaim')}</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Cancel / Go Back */}
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => { resetForm(); setShowForm(false); }}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="arrow-back-outline" size={18} color={COLORS.textSecondary} />
                                <Text style={styles.cancelBtnText}>{t('cancel') || 'Cancel'}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Report Picker Modal */}
            <Modal visible={showReportPicker} animationType="fade" transparent>
                <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowReportPicker(false)}>
                    <View style={styles.pickerModal}>
                        <Text style={styles.pickerTitle}>{t('selectReport')}</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {verifiedReports.map((r: any) => (
                                <TouchableOpacity
                                    key={r.report_id}
                                    style={[styles.pickerItem, selectedReport?.report_id === r.report_id && styles.pickerItemActive]}
                                    onPress={() => { setSelectedReport(r); setShowReportPicker(false); }}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.pickerItemTitle}>Report #{r.report_id}</Text>
                                        <Text style={styles.pickerItemSub}>{r.field_location || 'No location'} • {new Date(r.reported_at).toLocaleDateString()}</Text>
                                    </View>
                                    {selectedReport?.report_id === r.report_id && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Damage Type Picker Modal */}
            <Modal visible={showDamagePicker} animationType="fade" transparent>
                <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowDamagePicker(false)}>
                    <View style={styles.pickerModal}>
                        <Text style={styles.pickerTitle}>{t('selectDamageType')}</Text>
                        <ScrollView style={{ maxHeight: 350 }}>
                            {DAMAGE_TYPES.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.pickerItem, damageType === type && styles.pickerItemActive]}
                                    onPress={() => { setDamageType(type); setShowDamagePicker(false); }}
                                >
                                    <Text style={styles.pickerItemTitle}>{type}</Text>
                                    {damageType === type && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Image Type Picker Modal */}
            <Modal visible={showImageTypePicker !== null} animationType="fade" transparent>
                <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowImageTypePicker(null)}>
                    <View style={styles.pickerModal}>
                        <Text style={styles.pickerTitle}>Select Photo Category</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {IMAGE_TYPES.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.pickerItem,
                                        showImageTypePicker !== null && proofImages[showImageTypePicker]?.type === type && styles.pickerItemActive,
                                    ]}
                                    onPress={() => {
                                        if (showImageTypePicker !== null) updateImageType(showImageTypePicker, type);
                                    }}
                                >
                                    <Text style={styles.pickerItemTitle}>{type}</Text>
                                    {showImageTypePicker !== null && proofImages[showImageTypePicker]?.type === type && (
                                        <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        paddingTop: 60, paddingBottom: SPACING.lg, paddingHorizontal: SPACING.lg,
        borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl,
    },
    headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.white },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

    actionRow: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
    fileClaimBtn: { borderRadius: RADIUS.md, overflow: 'hidden' },
    fileClaimGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        height: 48, gap: 8, borderRadius: RADIUS.md,
    },
    fileClaimText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },

    list: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xxl },
    claimCard: {
        backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.small,
    },
    claimHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: SPACING.sm,
    },
    claimIdRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    claimId: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full,
    },
    statusText: { fontSize: 11, fontWeight: '700' },

    claimDetail: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    detailText: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },

    claimFooter: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginTop: SPACING.sm,
        paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border,
    },
    dateText: { fontSize: 11, color: COLORS.textMuted },
    rsbsaTag: { fontSize: 11, fontWeight: '600', color: COLORS.info },
    proofCountBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: '#E3F2FD', paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.full,
    },
    proofCountText: { fontSize: 10, fontWeight: '600', color: COLORS.info },

    empty: { alignItems: 'center', marginTop: 60 },
    emptyIcon: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: COLORS.primaryFaded, justifyContent: 'center', alignItems: 'center',
        marginBottom: SPACING.md,
    },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    emptyText: { fontSize: 14, color: COLORS.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },

    // Rejection reason
    rejectionBox: {
        marginTop: SPACING.sm, backgroundColor: '#FFEBEE', borderRadius: RADIUS.md,
        padding: SPACING.sm, borderLeftWidth: 3, borderLeftColor: '#C62828',
    },
    rejectionTitle: { fontSize: 12, fontWeight: '700', color: '#C62828' },
    rejectionText: { fontSize: 12, color: '#C62828', lineHeight: 17 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
        padding: SPACING.lg, maxHeight: '90%',
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
    closeBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center',
    },
    modalSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, marginBottom: SPACING.lg },

    formLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs, marginTop: SPACING.md },
    pickerBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: COLORS.background, borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md, height: 48,
        borderWidth: 1, borderColor: COLORS.border,
    },
    pickerText: { flex: 1, fontSize: 14, color: COLORS.textMuted },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: COLORS.background, borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md, height: 48,
        borderWidth: 1, borderColor: COLORS.border,
    },
    input: { flex: 1, fontSize: 14, color: COLORS.textPrimary },

    noReportsCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 10,
        backgroundColor: '#E3F2FD', borderRadius: RADIUS.md, padding: SPACING.md,
    },
    noReportsText: { flex: 1, fontSize: 13, color: '#1565C0', lineHeight: 18 },

    // Proof Photos
    proofHint: {
        fontSize: 12, color: COLORS.textMuted, lineHeight: 17,
        marginBottom: SPACING.sm,
    },
    photoActions: {
        flexDirection: 'row', gap: SPACING.sm,
    },
    photoBtn: { flex: 1, borderRadius: RADIUS.md, overflow: 'hidden' },
    photoBtnGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        height: 44, gap: 6, borderRadius: RADIUS.md,
    },
    photoBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },

    proofGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm,
        marginTop: SPACING.md,
    },
    proofItem: {
        width: '30%', borderRadius: RADIUS.md, overflow: 'hidden',
        backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    },
    proofImage: { width: '100%', height: 80 },
    proofRemove: {
        position: 'absolute', top: 2, right: 2,
        backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 11,
    },
    proofTypeBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 4, paddingHorizontal: 6, gap: 2,
    },
    proofTypeText: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },

    infoBox: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        backgroundColor: '#E3F2FD', borderRadius: RADIUS.md, padding: SPACING.md,
        marginTop: SPACING.lg,
    },
    infoText: { flex: 1, fontSize: 12, color: '#1565C0', lineHeight: 17 },

    submitBtn: { marginTop: SPACING.lg, borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: SPACING.lg },
    submitBtnDisabled: { opacity: 0.6 },
    submitGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        height: 52, gap: 8,
    },
    submitText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
    cancelBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        height: 48, gap: 8, borderRadius: RADIUS.md,
        borderWidth: 1.5, borderColor: COLORS.border,
        backgroundColor: COLORS.background, marginBottom: SPACING.lg,
    },
    cancelBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },

    // Picker Modals
    pickerOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center', paddingHorizontal: SPACING.lg,
    },
    pickerModal: {
        backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: SPACING.lg,
        ...SHADOWS.large,
    },
    pickerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
    pickerItem: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: 4,
    },
    pickerItemActive: { backgroundColor: COLORS.primaryFaded },
    pickerItemTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
    pickerItemSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
});
