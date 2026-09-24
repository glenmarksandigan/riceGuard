import React, { createContext, useState, useContext } from 'react';

// User type matches the shape returned by the PHP auth API
export interface User {
    user_id: number;
    user_type_id: number;
    type_name: string;
    fname: string;
    lname: string;
    mname: string;
    contact_number: string;
    created_at: string;
    barangay?: string;
    municipality?: string;
    province?: string;
    [key: string]: any; // allow extra fields
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (userData: User) => void;
    logout: () => void;
    updateUser: (updatedData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const login = (userData: User) => {
        setUser(userData);
    };

    const logout = () => {
        setUser(null);
    };

    const updateUser = (updatedData: Partial<User>) => {
        setUser((prev) => (prev ? { ...prev, ...updatedData } : null));
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
