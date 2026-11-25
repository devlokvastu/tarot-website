/**
 * TrikalDarshi Tarot — Universal Backend Adapter (GitHub Pages + Google Apps Script)
 *
 * HOW TO CONNECT GOOGLE APPS SCRIPT:
 * 1. Deploy google-apps-script/Code.gs as a Google Apps Script Web App.
 * 2. Paste your Web App URL ("https://script.google.com/macros/s/.../exec") below.
 *    (Leave as placeholder if running locally with Node/Express server.js.)
 */
window.GAS_BACKEND_URL = "https://script.google.com/macros/s/AKfycby7oS1Yxn_poJBDpNLaI5KRR8_abcSBqHGUMMxW99FM1aee6Buv-Iq8YQVhSlOiTXK-tA/exec";

(function () {
    const rawUrl = (window.GAS_BACKEND_URL || '').trim();
    const isGasActive = rawUrl.startsWith('https://script.google.com/');
    if (!isGasActive) return;

    const GAS_URL = rawUrl;
    const nativeFetch = window.fetch.bind(window);
    const TOKEN_KEY = 'admin_token';

    function getToken() {
        try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
    }

    function setToken(t) {
        try {
            if (t) localStorage.setItem(TOKEN_KEY, t);
            else localStorage.removeItem(TOKEN_KEY);
        } catch (e) {}
    }

    function makeJsonResponse(data, fallbackStatus) {
        let status = fallbackStatus || 200;
        if (data && typeof data === 'object' && !Array.isArray(data) && data._httpStatus) {
            status = data._httpStatus;
            delete data._httpStatus;
        }
        if (status === 401) setToken('');
        return new Response(JSON.stringify(data), {
            status: status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    window.fetch = async function (input, init) {
        const reqUrl = typeof input === 'string' ? input : (input && input.url) || '';
        if (!reqUrl.startsWith('/api/')) {
            return nativeFetch(input, init);
        }

        const method = ((init && init.method) || 'GET').toUpperCase();
        const parsed = new URL(reqUrl, window.location.origin);
        const pathName = parsed.pathname;
        const token = getToken();

        let bodyObj = {};
        if (init && init.body && typeof init.body === 'string') {
            try { bodyObj = JSON.parse(init.body); } catch (e) { bodyObj = {}; }
        }

        // --- Route public GET requests (no admin token in URL query string) ---
        if (method === 'GET') {
            const qs = new URLSearchParams();
            if (pathName === '/api/slots') {
                qs.set('action', 'slots');
                qs.set('plan', parsed.searchParams.get('plan') || '0');
                qs.set('_t', Date.now().toString());
                const gasRes = await nativeFetch(`${GAS_URL}?${qs.toString()}`, { method: 'GET', redirect: 'follow' });
                const json = await gasRes.json();
                return makeJsonResponse(json, gasRes.status);
            }
            if (pathName === '/api/config' && !token) {
                qs.set('action', 'config');
                qs.set('_t', Date.now().toString());
                const gasRes = await nativeFetch(`${GAS_URL}?${qs.toString()}`, { method: 'GET', redirect: 'follow' });
                const json = await gasRes.json();
                return makeJsonResponse(json, gasRes.status);
            }
            if (pathName !== '/api/auth/check' && pathName !== '/api/config' && pathName !== '/api/bookings' &&
                pathName !== '/api/admin/export-database' && pathName !== '/api/admin/export-db') {
                return makeJsonResponse({ error: 'Unsupported GET route: ' + pathName }, 404);
            }
        }

        // --- Route authenticated reads & all mutations via POST (keeps tokens out of URLs) ---
        let postAction = '';
        const payload = { ...bodyObj, token: token };

        if (method === 'GET' && pathName === '/api/auth/check') postAction = 'auth_check';
        else if (method === 'GET' && pathName === '/api/config') postAction = 'config';
        else if (method === 'GET' && pathName === '/api/bookings') postAction = 'bookings';
        else if (method === 'GET' && (pathName === '/api/admin/export-database' || pathName === '/api/admin/export-db')) postAction = 'export_database';
        else if (pathName === '/api/auth/login') postAction = 'login';
        else if (pathName === '/api/auth/logout') postAction = 'logout';
        else if (pathName === '/api/auth/forgot-password') {
            postAction = 'forgot_password';
            payload.baseUrl = new URL('.', window.location.href).href.replace(/\/+$/, '');
        }
        else if (pathName === '/api/auth/reset-password') postAction = 'reset_password';
        else if (pathName === '/api/config') postAction = 'save_config';
        else if (pathName === '/api/book') postAction = 'book';
        else if (pathName === '/api/payment/create-order') postAction = 'create_order';
        else if (pathName === '/api/payment/verify-and-book') postAction = 'verify_and_book';
        else if (pathName === '/api/bookings/import') postAction = 'import_bookings';
        else if (pathName === '/api/bookings/sync-sheets') postAction = 'sync_sheets';
        else if (pathName.startsWith('/api/bookings/') && pathName.endsWith('/status')) {
            postAction = 'update_status';
            payload.id = decodeURIComponent(pathName.split('/')[3] || '');
        } else if (method === 'DELETE' && pathName.startsWith('/api/bookings/')) {
            postAction = 'delete_booking';
            payload.id = decodeURIComponent(pathName.split('/')[3] || '');
        } else {
            return makeJsonResponse({ error: 'Unsupported route: ' + method + ' ' + pathName }, 404);
        }

        payload.action = postAction;

        const gasRes = await nativeFetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload),
            redirect: 'follow'
        });
        const json = await gasRes.json();

        if (postAction === 'login' && json && json.success && json.token) {
            setToken(json.token);
        } else if (postAction === 'logout') {
            setToken('');
        }

        return makeJsonResponse(json, gasRes.status);
    };
})();
