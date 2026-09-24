import { useRef, useEffect, useCallback } from 'react';
import { Animated, Easing, ViewStyle } from 'react-native';

// ── Fade In + Slide Up ──────────────────────────────────
// Screen-level entrance animation
export function useFadeIn(delay = 0, duration = 500) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration,
                delay,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration,
                delay,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return { opacity, transform: [{ translateY }] };
}

// ── Staggered Items ─────────────────────────────────────
// Returns an array of animated values for staggered list items
export function useStaggerFade(count: number, staggerDelay = 80, startDelay = 200) {
    const anims = useRef(
        Array.from({ length: count }, () => ({
            opacity: new Animated.Value(0),
            translateY: new Animated.Value(18),
        }))
    ).current;

    useEffect(() => {
        const animations = anims.map((anim, i) =>
            Animated.parallel([
                Animated.timing(anim.opacity, {
                    toValue: 1,
                    duration: 400,
                    delay: startDelay + i * staggerDelay,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(anim.translateY, {
                    toValue: 0,
                    duration: 400,
                    delay: startDelay + i * staggerDelay,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ])
        );
        Animated.parallel(animations).start();
    }, [count]);

    return anims;
}

// ── Animated Counter ────────────────────────────────────
// Count-up animation for stat numbers
export function useAnimatedCounter(target: number, duration = 800, delay = 300) {
    const animatedValue = useRef(new Animated.Value(0)).current;
    const displayValue = useRef(0);

    useEffect(() => {
        animatedValue.setValue(0);
        Animated.timing(animatedValue, {
            toValue: target,
            duration,
            delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false, // Can't use native driver for text
        }).start();
    }, [target]);

    return animatedValue;
}

// ── Press Scale ─────────────────────────────────────────
// Scale-down effect on press for touchable cards
export function usePressScale(scaleValue = 0.96) {
    const scale = useRef(new Animated.Value(1)).current;

    const onPressIn = useCallback(() => {
        Animated.spring(scale, {
            toValue: scaleValue,
            speed: 50,
            bounciness: 4,
            useNativeDriver: true,
        }).start();
    }, []);

    const onPressOut = useCallback(() => {
        Animated.spring(scale, {
            toValue: 1,
            speed: 40,
            bounciness: 6,
            useNativeDriver: true,
        }).start();
    }, []);

    return { scale, onPressIn, onPressOut };
}

// ── Pulse Animation ─────────────────────────────────────
// Gentle pulse for buttons / attention elements
export function usePulse(active = true) {
    const scale = useRef(new Animated.Value(1)).current;
    const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        if (active) {
            pulseRef.current = Animated.loop(
                Animated.sequence([
                    Animated.timing(scale, {
                        toValue: 1.04,
                        duration: 800,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(scale, {
                        toValue: 1,
                        duration: 800,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            );
            pulseRef.current.start();
        } else {
            pulseRef.current?.stop();
            scale.setValue(1);
        }

        return () => {
            pulseRef.current?.stop();
        };
    }, [active]);

    return scale;
}

// ── Bounce In ───────────────────────────────────────────
// Spring-bounce entrance for icons/elements
export function useBounceIn(delay = 0) {
    const scale = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scale, {
                toValue: 1,
                speed: 8,
                bounciness: 14,
                delay,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 200,
                delay,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return { scale, opacity };
}

// ── Slide In From Bottom ────────────────────────────────
export function useSlideUp(delay = 0, distance = 40) {
    const translateY = useRef(new Animated.Value(distance)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: 0,
                duration: 500,
                delay,
                easing: Easing.out(Easing.back(1.2)),
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 400,
                delay,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return { translateY, opacity };
}
