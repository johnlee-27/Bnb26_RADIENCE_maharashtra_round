/* =========================================================================
   INFLUX — iPad-style creator studio (frontend)
   One page. The home screen shows apps; tapping one opens it full-screen.
   URLs look like  App.html#/script/instagram  so every app is linkable
   and the browser back button works.
   ========================================================================= */

// ---------------------------------------------------------------------------
// Backend connection: found automatically by config.js (see INFLUX_API there).
let API_BASE = '';

// Shown in the About app. Leave empty to hide the contact button.
const CONTACT_EMAIL = '';
// ---------------------------------------------------------------------------

/* ---------- Icons (simple line glyphs, 24×24) ---------- */
const svg = (d) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const ICON = {
    script: svg('<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14.5 7.5 3 3"/><path d="M13 20h7"/>'),
    image: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.6"/>'),
    clips: svg('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6 20 18M8.6 16.4 20 6"/>'),
    touchup: svg('<path d="m4 20 11-11"/><path d="m13 7 3 3"/><path d="M18 2.5v3M16.5 4h3M20.5 10v2.5M19.2 11.2h2.6M9.5 3v2.5M8.2 4.2h2.6"/>'),
    trends: svg('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
    copilot: svg('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>'),
    about: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    back: svg('<path d="m15 6-6 6 6 6"/>'),
    download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
    upload: svg('<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>'),
    send: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    refresh: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'),
    mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
};

/* ---------- Apps ---------- */
const APPS = [
    { id: 'script', name: 'Scripting', blurb: 'Hooks, scripts and captions', tint: '#FF8A00', hi: '#FFB547', ink: '#9E4F00', soft: '#FFF1E0' },
    { id: 'image', name: 'ImageGen', blurb: 'Post visuals and thumbnails', tint: '#7B5CFF', hi: '#A491FF', ink: '#4B2FD1', soft: '#EFEBFF' },
    { id: 'clips', name: 'VideoClip', blurb: 'Turn a long video into short clips', tint: '#FF3554', hi: '#FF7488', ink: '#B80F2C', soft: '#FFE9ED' },
    { id: 'touchup', name: 'Muse', blurb: 'Feedback before you post', tint: '#D63B98', hi: '#F07CC2', ink: '#9C146A', soft: '#FCE8F4' },
    { id: 'trends', name: 'Trends', blurb: "What's working right now", tint: '#0FA47A', hi: '#3FCDA0', ink: '#07714F', soft: '#E2F6EF' },
    { id: 'copilot', name: 'C-Pilot', blurb: 'Ask anything about growing', tint: '#2F7BF5', hi: '#6BA4FF', ink: '#1452BB', soft: '#E6F0FF' },
    { id: 'about', name: 'About', blurb: 'What INFLUX does', tint: '#6B6779', hi: '#9C98AA', ink: '#45404F', soft: '#EFEEF3', noPlatform: true },
];
const DOCK = ['script', 'image', 'clips', 'copilot', '|', 'about'];

const PLATFORMS = {
    instagram: { name: 'Instagram', ratio: '4:5', format: 'Instagram post' },
    linkedin: { name: 'LinkedIn', ratio: '1:1', format: 'LinkedIn post' },
    youtube: { name: 'YouTube', ratio: '16:9', format: 'YouTube thumbnail' },
};

/* ---------- State ---------- */
const { store, getToken, clearToken, findServer } = window.INFLUX;

const state = {
    platform: store.get('platform') || 'instagram',
    health: null,
    handoff: null,          // data passed from one app to another
    chats: { instagram: [], linkedin: [], youtube: [] },
    images: [],             // ImageGen results this session
    current: null,          // open app id
    user: null,             // signed-in account { id, username, email }
    originRect: null,       // where the open animation starts
    originEl: null,
};

/* ---------- DOM ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const screen = $('#screen');
const appWindow = $('#appWindow');

/* =========================================================================
   Helpers
   ========================================================================= */
function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function md(text) {
    if (!window.marked) return `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
    const html = marked.parse(text || '', { breaks: true });
    return window.DOMPurify ? DOMPurify.sanitize(html) : html;
}

function tile(app, extra = '') {
    return `<span class="app-tile ${extra}" style="--tint:${app.tint};--tint-hi:${app.hi}">${ICON[app.id]}</span>`;
}

function toast(message) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = message;
    $('#toasts').append(t);
    setTimeout(() => t.remove(), 2600);
}

let busyCount = 0;
function busy(on) {
    busyCount = Math.max(0, busyCount + (on ? 1 : -1));
    screen.classList.toggle('is-busy', busyCount > 0);
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        toast('Copied');
    } catch {
        toast('Select the text and copy it manually');
    }
}

function fmtTime(sec) {
    const s = Math.max(0, Math.round(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtSize(bytes) {
    return bytes > 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`;
}


/* ---------- Talking to the backend ---------- */
async function api(path, { method = 'POST', json, form, query } = {}) {
    let url = API_BASE + path;
    if (query) url += '?' + new URLSearchParams(query);
    const options = { method, headers: {} };
    const token = getToken();
    if (token) options.headers.Authorization = `Bearer ${token}`;
    if (json) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(json);
    } else if (form) {
        options.body = form;
    }

    let res;
    try {
        res = await fetch(url, options);
    } catch {
        throw new Error("Lost connection to the INFLUX server. Check that it's still running, then try again.");
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && state.user && !path.startsWith('/api/auth')) {
        signOut('expired');
    }
    if (!res.ok) {
        const err = new Error(data.error || `The server returned an error (${res.status}).`);
        err.status = res.status;
        err.field = data.field;
        throw err;
    }
    return data;
}

// Same as api() but reports upload progress (used for big video files)
function apiUpload(path, form, onProgress, onUploaded) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', API_BASE + path);
        const token = getToken();
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
        xhr.upload.onload = () => onUploaded();
        xhr.onload = () => {
            let data = {};
            try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
            if (xhr.status === 401 && state.user) signOut('expired');
            xhr.status < 400 ? resolve(data) : reject(new Error(data.error || `The server returned an error (${xhr.status}).`));
        };
        xhr.onerror = () => reject(new Error("Lost connection to the INFLUX server. Check that it's still running, then try again."));
        xhr.send(form);
    });
}

function errorCard(err, hint = '') {
    return `<div class="error-card" role="alert"><div><strong>That didn't work.</strong>${escapeHtml(err.message)}${hint ? `<br>${hint}` : ''}</div></div>`;
}

const skeleton = `<div class="skeleton" aria-label="Working on it"><i class="h"></i><i></i><i></i><i style="width:85%"></i><i></i><i style="width:60%"></i><br><i class="h" style="width:30%"></i><i></i><i style="width:75%"></i></div>`;

/* =========================================================================
   Home screen
   ========================================================================= */
function renderHome() {
    const appButton = (app) =>
        `<a class="app" href="#/${app.id}" data-app="${app.id}" aria-label="${app.name}: ${app.blurb}">
            ${tile(app)}<span class="app-label">${app.name}</span>
        </a>`;

    $('#appGrid').innerHTML = APPS.map(appButton).join('');
    $('#dock').innerHTML = DOCK.map((id) =>
        id === '|' ? '<span class="dock-divider" aria-hidden="true"></span>' : appButton(APPS.find((a) => a.id === id))
    ).join('');

    // Remember which icon was tapped so the app can zoom out of it
    $$('.app').forEach((a) =>
        a.addEventListener('click', () => {
            state.originEl = a.querySelector('.app-tile');
            state.originRect = state.originEl.getBoundingClientRect();
        })
    );
    $$('[data-open]').forEach((b) =>
        b.addEventListener('click', () => {
            state.originEl = b;
            state.originRect = b.getBoundingClientRect();
            location.hash = `#/${b.dataset.open}`;
        })
    );
}

function tickClock() {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
    $('#statusTime').textContent = time;
    $('#statusDate').textContent = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
    $('#widgetDate').textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

async function loadHealth() {
    const list = $('#engineList');
    try {
        const h = await api('/api/health', { method: 'GET' });
        state.health = h;
        const row = (on, label, detail) =>
            `<li><span class="dot ${on ? 'on' : 'off'}"></span>${label}<small>${on ? detail : 'Add key'}</small></li>`;
        const textOn = h.text && h.text !== 'NOT CONFIGURED';
        const textName = !textOn ? '' : h.text.includes('groq') ? 'Groq' : h.text.includes('github') ? 'GitHub' : h.text.startsWith('gemini') ? 'Gemini' : 'OpenAI';
        const imagesOn = h.images === 'cloudflare' || h.images === 'pollinations' || (h.images === 'gemini' && h.gemini);
        list.innerHTML =
            row(textOn, 'Writing', textName) +
            row(imagesOn, 'Images', { cloudflare: 'Cloudflare', pollinations: 'Pollinations', gemini: 'Gemini' }[h.images] || h.images) +
            row(h.gemini, 'Video and feedback', 'Gemini') +
            row(h.youtube, 'YouTube charts', 'YouTube');
    } catch {
        list.innerHTML = `<li><span class="dot off"></span>Server offline</li>
            <li><small style="margin:0;opacity:.75">Run npm start in the backend folder</small></li>`;
    }
}

/* =========================================================================
   Opening and closing apps
   ========================================================================= */
function route() {
    if (!state.user) return;
    const [, id, platform] = location.hash.match(/^#\/([\w-]+)(?:\/([\w-]+))?/) || [];
    const app = APPS.find((a) => a.id === id);
    if (platform && PLATFORMS[platform]) setPlatform(platform, false);
    if (app) openApp(app);
    else closeApp();
}

/* The room glows with the colours on screen (see device.css) */
const HOME_GLOW = ['#5B3FD0', '#FFB979', '#FF3554'];
function setGlow(app) {
    const [a, b, c] = app ? [app.tint, app.hi, '#FFFFFF'] : HOME_GLOW;
    const root = document.documentElement.style;
    root.setProperty('--glow-a', a);
    root.setProperty('--glow-b', b);
    root.setProperty('--glow-c', c);
}

function openApp(app) {
    const wasOpen = Boolean(state.current);
    setGlow(app);
    state.current = app.id;

    appWindow.style.cssText = `--tint:${app.tint};--tint-hi:${app.hi};--tint-ink:${app.ink};--tint-soft:${app.soft}`;
    appWindow.setAttribute('aria-label', app.name);
    appWindow.innerHTML = `
        <header class="app-bar">
            <a class="back-btn" href="#/">${ICON.back}Home</a>
            <div class="app-title">${tile(app)}<div><h1>${app.name}</h1><p>${app.blurb}</p></div></div>
            ${app.noPlatform ? '' : platformSwitcher()}
        </header>
        <div class="app-body"></div>`;
    appWindow.hidden = false;
    screen.classList.add('app-open');

    bindPlatformSwitcher();
    APP_VIEWS[app.id]($('.app-body', appWindow), app);

    if (!wasOpen) animateOpen();
    const first = $('.app-body textarea, .app-body input[type="text"]', appWindow);
    if (first && matchMedia('(pointer: fine)').matches) first.focus({ preventScroll: true });
}

function closeApp() {
    if (!state.current) return;
    const closingId = state.current;
    state.current = null;
    setGlow(null);
    screen.classList.remove('app-open');

    const done = () => {
        if (state.current) return; // another app opened meanwhile
        appWindow.hidden = true;
        appWindow.innerHTML = '';
        const icon = $(`#appGrid [data-app="${closingId}"]`);
        icon?.focus({ preventScroll: true });
    };
    const anim = animateClose(closingId);
    anim ? anim.finished.then(done, done) : done();
}

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function zoomFrames(rect) {
    const s = screen.getBoundingClientRect();
    if (!rect || !rect.width) return null;
    const sx = rect.width / s.width;
    const sy = rect.height / s.height;
    return {
        from: `translate(${rect.left - s.left}px, ${rect.top - s.top}px) scale(${sx}, ${sy})`,
        radius: `${Math.round(rect.width * 0.25 / sx)}px`,
    };
}

function animateOpen() {
    if (reduceMotion()) return;
    const z = zoomFrames(state.originRect);
    appWindow.style.transformOrigin = '0 0';
    appWindow.animate(
        z
            ? [{ transform: z.from, borderRadius: z.radius, opacity: 0.2 }, { transform: 'none', borderRadius: '0px', opacity: 1 }]
            : [{ transform: 'scale(.92)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' }
    );
    state.originRect = null;
}

function animateClose(id) {
    if (reduceMotion()) return null;
    const icon = $(`#appGrid [data-app="${id}"] .app-tile`);
    const z = zoomFrames(icon?.getBoundingClientRect());
    return appWindow.animate(
        z
            ? [{ transform: 'none', borderRadius: '0px', opacity: 1 }, { transform: z.from, borderRadius: z.radius, opacity: 0 }]
            : [{ transform: 'none', opacity: 1 }, { transform: 'scale(.92)', opacity: 0 }],
        { duration: 340, easing: 'cubic-bezier(.4,0,.2,1)' }
    );
}

/* ---------- Platform switcher ---------- */
function platformSwitcher() {
    return `<div class="platforms" role="group" aria-label="Platform">
        ${Object.entries(PLATFORMS).map(([key, p]) =>
            `<button type="button" data-platform="${key}" aria-pressed="${key === state.platform}">
                <span class="pf-dot ${key}"></span>${p.name}
            </button>`).join('')}
    </div>`;
}

const platformListeners = new Set();
function bindPlatformSwitcher() {
    platformListeners.clear();
    $$('.platforms button', appWindow).forEach((b) =>
        b.addEventListener('click', () => setPlatform(b.dataset.platform))
    );
}

function setPlatform(key, updateUrl = true) {
    if (!PLATFORMS[key] || key === state.platform) return;
    state.platform = key;
    store.set('platform', key);
    $$('.platforms button', appWindow).forEach((b) => b.setAttribute('aria-pressed', b.dataset.platform === key));
    if (updateUrl && state.current) history.replaceState(null, '', `#/${state.current}/${key}`);
    platformListeners.forEach((fn) => fn(key));
}
const onPlatformChange = (fn) => platformListeners.add(fn);

/* =========================================================================
   Shared building blocks for the apps
   ========================================================================= */
function chips(name, options, selected, { optional = false } = {}) {
    return `<div class="chips" data-chips="${name}" data-optional="${optional}">
        <input type="hidden" name="${name}" value="${escapeHtml(selected || '')}">
        ${options.map((o) => `<button type="button" class="chip" data-value="${escapeHtml(o)}" aria-pressed="${o === selected}">${escapeHtml(o)}</button>`).join('')}
    </div>`;
}

function bindChips(root) {
    $$('[data-chips]', root).forEach((group) => {
        const input = $('input', group);
        group.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip');
            if (!chip) return;
            const optional = group.dataset.optional === 'true';
            const turnOff = optional && chip.getAttribute('aria-pressed') === 'true';
            $$('.chip', group).forEach((c) => c.setAttribute('aria-pressed', !turnOff && c === chip));
            input.value = turnOff ? '' : chip.dataset.value;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });
}

function primaryButton(label) {
    return `<button type="submit" class="primary"><span class="spinner" aria-hidden="true"></span><span class="label">${label}</span></button>`;
}

function setLoading(button, on, label) {
    button.disabled = on;
    button.classList.toggle('loading', on);
    if (label) $('.label', button).textContent = label;
    busy(on);
}

function emptyState(app, title, text) {
    return `<div class="empty">${tile(app)}<h3>${title}</h3><p>${text}</p></div>`;
}

/** Two-pane layout: inputs on the left, results on the right */
function twoPane(body, formHtml) {
    body.innerHTML = `<form class="panel composer" novalidate>${formHtml}</form><section class="panel canvas" aria-live="polite"></section>`;
    const form = $('form', body);
    bindChips(form);
    return { form, canvas: $('.canvas', body), button: $('.primary', form) };
}

function dropzone({ name, accept, title, hint }) {
    return `<label class="dropzone" data-drop>
        <span class="dz-body">${ICON.upload}<strong>${title}</strong><small>${hint}</small></span>
        <input type="file" name="${name}" accept="${accept}">
    </label>`;
}

function bindDropzone(zone, onFile) {
    const input = $('input', zone);
    ['dragenter', 'dragover'].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((t) => zone.addEventListener(t, () => zone.classList.remove('over')));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) { const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; onFile(file); }
    });
    input.addEventListener('change', () => input.files[0] && onFile(input.files[0]));
}

/* =========================================================================
   The apps
   ========================================================================= */
const APP_VIEWS = {

    /* ---------------- Scripting ---------------- */
    script(body, app) {
        const handoff = takeHandoff('script');
        const { form, canvas, button } = twoPane(body, `
            <label class="field"><span>What's the video or post about?</span>
                <textarea name="topic" required placeholder=""></textarea></label>
            <fieldset class="field"><legend>Tone</legend>
                ${chips('tone', ['Engaging', 'Funny', 'Educational', 'Inspiring', 'Professional'], 'Engaging')}</fieldset>
            <fieldset class="field"><legend>Length</legend>
                ${chips('length', ['Short', 'Medium', 'Long'], 'Short')}<small class="length-hint"></small></fieldset>
            <label class="field"><span>Who is it for? <small>(optional)</small></span>
                <input type="text" name="audience" placeholder="e.g. college students starting to invest"></label>
            ${primaryButton('Write script')}`);

        const topic = form.elements.topic;
        if (handoff) topic.value = handoff;

        const hints = {
            instagram: { Short: 'Reel under 30 seconds', Medium: 'Reel of 30–60 seconds', Long: 'Reel of 60–90 seconds' },
            linkedin: { Short: 'Post under 150 words or a 30-second video', Medium: 'Post of 150–300 words', Long: 'Story-style post of 300+ words' },
            youtube: { Short: 'A Short, under 60 seconds', Medium: '5–8 minute video', Long: '10–15 minute video' },
        };
        const placeholders = {
            instagram: 'e.g. 3 budget street-food spots in Pune under ₹100',
            linkedin: 'e.g. What I learned from my first year as a product designer',
            youtube: 'e.g. I tried studying with the Pomodoro method for 30 days',
        };
        const refresh = () => {
            topic.placeholder = placeholders[state.platform];
            $('.length-hint', form).textContent = hints[state.platform][form.elements.length.value];
        };
        refresh();
        form.addEventListener('change', refresh);
        onPlatformChange(refresh);

        let lastScript = '';
        canvas.innerHTML = emptyState(app, 'Your script appears here', 'Describe your idea and pick a tone. You get a hook, the full script with shot notes, a call to action, a caption and hashtags.');

        const run = async () => {
            if (!topic.value.trim()) { topic.focus(); toast('Add what the video is about first'); return; }
            const v = Object.fromEntries(new FormData(form));
            setLoading(button, true, 'Writing…');
            canvas.innerHTML = skeleton;
            try {
                const { script } = await api('/api/script', {
                    json: { platform: state.platform, topic: v.topic, tone: v.tone.toLowerCase(), length: `${v.length.toLowerCase()} (${hints[state.platform][v.length]})`, audience: v.audience },
                });
                lastScript = script;
                canvas.innerHTML = `
                    <div class="canvas-toolbar"><h2>${PLATFORMS[state.platform].name} script</h2>
                        <button class="ghost" data-act="copy">${ICON.copy}Copy</button>
                        <button class="ghost" data-act="thumb">${ICON.image}Make a visual</button>
                        <button class="ghost" data-act="again">${ICON.refresh}Rewrite</button></div>
                    <article class="doc">${md(script)}</article>`;
            } catch (err) {
                canvas.innerHTML = errorCard(err);
            } finally {
                setLoading(button, false, 'Write script');
            }
        };

        form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
        canvas.addEventListener('click', (e) => {
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (act === 'copy') copyText(lastScript);
            if (act === 'again') run();
            if (act === 'thumb') handOff('image', topic.value.trim());
        });
    },

    /* ---------------- ImageGen ---------------- */
    image(body, app) {
        const handoff = takeHandoff('image');
        const { form, canvas, button } = twoPane(body, `
            <label class="field"><span>Describe the image</span>
                <textarea name="prompt" required placeholder="e.g. A steaming plate of vada pav on a rainy Mumbai street, warm evening light"></textarea></label>
            <fieldset class="field"><legend>Style <small>(optional)</small></legend>
                ${chips('style', ['Photo', '3D render', 'Minimal', 'Neon', 'Illustration', 'Flat lay'], '', { optional: true })}</fieldset>
            <p class="field"><small class="format-hint"></small></p>
            ${primaryButton('Generate image')}`);

        if (handoff) form.elements.prompt.value = `Eye-catching visual for: ${handoff}`;
        let current = state.images.length ? state.images.length - 1 : -1;

        const draw = (loading = false) => {
            const p = PLATFORMS[state.platform];
            $('.format-hint', form).textContent = `Sized for a ${p.format} (${p.ratio}).`;
            const img = state.images[current];
            if (!img && !loading) {
                canvas.innerHTML = emptyState(app, 'Nothing generated yet', `Describe a scene, pick a style if you like, and the image is framed for ${p.name}.`);
                return;
            }
            const frameFor = loading ? state.platform : img.platform;
            canvas.innerHTML = `
                <div class="frame r-${frameFor} ${loading ? 'loading' : ''}">
                    ${loading ? '' : `<img src="${img.src}" alt="${escapeHtml(img.prompt)}">`}
                    <span class="frame-label">${PLATFORMS[frameFor].ratio} ${PLATFORMS[frameFor].format}</span>
                </div>
                ${loading ? '' : `<div class="image-actions">
                    <a class="ghost" href="${img.src}" download="influx-${img.platform}-${current + 1}.${img.src.startsWith('data:image/jpeg') ? 'jpg' : 'png'}">${ICON.download}Download</a>
                    <button class="ghost" data-act="muse">${ICON.touchup}Get feedback in Muse</button>
                </div>`}
                ${state.images.length > 1 ? `<div class="history" aria-label="This session">${state.images.map((im, i) =>
                    `<button data-i="${i}" aria-current="${i === current}" aria-label="Image ${i + 1}"><img src="${im.src}" alt=""></button>`).join('')}</div>` : ''}`;
        };
        draw();
        onPlatformChange(() => draw());

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const v = Object.fromEntries(new FormData(form));
            if (!v.prompt.trim()) { form.elements.prompt.focus(); toast('Describe the image first'); return; }
            setLoading(button, true, 'Generating…');
            draw(true);
            try {
                const data = await api('/api/image', { json: { platform: state.platform, prompt: v.prompt, style: v.style } });
                data.images.forEach((src) => state.images.push({ src, prompt: v.prompt, platform: state.platform }));
                current = state.images.length - 1;
                draw();
            } catch (err) {
                canvas.innerHTML = errorCard(err);
            } finally {
                setLoading(button, false, 'Generate image');
            }
        });

        canvas.addEventListener('click', (e) => {
            const pick = e.target.closest('[data-i]');
            if (pick) { current = Number(pick.dataset.i); draw(); }
            if (e.target.closest('[data-act="muse"]')) handOff('touchup', { image: state.images[current].src });
        });
    },

    /* ---------------- VideoClip ---------------- */
    clips(body, app) {
        const { form, canvas, button } = twoPane(body, `
            <div class="field"><span>Long-form video</span>
                ${dropzone({ name: 'video', accept: 'video/*', title: 'Drop a video or click to choose', hint: 'MP4 or MOV, up to 500 MB' })}</div>
            <div class="field"><span>How many clips?</span>
                <div class="stepper"><button type="button" data-step="-1" aria-label="Fewer clips">−</button>
                <output name="countOut">3</output>
                <button type="button" data-step="1" aria-label="More clips">+</button></div>
                <input type="hidden" name="count" value="3"></div>
            <p class="field"><small class="format-hint"></small></p>
            ${primaryButton('Make clips')}`);

        const zone = $('[data-drop]', form);
        let file = null;
        bindDropzone(zone, (f) => {
            file = f;
            zone.classList.add('has-file');
            const url = URL.createObjectURL(f);
            zone.querySelector('strong').textContent = f.name;
            zone.querySelector('small').textContent = `${fmtSize(f.size)}, click to change`;
            const v = document.createElement('video');
            v.preload = 'metadata';
            v.src = url;
            v.onloadedmetadata = () => {
                zone.querySelector('small').textContent = `${fmtTime(v.duration)} long, ${fmtSize(f.size)}. Click to change.`;
                URL.revokeObjectURL(url);
            };
        });

        $$('[data-step]', form).forEach((b) => b.addEventListener('click', () => {
            const n = Math.min(6, Math.max(1, Number(form.elements.count.value) + Number(b.dataset.step)));
            form.elements.count.value = n;
            form.elements.countOut.value = n;
        }));

        const hint = () => {
            $('.format-hint', form).textContent = {
                instagram: 'Clips are cropped to vertical 9:16 for Reels.',
                linkedin: 'Clips keep the original widescreen frame for the LinkedIn feed.',
                youtube: 'Clips are cropped to vertical 9:16 for Shorts.',
            }[state.platform];
        };
        hint();
        onPlatformChange(hint);

        canvas.innerHTML = emptyState(app, 'Find the moments worth posting', 'Upload a podcast, vlog or talk. AI watches it, picks the strongest self-contained moments and cuts each into a ready-to-post clip.');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!file) { toast('Choose a video first'); return; }
            const fd = new FormData();
            fd.append('video', file);
            fd.append('platform', state.platform);
            fd.append('count', form.elements.count.value);

            canvas.innerHTML = `
                <div class="empty" style="min-height:auto;padding-top:2em">${tile(app)}<h3>Making your clips</h3>
                <p>Long videos can take a few minutes. Keep this tab open.</p></div>
                <ol class="steps">
                    <li class="active" data-s="1"><span class="state">1</span><div style="flex:1">Uploading video<div class="bar"><i></i></div></div></li>
                    <li data-s="2"><span class="state">2</span>Finding the best moments and cutting clips</li>
                </ol>`;
            const s1 = $('[data-s="1"]', canvas), s2 = $('[data-s="2"]', canvas);
            setLoading(button, true, 'Working…');
            try {
                const { clips } = await apiUpload('/api/clips', fd,
                    (p) => { $('.bar i', s1).style.width = `${Math.round(p * 100)}%`; },
                    () => { s1.className = 'done'; $('.state', s1).textContent = '✓'; s2.className = 'active'; });
                const wide = state.platform === 'linkedin';
                canvas.innerHTML = !clips.length
                    ? emptyState(app, 'No strong moments found', 'Try a longer video with more talking or action.')
                    : `<div class="canvas-toolbar"><h2>${clips.length} clip${clips.length > 1 ? 's' : ''} for ${PLATFORMS[state.platform].name}</h2></div>
                       <div class="clips">${clips.map((c, i) => `
                        <article class="clip ${wide ? 'wide' : ''}">
                            <div class="clip-phone"><video src="${API_BASE + c.url}" controls preload="metadata" playsinline></video></div>
                            <span class="time">${fmtTime(c.start)} – ${fmtTime(c.end)} of the original</span>
                            <h3>${escapeHtml(c.title)}</h3>
                            <p>${escapeHtml(c.reason)}</p>
                            <a class="ghost" style="align-self:flex-start" href="${API_BASE + c.url}" download="clip-${i + 1}.mp4">${ICON.download}Download</a>
                        </article>`).join('')}</div>`;
            } catch (err) {
                canvas.innerHTML = errorCard(err);
            } finally {
                setLoading(button, false, 'Make clips');
            }
        });
    },

    /* ---------------- Muse (touch-ups) ---------------- */
    touchup(body, app) {
        const handoff = takeHandoff('touchup');
        const { form, canvas, button } = twoPane(body, `
            <div class="field"><span>Thumbnail or post image <small>(optional)</small></span>
                ${dropzone({ name: 'image', accept: 'image/*', title: 'Drop an image or click to choose', hint: 'PNG or JPG, up to 15 MB' })}</div>
            <label class="field"><span>Caption, title or script <small>(optional)</small></span>
                <textarea name="text" placeholder="Paste what you're planning to post"></textarea></label>
            ${primaryButton('Get feedback')}`);

        const zone = $('[data-drop]', form);
        let imageFile = null;
        const showImage = (f) => {
            imageFile = f;
            zone.classList.add('has-file');
            $('.dz-body', zone).innerHTML = `<img class="preview" src="${URL.createObjectURL(f)}" alt="Selected image"><small>${escapeHtml(f.name)}, click to change</small>`;
        };
        bindDropzone(zone, showImage);

        if (handoff?.image) {
            fetch(handoff.image).then((r) => r.blob()).then((b) => showImage(new File([b], 'imagegen.' + (b.type.includes('jpeg') ? 'jpg' : 'png'), { type: b.type })));
        }

        canvas.innerHTML = emptyState(app, 'Get a second opinion', 'Add a thumbnail, a caption or both. You get what works, the three fixes that matter most, a rewritten hook and an engagement score.');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = form.elements.text.value.trim();
            if (!imageFile && !text) { toast('Add an image or some text first'); return; }
            const fd = new FormData();
            fd.append('platform', state.platform);
            if (text) fd.append('text', text);
            if (imageFile) fd.append('image', imageFile);

            setLoading(button, true, 'Reviewing…');
            canvas.innerHTML = skeleton;
            try {
                const { feedback } = await api('/api/touchup', { form: fd });
                const m = feedback.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
                const score = m ? Math.min(10, parseFloat(m[1])) : null;
                const verdict = score === null ? '' : score >= 8 ? 'Ready to post' : score >= 6 ? 'Close — make the top fixes' : 'Worth reworking before you post';
                canvas.innerHTML = `
                    <div class="canvas-toolbar"><h2>Feedback for ${PLATFORMS[state.platform].name}</h2>
                        <button class="ghost" data-act="copy">${ICON.copy}Copy</button></div>
                    ${score === null ? '' : `<div class="score"><div class="score-ring" style="--v:${score * 10}"><span>${score}</span></div>
                        <p>${verdict}<small>Expected engagement score out of 10</small></p></div>`}
                    <article class="doc">${md(feedback)}</article>`;
                $('[data-act="copy"]', canvas).addEventListener('click', () => copyText(feedback));
            } catch (err) {
                canvas.innerHTML = errorCard(err);
            } finally {
                setLoading(button, false, 'Get feedback');
            }
        });
    },

    /* ---------------- Trends ----------------
       Layout adapted from a teammate's "TrendsPulse" design: highlight tiles,
       category tabs, search + sort, topic cards with a detail sheet, and a
       sidebar with hashtags, sounds and (for YouTube) the live trending chart. */
    trends(body, app) {
        body.classList.add('trends-layout');
        const MOMENTUM_ORDER = { Hot: 0, Rising: 1, Steady: 2 };
        const view = { category: 'All', query: '', sort: 'momentum' };
        let data = null;

        body.innerHTML = `
            <div class="tr-bar">
                <label class="tr-search">
                    ${svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>')}
                    <input type="search" placeholder="Search topics or hashtags" aria-label="Search topics or hashtags">
                </label>
                <label class="tr-sort"><span>Sort by</span>
                    <select aria-label="Sort topics">
                        <option value="momentum">Momentum</option>
                        <option value="category">Category</option>
                        <option value="title">A–Z</option>
                    </select></label>
                <button class="ghost" data-act="refresh">${ICON.refresh}Refresh</button>
            </div>
            <div class="tr-content" aria-live="polite"></div>
            <div class="sheet-backdrop" hidden></div>
            <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle" hidden></section>`;

        const content = $('.tr-content', body);
        const search = $('.tr-search input', body);
        const sortSel = $('.tr-sort select', body);
        const sheet = $('.sheet', body);
        const backdrop = $('.sheet-backdrop', body);
        let lastFocus = null;

        const compact = (n) => Intl.NumberFormat([], { notation: 'compact' }).format(n);
        const pill = (m) => `<span class="momentum m-${m.toLowerCase()}">${m}</span>`;

        const loadingView = () => {
            content.innerHTML = `
                <div class="tr-highlights">${'<div class="tr-tile is-loading"><i></i><i></i></div>'.repeat(4)}</div>
                <div class="tr-main"><div class="tr-grid">${'<div class="tr-card is-loading"><i></i><i></i><i></i></div>'.repeat(4)}</div>
                <aside class="tr-side"><div class="tr-panel is-loading"><i></i><i></i><i></i></div></aside></div>`;
        };

        const load = async (refresh = false) => {
            const platform = state.platform;
            const cached = state.trends?.[platform];
            if (cached && !refresh) { data = cached; draw(); return; }
            loadingView();
            busy(true);
            try {
                const res = await api('/api/trends', { method: 'GET', query: { platform, ...(refresh && { refresh: '1' }) } });
                state.trends = { ...(state.trends || {}), [platform]: res };
                if (state.platform === platform && state.current === 'trends') { data = res; view.category = 'All'; draw(); }
            } catch (err) {
                content.innerHTML = errorCard(err) + `<p style="margin-top:1em"><button class="ghost" data-act="retry">${ICON.refresh}Try again</button></p>`;
            } finally {
                busy(false);
            }
        };

        const visibleTopics = () => {
            const q = view.query.toLowerCase();
            return data.topics
                .filter((t) => view.category === 'All' || t.category === view.category)
                .filter((t) => !q || [t.title, t.description, t.category, ...t.hashtags].join(' ').toLowerCase().includes(q))
                .sort((a, b) =>
                    view.sort === 'title' ? a.title.localeCompare(b.title)
                    : view.sort === 'category' ? a.category.localeCompare(b.category) || MOMENTUM_ORDER[a.momentum] - MOMENTUM_ORDER[b.momentum]
                    : MOMENTUM_ORDER[a.momentum] - MOMENTUM_ORDER[b.momentum]);
        };

        function draw() {
            if (!data) return;
            const p = PLATFORMS[data.platform];
            const h = data.highlights;
            const hot = data.topics.filter((t) => t.momentum === 'Hot').length;
            const tiles = [
                { label: 'Top topic', value: h.topic, icon: svg('<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9Z"/>') },
                { label: 'Top hashtag', value: h.hashtag, icon: svg('<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>'), copy: h.hashtag },
                h.audio
                    ? { label: data.platform === 'youtube' ? 'Top Shorts sound' : 'Top Reels sound', value: h.audio, icon: svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>') }
                    : { label: 'Hot right now', value: `${hot} topic${hot === 1 ? '' : 's'}`, icon: svg('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>') },
                { label: 'Format that works', value: h.format || '—', icon: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>') },
            ];
            const counts = data.categories.map((c) => [c, data.topics.filter((t) => t.category === c).length]);
            const topics = visibleTopics();

            content.innerHTML = `
                <div class="tr-highlights">
                    ${tiles.map((t) => `<div class="tr-tile">
                        <span class="tr-tile-icon">${t.icon}</span>
                        <div><p>${t.label}</p><strong title="${escapeHtml(t.value)}">${escapeHtml(t.value)}</strong></div>
                        ${t.copy ? `<button class="tr-tile-copy" data-copy="${escapeHtml(t.copy)}" aria-label="Copy ${escapeHtml(t.copy)}">${ICON.copy}</button>` : ''}
                    </div>`).join('')}
                </div>

                <div class="tr-tabs" role="tablist" aria-label="Categories">
                    <button role="tab" data-cat="All" aria-selected="${view.category === 'All'}">All topics <span>${data.topics.length}</span></button>
                    ${counts.map(([c, n]) => `<button role="tab" data-cat="${escapeHtml(c)}" aria-selected="${view.category === c}">${escapeHtml(c)} <span>${n}</span></button>`).join('')}
                </div>

                <div class="tr-main">
                    <section>
                        <h2 class="tr-heading">${view.category === 'All' ? `Trending on ${p.name}` : escapeHtml(view.category)}
                            <span>${topics.length} topic${topics.length === 1 ? '' : 's'}</span></h2>
                        ${topics.length ? `<div class="tr-grid">${topics.map((t) => `
                            <button class="tr-card" data-topic="${t.id}">
                                <span class="tr-card-top"><span class="tr-cat">${escapeHtml(t.category)}</span>${pill(t.momentum)}</span>
                                <strong>${escapeHtml(t.title)}</strong>
                                <span class="tr-desc">${escapeHtml(t.description)}</span>
                                <span class="tr-card-foot">
                                    ${t.format ? `<span class="tr-format">${escapeHtml(t.format)}</span>` : ''}
                                    ${t.hashtags.slice(0, 2).map((x) => `<span class="tr-tag">${escapeHtml(x)}</span>`).join('')}
                                </span>
                            </button>`).join('')}</div>`
                        : `<div class="empty" style="min-height:14em">${tile(app)}<h3>No topics match</h3>
                            <p>Try another search or category.</p><button class="ghost" data-act="reset">Show all topics</button></div>`}
                    </section>

                    <aside class="tr-side">
                        ${data.youtube?.length ? `<div class="tr-panel">
                            <div class="tr-panel-head"><h3>Trending on YouTube now</h3><span class="live-dot">Live</span></div>
                            <ol class="tr-bars">${(() => {
                                const top = data.youtube.slice(0, 8);
                                const max = Math.max(...top.map((y) => y.views)) || 1;
                                return top.map((y) => `<li><a href="${y.url}" target="_blank" rel="noopener">
                                    <span class="tr-bar-label">${escapeHtml(y.title)}</span>
                                    <span class="tr-bar-track"><i style="width:${Math.max(4, (y.views / max) * 100)}%"></i></span>
                                    <span class="tr-bar-value">${compact(y.views)}</span></a></li>`).join('');
                            })()}</ol>
                            <p class="tr-panel-note">Views, from the YouTube trending chart.</p>
                        </div>` : ''}

                        <div class="tr-panel">
                            <div class="tr-panel-head"><h3>Top hashtags</h3>
                                ${data.hashtags.length ? '<button class="link-btn" data-act="copy-top">Copy top 5</button>' : ''}</div>
                            <ol class="tr-hashtags">${data.hashtags.map((x, i) => `
                                <li><span class="rank">${i + 1}</span><div><button class="tag-btn" data-copy="${escapeHtml(x.tag)}">${escapeHtml(x.tag)}</button>
                                ${x.note ? `<small>${escapeHtml(x.note)}</small>` : ''}</div></li>`).join('')}</ol>
                        </div>

                        ${data.audio.length ? `<div class="tr-panel">
                            <div class="tr-panel-head"><h3>${data.platform === 'youtube' ? 'Sounds for Shorts' : 'Sounds for Reels'}</h3></div>
                            <ul class="tr-audio">${data.audio.map((a) => `
                                <li><span class="disc">${svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>')}</span>
                                <div><strong>${escapeHtml(a.title)}</strong>${a.note ? `<small>${escapeHtml(a.note)}</small>` : ''}</div></li>`).join('')}</ul>
                        </div>` : ''}
                    </aside>
                </div>

                <p class="note">${data.live
                    ? 'Topics come from a live web search.'
                    : "Topics, hashtags and sounds come from the AI model's own knowledge, which can be a few months behind. Check them in the app before you post."}
                    ${data.youtube?.length ? ' The YouTube chart is live.' : ''}
                    Momentum is an AI estimate, not a measured statistic.</p>`;
        }

        /* ---- Detail sheet ---- */
        const openSheet = (topic) => {
            lastFocus = document.activeElement;
            sheet.innerHTML = `
                <header class="sheet-head">
                    <div><span class="tr-card-top"><span class="tr-cat">${escapeHtml(topic.category)}</span>${pill(topic.momentum)}</span>
                    <h2 id="sheetTitle">${escapeHtml(topic.title)}</h2>
                    <p>${escapeHtml(topic.description)}</p></div>
                    <button class="sheet-close" data-close aria-label="Close">${svg('<path d="M6 6l12 12M18 6 6 18"/>')}</button>
                </header>
                <div class="sheet-body">
                    ${topic.format ? `<div class="sheet-row"><h3>Format</h3><p>${escapeHtml(topic.format)}</p></div>` : ''}
                    ${topic.hashtags.length ? `<div class="sheet-row"><h3>Hashtags</h3><div class="sheet-tags">
                        ${topic.hashtags.map((x) => `<button class="tag-btn chip" data-copy="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('')}</div></div>` : ''}
                    ${topic.advice ? `<div class="sheet-advice"><h3>How to post on this trend</h3><p>${escapeHtml(topic.advice)}</p></div>` : ''}
                </div>
                <footer class="sheet-foot">
                    ${topic.hashtags.length ? `<button class="ghost" data-copy="${escapeHtml(topic.hashtags.join(' '))}">${ICON.copy}Copy all hashtags</button>` : ''}
                    <button class="primary sheet-cta" data-script="${topic.id}">${ICON.script}Script this trend</button>
                </footer>`;
            sheet.hidden = false;
            backdrop.hidden = false;
            $('[data-close]', sheet).focus();
        };
        const closeSheet = () => {
            if (sheet.hidden) return;
            sheet.hidden = true;
            backdrop.hidden = true;
            lastFocus?.focus?.();
        };
        body.closeSheet = closeSheet; // used by the global Esc handler

        /* ---- Events ---- */
        search.addEventListener('input', () => { view.query = search.value.trim(); if (data) draw(); });
        sortSel.addEventListener('change', () => { view.sort = sortSel.value; if (data) draw(); });
        backdrop.addEventListener('click', closeSheet);
        sheet.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return; // keep keyboard focus inside the sheet
            const f = $$('button, a[href]', sheet);
            if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
            else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
        });

        body.addEventListener('click', (e) => {
            const t = e.target;
            const copy = t.closest('[data-copy]');
            if (copy) { copyText(copy.dataset.copy); return; }
            if (t.closest('[data-close]')) { closeSheet(); return; }
            const cat = t.closest('[data-cat]');
            if (cat) { view.category = cat.dataset.cat; draw(); return; }
            const card = t.closest('[data-topic]');
            if (card) { openSheet(data.topics.find((x) => x.id === Number(card.dataset.topic))); return; }
            const script = t.closest('[data-script]');
            if (script) {
                const topic = data.topics.find((x) => x.id === Number(script.dataset.script));
                closeSheet();
                handOff('script', `${topic.title} — ${topic.advice}`);
                return;
            }
            const act = t.closest('[data-act]')?.dataset.act;
            if (act === 'refresh') load(true);
            if (act === 'retry') load();
            if (act === 'reset') { view.category = 'All'; view.query = ''; search.value = ''; draw(); }
            if (act === 'copy-top') copyText(data.hashtags.slice(0, 5).map((x) => x.tag).join(' '));
        });

        onPlatformChange(() => { closeSheet(); data = null; load(); });
        load();
    },

    /* ---------------- C-Pilot ---------------- */
    copilot(body, app) {
        body.classList.add('chat-layout');
        body.innerHTML = `
            <section class="chat">
                <div class="chat-log" aria-live="polite"></div>
                <form class="chat-compose">
                    <textarea name="message" rows="1" placeholder="Ask C-Pilot anything" aria-label="Message"></textarea>
                    <button class="send" type="submit" aria-label="Send">${ICON.send}</button>
                </form>
            </section>`;
        const log = $('.chat-log', body);
        const form = $('.chat-compose', body);
        const input = form.elements.message;
        const sendBtn = $('.send', form);

        const suggestions = {
            instagram: ['When should I post Reels this week?', 'How do I get my first 1,000 followers?', 'How many hashtags should I use?', 'Plan my first 5 posts'],
            linkedin: ['What time do LinkedIn posts get the most reach?', 'How often should I post on LinkedIn?', 'Text post or carousel — which reaches more?', 'Plan my first 5 posts'],
            youtube: ['Best day and time to upload?', 'Shorts or long videos for a new channel?', 'How do I write titles that get clicks?', 'Plan my first 5 videos'],
        };

        const draw = () => {
            const chat = state.chats[state.platform];
            if (!chat.length) {
                log.innerHTML = `<div class="chat-hello">${tile(app)}<h2>Grow on ${PLATFORMS[state.platform].name}</h2>
                    <p>Posting times, reach, formats, your first followers. Ask in your own words.</p>
                    <div class="suggestions">${suggestions[state.platform].map((s) => `<button type="button" class="chip" data-ask="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}</div></div>`;
                return;
            }
            log.innerHTML = chat.map((m) =>
                m.role === 'user'
                    ? `<div class="bubble user">${escapeHtml(m.content)}</div>`
                    : `<div class="bubble assistant doc">${md(m.content)}</div>`).join('');
            log.scrollTop = log.scrollHeight;
        };
        draw();
        onPlatformChange(draw);

        const grow = () => { input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`; };
        input.addEventListener('input', grow);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
        });
        log.addEventListener('click', (e) => {
            const s = e.target.closest('[data-ask]');
            if (s) { input.value = s.dataset.ask; form.requestSubmit(); }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text || sendBtn.disabled) return;
            const platform = state.platform;
            const chat = state.chats[platform];
            chat.push({ role: 'user', content: text });
            input.value = '';
            grow();
            draw();
            log.insertAdjacentHTML('beforeend', '<div class="bubble assistant typing" aria-label="C-Pilot is typing"><i></i><i></i><i></i></div>');
            log.scrollTop = log.scrollHeight;
            sendBtn.disabled = true;
            busy(true);
            try {
                const { reply } = await api('/api/copilot', {
                    json: { platform, messages: chat, profile: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } },
                });
                chat.push({ role: 'assistant', content: reply });
            } catch (err) {
                chat.pop();
                toast(err.message.length > 90 ? "C-Pilot couldn't answer. Check the server." : err.message);
                input.value = text;
            } finally {
                sendBtn.disabled = false;
                busy(false);
                if (state.current === 'copilot' && state.platform === platform) draw();
                input.focus();
            }
        });
    },

    /* ---------------- About ---------------- */
    about(body) {
        body.classList.add('chat-layout');
        body.innerHTML = `
            <section class="panel canvas"><div class="about">
                <h2>One studio for everything you post</h2>
                <p>INFLUX puts the AI tools a creator needs in one place: write it, make the visuals, cut the clips, check it before it goes out, and know what to post next. Every tool adapts to Instagram, LinkedIn or YouTube.</p>
                <ul class="about-list">
                    ${APPS.filter((a) => a.id !== 'about').map((a) => `<li>${tile(a)}<div><strong>${a.name}</strong><span>${a.blurb}</span></div></li>`).join('')}
                </ul>
                ${CONTACT_EMAIL ? `<a class="ghost" href="mailto:${CONTACT_EMAIL}">${ICON.mail}Contact the team</a>` : ''}
            </div></section>`;
    },
};

/* ---------- Passing work between apps ---------- */
function handOff(appId, data) {
    state.handoff = { appId, data };
    state.originRect = null;
    location.hash = `#/${appId}/${state.platform}`;
}
function takeHandoff(appId) {
    if (state.handoff?.appId !== appId) return null;
    const { data } = state.handoff;
    state.handoff = null;
    return data;
}

/* =========================================================================
   Accounts: the login page is login.html. Here we only greet and sign out.
   ========================================================================= */
function goToLogin(reason = '') {
    const q = new URLSearchParams();
    if (reason) q.set('reason', reason);
    const next = location.hash.length > 2 ? location.hash : '';
    if (next) q.set('next', next);
    location.replace('login.html' + (q.toString() ? '?' + q : ''));
}

function enterStudio(user) {
    state.user = user;
    const first = user.username.split(' ')[0];
    const greet = window.INFLUX.once.take('greet');
    $('#helloName').textContent = `${greet === 'welcome' ? 'Welcome' : 'Hello'}, ${first}`;
    $('#avatarBtn').textContent = first.charAt(0).toUpperCase();
    $('#accountName').textContent = user.username;
    $('#accountEmail').textContent = user.email;

    const studio = $('#studio');
    studio.hidden = false;
    if (!reduceMotion()) {
        studio.classList.add('entering');
        setTimeout(() => studio.classList.remove('entering'), 700);
    }
    loadHealth();
    route();
}

function signOut(reason = '') {
    clearToken();
    state.user = null;
    goToLogin(reason);
}

// Account menu on the home screen
$('#avatarBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = $('#accountMenu');
    menu.hidden = !menu.hidden;
    e.currentTarget.setAttribute('aria-expanded', !menu.hidden);
    if (!menu.hidden) $('#logoutBtn').focus();
});
document.addEventListener('click', (e) => {
    if (!e.target.closest('#accountMenu')) {
        $('#accountMenu').hidden = true;
        $('#avatarBtn').setAttribute('aria-expanded', 'false');
    }
});
$('#logoutBtn').addEventListener('click', () => signOut());

/* =========================================================================
   Start
   ========================================================================= */
renderHome();
tickClock();
setInterval(tickClock, 15000);

$('#homeIndicator').addEventListener('click', () => { location.hash = '#/'; });
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#accountMenu').hidden) { $('#accountMenu').hidden = true; $('#avatarBtn').focus(); return; }
    const openSheet = $('.sheet:not([hidden])', appWindow);
    if (openSheet) { openSheet.closest('.app-body').closeSheet(); return; }
    if (state.current) location.hash = '#/';
});
window.addEventListener('hashchange', route);

(async function boot() {
    if (!getToken()) { goToLogin(); return; }
    const base = await findServer();
    if (base === null) { goToLogin(); return; } // the login page explains how to start the server
    API_BASE = base;
    try {
        const { user } = await api('/api/auth/me', { method: 'GET' });
        enterStudio(user);
    } catch (err) {
        if (err.status === 401) { clearToken(); goToLogin(/no longer exists/.test(err.message) ? 'gone' : 'expired'); return; }
        goToLogin();
        return;
    }
    document.body.classList.remove('booting');
})();
