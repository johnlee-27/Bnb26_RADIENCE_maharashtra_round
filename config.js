/* =========================================================================
   INFLUX — shared settings for login.html and App.html
   ========================================================================= */

// Where the INFLUX backend runs.
// Leave empty to find it automatically: the page first tries its own address
// (when opened from http://localhost:3000), then the addresses below. This makes it
// work whether you open the site from the server, from VS Code Live Server, or by
// double-clicking the HTML file.
// For a hosted backend, put its address here, e.g. 'https://influx-api.onrender.com'.
const INFLUX_API = '';
const INFLUX_FALLBACKS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

window.INFLUX = (() => {
    const store = {
        get(k) { try { return localStorage.getItem('influx.' + k); } catch { return null; } },
        set(k, v) { try { localStorage.setItem('influx.' + k, v); } catch { /* private mode */ } },
        remove(k) { try { localStorage.removeItem('influx.' + k); } catch { /* private mode */ } },
    };
    // sessionStorage: short-lived hand-offs between the two pages
    const once = {
        set(k, v) { try { sessionStorage.setItem('influx.' + k, v); } catch { /* ignore */ } },
        take(k) {
            try { const v = sessionStorage.getItem('influx.' + k); sessionStorage.removeItem('influx.' + k); return v; }
            catch { return null; }
        },
    };

    async function isInfluxServer(base) {
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 2500);
            const res = await fetch(base + '/api/health', { signal: ctrl.signal });
            clearTimeout(timer);
            const data = await res.json();
            return data && data.ok === true;
        } catch {
            return false;
        }
    }

    let found = null;
    /** Resolves to the backend's base URL ('' = same address as this page), or null if none answers. */
    function findServer() {
        if (found) return found;
        found = (async () => {
            if (INFLUX_API) return INFLUX_API.replace(/\/$/, '');
            const candidates = [];
            if (location.protocol.startsWith('http')) candidates.push('');
            for (const c of INFLUX_FALLBACKS) if (c !== location.origin) candidates.push(c);
            for (const base of candidates) if (await isInfluxServer(base)) return base;
            found = null; // try again next time
            return null;
        })();
        return found;
    }

    function serverHelp() {
        const opened = location.protocol === 'file:' ? 'You opened the HTML file directly, and the INFLUX server isn\'t running.' : 'The INFLUX server isn\'t running.';
        return `${opened} Start it: open a terminal in the project folder and run "npm install" then "npm start" (or double-click start.bat on Windows), then open http://localhost:3000.`;
    }

    return {
        store,
        once,
        findServer,
        serverHelp,
        getToken: () => store.get('token'),
        setToken: (t) => store.set('token', t),
        clearToken: () => store.remove('token'),
    };
})();
