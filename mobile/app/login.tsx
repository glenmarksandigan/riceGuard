import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS, FONTS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { authService } from '../services/api.service';
import { useFadeIn, useBounceIn, usePressScale } from '../constants/animations';

export default function LoginScreen() {
    const router = useRouter();
    const { login } = useAuth();
    const { t } = useLanguage();
    const [contactNumber, setContactNumber] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Animations
    const iconBounce = useBounceIn(200);
    const titleFade = useFadeIn(400, 500);
    const formFade = useFadeIn(600, 500);
    const { scale: btnScale, onPressIn, onPressOut } = usePressScale(0.96);

    const handleLogin = async () => {
        if (!contactNumber || !password) {
            Alert.alert(t('error'), t('loginError'));
            return;
        }

        setLoading(true);
        try {
            const result = await authService.login(contactNumber, password);
            if (result.error) {
                Alert.alert(t('loginFailed'), result.error);
            } else {
                login(result.user);
                // Show demo on first login
                if (!result.user.has_seen_demo || result.user.has_seen_demo === 0 || result.user.has_seen_demo === '0') {
                    router.replace('/demo');
                } else {
                    const route = result.user.type_name === 'Farmer' ? '/(farmer)/' : '/(tech)/';
                    router.replace(route);
                }
            }
        } catch (err) {
            Alert.alert(t('error'), t('serverError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.gradient}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                    {/* Header with animations */}
                    <View style={styles.header}>
                        <Animated.View style={[styles.iconCircle, { opacity: iconBounce.opacity, transform: [{ scale: iconBounce.scale }] }]}>
                            <Ionicons name="leaf" size={48} color={COLORS.white} />
                        </Animated.View>
                        <Animated.View style={titleFade}>
                            <Text style={styles.title}>{t('loginTitle')}</Text>
                            <Text style={styles.subtitle}>{t('loginSubtitle')}</Text>
                        </Animated.View>
                    </View>

                    {/* Form Card with slide-up */}
                    <Animated.View style={[styles.card, formFade]}>
                        <View style={styles.inputContainer}>
                            <Ionicons name="call-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder={t('contactNumber')}
                                placeholderTextColor={COLORS.textMuted}
                                value={contactNumber}
                                onChangeText={setContactNumber}
                                keyboardType="phone-pad"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder={t('password')}
                                placeholderTextColor={COLORS.textMuted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1}>
                                <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.loginBtnGradient}>
                                    {loading ? (
                                        <ActivityIndicator color={COLORS.white} />
                                    ) : (
                                        <>
                                            <Ionicons name="log-in-outline" size={20} color={COLORS.white} />
                                            <Text style={styles.loginBtnText}>{t('signIn')}</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>

                        <TouchableOpacity style={styles.registerLink} onPress={() => router.push('/register')}>
                            <Text style={styles.registerText}>
                                {t('noAccount')} <Text style={styles.registerHighlight}>{t('signUp')}</Text>
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    container: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: SPACING.lg,
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    iconCircle: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: COLORS.white,
        letterSpacing: 1,
    },
    subtitle: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 6,
    },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: RADIUS.xl,
        padding: SPACING.lg,
        ...SHADOWS.large,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
        marginBottom: SPACING.md,
        height: 52,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    inputIcon: { marginRight: SPACING.sm },
    input: {
        flex: 1,
        fontSize: 15,
        color: COLORS.textPrimary,
    },
    loginBtn: {
        marginTop: SPACING.sm,
        borderRadius: RADIUS.md,
        overflow: 'hidden',
    },
    loginBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        gap: 8,
    },
    loginBtnText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
    },
    registerLink: {
        marginTop: SPACING.lg,
        alignItems: 'center',
    },
    registerText: {
        color: COLORS.textSecondary,
        fontSize: 14,
    },
    registerHighlight: {
        color: COLORS.primary,
        fontWeight: '700',
    },
});
