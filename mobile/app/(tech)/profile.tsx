// Technologist Profile — with language toggle
import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Alert, Switch,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { userService } from '../../services/api.service';

export default function TechProfileScreen() {
    const { user, logout, updateUser } = useAuth();
    const { lang, setLang, t } = useLanguage();
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState<Record<string, string>>({});

    useFocusEffect(
        useCallback(() => {
            if (user) {
                setForm({
                    fname: user.fname || '', lname: user.lname || '', mname: user.mname || '',
                    contact_number: user.contact_number || '',
                    barangay: user.barangay || '', municipality: user.municipality || '', province: user.province || '',
                });
            }
        }, [user])
    );

    const handleSave = async () => {
        try {
            const result = await userService.updateUser({ user_id: user!.user_id, ...form });
            if (result.error) { Alert.alert(t('error'), result.error); }
            else { updateUser(form); setEditing(false); Alert.alert(t('success'), t('profile') + ' updated!'); }
        } catch (err) { Alert.alert(t('error'), 'Failed to update'); }
    };

    const handleLogout = () => {
        Alert.alert(t('logout'), t('logoutConfirm'), [
            { text: t('cancel'), style: 'cancel' },
            { text: t('logout'), style: 'destructive', onPress: () => { logout(); router.replace('/login'); } },
        ]);
    };

    const fields = [
        { key: 'fname', label: t('firstName').replace(' *', ''), icon: 'person-outline' as const },
        { key: 'lname', label: t('lastName').replace(' *', ''), icon: 'person-outline' as const },
        { key: 'mname', label: t('middleName'), icon: 'person-outline' as const },
        { key: 'contact_number', label: t('contactNumber'), icon: 'call-outline' as const },
        { key: 'barangay', label: t('barangay'), icon: 'location-outline' as const },
        { key: 'municipality', label: t('municipality'), icon: 'location-outline' as const },
        { key: 'province', label: t('province'), icon: 'location-outline' as const },
    ];

    return (
        <ScrollView style={styles.container}>
            <LinearGradient colors={['#0D47A1', '#1E88E5']} style={styles.header}>
                <View style={styles.avatar}>
                    <Ionicons name="person" size={40} color={COLORS.white} />
                </View>
                <Text style={styles.name}>{user?.fname} {user?.lname}</Text>
                <Text style={styles.role}>{t('technologist')}</Text>
            </LinearGradient>

            <View style={styles.content}>
                {/* Language Toggle */}
                <View style={styles.langCard}>
                    <View style={styles.langLeft}>
                        <Ionicons name="globe-outline" size={22} color="#1E88E5" />
                        <View>
                            <Text style={styles.langTitle}>{t('language')}</Text>
                            <Text style={styles.langSub}>
                                {lang === 'en' ? 'English' : 'Bisaya (Cebuano)'}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.langToggle}>
                        <Text style={[styles.langLabel, lang === 'en' && styles.langLabelActive]}>EN</Text>
                        <Switch
                            value={lang === 'bis'}
                            onValueChange={(v) => setLang(v ? 'bis' : 'en')}
                            trackColor={{ false: COLORS.border, true: '#BBDEFB' }}
                            thumbColor={lang === 'bis' ? '#1E88E5' : '#ccc'}
                        />
                        <Text style={[styles.langLabel, lang === 'bis' && styles.langLabelActive]}>BIS</Text>
                    </View>
                </View>

                {/* Personal Info */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('personalInfo')}</Text>
                    <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)}>
                        <Text style={styles.editBtn}>{editing ? '💾 ' + t('save') : '✏️ ' + t('editProfile')}</Text>
                    </TouchableOpacity>
                </View>

                {fields.map((f) => (
                    <View key={f.key} style={styles.fieldRow}>
                        <View style={styles.fieldLeft}>
                            <Ionicons name={f.icon} size={18} color="#1E88E5" />
                            <Text style={styles.fieldLabel}>{f.label}</Text>
                        </View>
                        {editing ? (
                            <TextInput style={styles.fieldInput} value={form[f.key]} onChangeText={(v) => setForm({ ...form, [f.key]: v })} />
                        ) : (
                            <Text style={styles.fieldValue}>{form[f.key] || '—'}</Text>
                        )}
                    </View>
                ))}

                {editing && (
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                        <Text style={styles.cancelText}>{t('cancel')}</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
                    <Text style={styles.logoutText}>{t('logout')}</Text>
                </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        paddingTop: 60, paddingBottom: SPACING.xl, alignItems: 'center',
        borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl,
    },
    avatar: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md,
        borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
    },
    name: { fontSize: 22, fontWeight: '800', color: COLORS.white },
    role: { fontSize: 14, color: '#90CAF9', fontWeight: '600', marginTop: 4 },
    content: { padding: SPACING.lg },

    // Language card
    langCard: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md,
        marginBottom: SPACING.lg, ...SHADOWS.small,
    },
    langLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    langTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
    langSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
    langToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    langLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
    langLabelActive: { color: '#1E88E5' },

    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    editBtn: { fontSize: 14, fontWeight: '600', color: '#1E88E5' },
    fieldRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md,
        marginBottom: SPACING.sm, ...SHADOWS.small,
    },
    fieldLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    fieldLabel: { fontSize: 13, color: COLORS.textSecondary },
    fieldValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
    fieldInput: {
        flex: 1, textAlign: 'right', fontSize: 14, color: COLORS.textPrimary,
        borderBottomWidth: 1, borderBottomColor: '#1E88E5', paddingVertical: 2, marginLeft: 16,
    },
    cancelBtn: { alignItems: 'center', marginTop: SPACING.sm },
    cancelText: { fontSize: 14, color: COLORS.textMuted },
    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        marginTop: SPACING.xl, paddingVertical: 14, borderRadius: RADIUS.md,
        borderWidth: 1.5, borderColor: COLORS.danger,
    },
    logoutText: { fontSize: 15, fontWeight: '600', color: COLORS.danger },
});
