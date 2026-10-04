/* =========================================================================
   INFLUX — Library: one place for every video, image, audio file and document.
   Loaded after app.js and uses its helpers (api, apiUpload, $, ICON, tile, toast…).

   - Upload by button or drag and drop (many files at once, with progress)
   - AI (Gemini) names, describes and tags each file, so search finds "sunset" or "podcast"
   - Filter by type or favourites, search, sort; storage meter
   - Detail view: preview/player, rename, edit tags, AI post idea, download, delete,
     and send the file to another app (Muse, VideoClip)
   - Scripting, ImageGen and VideoClip save their results here (saveToLibrary)
   ========================================================================= */

Object.assign(ICON, {
    star: svg('<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z"/>'),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
    play: svg('<path d="M8 5.5v13l11-6.5Z" fill="currentColor"/>'),
    music: svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
    doc: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
    sparkle: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
});

const LIB_TYPES = [
    { id: 'all', label: 'All' },
    { id: 'video', label: 'Videos' },
    { id: 'image', label: 'Images' },
    { id: 'audio', label: 'Audio' },
    { id: 'document', label: 'Docs' },
    { id: 'favorite', label: 'Favourites' },
];
const LIB_SOURCES = { upload: 'Uploaded', Scripting: 'From Scripting', ImageGen: 'From ImageGen', VideoClip: 'From VideoClip', Muse: 'From Muse' };

const libUrl = (u) => (u ? API_BASE + u : '');
const fmtBytes = (b) => {
    const K = 1024, M = K * K, G = M * K;
    const one = (n) => (Math.round(n * 10) / 10).toString(); // 2 GB, 4.2 MB
    return b >= G ? `${one(b / G)} GB` : b >= M ? `${one(b / M)} MB` : `${Math.max(1, Math.round(b / K))} KB`;
};
function fmtAgo(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    const rtf = new Intl.RelativeTimeFormat([], { numeric: 'auto' });
    if (s < 45) return 'just now';
    if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
    if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
    if (s < 86400 * 30) return rtf.format(-Math.round(s / 86400), 'day');
    return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}
const extOf = (name) => (name.match(/\.([a-z0-9]{1,6})$/i)?.[1] || 'file').toUpperCase();

/**
 * Save files to the Library from any app.
 * blobOrFiles: a Blob (with name) or an array of File objects.
 */
async function saveToLibrary(blobOrFiles, name, { source = 'upload', platform } = {}) {
    const files = Array.isArray(blobOrFiles) ? blobOrFiles : [new File([blobOrFiles], name, { type: blobOrFiles.type })];
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    fd.append('source', source);
    if (platform) fd.append('platform', platform);
    busy(true);
    try {
        const res = await api('/api/library', { form: fd });
        state.library = null; // reload next time the Library opens
        toast(res.assets.length > 1 ? `Saved ${res.assets.length} files to Library` : 'Saved to Library');
        return res;
    } catch (err) {
        toast(err.message);
        throw err;
    } finally {
        busy(false);
    }
}

APP_VIEWS.library = function libraryView(body, app) {
    body.classList.add('library-layout');
    const view = { type: 'all', q: '', sort: 'newest' };
    let pollTimer = null;
    let openId = null;

    body.innerHTML = `
        <div class="lib-bar">
            <label class="tr-search lib-search">${ICON.search}
                <input type="search" placeholder="Search names, tags or what's in them" aria-label="Search the Library"></label>
            <div class="lib-types" role="tablist" aria-label="File type"></div>
            <label class="tr-sort"><span>Sort</span>
                <select aria-label="Sort files">
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="name">Name</option>
                    <option value="size">Size</option>
                </select></label>
            <button class="primary lib-upload" type="button">${ICON.upload}<span>Upload</span></button>
            <input class="lib-file" type="file" multiple hidden>
        </div>
        <div class="lib-status"></div>
        <div class="lib-uploads" aria-live="polite"></div>
        <section class="lib-content" aria-live="polite"><div class="lib-grid">${'<div class="lib-card is-loading"><div class="lib-thumb"></div><i></i><i></i></div>'.repeat(8)}</div></section>
        <div class="lib-drop" hidden><div>${ICON.upload}<strong>Drop to add to your Library</strong><span>Videos, images, audio and documents, up to 500 MB each</span></div></div>
        <div class="sheet-backdrop" hidden></div>
        <section class="sheet lib-sheet" role="dialog" aria-modal="true" aria-labelledby="libSheetTitle" hidden></section>`;

    const $b = (sel) => $(sel, body);
    const content = $b('.lib-content');
    const sheet = $b('.lib-sheet');
    const backdrop = $b('.sheet-backdrop');
    const fileInput = $b('.lib-file');
    let lastFocus = null;

    /* ---------- Data ---------- */
    async function load({ quiet = false } = {}) {
        try {
            const data = await api('/api/library', { method: 'GET' });
            state.library = data;
            if (state.current !== 'library') return;
            draw();
            if (openId) {
                const a = data.assets.find((x) => x.id === openId);
                if (a) refreshSheet(a); else closeSheet();
            }
            schedulePoll();
        } catch (err) {
            if (!quiet) content.innerHTML = errorCard(err) + `<p style="margin-top:1em"><button class="ghost" data-act="retry">${ICON.refresh}Try again</button></p>`;
        }
    }
    // While the AI is still tagging, check back every few seconds
    function schedulePoll() {
        clearTimeout(pollTimer);
        const pending = state.library?.assets.some((a) => a.ai?.status === 'pending');
        if (pending && state.current === 'library') pollTimer = setTimeout(() => load({ quiet: true }), 3000);
    }

    function filtered() {
        const words = view.q.toLowerCase().split(/\s+/).filter(Boolean);
        const list = state.library.assets.filter((a) =>
            (view.type === 'all' || (view.type === 'favorite' ? a.favorite : a.type === view.type)) &&
            words.every((w) => [a.name, a.type, a.source, ...(a.tags || []), a.ai?.title, a.ai?.description]
                .join(' ').toLowerCase().includes(w)));
        const by = {
            newest: (x, y) => y.createdAt.localeCompare(x.createdAt),
            oldest: (x, y) => x.createdAt.localeCompare(y.createdAt),
            name: (x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }),
            size: (x, y) => y.size - x.size,
        }[view.sort];
        return list.sort(by);
    }

    /* ---------- Drawing ---------- */
    function thumbHtml(a) {
        const t = libUrl(a.urls.thumb) || (a.type === 'image' ? libUrl(a.urls.file) : '');
        const dur = a.meta?.duration ? `<span class="lib-dur">${fmtTime(a.meta.duration)}</span>` : '';
        if (a.type === 'video') return `${t ? `<img src="${t}" alt="" loading="lazy">` : ''}<span class="lib-play">${ICON.play}</span>${dur}`;
        if (a.type === 'image') return t ? `<img src="${t}" alt="" loading="lazy">` : `<span class="lib-glyph">${ICON.image}</span>`;
        if (a.type === 'audio') return `<span class="lib-glyph">${ICON.music}</span>${t ? `<img class="lib-wave" src="${t}" alt="" loading="lazy">` : ''}${dur}`;
        return a.preview
            ? `<span class="lib-textprev">${escapeHtml(a.preview.slice(0, 260))}</span><span class="lib-ext">${extOf(a.name)}</span>`
            : `<span class="lib-glyph">${ICON.doc}</span><span class="lib-ext">${extOf(a.name)}</span>`;
    }

    function tagsHtml(a) {
        if (a.ai?.status === 'pending') return `<span class="lib-ai-pending">${ICON.sparkle}AI is tagging…</span>`;
        if (!a.tags?.length) return '';
        return a.tags.slice(0, 3).map((t) => `<span class="lib-tag">${escapeHtml(t)}</span>`).join('');
    }

    function draw() {
        const data = state.library;
        const all = data.assets;
        const counts = Object.fromEntries(LIB_TYPES.map((t) => [t.id,
            t.id === 'all' ? all.length : t.id === 'favorite' ? all.filter((a) => a.favorite).length : all.filter((a) => a.type === t.id).length]));

        $b('.lib-types').innerHTML = LIB_TYPES
            .filter((t) => t.id === 'all' || t.id === view.type || counts[t.id])
            .map((t) => `<button role="tab" data-type="${t.id}" aria-selected="${view.type === t.id}">${t.label} <span>${counts[t.id]}</span></button>`).join('');

        const pct = Math.min(100, (data.usage.bytes / data.usage.quota) * 100);
        const pending = all.filter((a) => a.ai?.status === 'pending').length;
        $b('.lib-status').innerHTML = `
            <div class="lib-meter" title="${pct.toFixed(1)}% used"><i style="width:${Math.max(pct, all.length ? 1 : 0)}%" class="${pct > 90 ? 'full' : ''}"></i></div>
            <span>${fmtBytes(data.usage.bytes)} of ${fmtBytes(data.usage.quota)} used</span>
            <span class="lib-ai-note">${data.ai
                ? (pending ? `${ICON.sparkle}AI is tagging ${pending} file${pending > 1 ? 's' : ''}…` : `${ICON.sparkle}AI tags files as you add them`)
                : 'Add a Gemini key to turn on AI tagging'}</span>`;

        if (!all.length) {
            content.innerHTML = `<div class="empty lib-empty">${tile(app)}<h3>Everything you make, in one place</h3>
                <p>Add videos, images, audio and documents, or drop them here. AI names and tags each one so you can find it later.
                Scripts, images and clips you make in the other apps can be saved here too.</p>
                <button class="primary" type="button" data-act="upload" style="width:auto">${ICON.upload}<span>Upload files</span></button></div>`;
            return;
        }
        const list = filtered();
        if (!list.length) {
            content.innerHTML = `<div class="empty lib-empty">${tile(app)}<h3>Nothing matches</h3>
                <p>Try different words, or show all files.</p><button class="ghost" data-act="reset">Show all files</button></div>`;
            return;
        }
        content.innerHTML = `<div class="lib-grid">${list.map((a) => `
            <article class="lib-card" data-id="${a.id}">
                <button class="lib-open" data-open="${a.id}" aria-label="Open ${escapeHtml(a.name)}">
                    <span class="lib-thumb t-${a.type}">${thumbHtml(a)}</span>
                    <span class="lib-name">${escapeHtml(a.name)}</span>
                    <span class="lib-meta">${fmtBytes(a.size)} · ${fmtAgo(a.createdAt)}${a.source !== 'upload' ? ` · ${LIB_SOURCES[a.source] || a.source}` : ''}</span>
                    <span class="lib-tags">${tagsHtml(a)}</span>
                </button>
                <button class="lib-fav" data-fav="${a.id}" aria-pressed="${a.favorite}" aria-label="${a.favorite ? 'Remove from favourites' : 'Add to favourites'}">${ICON.star}</button>
            </article>`).join('')}</div>`;
    }

    /* ---------- Uploading ---------- */
    function upload(files) {
        files = [...files].filter((f) => f.size > 0);
        if (!files.length) return;
        const tray = $b('.lib-uploads');
        const batches = [];
        for (let i = 0; i < files.length; i += 10) batches.push(files.slice(i, i + 10));

        batches.forEach((batch) => {
            const row = document.createElement('div');
            row.className = 'lib-upload-row';
            const total = batch.reduce((s, f) => s + f.size, 0);
            row.innerHTML = `<span class="lib-upload-name">${batch.length === 1 ? escapeHtml(batch[0].name) : `${batch.length} files`} · ${fmtBytes(total)}</span>
                <span class="bar"><i></i></span><span class="lib-upload-pct">0%</span>`;
            tray.append(row);

            const fd = new FormData();
            batch.forEach((f) => fd.append('files', f));
            busy(true);
            apiUpload('/api/library', fd,
                (p) => { $('i', row).style.width = `${Math.round(p * 100)}%`; $('.lib-upload-pct', row).textContent = `${Math.round(p * 100)}%`; },
                () => { $('.lib-upload-pct', row).textContent = 'Processing…'; })
                .then((res) => {
                    row.remove();
                    if (res.skipped?.length) toast(`${res.skipped[0].name}: ${res.skipped[0].reason}`);
                    if (res.assets?.length) toast(res.assets.length > 1 ? `Added ${res.assets.length} files` : `Added ${res.assets[0].name}`);
                    load({ quiet: true });
                })
                .catch((err) => {
                    row.classList.add('failed');
                    $('.lib-upload-pct', row).textContent = '';
                    $('.lib-upload-name', row).textContent = err.message;
                    setTimeout(() => row.remove(), 7000);
                })
                .finally(() => busy(false));
        });
    }

    /* ---------- Detail sheet ---------- */
    function previewHtml(a) {
        const src = libUrl(a.urls.file);
        if (a.type === 'image') return `<img src="${src}" alt="${escapeHtml(a.ai?.description || a.name)}">`;
        if (a.type === 'video') return `<video src="${src}" controls playsinline preload="metadata" ${a.urls.thumb ? `poster="${libUrl(a.urls.thumb)}"` : ''}></video>`;
        if (a.type === 'audio') return `<div class="lib-audio">${a.urls.thumb ? `<img src="${libUrl(a.urls.thumb)}" alt="">` : `<span class="lib-glyph">${ICON.music}</span>`}<audio src="${src}" controls preload="metadata"></audio></div>`;
        if (a.preview) return `<pre class="lib-text">${escapeHtml(a.preview)}${a.preview.length >= 600 ? '\n…' : ''}</pre>`;
        return `<div class="lib-docprev"><span class="lib-glyph">${ICON.doc}</span><span class="lib-ext">${extOf(a.name)}</span></div>`;
    }

    function aiHtml(a) {
        const ai = a.ai || {};
        if (ai.status === 'pending') return `<div class="lib-ai is-pending">${ICON.sparkle}<div><strong>AI is looking at this file…</strong><p>Title, description and tags appear in a few seconds.</p></div></div>`;
        if (ai.status === 'done') return `<div class="lib-ai">${ICON.sparkle}<div>
            <strong>${escapeHtml(ai.title)}</strong><p>${escapeHtml(ai.description)}</p>
            ${ai.idea ? `<p class="lib-idea"><b>Post idea:</b> ${escapeHtml(ai.idea)}</p>` : ''}
            ${ai.platforms?.length ? `<p class="lib-fits">Fits ${ai.platforms.map((p) => `<span><span class="pf-dot ${p}"></span>${PLATFORMS[p]?.name || p}</span>`).join('')}</p>` : ''}
        </div></div>`;
        if (ai.status === 'failed') return `<div class="lib-ai is-failed">${ICON.sparkle}<div><strong>AI couldn't tag this file</strong><p>${escapeHtml(ai.error || '')}</p></div></div>`;
        if (ai.status === 'skipped') return `<div class="lib-ai is-muted">${ICON.sparkle}<div><p>AI can't read this kind of file, so add tags yourself.</p></div></div>`;
        return '';
    }

    function sheetHtml(a) {
        const m = a.meta || {};
        const rows = [
            ['Type', `${a.type === 'document' ? 'Document' : a.type[0].toUpperCase() + a.type.slice(1)} · ${extOf(a.name)}`],
            ['Size', fmtBytes(a.size)],
            m.width ? ['Dimensions', `${m.width} × ${m.height}`] : null,
            m.duration ? ['Length', fmtTime(m.duration)] : null,
            ['Added', `${new Date(a.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`],
            ['Source', LIB_SOURCES[a.source] || a.source],
            a.platform ? ['Made for', PLATFORMS[a.platform]?.name] : null,
        ].filter(Boolean);
        const useIn = [];
        if (a.type === 'image') useIn.push(`<button class="ghost" data-use="touchup">${ICON.touchup}Get feedback in Muse</button>`);
        if (a.type === 'video') useIn.push(`<button class="ghost" data-use="clips">${ICON.clips}Make clips in VideoClip</button>`);
        if (a.type === 'document' && a.preview) useIn.push(`<button class="ghost" data-use="touchup-text">${ICON.touchup}Review in Muse</button>`);

        return `
            <header class="sheet-head">
                <div>
                    <label class="lib-rename"><span class="sr-only">File name</span>
                        <input id="libSheetTitle" value="${escapeHtml(a.name)}" maxlength="120" aria-label="File name"></label>
                </div>
                <button class="lib-fav lib-fav-lg" data-fav="${a.id}" aria-pressed="${a.favorite}" aria-label="${a.favorite ? 'Remove from favourites' : 'Add to favourites'}">${ICON.star}</button>
                <button class="sheet-close" data-close aria-label="Close">${ICON.close}</button>
            </header>
            <div class="lib-sheet-body">
                <div class="lib-preview t-${a.type}">${previewHtml(a)}</div>
                <div class="lib-info">
                    ${aiHtml(a)}
                    <div class="lib-tagedit">
                        <h3>Tags</h3>
                        <div class="lib-tagbox">
                            ${(a.tags || []).map((t, i) => `<span class="chip lib-chip">${escapeHtml(t)}<button data-untag="${i}" aria-label="Remove tag ${escapeHtml(t)}">${ICON.close}</button></span>`).join('')}
                            <input class="lib-tag-input" placeholder="Add a tag" aria-label="Add a tag" maxlength="30">
                        </div>
                    </div>
                    <dl class="lib-facts">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
                </div>
            </div>
            <footer class="sheet-foot lib-sheet-foot">
                <button class="ghost lib-delete" data-delete>${ICON.trash}Delete</button>
                ${a.ai?.status !== 'pending' && state.library?.ai && a.ai?.status !== 'skipped' ? `<button class="ghost" data-retag>${ICON.sparkle}Retag with AI</button>` : ''}
                <span class="lib-foot-gap"></span>
                ${useIn.join('')}
                <a class="primary sheet-cta" href="${libUrl(a.urls.download)}" download="${escapeHtml(a.name)}">${ICON.download}Download</a>
            </footer>`;
    }

    function openSheet(a) {
        openId = a.id;
        lastFocus = document.activeElement;
        sheet.innerHTML = sheetHtml(a);
        sheet.hidden = false;
        backdrop.hidden = false;
        $('[data-close]', sheet).focus();
    }
    // Update the open sheet without interrupting a playing video or a half-typed name
    function refreshSheet(a) {
        const nameInput = $('#libSheetTitle', sheet);
        const typing = document.activeElement === nameInput || document.activeElement?.classList.contains('lib-tag-input');
        if (typing) return;
        const info = $('.lib-info', sheet);
        if (info) {
            const tmp = document.createElement('div');
            tmp.innerHTML = sheetHtml(a);
            info.replaceWith($('.lib-info', tmp));
            $('.lib-sheet-foot', sheet).replaceWith($('.lib-sheet-foot', tmp));
            $$('[data-fav]', sheet).forEach((b) => b.setAttribute('aria-pressed', a.favorite));
        }
    }
    function closeSheet() {
        if (sheet.hidden) return;
        sheet.hidden = true;
        backdrop.hidden = true;
        sheet.innerHTML = ''; // stops any playing media
        openId = null;
        lastFocus?.focus?.();
    }
    body.closeSheet = closeSheet;

    const current = () => state.library?.assets.find((x) => x.id === openId);

    async function patch(id, changes, { quiet } = {}) {
        try {
            const { asset } = await api(`/api/library/${id}`, { method: 'PATCH', json: changes });
            const i = state.library.assets.findIndex((x) => x.id === id);
            if (i > -1) state.library.assets[i] = asset;
            draw();
            if (openId === id) refreshSheet(asset);
            if (!quiet) toast('Saved');
            return asset;
        } catch (err) {
            toast(err.message);
        }
    }

    /* ---------- Events ---------- */
    $b('.lib-upload').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { upload(fileInput.files); fileInput.value = ''; });
    $b('.lib-search input').addEventListener('input', (e) => { view.q = e.target.value.trim(); if (state.library) draw(); });
    $b('.tr-sort select').addEventListener('change', (e) => { view.sort = e.target.value; if (state.library) draw(); });
    backdrop.addEventListener('click', closeSheet);

    // Drag files anywhere onto the Library
    let dragDepth = 0;
    const dropLayer = $b('.lib-drop');
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    body.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; dropLayer.hidden = false; });
    body.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
    body.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dropLayer.hidden = true; });
    body.addEventListener('drop', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth = 0;
        dropLayer.hidden = true;
        upload(e.dataTransfer.files);
    });

    body.addEventListener('click', async (e) => {
        const t = e.target;
        const typeBtn = t.closest('[data-type]');
        if (typeBtn) { view.type = typeBtn.dataset.type; draw(); return; }

        const fav = t.closest('[data-fav]');
        if (fav) {
            const a = state.library.assets.find((x) => x.id === fav.dataset.fav);
            if (a) patch(a.id, { favorite: !a.favorite }, { quiet: true });
            return;
        }
        const open = t.closest('[data-open]');
        if (open) { const a = state.library.assets.find((x) => x.id === open.dataset.open); if (a) openSheet(a); return; }
        if (t.closest('[data-close]')) { closeSheet(); return; }

        const act = t.closest('[data-act]')?.dataset.act;
        if (act === 'upload') { fileInput.click(); return; }
        if (act === 'retry') { load(); return; }
        if (act === 'reset') { view.type = 'all'; view.q = ''; $b('.lib-search input').value = ''; draw(); return; }

        const a = current();
        if (!a) return;

        const untag = t.closest('[data-untag]');
        if (untag) { patch(a.id, { tags: a.tags.filter((_, i) => i !== Number(untag.dataset.untag)) }, { quiet: true }); return; }

        if (t.closest('[data-retag]')) {
            try {
                const { asset } = await api(`/api/library/${a.id}/retag`);
                Object.assign(a, asset);
                draw(); refreshSheet(a); schedulePoll();
            } catch (err) { toast(err.message); }
            return;
        }

        const del = t.closest('[data-delete]');
        if (del) {
            if (del.dataset.confirm !== 'yes') {
                del.dataset.confirm = 'yes';
                del.classList.add('confirm');
                del.innerHTML = `${ICON.trash}Delete for good?`;
                setTimeout(() => { if (del.isConnected) { del.dataset.confirm = ''; del.classList.remove('confirm'); del.innerHTML = `${ICON.trash}Delete`; } }, 4000);
                return;
            }
            try {
                await api(`/api/library/${a.id}`, { method: 'DELETE' });
                state.library.assets = state.library.assets.filter((x) => x.id !== a.id);
                state.library.usage.bytes -= a.size;
                closeSheet();
                draw();
                toast(`Deleted ${a.name}`);
            } catch (err) { toast(err.message); }
            return;
        }

        const use = t.closest('[data-use]')?.dataset.use;
        if (use === 'touchup') { closeSheet(); handOff('touchup', { image: libUrl(a.urls.file) }); }
        if (use === 'touchup-text') { closeSheet(); handOff('touchup', { text: a.preview }); }
        if (use === 'clips') { closeSheet(); handOff('clips', { video: libUrl(a.urls.file), name: a.name }); }
    });

    // Rename: saves when you press Enter or leave the field
    sheet.addEventListener('keydown', (e) => {
        if (e.target.id === 'libSheetTitle' && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
        if (e.target.classList.contains('lib-tag-input') && (e.key === 'Enter' || e.key === ',')) {
            e.preventDefault();
            const a = current();
            const tag = e.target.value.trim().replace(/^#/, '').toLowerCase();
            e.target.value = '';
            if (a && tag && !a.tags.includes(tag)) patch(a.id, { tags: [...a.tags, tag] }, { quiet: true }).then(() => $('.lib-tag-input', sheet)?.focus());
        }
        if (e.key === 'Tab') { // keep keyboard focus inside the sheet
            const f = $$('button, a[href], input, video, audio', sheet).filter((x) => !x.disabled);
            if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
            else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
        }
    });
    sheet.addEventListener('focusout', (e) => {
        if (e.target.id !== 'libSheetTitle') return;
        const a = current();
        const name = e.target.value.trim();
        if (a && name && name !== a.name) patch(a.id, { name });
        else if (a) e.target.value = a.name;
    });

    // Stop polling when the app closes
    const stopWhenClosed = () => { if (state.current !== 'library') { clearTimeout(pollTimer); window.removeEventListener('hashchange', stopWhenClosed); } };
    window.addEventListener('hashchange', stopWhenClosed);

    if (state.library) { draw(); schedulePoll(); load({ quiet: true }); } else load();
};
