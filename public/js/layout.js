// Global Fetch Interceptor to handle Session Expiration
const originalFetch = window.fetch;
window.fetch = async function (...args) {
    try {
        const response = await originalFetch(...args);

        // Check if response is a redirect to login page (Session Expired handled by backend redirect)
        if (response.redirected && response.url.includes('/login')) {
            window.location.href = '/login?session_expired=true';
            return new Promise(() => { }); // Return never-resolving promise to stop execution while redirecting
        }

        // Check for 401 Unauthorized (Session Expired handled by backend 401)
        if (response.status === 401) {
            window.location.href = '/login?session_expired=true';
            return new Promise(() => { }); // Return never-resolving promise to stop execution
        }

        return response;
    } catch (error) {
        throw error;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Mobile Menu Toggle
    const btn = document.getElementById('mobile-menu-btn');
    const menu = document.getElementById('mobile-menu');

    if (btn && menu) {
        btn.addEventListener('click', () => {
            menu.classList.toggle('hidden');
        });
    }
});
