// User Contributions CRUD (Supabase)
(function(){
  // Local fallback storage helpers (used when Supabase is unavailable/misconfigured)
  const LS_PREFIX = 'xaytheon:contribs:';
  function lsKey(userId){ return LS_PREFIX + (userId || 'guest'); }
  function lsRead(userId){
    try { return JSON.parse(localStorage.getItem(lsKey(userId))||'[]') || []; } catch { return []; }
  }
  function lsWrite(userId, rows){
    try { localStorage.setItem(lsKey(userId), JSON.stringify(rows)); } catch {}
  }
  function uuid(){
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    // RFC4122-ish fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8); return v.toString(16);
    });
  }
  function supa(){
    try {
      const ensure = window.XAYTHEON_AUTH?.ensureClient;
      if (typeof ensure !== 'function') {
        console.warn('Supabase ensureClient not available');
        return null;
      }
      const client = ensure();
      if (!client) {
        console.warn('Supabase client not created');
      }
      return client;
    } catch (e) {
      console.warn('Supabase client error:', e);
      return null;
    }
  }
  const CARD_BUCKET = 'contrib-cards';
  const FALLBACK_BUCKET = 'contrib-screens'; // reuse screenshots bucket if cards bucket missing
  const FALLBACK_PREFIX = 'cards';

  function status(msg, level='info'){ const el = document.getElementById('contrib-status'); if (el){ el.textContent = msg; el.style.color = level==='error'?'#b91c1c':'#111827'; } }

  async function getUser(){
    try {
      const s = await window.XAYTHEON_AUTH.getSession();
      return s?.user || null;
    } catch (e) {
      console.warn('getSession failed:', e);
      return null;
    }
  }

  async function ensureTables(){
    // Tables and buckets must be created in Supabase. Provide SQL helper in README if needed.
    // Expected table: contributions (id uuid default uuid_generate_v4() primary key, user_id uuid, project text, link text, program text, date date, type text, description text, tech text, screenshot_url text, created_at timestamp default now()) with RLS: user_id = auth.uid()
  }

  async function uploadScreenshot(file, userId){
    if (!file) return null;
    const c = supa(); if (!c) return null;
    const path = `${userId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const { error } = await c.storage.from('contrib-screens').upload(path, file, { upsert: false });
    if (error) { console.warn('upload error', error); return null; }
    const { data } = c.storage.from('contrib-screens').getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function uploadScreenshotLocal(file){
    // As a local fallback, store data URL directly for inline display
    if (!file) return null;
    try { return await blobToDataUrl(file); } catch { return null; }
  }

  // ---------- SVG Card Generation & Upload ----------
  function esc(s){
    return (s||'').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function cardSvg(row, imgHref){
    // Simple, GitHub-safe SVG card (no remote fonts). Width ~760 for README.
    const W = 760, H = 200, pad = 22;
    const title = (row.project||'Contribution').slice(0, 80);
    const line1 = [row.type, row.program, row.date ? new Date(row.date).toLocaleDateString() : ''].filter(Boolean).join(' • ');
    const tech = (row.tech||'').slice(0, 110);
    let host = '';
    try { if (row.link) host = new URL(row.link).hostname; } catch {}
    const linkText = host ? `${host}` : '';
    const desc = (row.description||'').slice(0, 140);
  const img = imgHref || row.screenshot_url || '';
    const clipId = `clip-${row.id || 'x'}`;
    const imgW = 180, imgH = 120; // image size on the right
    const imgX = W - pad - imgW, imgY = pad;
    // Neutral light background with subtle border
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Contribution card">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#eef2f6"/>
    </linearGradient>
    <clipPath id="${clipId}">
      <rect x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" rx="10" ry="10" />
    </clipPath>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="url(#g1)" stroke="#e5e7eb"/>
  ${img ? `<image x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" href="${esc(img)}" xlink:href="${esc(img)}" />` : ''}
  <g transform="translate(${pad},${pad})" font-family="-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial,sans-serif" fill="#0f172a">
    <text x="0" y="0" font-size="20" font-weight="700" dominant-baseline="hanging">${esc(title)}</text>
    ${line1?`<text x="0" y="36" font-size="14" fill="#334155">${esc(line1)}</text>`:''}
    ${desc?`<text x="0" y="62" font-size="14" fill="#334155">${esc(desc)}</text>`:''}
    ${tech?`<text x="0" y="100" font-size="13" fill="#475569">${esc(tech)}</text>`:''}
    ${linkText?`<text x="0" y="126" font-size="13" fill="#475569">${esc(linkText)}</text>`:''}
    <text x="0" y="${H - pad*2}" font-size="12" fill="#64748b">Made with XAYTHEON</text>
  </g>
</svg>`;
  }

  // Convert Blob to data URL (optimize large images by downscaling)
  function blobToDataUrl(blob){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function optimizeImageBlob(blob){
    try {
      if (blob.size <= 600000) {
        return await blobToDataUrl(blob);
      }
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.decoding = 'async';
      const dataUrl = await new Promise((resolve, reject) => {
        img.onload = () => {
          try {
            const maxW = 800, maxH = 800;
            let { width, height } = img;
            const scale = Math.min(1, maxW / width, maxH / height);
            const w = Math.max(1, Math.round(width * scale));
            const h = Math.max(1, Math.round(height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const out = canvas.toDataURL('image/jpeg', 0.85);
            resolve(out);
          } catch(e){ reject(e); }
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = url;
      });
      URL.revokeObjectURL(url);
      return dataUrl;
    } catch {
      // Fallback to plain base64 without optimization
      try { return await blobToDataUrl(blob); } catch { return null; }
    }
  }

  async function resolveInlineImage(row){
    if (!row.screenshot_url) return null;
    try {
      const res = await fetch(row.screenshot_url, { cache: 'no-store' });
      if (!res.ok) return null;
      const blob = await res.blob();
      const dataUrl = await optimizeImageBlob(blob);
      return dataUrl || null;
    } catch { return null; }
  }

  async function uploadCardSvg(row, userId){
    const c = supa(); if (!c) return { url:null, error:'Supabase not available' };
    const inlineImg = await resolveInlineImage(row);
    const svg = cardSvg(row, inlineImg);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const primaryPath = `${userId}/${row.id}.svg`;

    // Try primary bucket first
    let up = await c.storage.from(CARD_BUCKET).upload(primaryPath, blob, { upsert: true, contentType: 'image/svg+xml', cacheControl: '600' });
    if (up.error) {
      console.warn('card upload error (primary bucket)', up.error);
      // Fallback to existing screenshots bucket under a subfolder to avoid failing the feature entirely
      const fbPath = `${FALLBACK_PREFIX}/${userId}/${row.id}.svg`;
      const fb = await c.storage.from(FALLBACK_BUCKET).upload(fbPath, blob, { upsert: true, contentType: 'image/svg+xml', cacheControl: '600' });
      if (fb.error) {
        return { url:null, error: `Upload failed. Create a public bucket "${CARD_BUCKET}" or allow write to "${FALLBACK_BUCKET}". Details: ${fb.error.message || fb.error}`, blob };
      }
      const { data: fbUrlData } = c.storage.from(FALLBACK_BUCKET).getPublicUrl(fbPath);
      const fbUrl = fbUrlData?.publicUrl || null;
      const accessible = await checkPublicUrl(fbUrl);
      return { url: fbUrl, error: accessible ? null : 'Uploaded to fallback but public URL not accessible', blob };
    }
    const { data } = c.storage.from(CARD_BUCKET).getPublicUrl(primaryPath);
    const url = data?.publicUrl || null;
    const accessible = await checkPublicUrl(url);
    return { url, error: accessible ? null : 'Public URL not accessible', blob };
  }

  async function checkPublicUrl(url){
    if (!url) return false;
    try {
      const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      return head.ok;
    } catch { return false; }
  }

  async function getCardUrl(userId, contribId){
    const c = supa(); if (!c) return null;
    // Try primary
    const primaryPath = `${userId}/${contribId}.svg`;
    let { data } = c.storage.from(CARD_BUCKET).getPublicUrl(primaryPath);
    if (data?.publicUrl) {
      const ok = await checkPublicUrl(data.publicUrl);
      if (ok) return data.publicUrl;
    }
    // Try fallback
    const fbPath = `${FALLBACK_PREFIX}/${userId}/${contribId}.svg`;
    let { data: d2 } = c.storage.from(FALLBACK_BUCKET).getPublicUrl(fbPath);
    if (d2?.publicUrl) {
      const ok = await checkPublicUrl(d2.publicUrl);
      if (ok) return d2.publicUrl;
    }
    return null;
  }

  async function saveContribution(e){
    e.preventDefault();
    const c = supa();
    const user = await getUser(); if (!user){ status('Please sign in to save.', 'error'); return; }

    const project = document.getElementById('cf-project').value.trim();
    const link = document.getElementById('cf-link').value.trim();
    const program = document.getElementById('cf-program').value.trim();
    const date = document.getElementById('cf-date').value || null;
    const type = document.getElementById('cf-type').value.trim();
    const description = document.getElementById('cf-desc').value.trim();
    const tech = document.getElementById('cf-tech').value.trim();
    const file = document.getElementById('cf-shot').files[0] || null;

    // Validation
    if (!project) {
      status('Please enter a project name.', 'error');
      document.getElementById('cf-project').focus();
      return;
    }

    if (project.length > 100) {
      status('Project name must be 100 characters or less.', 'error');
      document.getElementById('cf-project').focus();
      return;
    }

    if (link && link.length > 500) {
      status('Link must be 500 characters or less.', 'error');
      document.getElementById('cf-link').focus();
      return;
    }

    if (link && !/^https?:\/\/.+/.test(link)) {
      status('Link must be a valid HTTP or HTTPS URL.', 'error');
      document.getElementById('cf-link').focus();
      return;
    }

    if (program && program.length > 100) {
      status('Program name must be 100 characters or less.', 'error');
      document.getElementById('cf-program').focus();
      return;
    }

    if (!type) {
      status('Please select a contribution type.', 'error');
      document.getElementById('cf-type').focus();
      return;
    }

    if (description.length > 1000) {
      status('Description must be 1000 characters or less.', 'error');
      document.getElementById('cf-desc').focus();
      return;
    }

    if (tech && tech.length > 200) {
      status('Technology must be 200 characters or less.', 'error');
      document.getElementById('cf-tech').focus();
      return;
    }

    // Validate file if present
    if (file) {
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        status('Screenshot file must be 5MB or smaller.', 'error');
        return;
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        status('Screenshot must be a JPEG, PNG, GIF, or WebP image.', 'error');
        return;
      }
    }

    status('Saving...');
    // disable button while saving
    const btn = (e.submitter && e.submitter.tagName === 'BUTTON') ? e.submitter : document.querySelector('#contrib-form button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    // Try Supabase path first if client is available
    let savedRow = null;
    if (c) {
      let screenshot_url = null;
      try { screenshot_url = await uploadScreenshot(file, user.id); } catch {}
      try {
        const { data, error } = await c.from('contributions').insert({
          user_id: user.id,
          project, link, program, date, type, description, tech, screenshot_url
        }).select().single();
        if (!error && data) {
          savedRow = data;
        } else if (error) {
          console.warn('Supabase insert failed, using local fallback:', error);
        }
      } catch (err) {
        console.warn('Supabase insert exception, using local fallback:', err);
      }
    }

    // Local fallback if Supabase path failed or unavailable
    if (!savedRow) {
      let screenshot_url = null;
      try { screenshot_url = await uploadScreenshotLocal(file); } catch {}
      savedRow = {
        id: uuid(),
        user_id: user.id,
        project, link, program, date, type, description, tech,
        screenshot_url,
        created_at: new Date().toISOString()
      };
      const rows = lsRead(user.id);
      rows.unshift(savedRow);
      lsWrite(user.id, rows);
      status('Saved locally (Supabase not configured).');
    } else {
      status('Saved. Generating card…');
    }

    // Generate a card
    try {
      const res = c ? await uploadCardSvg(savedRow, user.id) : { url: null, error: 'offline', blob: new Blob([cardSvg(savedRow)], { type: 'image/svg+xml' }) };
      if (res?.url && !res.error) {
        status('Saved and card generated.');
      } else if (res?.url && res.error) {
        status(`Saved. Card uploaded but not publicly accessible: ${res.error}. See setup notes below.`, 'error');
      } else {
        status('Saved. Download the generated SVG from the row if needed.');
      }
    } catch (e2) { console.warn('Card generation exception', e2); }

    (document.getElementById('contrib-form')).reset();
    await listContributions();
    if (btn) { btn.disabled = false; btn.textContent = 'Save Contribution'; }
  }

  function rowHtml(r){
    const shot = r.screenshot_url ? `<img src="${r.screenshot_url}" alt="screenshot" style="max-width:120px; border-radius:8px;"/>` : '';
    const date = r.date ? new Date(r.date).toLocaleDateString() : '';
    return `
      <div class="repo-item" data-id="${r.id}" style="display:grid; grid-template-columns: 1fr auto; gap: 8px; align-items:center;">
        <div>
          <div class="repo-name" style="font-family:'Eightgon',sans-serif;">${escapeHtml(r.project || '')}</div>
          <div class="repo-desc">${escapeHtml(r.description || '')}</div>
          <div class="repo-meta">
            ${r.link ? `<a href="${r.link}" target="_blank" rel="noopener">Link</a>` : ''}
            ${r.program ? `<span>${escapeHtml(r.program)}</span>` : ''}
            ${r.type ? `<span>${escapeHtml(r.type)}</span>` : ''}
            ${date ? `<span>${date}</span>` : ''}
            ${r.tech ? `<span>${escapeHtml(r.tech)}</span>` : ''}
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          ${shot}
          <button class="btn btn-outline contrib-gen" data-id="${r.id}" title="Generate/Update card">Generate Card</button>
          <button class="btn btn-outline contrib-copy" data-id="${r.id}" title="Copy README Markdown">Copy README</button>
          <a class="btn btn-outline contrib-open" data-id="${r.id}" target="_blank" rel="noopener">Open Image</a>
          <button class="btn btn-outline contrib-del" data-id="${r.id}" title="Delete">Delete</button>
        </div>
      </div>`;
  }

  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

  async function listContributions(){
    const c = supa();
    const list = document.getElementById('contrib-list'); if (!list) return;
    const user = await getUser(); if (!user){ list.innerHTML = ''; return; }

    let data = [];
    let loadError = null;
    if (c) {
      try {
        const resp = await c.from('contributions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        if (resp.error) { loadError = resp.error; }
        else data = resp.data || [];
      } catch (err) { loadError = err; }
    } else {
      loadError = new Error('Supabase not available');
    }

    // If Supabase failed, use local fallback
    if (loadError) {
      console.warn('Falling back to local contributions due to load error:', loadError);
      data = lsRead(user.id);
      if (!data || !data.length) {
        list.innerHTML = '<div class="muted">No contributions yet. (Using local storage fallback)</div>';
        return;
      }
    }

    list.innerHTML = data.map(rowHtml).join('');
    // Wire delete buttons
    list.querySelectorAll('.contrib-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (!id) return;
        if (!confirm('Delete this contribution?')) return;
        const c = supa(); if (!c) return;
        const { error } = await c.from('contributions').delete().eq('id', id);
        if (error) { status('Delete failed: ' + error.message, 'error'); return; }
        status('Deleted.');
        await listContributions();
      });
    });
    // Wire generate/copy/open actions
    list.querySelectorAll('.contrib-gen').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const row = data.find(r => r.id === id);
        if (!row) return;
        status('Generating card…');
        let res = null;
        if (c) {
          res = await uploadCardSvg(row, user.id);
        } else {
          res = { url:null, error:'offline', blob: new Blob([cardSvg(row)], { type: 'image/svg+xml' }) };
        }
        if (res?.url && !res.error) {
          status('Card generated.');
          const parent = e.currentTarget.closest('[data-id]');
          const openBtn = parent?.querySelector('.contrib-open');
          if (openBtn) openBtn.setAttribute('href', res.url);
        } else if (res?.url && res.error) {
          status(`Card uploaded but not publicly accessible: ${res.error}`, 'error');
        } else {
          status('Card generated (download locally).');
          const parent = e.currentTarget.closest('[data-id]');
          const openBtn = parent?.querySelector('.contrib-open');
          if (openBtn && res?.blob) {
            const tmpUrl = URL.createObjectURL(res.blob);
            openBtn.textContent = 'Download SVG';
            openBtn.setAttribute('href', tmpUrl);
            openBtn.setAttribute('download', `contribution-${id}.svg`);
          }
        }
      });
    });
    list.querySelectorAll('.contrib-copy').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (!c) { status('Card URL copy is unavailable in local mode. Use Download SVG.', 'error'); return; }
        const url = await getCardUrl(user.id, id);
        if (!url) { status('No card found. Generate it first.', 'error'); return; }
        const project = (data.find(r => r.id === id)?.project) || 'Contribution';
        const imageUrl = `${url}?v=${Date.now()}`; // bust caches when copying
        const link = `${location.origin}${location.pathname.replace(/[^/]*$/,'')}contributions.html#${id}`;
        const md = `[![Contribution – ${project}](${imageUrl})](${link})`;
        try { await navigator.clipboard.writeText(md); status('Copied README Markdown.'); }
        catch { status('Failed to copy to clipboard', 'error'); }
      });
    });
    list.querySelectorAll('.contrib-open').forEach(async (a) => {
      const id = a.getAttribute('data-id');
      if (!c) { a.setAttribute('href', '#'); return; }
      const url = await getCardUrl(user.id, id);
      if (url) a.setAttribute('href', url); else a.setAttribute('href', '#');
    });

    // If there is a hash, scroll to that contribution and highlight it briefly
    if (location.hash) {
      const targetId = location.hash.slice(1);
      const el = list.querySelector(`[data-id="${CSS.escape(targetId)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const orig = el.style.boxShadow;
        el.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.5)';
        setTimeout(() => { el.style.boxShadow = orig; }, 1800);
      }
    }
  }

  function onReady(){
    const form = document.getElementById('contrib-form');
    if (form) form.addEventListener('submit', saveContribution);
    listContributions();
    window.addEventListener('xaytheon:authchange', listContributions);
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', onReady);
  } else {
    // DOM is already ready when script is loaded at the end of body
    onReady();
  }
})();
