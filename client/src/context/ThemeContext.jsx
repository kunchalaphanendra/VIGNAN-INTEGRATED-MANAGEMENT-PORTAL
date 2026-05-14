import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
    const { user, updateTheme } = useAuth();
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('vignan-theme') || 'light';
    });

    useEffect(() => {
        if (user?.theme_preference) {
            setTheme(user.theme_preference);
        }
    }, [user]);

    useEffect(() => {
        document.documentElement.className = `theme-${theme}`;
        localStorage.setItem('vignan-theme', theme);
    }, [theme]);

    const toggleTheme = async () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        if (user) {
            try { await updateTheme(newTheme); } catch { }
        }
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
