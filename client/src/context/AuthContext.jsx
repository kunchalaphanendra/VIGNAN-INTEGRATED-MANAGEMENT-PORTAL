import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const res = await api.get('/auth/me');
            setUser(res.data.user);
        } catch {
            setUser(null);
            localStorage.removeItem('vimp_token');
        } finally {
            setLoading(false);
        }
    };

    const login = async (login_id, password, role) => {
        const res = await api.post('/auth/login', { login_id, password, role });
        // Store token in localStorage so Bearer auth works on mobile/network access
        if (res.data.token) {
            localStorage.setItem('vimp_token', res.data.token);
        }
        setUser(res.data.user);
        return res.data;
    };

    const logout = async () => {
        await api.post('/auth/logout');
        localStorage.removeItem('vimp_token');
        setUser(null);
    };

    const updateTheme = async (theme) => {
        await api.patch('/auth/theme', { theme });
        setUser(prev => ({ ...prev, theme_preference: theme }));
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, updateTheme, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
