import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' }
});

// Response interceptor for auth errors
let _isRedirecting = false;
api.interceptors.response.use(
    response => response,
    error => {
        const url = error.config?.url || '';
        // Only redirect on 401 for non-auth-check requests, and prevent multiple redirects
        if (
            !_isRedirecting &&
            error.response &&
            error.response.status === 401 &&
            !url.includes('/auth/me')
        ) {
            _isRedirecting = true;
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default api;
