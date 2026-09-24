import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Alert, ActivityIndicator, Image, Modal, Dimensions, Linking,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { reportService, treatmentService, verificationService } from '../../services/api.service';
import { API_CONFIG } from '../../services/api.config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function RecommendScreen() {
    const { user } = useAuth();
    const [reports, setReports] = useState<any[]>([]);
    const [selected, setSelected] = useState<any>(null);
    const [treatments, setTreatments] = useState<any[]>([]);
    const [selectedTreatment, setSelectedTreatment] = useState<number | null>(null);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [verifiedDisease, setVerifiedDisease] = useState<string>('');
    const [zoomImage, setZoomImage] = useState<string | null>(null);

    const getImageUrl = (path: string) => {
        const base = API_CONFIG.PHP_BASE_URL.replace('/app/api', '');
        return `${base}/${path}`;
    };

    const load = async () => {
        try {
            const data = await reportService.getReports({ status: 'Verified' });
            setReports(Array.isArray(data) ? data : []);
        } catch (err) { console.log(err); }
    };

    useFocusEffect(useCallback(() => { load(); }, []));

    const selectReport = async (report: any) => {
        setSelected(report);
        setSelectedTreatment(null);
        setNotes('');
        setVerifiedDisease('');

        // Get the verified disease to auto-filter treatments
        try {
            const verifications = await verificationService.getVerifications(report.report_id);
            if (Array.isArray(verifications) && verifications.length > 0) {
                const diseaseId = verifications[0].disease_id;
                const diseaseName = verifications[0].disease_name;
                setVerifiedDisease(diseaseName || '');

                // Load treatments filtered by the verified disease
                const data = await treatmentService.getTreatments(diseaseId);
                setTreatments(Array.isArray(data) ? data : []);
            } else {
                // Fallback: load all treatments
                const data = await treatmentService.getTreatments();
                setTreatments(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.log(err);
            try {
                const data = await treatmentService.getTreatments();
                setTreatments(Array.isArray(data) ? data : []);
            } catch (e) { console.log(e); }
        }
    };

    const submit = async () => {
        if (!selectedTreatment && !notes.trim()) {
            Alert.alert('Error', 'Please select a treatment or provide manual notes');
            return;
        }

        setLoading(true);
        try {
            const result = await treatmentService.createRecommendation({
                report_id: selected.report_id,
                treatment_id: selectedTreatment, // Can be null now
                recommended_by: (user as any).user_id,
                recommendation_source: 'Technologist',
                additional_notes: notes,
            });

            if (result.error) {
                Alert.alert('Error', result.error);
            } else {
                Alert.alert('Success', 'Treatment recommendation sent!');
                setSelected(null);
                load();
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to submit recommendation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <LinearGradient colors={['#0D47A1', '#1E88E5']} style={styles.header}>
                <Text style={styles.headerTitle}>💊 Treatment Recommendations</Text>
                <Text style={styles.headerSub}>Recommend treatments for verified reports</Text>
            </LinearGradient>

            <View style={styles.content}>
                {selected ? (
                    <View>
                        <TouchableOpacity onPress={() => setSelected(null)} style={styles.backLink}>
                            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
                            <Text style={styles.backText}>Back to list</Text>
                        </TouchableOpacity>

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Report #{selected.report_id}</Text>
                            <Text style={styles.cardSub}>{selected.fname} {selected.lname}</Text>
                            {selected.field_location && <Text style={styles.cardLoc}>📍 {selected.field_location}</Text>}
                            {verifiedDisease && (
                                <View style={styles.diseaseBadge}>
                                    <Ionicons name="bug-outline" size={14} color="#D32F2F" />
                                    <Text style={styles.diseaseBadgeText}>Verified: {verifiedDisease}</Text>
                                </View>
                            )}
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
                                <Text style={styles.label}>📸 Report Photos ({selected.images.length})</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                                    {selected.images.map((img: string, idx: number) => (
                                        <TouchableOpacity key={idx} onPress={() => setZoomImage(getImageUrl(img))} activeOpacity={0.8}>
                                            <Image source={{ uri: getImageUrl(img) }} style={styles.imageThumbnail} resizeMode="cover" />
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        <Text style={styles.label}>
                            {verifiedDisease ? `Treatments for ${verifiedDisease}` : 'Select Treatment'}
                        </Text>
                        {treatments.length === 0 ? (
                            <View style={styles.noTreatments}>
                                <Ionicons name="information-circle-outline" size={24} color={COLORS.textMuted} />
                                <Text style={styles.noTreatmentsText}>No treatments found in the database for this disease. Add treatments in phpMyAdmin.</Text>
                            </View>
                        ) : (
                            treatments.map((t: any) => (
                                <TouchableOpacity
                                    key={t.treatment_id}
                                    style={[styles.treatmentCard, selectedTreatment === t.treatment_id && styles.treatmentActive]}
                                    onPress={() => setSelectedTreatment(t.treatment_id)}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.treatmentName}>{t.pesticide_name || t.treatment_type}</Text>
                                        <Text style={styles.treatmentType}>{t.treatment_type} • {t.disease_name}</Text>
                                        {t.dosage && <Text style={styles.treatmentDetail}>💊 Dosage: {t.dosage}</Text>}
                                        {t.application_method && <Text style={styles.treatmentDetail}>🔧 Method: {t.application_method}</Text>}
                                    </View>
                                    {selectedTreatment === t.treatment_id && (
                                        <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                                    )}
                                    {t.estimated_cost > 0 && (
                                        <Text style={styles.treatmentCost}>₱{parseFloat(t.estimated_cost).toLocaleString()}/ha</Text>
                                    )}
                                </TouchableOpacity>
                            ))
                        )}

                        <TouchableOpacity
                            style={[styles.treatmentCard, selectedTreatment === null && notes.trim() !== '' && styles.treatmentActive, { marginTop: SPACING.md }]}
                            onPress={() => {
                                setSelectedTreatment(null);
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={styles.treatmentName}>📝 Provide Manual Advice</Text>
                                <Text style={styles.treatmentType}>Not choosing from the list? Provide your own recommendation below.</Text>
                            </View>
                            {selectedTreatment === null && notes.trim() !== '' && (
                                <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                            )}
                        </TouchableOpacity>

                        <Text style={styles.label}>Additional Notes</Text>
                        <TextInput
                            style={styles.notesInput}
                            placeholder="Add guidance for the farmer..."
                            placeholderTextColor={COLORS.textMuted}
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                            numberOfLines={4}
                        />

                        <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={loading}>
                            <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.submitGrad}>
                                {loading ? <ActivityIndicator color={COLORS.white} /> : (
                                    <Text style={styles.submitText}>Send Recommendation</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                ) : (
                    reports.length === 0 ? (
                        <View style={styles.empty}>
                            <Ionicons name="medical-outline" size={48} color={COLORS.textMuted} />
                            <Text style={styles.emptyText}>No verified reports</Text>
                        </View>
                    ) : (
                        reports.map((r: any) => (
                            <TouchableOpacity key={r.report_id} style={styles.reportCard} onPress={() => selectReport(r)}>
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
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        ))
                    )
                )}
            </View>

            <View style={{ height: 40 }} />

            {/* Full-Screen Image Zoom */}
            <Modal visible={!!zoomImage} transparent animationType="fade">
                <View style={styles.zoomOverlay}>
                    <TouchableOpacity style={styles.zoomClose} onPress={() => setZoomImage(null)}>
                        <Ionicons name="close-circle" size={36} color={COLORS.white} />
                    </TouchableOpacity>
                    {zoomImage && <Image source={{ uri: zoomImage }} style={styles.zoomImage} resizeMode="contain" />}
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
    card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOWS.small, marginBottom: SPACING.md },
    cardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    cardSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
    cardLoc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
    diseaseBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, backgroundColor: '#FFEBEE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.md, alignSelf: 'flex-start' },
    diseaseBadgeText: { fontSize: 12, fontWeight: '700', color: '#D32F2F' },

    // Images
    imageSection: { marginBottom: SPACING.md },
    imageScroll: { marginTop: 4 },
    imageThumbnail: { width: 100, height: 100, borderRadius: RADIUS.md, marginRight: SPACING.sm, backgroundColor: COLORS.border },
    reportThumb: { width: 50, height: 50, borderRadius: RADIUS.md, backgroundColor: COLORS.border },
    reportThumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryFaded },

    noTreatments: { alignItems: 'center', padding: SPACING.lg, backgroundColor: COLORS.white, borderRadius: RADIUS.md, marginBottom: SPACING.md },
    noTreatmentsText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.sm },

    label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm, marginTop: SPACING.md },
    treatmentCard: {
        backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md,
        marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border,
        flexDirection: 'row', alignItems: 'center', ...SHADOWS.small,
    },
    treatmentActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFaded },
    treatmentName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
    treatmentType: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    treatmentDetail: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
    treatmentCost: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginLeft: SPACING.sm },
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

    // Zoom
    zoomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    zoomClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
    zoomImage: { width: SCREEN_WIDTH - 20, height: SCREEN_WIDTH - 20 },
});
