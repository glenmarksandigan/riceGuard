import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Image, TextInput, ActivityIndicator, Dimensions,
    RefreshControl, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { useLanguage } from '../../contexts/LanguageContext';
import { aiService } from '../../services/api.service';
import { API_CONFIG } from '../../services/api.config';
import { useFadeIn } from '../../constants/animations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - SPACING.lg * 2;

export default function DiseaseLibraryScreen() {
    const { t } = useLanguage();
    const [diseases, setDiseases] = useState<any[]>([]);
    const [filtered, setFiltered] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');

    const headerFade = useFadeIn(0, 500);

    const loadData = async () => {
        try {
            const data = await aiService.getDiseases();
            setDiseases(data);
            setFiltered(data);
        } catch (err) {
            console.log('Failed to load diseases:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleSearch = (text: string) => {
        setSearch(text);
        if (!text.trim()) {
            setFiltered(diseases);
            return;
        }
        const filteredData = diseases.filter(d =>
            d.disease_name.toLowerCase().includes(text.toLowerCase()) ||
            (d.scientific_name && d.scientific_name.toLowerCase().includes(text.toLowerCase()))
        );
        setFiltered(filteredData);
    };

    const getImageUrl = (path: string) => {
        if (!path) return null;
        const base = API_CONFIG.PHP_BASE_URL.replace('/app/api', '');
        return `${base}/${path}`;
    };

    const renderDiseaseCard = ({ item, index }: { item: any; index: number }) => (
        <View style={styles.card}>
            {item.reference_image ? (
                <Image
                    source={{ uri: getImageUrl(item.reference_image) || undefined }}
                    style={styles.cardImage}
                    resizeMode="cover"
                />
            ) : (
                <View style={[styles.cardImage, styles.placeholderImg]}>
                    <Ionicons name="leaf-outline" size={40} color={COLORS.textMuted} />
                </View>
            )}

            <View style={styles.cardInfo}>
                <Text style={styles.diseaseName}>{item.disease_name}</Text>
                {item.scientific_name && item.scientific_name !== 'N/A' && (
                    <Text style={styles.scientificName}>{item.scientific_name}</Text>
                )}

                <Text style={styles.label}>{t('symptoms')}</Text>
                <Text style={styles.symptomsText} numberOfLines={3}>
                    {item.common_symptoms}
                </Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Animated.View style={headerFade}>
                <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.header}>
                    <Text style={styles.headerTitle}>📚 {t('diseaseLibrary')}</Text>
                    <Text style={styles.headerSub}>{t('scanSubtitle')}</Text>

                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={20} color={COLORS.textMuted} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={t('searchDiseases')}
                            placeholderTextColor={COLORS.textMuted}
                            value={search}
                            onChangeText={handleSearch}
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => handleSearch('')}>
                                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>
                </LinearGradient>
            </Animated.View>

            {/* AI Disclaimer Card */}
            <View style={{ paddingHorizontal: SPACING.lg, marginTop: SPACING.md }}>
                <View style={styles.disclaimerCard}>
                    <View style={styles.disclaimerHeader}>
                        <Ionicons name="information-circle" size={18} color={COLORS.info} />
                        <Text style={styles.disclaimerTitle}>{t('aiDisclaimerTitle')}</Text>
                    </View>
                    <Text style={styles.disclaimerText}>{t('aiDisclaimerText')}</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.disease_id.toString()}
                    renderItem={renderDiseaseCard}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="search-outline" size={48} color={COLORS.textMuted} />
                            <Text style={styles.emptyText}>{t('noData')}</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        paddingTop: 60,
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.xl,
        borderBottomLeftRadius: RADIUS.xl,
        borderBottomRightRadius: RADIUS.xl,
    },
    headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.white },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4, marginBottom: SPACING.lg },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: RADIUS.md,
        paddingHorizontal: 12,
        height: 48,
        ...SHADOWS.small,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 15,
        color: COLORS.textPrimary,
    },
    list: { padding: SPACING.lg, paddingBottom: 40 },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: RADIUS.lg,
        marginBottom: SPACING.lg,
        overflow: 'hidden',
        ...SHADOWS.medium,
    },
    cardImage: {
        width: '100%',
        height: 180,
        backgroundColor: COLORS.border,
    },
    placeholderImg: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardInfo: {
        padding: SPACING.md,
    },
    diseaseName: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    scientificName: {
        fontSize: 14,
        fontStyle: 'italic',
        color: COLORS.primary,
        marginTop: 2,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        marginTop: SPACING.md,
        marginBottom: 4,
    },
    symptomsText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 20,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { alignItems: 'center', marginTop: 60 },
    emptyText: { fontSize: 16, color: COLORS.textMuted, marginTop: SPACING.md },

    // Disclaimer
    disclaimerCard: {
        backgroundColor: COLORS.info + '10',
        borderRadius: RADIUS.md,
        padding: SPACING.md,
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
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.info,
    },
    disclaimerText: {
        fontSize: 11,
        color: COLORS.textSecondary,
        lineHeight: 16,
    },
});
