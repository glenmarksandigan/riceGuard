import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image,
    ScrollView, Alert, ActivityIndicator, Animated, Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import { COLORS, SPACING, RADIUS, SHADOWS, MODEL_CONFIG } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { aiService, reportService, treatmentService } from '../../services/api.service';
import { syncService } from '../../services/sync.service';
import { useFadeIn, usePressScale, usePulse } from '../../constants/animations';

// ── Animated Model Card ─────────────────────────────────
function ModelCard({ model, selected, index, onPress }: any) {
    const { scale, onPressIn, onPressOut } = usePressScale(0.93);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1, duration: 400, delay: 100 + index * 100,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ scale }] }}>
            <TouchableOpacity
                style={[
                    styles.modelCard,
                    selected && { borderColor: model.color, borderWidth: 2, backgroundColor: model.color + '0A' },
                ]}
                onPress={onPress}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                activeOpacity={1}
            >
                <View style={[styles.modelIconWrap, { backgroundColor: model.color + '15' }]}>
                    <Ionicons name={model.icon as any} size={22} color={model.color} />
                </View>
                <Text style={[styles.modelName, selected && { color: model.color }]}>
                    {model.name}
                </Text>
                <Text style={styles.modelDesc} numberOfLines={2}>{model.description}</Text>
                {selected && (
                    <Ionicons name="checkmark-circle" size={18} color={model.color} style={styles.modelCheck} />
                )}
            </TouchableOpacity>
        </Animated.View>
    );
}

// ── Animated Progress Bar ───────────────────────────────
function AnalysisProgress() {
    const progress = useRef(new Animated.Value(0)).current;
    const shimmer = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Smooth progress to 90% then hold
        Animated.timing(progress, {
            toValue: 0.9, duration: 3000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();

        // Shimmer effect
        Animated.loop(
            Animated.timing(shimmer, {
                toValue: 1, duration: 1200,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const widthInterpolation = progress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: widthInterpolation as any }]} />
            </View>
            <Text style={styles.progressText}>Analyzing rice leaf...</Text>
        </View>
    );
}

export default function ScanScreen() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();
    const [selectedModel, setSelectedModel] = useState('efficientnetv2s');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [treatments, setTreatments] = useState<any[]>([]);
    const [loadingTreatments, setLoadingTreatments] = useState(false);
    


    // Reuse State to prevent false-offline on same image
    const [lastReportId, setLastReportId] = useState<number | null>(null);
    const [lastImageUri, setLastImageUri] = useState<string | null>(null);

    // Animations
    const headerFade = useFadeIn(0, 500);
    const pulseScale = usePulse(!!imageUri && !loading && !result);
    const resultSlide = useRef(new Animated.Value(40)).current;
    const resultOpacity = useRef(new Animated.Value(0)).current;

    // Animate result card appearance
    useEffect(() => {
        if (result) {
            resultSlide.setValue(40);
            resultOpacity.setValue(0);
            Animated.parallel([
                Animated.spring(resultSlide, {
                    toValue: 0, speed: 12, bounciness: 6,
                    useNativeDriver: true,
                }),
                Animated.timing(resultOpacity, {
                    toValue: 1, duration: 400,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [result]);

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Camera roll access is required to pick images.');
                return;
            }
            const picked = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.8, // Removed allowsEditing to prevent crashes
            });
            
            console.log('Picker result:', picked);
            if (!picked.canceled && picked.assets && picked.assets.length > 0) {
                const uri = picked.assets[0].uri;
                console.log('Selected URI:', uri);
                setImageUri(uri);
                setResult(null);
                setLastReportId(null); // Reset reuse state for new image
                setLastImageUri(null);
            } else {
                console.log('Picker was canceled or assets empty');
            }
        } catch (err: any) {
            console.error('Pick error:', err);
            Alert.alert('Picker Error', `Could not open gallery: ${err.message || 'Unknown error'}`);
        }
    };

    const takePhoto = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Camera access is required to take photos.');
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                setImageUri(result.assets[0].uri);
                setResult(null);
                setLastReportId(null);
                setLastImageUri(null);
            }
        } catch (err: any) {
            console.error('Camera error:', err);
            Alert.alert('Camera Error', `Could not open camera: ${err.message || 'Unknown error'}`);
        }
    };

    const analyzImage = async () => {
        if (!imageUri) return;
        setLoading(true);
        setResult(null);

        const isSameImage = imageUri === lastImageUri && lastReportId !== null;
        let reportId = lastReportId;

        const reportData: any = {
            user_id: user!.user_id.toString(),
            report_method: 'Photo',
            description: `AI scan using ${MODEL_CONFIG[selectedModel]?.name || selectedModel} model`,
            images: { uri: imageUri, type: 'image/jpeg', name: 'leaf_scan.jpg' }
        };

        try {
            if (!isSameImage) {
                // Only create a new report if it's a different image
                const formData = new FormData();
                formData.append('user_id', reportData.user_id);
                formData.append('report_method', reportData.report_method);
                formData.append('description', reportData.description);
                
                // Location
                try {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status === 'granted') {
                        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                        formData.append('latitude', loc.coords.latitude.toString());
                        formData.append('longitude', loc.coords.longitude.toString());
                    }
                } catch (e) {}

                formData.append('images', { uri: imageUri, type: 'image/jpeg', name: 'leaf_scan.jpg' } as any);

                const reportRes = await reportService.createReport(formData);
                reportId = reportRes.report_id;
                setLastReportId(reportId);
                setLastImageUri(imageUri);
            }

            // Now attempt AI prediction (or re-prediction)
            const prediction = await aiService.predict(imageUri, selectedModel, reportId);

            setResult({ ...prediction, report_id: reportId });

            const diseaseId = prediction.disease_id || prediction.step2_classification?.disease_id;
            if (diseaseId && prediction.status !== 'rejected') {
                setLoadingTreatments(true);
                try {
                    const tData = await treatmentService.getTreatments(diseaseId);
                    setTreatments(Array.isArray(tData) ? tData : []);
                } catch (e) { setTreatments([]); }
                finally { setLoadingTreatments(false); }
            }
        } catch (err: any) {
            console.log('Error during analysis:', err);

            if (reportId) {
                // Report exists but AI failed or re-prediction failed
                Alert.alert('Analysis Error', `The AI assistant is temporarily unavailable. Error: ${err?.message || 'Server error'}`);
                setResult({
                    disease_name: 'Manual Verification Required',
                    confidence_score: 0,
                    report_id: reportId,
                    model_version: 'AI Offline'
                });
            } else {
                // If it really failed to even create a report, it's likely a network issue
                const queued = await syncService.queueReport(reportData);
                if (queued) {
                    Alert.alert(t('savedOffline'), t('savedOfflineMsg'));
                    setImageUri(null); 
                } else {
                    Alert.alert('System Error', `Failed to analyze or save report: ${err?.message || 'Network error'}`);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const getConfidenceColor = (score: number) => {
        if (score >= 85) return COLORS.success;
        if (score >= 70) return COLORS.warning;
        return COLORS.danger;
    };

    // Animated confidence bar
    const ConfidenceBar = ({ score }: { score: number }) => {
        const width = useRef(new Animated.Value(0)).current;
        useEffect(() => {
            Animated.timing(width, {
                toValue: score, duration: 1000, delay: 300,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
            }).start();
        }, [score]);

        const widthPct = width.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
        });

        return (
            <View style={styles.confidenceBar}>
                <Animated.View style={[styles.confidenceFill, {
                    width: widthPct as any,
                    backgroundColor: getConfidenceColor(score),
                }]} />
            </View>
        );
    };

    return (
        <ScrollView style={styles.container}>


            {/* Animated Header */}
            <Animated.View style={headerFade}>
                <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.header}>
                    <Text style={styles.headerTitle}>🔬 {t('scanDisease')}</Text>
                    <Text style={styles.headerSub}>{t('scanSub')}</Text>
                </LinearGradient>
            </Animated.View>

            <View style={styles.content}>
                {/* AI Disclaimer Card */}
                <View style={styles.disclaimerCard}>
                    <View style={styles.disclaimerHeader}>
                        <Ionicons name="information-circle" size={20} color={COLORS.info} />
                        <Text style={styles.disclaimerTitle}>{t('aiDisclaimerTitle')}</Text>
                    </View>
                    <Text style={styles.disclaimerText}>{t('aiDisclaimerText')}</Text>
                </View>

                {/* Model Picker with staggered entrance */}
                <Text style={styles.sectionTitle}>{t('selectModel')}</Text>
                <View style={styles.modelRow}>
                    {Object.values(MODEL_CONFIG).map((model: any, i: number) => (
                        <ModelCard
                            key={model.key}
                            model={model}
                            selected={selectedModel === model.key}
                            index={i}
                            onPress={() => setSelectedModel(model.key)}
                        />
                    ))}
                </View>

                {/* Image Area */}
                <Text style={styles.sectionTitle}>{t('riceLeafPhoto')}</Text>
                <View style={styles.imageArea}>
                    {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
                    ) : (
                        <View style={styles.placeholder}>
                            <Ionicons name="image-outline" size={60} color={COLORS.textMuted} style={{ opacity: 0.3 }} />
                            <Text style={styles.placeholderText}>{t('noImageSelected')}</Text>
                        </View>
                    )}
                </View>

                {/* Image Buttons with press scale */}
                <View style={styles.imageButtons}>
                    <CameraButton icon="camera" label={t('camera')} onPress={takePhoto} />
                    <CameraButton icon="images" label={t('gallery')} onPress={pickImage} />
                </View>

                {/* Analyze Button with pulse */}
                <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
                    <TouchableOpacity
                        style={[styles.analyzeBtn, !imageUri && { opacity: 0.5 }]}
                        onPress={analyzImage}
                        disabled={!imageUri || loading}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={[MODEL_CONFIG[selectedModel].color, MODEL_CONFIG[selectedModel].color + 'CC']}
                            style={styles.analyzeBtnGrad}
                        >
                            {loading ? (
                                <ActivityIndicator color={COLORS.white} size="small" />
                            ) : (
                                <>
                                    <Ionicons name="scan" size={22} color={COLORS.white} />
                                    <Text style={styles.analyzeBtnText}>{t('analyzeWith')} {MODEL_CONFIG[selectedModel].name}</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>

                {/* Progress bar during analysis */}
                {loading && <AnalysisProgress />}

                {/* Results with slide-up animation */}
                {result && (result.status === 'rejected' || result.step1_is_rice_leaf === false ? (
                    <Animated.View style={{ opacity: resultOpacity, transform: [{ translateY: resultSlide }] }}>
                        <View style={[styles.resultCard, { borderColor: COLORS.danger, borderWidth: 2 }]}>
                            <View style={styles.resultHeader}>
                                <Ionicons name="alert-circle" size={32} color={COLORS.danger} />
                                <Text style={[styles.resultTitle, { color: COLORS.danger }]}>Image Rejected</Text>
                            </View>
                            <Text style={{ fontSize: 14, color: COLORS.textPrimary, marginTop: 8, lineHeight: 20 }}>
                                {result.message || 'No rice leaf detected in the image. Please upload a clear, focused photo of a rice leaf.'}
                            </Text>
                            <View style={{ marginTop: 16, backgroundColor: COLORS.danger + '10', padding: 12, borderRadius: 8 }}>
                                <Text style={{ fontSize: 13, color: COLORS.danger, fontWeight: '600' }}>
                                    Step 1 Validation Failed: Not a Rice Leaf
                                </Text>
                            </View>
                        </View>
                    </Animated.View>
                ) : (
                    <Animated.View style={{ opacity: resultOpacity, transform: [{ translateY: resultSlide }] }}>
                        <View style={styles.resultCard}>
                            <View style={styles.resultHeader}>
                                <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
                                <Text style={styles.resultTitle}>{t('analysisComplete')}</Text>
                            </View>

                            {/* 2-Step Pipeline Breakdown Banner */}
                            <View style={{ backgroundColor: COLORS.primaryFaded, padding: 12, borderRadius: 10, marginBottom: 14 }}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.primaryDark, marginBottom: 6 }}>
                                    🎯 2-Step AI Analysis Pipeline ({MODEL_CONFIG[selectedModel]?.name || selectedModel})
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 2 }}>
                                    <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                                    <Text style={{ fontSize: 12, color: COLORS.textPrimary, marginLeft: 6 }}>
                                        Step 1: Rice Leaf Detection — <Text style={{ fontWeight: '600', color: COLORS.success }}>Verified ✓</Text>
                                    </Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 2 }}>
                                    <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                                    <Text style={{ fontSize: 12, color: COLORS.textPrimary, marginLeft: 6 }}>
                                        Step 2: Classification — <Text style={{ fontWeight: '600', color: result.is_healthy ? COLORS.success : COLORS.warning }}>{result.is_healthy ? '🌿 Healthy Rice Leaf' : `⚠️ ${result.disease_name || result.step2_classification?.disease_name}`}</Text>
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.resultRow}>
                                <Text style={styles.resultLabel}>{t('diseaseDetected')}</Text>
                                <Text style={styles.resultValue}>{result.disease_name || result.step2_classification?.disease_name}</Text>
                            </View>
                            <View style={styles.resultRow}>
                                <Text style={styles.resultLabel}>{t('confidence')}</Text>
                                <ConfidenceBar score={result.confidence_score || result.step2_classification?.confidence_score || 0} />
                                <Text style={[styles.confidenceText, { color: getConfidenceColor(result.confidence_score || result.step2_classification?.confidence_score || 0) }]}>
                                    {result.confidence_score || result.step2_classification?.confidence_score || 0}%
                                </Text>
                            </View>
                            <View style={styles.resultRow}>
                                <Text style={styles.resultLabel}>{t('modelUsed')}</Text>
                                <Text style={styles.resultValue}>{result.model_version}</Text>
                            </View>
                            <View style={styles.resultRow}>
                                <Text style={styles.resultLabel}>⚡ {t('inferenceTime')}</Text>
                                <Text style={[styles.resultValue, { color: COLORS.info }]}>
                                    {result.inference_time_ms ? `${(result.inference_time_ms / 1000).toFixed(2)} s` : '—'}
                                </Text>
                            </View>

                            {result.top_predictions && result.top_predictions.length > 1 && (
                                <View style={{ marginTop: SPACING.md }}>
                                    <Text style={[styles.resultLabel, { marginBottom: 8, fontWeight: '600' }]}>{t('topPredictions')}</Text>
                                    {result.top_predictions.map((pred: any, i: number) => (
                                        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                                            <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>{pred.disease_name}</Text>
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: i === 0 ? COLORS.primary : COLORS.textMuted }}>{pred.confidence}%</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                            <View style={styles.resultRow}>
                                <Text style={styles.resultLabel}>{t('reportId')}</Text>
                                <Text style={styles.resultValue}>#{result.report_id}</Text>
                            </View>
                        </View>
                    </Animated.View>
                ))}

                {/* Treatments with staggered entrance */}
                {result && result.status !== 'rejected' && result.step1_is_rice_leaf !== false && (
                    <View style={styles.treatmentSection}>
                        <Text style={styles.treatmentHeader}>💊 {t('suggestedTreatments')}</Text>
                        {loadingTreatments ? (
                            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: SPACING.md }} />
                        ) : treatments.length > 0 ? (
                            treatments.map((tr: any, idx: number) => (
                                <TreatmentCard key={tr.treatment_id} treatment={tr} index={idx} />
                            ))
                        ) : (
                            <View style={styles.noTreatments}>
                                <Ionicons name="information-circle-outline" size={20} color={COLORS.textMuted} />
                                <Text style={styles.noTreatmentsText}>{t('noTreatments')}</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

// ── Sub-components ──────────────────────────────────────
function CameraButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
    const { scale, onPressIn, onPressOut } = usePressScale(0.94);
    return (
        <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
            <TouchableOpacity style={styles.imgBtn} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1}>
                <Ionicons name={icon as any} size={22} color={COLORS.primary} />
                <Text style={styles.imgBtnText}>{label}</Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

function TreatmentCard({ treatment: tr, index }: { treatment: any; index: number }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(16)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: 200 + index * 100, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 350, delay: 200 + index * 100, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.treatmentCard}>
                <View style={styles.treatmentTypeTag}>
                    <Ionicons
                        name={tr.treatment_type === 'Chemical' ? 'flask-outline' : 'leaf-outline'}
                        size={14}
                        color={tr.treatment_type === 'Chemical' ? '#E65100' : '#2E7D32'}
                    />
                    <Text style={[styles.treatmentTypeText, { color: tr.treatment_type === 'Chemical' ? '#E65100' : '#2E7D32' }]}>
                        {tr.treatment_type}
                    </Text>
                </View>
                <Text style={styles.treatmentName}>{tr.pesticide_name || tr.treatment_type}</Text>
                {tr.dosage && <Text style={styles.treatmentDetail}>💊 Dosage: {tr.dosage}</Text>}
                {tr.application_method && <Text style={styles.treatmentDetail}>🔧 Method: {tr.application_method}</Text>}
                {tr.estimated_cost > 0 && <Text style={styles.treatmentDetail}>💰 Est. Cost: ₱{parseFloat(tr.estimated_cost).toLocaleString()}/ha</Text>}
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { paddingTop: 60, paddingBottom: SPACING.lg, paddingHorizontal: SPACING.lg, borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl },
    headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.white },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    content: { padding: SPACING.lg },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm, marginTop: SPACING.md },
    modelRow: { flexDirection: 'row', gap: SPACING.sm },
    modelCard: {
        flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.md,
        padding: SPACING.sm, alignItems: 'center', ...SHADOWS.small,
        borderWidth: 1, borderColor: COLORS.border,
    },
    modelIconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    modelName: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
    modelDesc: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', marginTop: 2, lineHeight: 14 },
    modelCheck: { position: 'absolute', top: 6, right: 6 },
    imageArea: {
        height: 220, backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
        overflow: 'hidden', ...SHADOWS.small, borderWidth: 1, borderColor: COLORS.border,
    },
    previewImage: { width: '100%', height: '100%' },
    placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    placeholderText: { fontSize: 14, color: COLORS.textMuted, marginTop: SPACING.sm },
    imageButtons: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
    imgBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: COLORS.white, borderRadius: RADIUS.md, paddingVertical: 14,
        borderWidth: 1.5, borderColor: COLORS.primary, ...SHADOWS.small,
    },
    imgBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
    analyzeBtn: { marginTop: SPACING.lg, borderRadius: RADIUS.md, overflow: 'hidden' },
    analyzeBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54 },
    analyzeBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

    // Progress
    progressContainer: { marginTop: SPACING.md, alignItems: 'center' },
    progressTrack: { width: '100%', height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
    progressText: { fontSize: 13, color: COLORS.textMuted, marginTop: 8, fontStyle: 'italic' },

    // Results
    resultCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, marginTop: SPACING.lg, ...SHADOWS.medium },
    resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    resultTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.background },
    resultLabel: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
    resultValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
    confidenceBar: { flex: 1, height: 8, backgroundColor: COLORS.background, borderRadius: 4, marginHorizontal: 10, overflow: 'hidden' },
    confidenceFill: { height: '100%', borderRadius: 4 },
    confidenceText: { fontSize: 14, fontWeight: '700', width: 50, textAlign: 'right' },

    // Treatments
    treatmentSection: { marginTop: SPACING.lg },
    treatmentHeader: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
    treatmentCard: {
        backgroundColor: '#F1F8E9', borderRadius: RADIUS.md, padding: SPACING.md,
        marginBottom: SPACING.sm, borderLeftWidth: 3, borderLeftColor: '#4CAF50',
    },
    treatmentTypeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    treatmentTypeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    treatmentName: { fontSize: 14, fontWeight: '700', color: '#2E7D32', marginBottom: 4 },
    treatmentDetail: { fontSize: 12, color: '#558B2F', marginTop: 2 },
    noTreatments: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: SPACING.md, backgroundColor: COLORS.white, borderRadius: RADIUS.md },
    noTreatmentsText: { flex: 1, fontSize: 12, color: COLORS.textMuted },

    // Disclaimer
    disclaimerCard: {
        backgroundColor: COLORS.info + '10',
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.info,
    },
    disclaimerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    disclaimerTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.info,
    },
    disclaimerText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        lineHeight: 18,
    },

    
    // Placeholder Guide Styles
    guideWrapper: { position: 'relative', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    guideFrame: { position: 'absolute', width: 100, height: 140, borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.textMuted, borderRadius: 50, opacity: 0.3 },
    guideHint: { fontSize: 11, color: COLORS.primary, marginTop: 4, fontWeight: '500', textAlign: 'center', paddingHorizontal: 20 },
});
