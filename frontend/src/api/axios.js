import axios from 'axios';

const api = axios.create({
    baseURL: `http://${window.location.hostname}:8000`, // Dynamic Local Backend
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle 401
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            console.error(`[API Error] ${error.config.method.toUpperCase()} ${error.config.url}:`, {
                status: error.response.status,
                data: error.response.data
            });
            
            if (error.response.status === 401) {
                console.warn("[Auth] 401 Unauthorized detected. Token might be invalid or expired.");
                // localStorage.removeItem('token'); // Temporarily disable removal to see if it fixes the follow-up 401
            }
        } else {
            console.error(`[Network Error] ${error.config?.method.toUpperCase()} ${error.config?.url}:`, error.message);
        }
        return Promise.reject(error);
    }
);

export default api;
