import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' }
});

// Attach stored token as Authorization header on every request
// This ensures mobile/network access works even when cookies don't travel through proxy
api.interceptors.request.use(config => {
    const token = localStorage.getItem('vimp_token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor for auth errors
let _isRedirecting = false;
api.interceptors.response.use(
    response => response,
    error => {
        const url = error.config?.url || '';
        if (
            !_isRedirecting &&
            error.response &&
            error.response.status === 401 &&
            !url.includes('/auth/me')
        ) {
            _isRedirecting = true;
            localStorage.removeItem('vimp_token');
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default api;
