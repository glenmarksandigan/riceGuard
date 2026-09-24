import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
    Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { authService } from '../services/api.service';
import { MUNICIPALITY, PROVINCE, BARANGAYS } from '../constants/candijay-data';

export default function RegisterScreen() {
    const router = useRouter();
    const { t } = useLanguage();

    const SUFFIXES = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'V'];
    const [form, setForm] = useState({
        fname: '', lname: '', mname: '', suffix: '', contact_number: '', password: '', confirmPassword: '',
        user_type_id: 1, // Farmers only
        barangay: '', purok: '', municipality: MUNICIPALITY, province: PROVINCE, zip_code: '',
    });
    const [showSuffixPicker, setShowSuffixPicker] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showBarangayPicker, setShowBarangayPicker] = useState(false);

    const update = (key: string, value: string | number) => setForm({ ...form, [key]: value });

    const handleRegister = async () => {
        if (!form.fname || !form.lname || !form.contact_number || !form.password) {
            Alert.alert(t('error'), t('regFillFields'));
            return;
        }
        if (form.password !== form.confirmPassword) {
            Alert.alert(t('error'), t('regPasswordMatch'));
            return;
        }
        if (form.password.length < 6) {
            Alert.alert(t('error'), t('regPasswordLength'));
            return;
        }

        setLoading(true);
        try {
            const { confirmPassword, purok, ...data } = form;
            // Combine purok into barangay field for storage
            const finalData = {
                ...data,
                barangay: purok ? `${form.barangay}, ${purok}` : form.barangay,
                zip_code: form.zip_code,
            };
            const result = await authService.register(finalData);
            if (result.error) {
                Alert.alert(t('regFailed'), result.error);
            } else {
                Alert.alert(t('success'), t('regSuccess'), [
                    { text: t('ok'), onPress: () => router.replace('/login') },
                ]);
            }
        } catch (err) {
            Alert.alert(t('error'), t('serverError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={{ flex: 1 }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                        </TouchableOpacity>
                        <Text style={styles.title}>{t('createAccount')}</Text>
                        <Text style={styles.subtitle}>{t('registerAsFarmer')}</Text>
                    </View>

                    {/* Form */}
                    <View style={styles.card}>
                        {/* Personal Info */}
                        <Text style={styles.sectionLabel}>{t('personalInfo')}</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="person-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput style={styles.input} placeholder={t('firstName')} placeholderTextColor={COLORS.textMuted}
                                value={form.fname} onChangeText={(v) => update('fname', v)} />
                        </View>
                        <View style={styles.inputContainer}>
                            <Ionicons name="person-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput style={styles.input} placeholder={t('lastName')} placeholderTextColor={COLORS.textMuted}
                                value={form.lname} onChangeText={(v) => update('lname', v)} />
                        </View>
                        <View style={styles.inputContainer}>
                            <Ionicons name="person-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput style={styles.input} placeholder={t('middleName')} placeholderTextColor={COLORS.textMuted}
                                value={form.mname} onChangeText={(v) => update('mname', v)} />
                        </View>

                        {/* Name Suffix / Extension */}
                        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowSuffixPicker(true)}>
                            <Ionicons name="ribbon-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                            <Text style={[styles.pickerText, form.suffix && { color: COLORS.textPrimary }]}>
                                {form.suffix || t('selectSuffix')}
                            </Text>
                            <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
                        </TouchableOpacity>
                        <View style={styles.inputContainer}>
                            <Ionicons name="call-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput style={styles.input} placeholder={t('contactNumberRequired')} placeholderTextColor={COLORS.textMuted}
                                value={form.contact_number} onChangeText={(v) => update('contact_number', v)} keyboardType="phone-pad" />
                        </View>

                        {/* Address */}
                        <Text style={styles.sectionLabel}>{t('address')}</Text>

                        {/* Barangay Picker */}
                        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowBarangayPicker(true)}>
                            <Ionicons name="location-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                            <Text style={[styles.pickerText, form.barangay && { color: COLORS.textPrimary }]}>
                                {form.barangay || t('selectBarangay')}
                            </Text>
                            <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
                        </TouchableOpacity>

                        {/* Purok */}
                        <View style={styles.inputContainer}>
                            <Ionicons name="home-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput style={styles.input} placeholder={t('purokPlaceholder')} placeholderTextColor={COLORS.textMuted}
                                value={form.purok} onChangeText={(v) => update('purok', v)} />
                        </View>

                        {/* Municipality (read-only) */}
                        <View style={[styles.inputContainer, styles.readOnly]}>
                            <Ionicons name="business-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                            <Text style={styles.readOnlyText}>{t('municipality')}: {form.municipality}</Text>
                        </View>

                        {/* Province (read-only) */}
                        <View style={[styles.inputContainer, styles.readOnly]}>
                            <Ionicons name="map-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                            <Text style={styles.readOnlyText}>{t('province')}: {form.province}</Text>
                        </View>

                        {/* Zip Code */}
                        <View style={styles.inputContainer}>
                            <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput style={styles.input} placeholder={t('zipCodePlaceholder')} placeholderTextColor={COLORS.textMuted}
                                value={form.zip_code} onChangeText={(v) => update('zip_code', v)} keyboardType="numeric" maxLength={10} />
                        </View>

                        {/* Security */}
                        <Text style={styles.sectionLabel}>{t('security')}</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput style={styles.input} placeholder={t('passwordRequired')} placeholderTextColor={COLORS.textMuted}
                                value={form.password} onChangeText={(v) => update('password', v)} secureTextEntry />
                        </View>
                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput style={styles.input} placeholder={t('confirmPassword')} placeholderTextColor={COLORS.textMuted}
                                value={form.confirmPassword} onChangeText={(v) => update('confirmPassword', v)} secureTextEntry />
                        </View>

                        {/* Submit */}
                        <TouchableOpacity style={styles.submitBtn} onPress={handleRegister} disabled={loading} activeOpacity={0.8}>
                            <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.submitBtnGradient}>
                                {loading ? (
                                    <ActivityIndicator color={COLORS.white} />
                                ) : (
                                    <Text style={styles.submitBtnText}>{t('registerBtn')}</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/login')}>
                            <Text style={styles.loginText}>
                                {t('hasAccount')} <Text style={styles.loginHighlight}>{t('signIn')}</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Barangay Picker Modal */}
            <Modal visible={showBarangayPicker} animationType="fade" transparent>
                <TouchableOpacity
                    style={styles.pickerOverlay}
                    activeOpacity={1}
                    onPress={() => setShowBarangayPicker(false)}
                >
                    <View style={styles.pickerModal}>
                        <Text style={styles.pickerTitle}>{t('selectBarangay')}</Text>
                        <Text style={styles.pickerSubtitle}>Candijay, Bohol</Text>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {BARANGAYS.map((brgy) => (
                                <TouchableOpacity
                                    key={brgy}
                                    style={[
                                        styles.pickerItem,
                                        form.barangay === brgy && styles.pickerItemActive,
                                    ]}
                                    onPress={() => {
                                        update('barangay', brgy);
                                        setShowBarangayPicker(false);
                                    }}
                                >
                                    <Ionicons
                                        name="location"
                                        size={16}
                                        color={form.barangay === brgy ? COLORS.primary : COLORS.textMuted}
                                    />
                                    <Text style={[
                                        styles.pickerItemText,
                                        form.barangay === brgy && { color: COLORS.primary, fontWeight: '700' }
                                    ]}>
                                        {brgy}
                                    </Text>
                                    {form.barangay === brgy && (
                                        <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Suffix Picker Modal */}
            <Modal visible={showSuffixPicker} animationType="fade" transparent>
                <TouchableOpacity
                    style={styles.pickerOverlay}
                    activeOpacity={1}
                    onPress={() => setShowSuffixPicker(false)}
                >
                    <View style={styles.pickerModal}>
                        <Text style={styles.pickerTitle}>{t('nameSuffix')}</Text>
                        <Text style={styles.pickerSubtitle}>{t('selectSuffix')}</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {SUFFIXES.map((suffix) => (
                                <TouchableOpacity
                                    key={suffix || 'none'}
                                    style={[
                                        styles.pickerItem,
                                        form.suffix === suffix && styles.pickerItemActive,
                                    ]}
                                    onPress={() => {
                                        update('suffix', suffix);
                                        setShowSuffixPicker(false);
                                    }}
                                >
                                    <Ionicons
                                        name="ribbon"
                                        size={16}
                                        color={form.suffix === suffix ? COLORS.primary : COLORS.textMuted}
                                    />
                                    <Text style={[
                                        styles.pickerItemText,
                                        form.suffix === suffix && { color: COLORS.primary, fontWeight: '700' }
                                    ]}>
                                        {suffix || 'None'}
                                    </Text>
                                    {form.suffix === suffix && (
                                        <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: SPACING.lg, paddingTop: 60 },
    header: { marginBottom: SPACING.lg },
    backBtn: { marginBottom: SPACING.md },
    title: { fontSize: 28, fontWeight: '800', color: COLORS.white },
    subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: RADIUS.xl,
        padding: SPACING.lg,
        ...SHADOWS.large,
        marginBottom: SPACING.xl,
    },
    sectionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.sm, marginTop: SPACING.md },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background,
        borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, marginBottom: SPACING.sm,
        height: 48, borderWidth: 1, borderColor: COLORS.border,
    },
    inputIcon: { marginRight: SPACING.sm },
    input: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
    readOnly: { backgroundColor: '#F0F4F0', borderColor: '#E0E5E0' },
    readOnlyText: { flex: 1, fontSize: 14, color: COLORS.textSecondary },
    pickerBtn: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background,
        borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, marginBottom: SPACING.sm,
        height: 48, borderWidth: 1, borderColor: COLORS.border,
    },
    pickerText: { flex: 1, fontSize: 14, color: COLORS.textMuted },
    submitBtn: { marginTop: SPACING.md, borderRadius: RADIUS.md, overflow: 'hidden' },
    submitBtnGradient: { alignItems: 'center', justifyContent: 'center', height: 52 },
    submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
    loginLink: { marginTop: SPACING.lg, alignItems: 'center' },
    loginText: { color: COLORS.textSecondary, fontSize: 14 },
    loginHighlight: { color: COLORS.primary, fontWeight: '700' },

    // Picker Modal
    pickerOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center', paddingHorizontal: SPACING.lg,
    },
    pickerModal: {
        backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: SPACING.lg,
        elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15, shadowRadius: 12,
    },
    pickerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    pickerSubtitle: { fontSize: 13, color: COLORS.textMuted, marginBottom: SPACING.md },
    pickerItem: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        padding: SPACING.sm, borderRadius: RADIUS.md, marginBottom: 2,
    },
    pickerItemActive: { backgroundColor: COLORS.primaryFaded },
    pickerItemText: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
});
