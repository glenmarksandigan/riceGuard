import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator, FlatList,
    TouchableOpacity, Image, Linking, RefreshControl
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { reportService } from '../../services/api.service';
import { API_CONFIG } from '../../services/api.config';

export default function TechMapScreen() {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const getImageUrl = (path: string) => {
        const base = API_CONFIG.PHP_BASE_URL.replace('/app/api', '');
        return `${base}/${path}`;
    };

    const loadReports = async () => {
        try {
            const data = await reportService.getReports({});
            // Filter only reports with valid coordinates
            const mapped = Array.isArray(data)
                ? data.filter(r => r.latitude && r.longitude && !isNaN(parseFloat(r.latitude)))
                : [];
            setReports(mapped);
        } catch (err) {
            console.error('Failed to load reports for map:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => {
        loadReports();
    }, []));

    const onRefresh = () => {
        setRefreshing(true);
        loadReports();
    };

    const openInMaps = (lat: string, lng: string) => {
        const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        Linking.openURL(url);
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.reportId}>Report #{item.report_id}</Text>
                    <Text style={styles.farmerName}>{item.fname} {item.lname}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: item.status === 'Pending' ? '#FFF3E0' : '#E8F5E9' }]}>
                    <Text style={[styles.statusText, { color: item.status === 'Pending' ? '#E65100' : '#2E7D32' }]}>{item.status}</Text>
                </View>
            </View>

            <View style={styles.cardBody}>
                {item.images && item.images.length > 0 ? (
                    <Image source={{ uri: getImageUrl(item.images[0]) }} style={styles.thumb} />
                ) : (
                    <View style={styles.thumbEmpty}>
                        <Ionicons name="image-outline" size={24} color={COLORS.textMuted} />
                    </View>
                )}
                <View style={styles.info}>
                    <Text style={styles.location} numberOfLines={2}>📍 {item.field_location || 'No address provided'}</Text>
                    <Text style={styles.date}>📅 {new Date(item.reported_at).toLocaleDateString()}</Text>
                    <Text style={styles.coords}>{parseFloat(item.latitude).toFixed(4)}, {parseFloat(item.longitude).toFixed(4)}</Text>
                </View>
            </View>

            <TouchableOpacity
                style={styles.mapBtn}
                onPress={() => openInMaps(item.latitude, item.longitude)}
            >
                <LinearGradient colors={['#2E7D32', '#388E3C']} style={styles.mapBtnGrad}>
                    <Ionicons name="navigate-circle-outline" size={18} color={COLORS.white} />
                    <Text style={styles.mapBtnText}>Navigate to Field</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    if (loading && !refreshing) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading visitation list...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#1B5E20', '#2E7D32']} style={styles.header}>
                <Text style={styles.title}>🗺️ Field Visitations</Text>
                <Text style={styles.subtitle}>{reports.length} locations pending visit</Text>
            </LinearGradient>

            <FlatList
                data={reports}
                keyExtractor={(item) => item.report_id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="map-outline" size={64} color={COLORS.textMuted} />
                        <Text style={styles.emptyText}>No geo-tagged reports found.</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: COLORS.textMuted, fontSize: 14 },
    header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    title: { fontSize: 22, fontWeight: '800', color: COLORS.white },
    subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    list: { padding: 20, paddingBottom: 40 },
    card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 16, ...SHADOWS.small },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    reportId: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
    farmerName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusText: { fontSize: 11, fontWeight: '700' },
    cardBody: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    thumb: { width: 80, height: 80, borderRadius: 12, backgroundColor: COLORS.border },
    thumbEmpty: { width: 80, height: 80, borderRadius: 12, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
    info: { flex: 1, justifyContent: 'center' },
    location: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600' },
    date: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
    coords: { fontSize: 10, color: COLORS.textMuted, marginTop: 2, fontStyle: 'italic' },
    mapBtn: { borderRadius: 12, overflow: 'hidden' },
    mapBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44 },
    mapBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 16, color: COLORS.textMuted },
});
