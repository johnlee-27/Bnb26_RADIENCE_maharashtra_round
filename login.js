/* =========================================================================
   INFLUX — Login page (login.html)
   Log in or create an account, then go to the studio (App.html).
   Needs config.js (finds the server, stores the sign-in token).
   ========================================================================= */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const { store, once, findServer, serverHelp, getToken, setToken, clearToken } = window.INFLUX;

const auth = $('#auth');
const form = $('#authForm');
const statusBox = $('#serverStatus');
const submitBtn = $('#authSubmit');

// Where to go after logging in: App.html, plus the app the person was trying to open
const params = new URLSearchParams(location.search);
const next = params.get('next') || '';
const studioUrl = () => 'App.html' + (/^#\/[\w/-]*$/.test(next) ? next : '');

let mode = 'login';
let apiBase = null; // set once the server answers

/* ---------- The six apps on the ring ---------- */
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const RING_APPS = [
    { tint: '#FF8A00', hi: '#FFB547', icon: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14.5 7.5 3 3"/><path d="M13 20h7"/>' },
    { tint: '#7B5CFF', hi: '#A491FF', icon: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.6"/>' },
    { tint: '#FF3554', hi: '#FF7488', icon: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6 20 18M8.6 16.4 20 6"/>' },
    { tint: '#D63B98', hi: '#F07CC2', icon: '<path d="m4 20 11-11"/><path d="m13 7 3 3"/><path d="M18 2.5v3M16.5 4h3M20.5 10v2.5M19.2 11.2h2.6M9.5 3v2.5M8.2 4.2h2.6"/>' },
    { tint: '#0FA47A', hi: '#3FCDA0', icon: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>' },
    { tint: '#2F7BF5', hi: '#6BA4FF', icon: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>' },
];
$('#orbit').innerHTML = RING_APPS.map((a, i) =>
    `<span class="app-tile" style="--tint:${a.tint};--tint-hi:${a.hi};--a:${-90 + 60 * i}deg;--i:${i}">${svg(a.icon)}</span>`
).join('');

/* ---------- Log in / Create account switch ---------- */
const COPY = {
    login: { title: 'Welcome back', sub: 'Log in to pick up where you left off.', button: 'Log in', busy: 'Logging in…',
        switchText: 'New to INFLUX?', switchBtn: 'Create an account', switchTo: 'register' },
    register: { title: 'Create your studio', sub: 'One account for every tool, on every platform.', button: 'Create account', busy: 'Creating account…',
        switchText: 'Already have an account?', switchBtn: 'Log in', switchTo: 'login' },
};

function setMode(m) {
    mode = m;
    const c = COPY[m];
    auth.dataset.mode = m;
    $$('.auth-tabs [role="tab"]').forEach((t) => t.setAttribute('aria-selected', t.dataset.mode === m));
    $('#authTitle').textContent = c.title;
    $('#authSub').textContent = c.sub;
    $('.label', submitBtn).textContent = c.button;
    $('#authSwitch').innerHTML = `${c.switchText} <button type="button" data-mode="${c.switchTo}">${c.switchBtn}</button>`;
    form.elements.password.autocomplete = m === 'login' ? 'current-password' : 'new-password';
    // Carry what was typed across modes
    const { identifier, email } = form.elements;
    if (m === 'register' && identifier.value.includes('@') && !email.value) email.value = identifier.value;
    if (m === 'login' && !identifier.value && email.value) identifier.value = email.value;
    clearErrors();
    document.title = (m === 'login' ? 'Log in' : 'Create account') + ' — INFLUX';
}

/* ---------- Errors ---------- */
function clearErrors() {
    $$('.afield', form).forEach((f) => f.classList.remove('invalid'));
    $$('[data-error]', form).forEach((e) => (e.textContent = ''));
    $('#formError').textContent = '';
}
function showError(field, message) {
    const slot = field && $(`[data-error="${field}"]`, form);
    if (!slot) { $('#formError').textContent = message; return; }
    slot.textContent = message;
    slot.closest('.afield').classList.add('invalid');
}
function validate(v) {
    const e = {};
    if (mode === 'register') {
        if (v.username.trim().length < 2) e.username = 'Enter at least 2 characters.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = 'Enter a valid email address.';
        if (v.password.length < 8) e.password = 'Use at least 8 characters.';
    } else {
        if (!v.identifier.trim()) e.identifier = 'Enter your email or username.';
        if (!v.password) e.password = 'Enter your password.';
    }
    return e;
}

/* ---------- Server connection ---------- */
function showOffline() {
    statusBox.className = 'server-status offline';
    statusBox.hidden = false;
    statusBox.innerHTML = `<div><strong>Can't reach the INFLUX server</strong>${serverHelp()
        .replace(/"([^"]+)"/g, '<code>$1</code>')
        .replace('http://localhost:3000', '<code>http://localhost:3000</code>')}
        <br><button type="button" id="retryServer">Try again</button></div>`;
    $('#retryServer').addEventListener('click', connect);
}

async function connect() {
    statusBox.className = 'server-status checking';
    statusBox.hidden = false;
    statusBox.textContent = 'Connecting to INFLUX…';
    apiBase = await findServer();
    if (apiBase === null) { showOffline(); return false; }
    statusBox.hidden = true;
    return true;
}

async function post(path, body) {
    let res;
    try {
        res = await fetch(apiBase + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    } catch {
        apiBase = null;
        throw Object.assign(new Error('Lost connection to the INFLUX server.'), { offline: true });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `The server returned an error (${res.status}).`), { field: data.field });
    return data;
}

/* ---------- Submit ---------- */
async function submit(e) {
    e.preventDefault();
    clearErrors();
    const v = Object.fromEntries(new FormData(form));
    const errors = validate(v);
    if (Object.keys(errors).length) {
        Object.entries(errors).forEach(([k, m]) => showError(k, m));
        form.elements[Object.keys(errors)[0]].focus();
        return;
    }

    const c = COPY[mode];
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    $('.label', submitBtn).textContent = c.busy;
    try {
        if (apiBase === null && !(await connect())) return;
        const body = mode === 'login'
            ? { identifier: v.identifier, password: v.password }
            : { username: v.username, email: v.email, password: v.password };
        const { token, user } = await post(`/api/auth/${mode}`, body);
        setToken(token);
        once.set('greet', mode === 'register' ? 'welcome' : 'hello');
        store.set('name', user.username);
        goToStudio();
    } catch (err) {
        if (err.offline) showOffline();
        else {
            showError(err.field, err.message);
            if (err.field && form.elements[err.field]) form.elements[err.field].focus();
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        $('.label', submitBtn).textContent = COPY[mode].button;
    }
}

function goToStudio() {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { location.href = studioUrl(); return; }
    auth.classList.add('leaving');
    setTimeout(() => { location.href = studioUrl(); }, 380);
}

/* ---------- Wiring ---------- */
form.addEventListener('submit', submit);
auth.addEventListener('click', (e) => {
    const m = e.target.closest('button[data-mode]');
    if (m) setMode(m.dataset.mode);
});
$('.pw-toggle').addEventListener('click', (e) => {
    const input = form.elements.password;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    e.currentTarget.textContent = show ? 'Hide' : 'Show';
    e.currentTarget.setAttribute('aria-pressed', show);
    e.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});
form.addEventListener('input', (e) => {
    const f = e.target.closest('.afield');
    if (f?.classList.contains('invalid')) {
        f.classList.remove('invalid');
        $('[data-error]', f).textContent = '';
    }
});

/* ---------- Start ---------- */
(async function start() {
    if (params.get('mode') === 'register') setMode('register');
    const reason = params.get('reason');
    if (reason === 'expired') $('#formError').textContent = 'Your session ended. Log in again to keep creating.';
    if (reason === 'gone') $('#formError').textContent = 'That account no longer exists on this server. Create it again.';

    const ok = await connect();
    // Already signed in? Skip straight to the studio.
    if (ok && getToken() && !reason) {
        try {
            const res = await fetch(apiBase + '/api/auth/me', { headers: { Authorization: `Bearer ${getToken()}` } });
            if (res.ok) { location.replace(studioUrl()); return; }
            clearToken();
        } catch { /* stay here */ }
    }
})();
