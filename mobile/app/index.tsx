import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.5)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
            ]),
            Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();

        const timer = setTimeout(() => {
            if (user) {
                const route = user.type_name === 'Farmer' ? '/(farmer)/' : '/(tech)/';
                router.replace(route);
            } else {
                router.replace('/login');
            }
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.container}>
            <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
                <View style={styles.iconCircle}>
                    <Ionicons name="leaf" size={64} color={COLORS.white} />
                </View>
            </Animated.View>

            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                <Text style={styles.title}>RiceGuard</Text>
                <Text style={styles.subtitle}>AI-Powered Rice Disease Detection</Text>
            </Animated.View>

            <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
                <Text style={styles.footerText}>Protecting Filipino Rice Farms</Text>
            </Animated.View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoContainer: {
        marginBottom: 24,
    },
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    title: {
        fontSize: 36,
        fontWeight: '800',
        color: COLORS.white,
        textAlign: 'center',
        letterSpacing: 1,
    },
    subtitle: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.85)',
        textAlign: 'center',
        marginTop: 8,
    },
    footer: {
        position: 'absolute',
        bottom: 50,
    },
    footerText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
    },
});
