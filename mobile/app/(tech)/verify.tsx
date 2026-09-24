import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Alert, RefreshControl, ActivityIndicator,
    Image, Modal, Dimensions, Linking,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { reportService, verificationService, aiService } from '../../services/api.service';
import { API_CONFIG } from '../../services/api.config';

const FALLBACK_DISEASES = [
    { disease_id: 1, disease_name: 'Bacterial Leaf Blight' },
    { disease_id: 2, disease_name: 'Brown Spot' },
    { disease_id: 3, disease_name: 'Leaf Blast' },
    { disease_id: 4, disease_name: 'Sheath Blight' },
    { disease_id: 5, disease_name: 'Tungro' },
    { disease_id: 6, disease_name: 'Healthy' }
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.sm * 2) / 3;

export default function VerifyScreen() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [reports, setReports] = useState<any[]>([]);
    const [selected, setSelected] = useState<any>(null);
    const [diseases, setDiseases] = useState<any[]>([]); // AI diagnoses
    const [allDiseases, setAllDiseases] = useState<any[]>([]); // Full list
    const [notes, setNotes] = useState('');
    const [method, setMethod] = useState('Field Visit');
    const [diseaseId, setDiseaseId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [zoomImage, setZoomImage] = useState<string | null>(null);

    const getImageUrl = (path: string) => {
        // Build full URL from relative image path
        const base = API_CONFIG.PHP_BASE_URL.replace('/app/api', '');
        return `${base}/${path}`;
    };

    const load = async () => {
        try {
            const data = await reportService.getReports({ status: 'Pending' });
            setReports(Array.isArray(data) ? data : []);

            // Load full disease list once
            if (allDiseases.length === 0) {
                try {
                    const list = await aiService.getDiseases();
                    setAllDiseases(Array.isArray(list) && list.length > 0 ? list : FALLBACK_DISEASES);
                } catch (e) {
                    console.log('Using offline disease list');
                    setAllDiseases(FALLBACK_DISEASES);
                }
            }
        } catch (err) { console.log(err); }
    };

    useFocusEffect(useCallback(() => { load(); }, [allDiseases]));

    const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

    const selectReport = async (report: any) => {
        setSelected(report);
        setDiseaseId(null);
        setNotes('');
        // Load AI diagnosis for reference
        try {
            const diag = await aiService.getDiagnosis(report.report_id);
            if (Array.isArray(diag) && diag.length > 0) {
                setDiseaseId(diag[0].disease_id);
                setDiseases(diag);
            }
        } catch (err) { console.log(err); }
    };

    const submitVerification = async () => {
        if (!diseaseId) {
            Alert.alert('Error', 'Please select a disease to confirm');
            return;
        }

        setLoading(true);
        try {
            const result = await verificationService.createVerification({
                report_id: selected.report_id,
                user_id: (user as any).user_id,
                disease_id: diseaseId,
                verification_method: method,
                notes,
            });

            if (result.error) {
                Alert.alert('Error', result.error);
            } else {
                Alert.alert('Success', 'Report verified successfully!');
                setSelected(null);
                load();
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to submit verification');
        } finally {
            setLoading(false);
        }
    };

    const callFarmer = (number: string) => {
        Linking.openURL(`tel:${number}`);
    };

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        >
            <LinearGradient colors={['#0D47A1', '#1E88E5']} style={styles.header}>
                <Text style={styles.headerTitle}>✅ Verify Reports</Text>
                <Text style={styles.headerSub}>{reports.length} report{reports.length !== 1 ? 's' : ''} pending verification</Text>
            </LinearGradient>

            <View style={styles.content}>
                {selected ? (
                    /* Verification Form */
                    <View>
                        <TouchableOpacity onPress={() => setSelected(null)} style={styles.backLink}>
                            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
                            <Text style={styles.backText}>Back to list</Text>
                        </TouchableOpacity>

                        <View style={styles.detailCard}>
                            <Text style={styles.detailTitle}>Report #{selected.report_id}</Text>
                            <Text style={styles.detailSub}>By {selected.fname} {selected.lname}</Text>
                            {selected.contact_number && (
                                <TouchableOpacity style={styles.contactRow} onPress={() => callFarmer(selected.contact_number)}>
                                    <Ionicons name="call-outline" size={14} color={COLORS.primary} />
                                    <Text style={styles.contactText}>{selected.contact_number}</Text>
                                </TouchableOpacity>
                            )}
                            {selected.field_location && <Text style={styles.detailLoc}>📍 {selected.field_location}</Text>}
                            {selected.description && <Text style={styles.detailDesc}>{selected.description}</Text>}
                            <Text style={styles.detailDate}>📅 {new Date(selected.reported_at).toLocaleString()}</Text>
                        </View>

                        {/* ── Field Location Map Link ── */}
                        {selected.latitude && selected.longitude && (
                            <View style={styles.mapContainer}>
                                <Text style={styles.label}>📍 Field Location</Text>
                                <TouchableOpacity 
                                    style={styles.mapActionBtnLarge}
                                    onPress={() => {
                                        const url = `https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`;
                                        Linking.openURL(url);
                                    }}
                                >
                                    <LinearGradient colors={['#2E7D32', '#388E3C']} style={styles.mapBtnGrad}>
                                        <Ionicons name="navigate-circle-outline" size={24} color={COLORS.white} />
                                        <Text style={styles.mapActionTextLarge}>View Location on Google Maps</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                                <Text style={styles.coordsText}>
                                    Lat: {parseFloat(selected.latitude).toFixed(6)}, Lng: {parseFloat(selected.longitude).toFixed(6)}
                                </Text>
                            </View>
                        )}

                        {/* ── Report Images ── */}
                        {selected.images && selected.images.length > 0 && (
                            <View style={styles.imageSection}>
                                <Text style={styles.label}>
                                    📸 Report Photos ({selected.images.length})
                                </Text>
                                <View style={styles.imageGrid}>
                                    {selected.images.map((img: string, idx: number) => (
                                        <TouchableOpacity
                                            key={idx}
                                            onPress={() => setZoomImage(getImageUrl(img))}
                                            activeOpacity={0.8}
                                        >
                                            <Image
                                                source={{ uri: getImageUrl(img) }}
                                                style={styles.imageThumbnail}
                                                resizeMode="cover"
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* ── All Diseases Selection ── */}
                        <Text style={styles.label}>Confirm Disease Type *</Text>
                        <View style={styles.diseaseGrid}>
                            {allDiseases.map((d: any) => (
                                <TouchableOpacity
                                    key={d.disease_id}
                                    style={[
                                        styles.miniDiseaseCard,
                                        diseaseId === d.disease_id && styles.miniDiseaseCardActive,
                                        d.disease_name.toLowerCase() === 'healthy' && diseaseId !== d.disease_id && styles.healthyBtn
                                    ]}
                                    onPress={() => setDiseaseId(d.disease_id)}
                                >
                                    <View style={[styles.miniDot, { backgroundColor: diseaseId === d.disease_id ? COLORS.white : (d.disease_name.toLowerCase() === 'healthy' ? '#2E7D32' : COLORS.primary) }]} />
                                    <Text style={[
                                        styles.miniDiseaseName,
                                        diseaseId === d.disease_id && { color: COLORS.white },
                                        d.disease_name.toLowerCase() === 'healthy' && diseaseId !== d.disease_id && { color: '#2E7D32' }
                                    ]}>
                                        {d.disease_name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {diseases.length > 0 && (
                            <View style={styles.aiSection}>
                                <Text style={[styles.label, { color: COLORS.primary }]}>🤖 AI Reference:</Text>
                                {diseases.map((d: any, i: number) => (
                                    <View key={i} style={styles.aiRefItem}>
                                        <Text style={styles.diseaseName}>{d.disease_name}</Text>
                                        <Text style={styles.diseaseConf}>{d.confidence_score}%</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        <Text style={styles.label}>Verification Method</Text>
                        <View style={styles.methodRow}>
                            {['Field Visit', 'Photo'].map((m) => (
                                <TouchableOpacity
                                    key={m}
                                    style={[styles.methodBtn, method === m && styles.methodBtnActive]}
                                    onPress={() => setMethod(m)}
                                >
                                    <Text style={[styles.methodText, method === m && styles.methodTextActive]}>{m}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Notes</Text>
                        <TextInput
                            style={styles.notesInput}
                            placeholder="Add observations and notes..."
                            placeholderTextColor={COLORS.textMuted}
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                            numberOfLines={4}
                        />

                        <TouchableOpacity style={styles.submitBtn} onPress={submitVerification} disabled={loading}>
                            <LinearGradient colors={['#0D47A1', '#1E88E5']} style={styles.submitGrad}>
                                {loading ? <ActivityIndicator color={COLORS.white} /> : (
                                    <Text style={styles.submitText}>Submit Verification</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                ) : (
                    /* Report List */
                    reports.length === 0 ? (
                        <View style={styles.empty}>
                            <Ionicons name="checkmark-done-circle-outline" size={48} color={COLORS.textMuted} />
                            <Text style={styles.emptyText}>No pending reports</Text>
                        </View>
                    ) : (
                        reports.map((r) => (
                            <TouchableOpacity key={r.report_id} style={styles.reportCard} onPress={() => selectReport(r)} activeOpacity={0.7}>
                                {/* Thumbnail preview */}
                                {r.images && r.images.length > 0 ? (
                                    <Image source={{ uri: getImageUrl(r.images[0]) }} style={styles.reportThumb} />
                                ) : (
                                    <View style={[styles.reportThumb, styles.reportThumbEmpty]}>
                                        <Ionicons name="leaf-outline" size={20} color={COLORS.textMuted} />
                                    </View>
                                )}
                                <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                                    <Text style={styles.reportTitle}>Report #{r.report_id}</Text>
                                    <Text style={styles.reportSub}>{r.fname} {r.lname} • {new Date(r.reported_at).toLocaleDateString()}</Text>
                                    {r.image_count > 0 && (
                                        <View style={styles.imageBadge}>
                                            <Ionicons name="camera-outline" size={12} color={COLORS.primary} />
                                            <Text style={styles.imageBadgeText}>{r.image_count} photo{r.image_count > 1 ? 's' : ''}</Text>
                                        </View>
                                    )}
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        ))
                    )
                )}
            </View>

            <View style={{ height: 40 }} />

            {/* ── Full-Screen Image Zoom Modal ── */}
            <Modal visible={!!zoomImage} transparent animationType="fade">
                <View style={styles.zoomOverlay}>
                    <TouchableOpacity style={styles.zoomClose} onPress={() => setZoomImage(null)}>
                        <Ionicons name="close-circle" size={36} color={COLORS.white} />
                    </TouchableOpacity>
                    {zoomImage && (
                        <Image source={{ uri: zoomImage }} style={styles.zoomImage} resizeMode="contain" />
                    )}
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { paddingTop: 60, paddingBottom: SPACING.lg, paddingHorizontal: SPACING.lg, borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl },
    headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.white },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    content: { padding: SPACING.lg },

    mapContainer: { marginBottom: SPACING.md },
    mapWrap: { height: 160, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: COLORS.border, ...SHADOWS.small },
    detailMap: { width: '100%', height: '100%' },
    mapActionBtnLarge: { marginTop: SPACING.xs, borderRadius: RADIUS.md, overflow: 'hidden' },
    mapBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14 },
    mapActionTextLarge: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
    coordsText: { fontSize: 10, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },

    backLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.md },
    backText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
    detailCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOWS.small, marginBottom: SPACING.md },
    detailTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    detailSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
    detailLoc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
    detailDesc: { fontSize: 14, color: COLORS.textPrimary, marginTop: 8, lineHeight: 20 },
    detailDate: { fontSize: 12, color: COLORS.textMuted, marginTop: 8 },
    contactRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    contactText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

    // Image Gallery
    imageSection: { marginBottom: SPACING.md },
    imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    imageThumbnail: {
        width: IMAGE_SIZE, height: IMAGE_SIZE,
        borderRadius: RADIUS.md, backgroundColor: COLORS.border,
    },

    // Report list thumbnails
    reportThumb: { width: 50, height: 50, borderRadius: RADIUS.md, backgroundColor: COLORS.border },
    reportThumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryFaded },
    imageBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
    imageBadgeText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },

    aiSection: { marginBottom: SPACING.md },
    label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm, marginTop: SPACING.sm },
    diseaseOption: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
        borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.xs, borderWidth: 1, borderColor: COLORS.border,
    },
    diseaseOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFaded },
    diseaseName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
    diseaseSymptoms: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
    diseaseConf: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginLeft: SPACING.sm },

    // Mini disease selection cards
    diseaseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.md },
    miniDiseaseCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
        paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
        borderWidth: 1, borderColor: COLORS.border, gap: 8,
    },
    miniDiseaseCardActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    miniDiseaseName: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
    miniDot: { width: 6, height: 6, borderRadius: 3 },

    aiRefItem: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.primaryFaded, padding: 10, borderRadius: 8, marginBottom: 4 },

    methodRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
    methodBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border },
    methodBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFaded },
    methodText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
    methodTextActive: { color: COLORS.primary },
    notesInput: {
        backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md,
        fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border,
        minHeight: 100, textAlignVertical: 'top',
    },
    submitBtn: { marginTop: SPACING.lg, borderRadius: RADIUS.md, overflow: 'hidden' },
    submitGrad: { alignItems: 'center', justifyContent: 'center', height: 52 },
    submitText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
    reportCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
        borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.small,
    },
    reportTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
    reportSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
    empty: { alignItems: 'center', marginTop: 60 },
    emptyText: { fontSize: 16, color: COLORS.textMuted, marginTop: SPACING.md },

    // Zoom Modal
    zoomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    zoomClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
    zoomImage: { width: SCREEN_WIDTH - 20, height: SCREEN_WIDTH - 20 },
    healthyBtn: { borderColor: '#4CAF50', backgroundColor: '#F1F8E9' },
});
