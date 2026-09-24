import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import translations, { LangKey } from '../constants/translations';

interface LanguageContextType {
    lang: LangKey;
    setLang: (lang: LangKey) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = '@riceguard_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [lang, setLangState] = useState<LangKey>('en');

    // Load saved language on mount
    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
            if (saved === 'en' || saved === 'bis') {
                setLangState(saved);
            }
        });
    }, []);

    const setLang = (newLang: LangKey) => {
        setLangState(newLang);
        AsyncStorage.setItem(STORAGE_KEY, newLang);
    };

    const t = (key: string): string => {
        const entry = translations[key];
        if (!entry) return key; // fallback to key if not found
        return entry[lang] || entry.en || key;
    };

    return (
        <LanguageContext.Provider value={{ lang, setLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage(): LanguageContextType {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
