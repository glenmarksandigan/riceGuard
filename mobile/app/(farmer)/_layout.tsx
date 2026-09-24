import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { useLanguage } from '../../contexts/LanguageContext';

export default function FarmerLayout() {
    const { t } = useLanguage();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.textMuted,
                tabBarStyle: {
                    backgroundColor: COLORS.white,
                    borderTopWidth: 0,
                    elevation: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -3 },
                    shadowOpacity: 0.1,
                    shadowRadius: 6,
                    height: 65,
                    paddingBottom: 8,
                    paddingTop: 6,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: t('tabHome'),
                    tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="scan"
                options={{
                    title: t('tabScan'),
                    tabBarIcon: ({ color, size }) => <Ionicons name="scan-circle" size={size + 4} color={color} />,
                }}
            />
            <Tabs.Screen
                name="diseases"
                options={{
                    title: t('tabDiseases'),
                    tabBarIcon: ({ color, size }) => <Ionicons name="leaf" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="reports"
                options={{
                    title: t('tabReports'),
                    tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="visits"
                options={{
                    title: t('tabVisits'),
                    tabBarIcon: ({ color, size }) => <Ionicons name="walk" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="claims"
                options={{
                    title: t('tabClaims'),
                    tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark" size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: t('tabProfile'),
                    tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
                }}
            />
        </Tabs>
    );
}
