import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, Dimensions, TouchableOpacity,
    FlatList, Animated, Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/api.service';
import { usePressScale } from '../constants/animations';

const { width, height } = Dimensions.get('window');

const SLIDES: { key: string; icon: string; iconColor: string; bgColors: [string, string]; titleKey: string; subKey: string }[] = [
    { key: 'welcome', icon: 'leaf', iconColor: '#4CAF50', bgColors: ['#1B5E20', '#4CAF50'], titleKey: 'demoWelcomeTitle', subKey: 'demoWelcomeSub' },
    { key: 'scan', icon: 'scan-circle', iconColor: '#1E88E5', bgColors: ['#0D47A1', '#1E88E5'], titleKey: 'demoScanTitle', subKey: 'demoScanSub' },
    { key: 'reports', icon: 'document-text', iconColor: '#FB8C00', bgColors: ['#E65100', '#FB8C00'], titleKey: 'demoReportsTitle', subKey: 'demoReportsSub' },
    { key: 'claims', icon: 'shield-checkmark', iconColor: '#7B1FA2', bgColors: ['#4A148C', '#7B1FA2'], titleKey: 'demoClaimsTitle', subKey: 'demoClaimsSub' },
    { key: 'language', icon: 'globe', iconColor: '#00897B', bgColors: ['#004D40', '#00897B'], titleKey: 'demoLangTitle', subKey: 'demoLangSub' },
];

// ── Animated Slide ──────────────────────────────────────
function SlideContent({ item, isActive }: { item: typeof SLIDES[0]; isActive: boolean }) {
    const iconScale = useRef(new Animated.Value(0)).current;
    const iconRotation = useRef(new Animated.Value(0)).current;
    const titleOpacity = useRef(new Animated.Value(0)).current;
    const titleTranslate = useRef(new Animated.Value(20)).current;
    const subOpacity = useRef(new Animated.Value(0)).current;
    const subTranslate = useRef(new Animated.Value(20)).current;
    const { t } = useLanguage();

    useEffect(() => {
        if (isActive) {
            // Reset
            iconScale.setValue(0);
            iconRotation.setValue(0);
            titleOpacity.setValue(0);
            titleTranslate.setValue(20);
            subOpacity.setValue(0);
            subTranslate.setValue(20);

            // Bounce in icon
            Animated.spring(iconScale, {
                toValue: 1, speed: 8, bounciness: 14, delay: 100,
                useNativeDriver: true,
            }).start();

            // Subtle rotation
            Animated.timing(iconRotation, {
                toValue: 1, duration: 600, delay: 100,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }).start();

            // Title fade in
            Animated.parallel([
                Animated.timing(titleOpacity, { toValue: 1, duration: 400, delay: 300, useNativeDriver: true }),
                Animated.timing(titleTranslate, { toValue: 0, duration: 400, delay: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]).start();

            // Subtitle fade in
            Animated.parallel([
                Animated.timing(subOpacity, { toValue: 1, duration: 400, delay: 500, useNativeDriver: true }),
                Animated.timing(subTranslate, { toValue: 0, duration: 400, delay: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]).start();
        }
    }, [isActive]);

    const rotate = iconRotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['-10deg', '0deg'],
    });

    return (
        <View style={styles.slideContent}>
            <Animated.View style={[styles.iconCircle, {
                transform: [{ scale: iconScale }, { rotate }],
            }]}>
                <Ionicons name={item.icon as any} size={72} color={COLORS.white} />
            </Animated.View>
            <Animated.Text style={[styles.slideTitle, { opacity: titleOpacity, transform: [{ translateY: titleTranslate }] }]}>
                {t(item.titleKey)}
            </Animated.Text>
            <Animated.Text style={[styles.slideSub, { opacity: subOpacity, transform: [{ translateY: subTranslate }] }]}>
                {t(item.subKey)}
            </Animated.Text>
        </View>
    );
}

// ── Animated Dot Indicator ──────────────────────────────
function DotIndicator({ count, scrollX }: { count: number; scrollX: Animated.Value }) {
    return (
        <View style={styles.dotsRow}>
            {Array.from({ length: count }).map((_, i) => {
                const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                const dotWidth = scrollX.interpolate({
                    inputRange,
                    outputRange: [8, 24, 8],
                    extrapolate: 'clamp',
                });
                const dotOpacity = scrollX.interpolate({
                    inputRange,
                    outputRange: [0.3, 1, 0.3],
                    extrapolate: 'clamp',
                });
                return (
                    <Animated.View
                        key={i}
                        style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]}
                    />
                );
            })}
        </View>
    );
}

export default function DemoScreen() {
    const router = useRouter();
    const { t } = useLanguage();
    const { user, updateUser } = useAuth();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;
    const { scale: nextScale, onPressIn, onPressOut } = usePressScale(0.92);

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
            setCurrentIndex(currentIndex + 1);
        } else {
            handleFinish();
        }
    };

    const handleFinish = async () => {
        if (user?.user_id) {
            try {
                await userService.updateUser({ user_id: user.user_id, has_seen_demo: 1 });
                updateUser({ has_seen_demo: 1 });
            } catch (err) {
                console.log('Failed to update demo flag:', err);
            }
        }
        const route = user?.type_name === 'Farmer' ? '/(farmer)/' : '/(tech)/';
        router.replace(route as any);
    };

    const renderSlide = ({ item, index }: { item: typeof SLIDES[0]; index: number }) => (
        <LinearGradient colors={item.bgColors} style={styles.slide}>
            <SlideContent item={item} isActive={currentIndex === index} />
        </LinearGradient>
    );

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={renderSlide}
                keyExtractor={(item) => item.key}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                    setCurrentIndex(idx);
                }}
            />

            {/* Bottom Controls */}
            <View style={styles.bottomBar}>
                {/* Skip */}
                <TouchableOpacity onPress={handleFinish} style={styles.skipBtn}>
                    <Text style={styles.skipText}>{t('skip')}</Text>
                </TouchableOpacity>

                {/* Animated Dots */}
                <DotIndicator count={SLIDES.length} scrollX={scrollX} />

                {/* Next / Get Started with press scale */}
                <Animated.View style={{ transform: [{ scale: nextScale }] }}>
                    <TouchableOpacity
                        onPress={handleNext}
                        onPressIn={onPressIn}
                        onPressOut={onPressOut}
                        style={styles.nextBtn}
                        activeOpacity={1}
                    >
                        <LinearGradient
                            colors={[COLORS.primary, COLORS.primaryLight]}
                            style={styles.nextBtnGrad}
                        >
                            <Text style={styles.nextText}>
                                {currentIndex === SLIDES.length - 1 ? t('getStarted') : t('next')}
                            </Text>
                            <Ionicons
                                name={currentIndex === SLIDES.length - 1 ? 'checkmark-circle' : 'arrow-forward'}
                                size={18}
                                color={COLORS.white}
                            />
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    slide: { width, height, justifyContent: 'center', alignItems: 'center' },
    slideContent: { alignItems: 'center', paddingHorizontal: 40 },
    iconCircle: {
        width: 140, height: 140, borderRadius: 70,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 40,
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
    },
    slideTitle: {
        fontSize: 28, fontWeight: '800', color: COLORS.white,
        textAlign: 'center', marginBottom: 16,
    },
    slideSub: {
        fontSize: 16, color: 'rgba(255,255,255,0.85)',
        textAlign: 'center', lineHeight: 24,
    },
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg, paddingBottom: 40, paddingTop: 20,
    },
    skipBtn: { width: 80 },
    skipText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
    dotsRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    dot: {
        height: 8, borderRadius: 4,
        backgroundColor: COLORS.white,
    },
    nextBtn: { borderRadius: RADIUS.md, overflow: 'hidden' },
    nextBtnGrad: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 20, paddingVertical: 12,
        borderRadius: RADIUS.md,
    },
    nextText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
