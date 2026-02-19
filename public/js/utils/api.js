const api = axios.create({
    baseURL: '/', // Adjust this if your API is on a different base URL
    timeout: 10000,
});

// Request Interceptor: Attach Access Token
api.interceptors.request.use(
    (config) => {
        const token = window.USER_ACCESS_TOKEN;
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`; // Just in case backend expects Bearer
            // Note: If you are sending to Supabase directly, headers might differ (apikey + Authorization)
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle 401 & Silent Refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // If error is 401 and we haven't retried yet
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
            console.log('[API] 401 Detected! Initiating Silent Refresh...');
            console.log('[API] Original Request:', originalRequest.method, originalRequest.url);

            if (isRefreshing) {
                // If already refreshing, add to queue
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers['Authorization'] = 'Bearer ' + token;
                    return api(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Fallback: Try to get refresh token from cookie via document.cookie (if not HttpOnly) - Usually HttpOnly, so this might fail but worth a shot or relying on backend session
                // Since our cookie is HttpOnly, we can't read it here.
                // But we can try to rely on "withCredentials". 
                // However, previous logs showed no cookie.

                // Call Refresh Endpoint with explicit cookie support
                const response = await axios.post('/auth/refresh', {}, { withCredentials: true });
                const { access_token } = response.data;

                // Update Memory Token
                window.USER_ACCESS_TOKEN = access_token;

                // Process Queue
                processQueue(null, access_token);

                // Retry Original Request
                // Update header
                originalRequest.headers['Authorization'] = 'Bearer ' + access_token;
                return api(originalRequest);

            } catch (err) {
                processQueue(err, null);

                // If Refresh Fails (Session Dead) -> Redirect or Logout
                console.error('Session expired or refresh failed', err);

                // Optional: Show "Session Expired" alert before redirect
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Session Expired',
                        text: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
                        confirmButtonText: 'ไปหน้า Login',
                        allowOutsideClick: false
                    }).then(() => {
                        window.location.href = '/login?session_expired=true';
                    });
                } else {
                    alert('Session expired (Refresh Failed). Status: ' + (err.response ? err.response.status : 'Unknown') + '. ' + err.message);
                    window.location.href = '/login?session_expired=true';
                }

                return Promise.reject(err);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

// Expose api to global scope (so list.js can use it)
window.api = api;
