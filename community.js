// Community Highlights: Top-K Trending Repos by Score (Heap)
// Defaults: language Any, topic empty, timeWindow 30, topK 10

(function(){
  const form = document.getElementById('trend-form');
  if (!form) return;

  const langEl = document.getElementById('trend-lang');
  const topicEl = document.getElementById('trend-topic');
  const windowEl = document.getElementById('trend-window');
  const kEl = document.getElementById('trend-k');
  const statusEl = document.getElementById('trend-status');
  const resultsEl = document.getElementById('trend-results');
  const resetBtn = document.getElementById('trend-reset');
  const cacheInfoEl = document.getElementById('trend-cache-info');

  // Debounce helper
  function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // API call tracker for rate limiting
  const API_TRACKER = {
    lastCall: 0,
    minInterval: 2000, // 2 seconds between calls to respect rate limits
    
    canCall() {
      const now = Date.now();
      return (now - this.lastCall) >= this.minInterval;
    },
    
    recordCall() {
      this.lastCall = Date.now();
    }
  };

  // In-memory + local cache
  const memoryCache = new Map(); // key -> { at:number, items:Array, expiresAt: number }
  const TTL_MS = 10 * 60 * 1000; // 10 minutes

  // --- Heap implementation (min-heap for Top-K) ---
  class BinaryHeap {
    constructor(compare){
      this.a = [];
      this.cmp = compare || ((x,y)=>x<y);
    }
    size(){ return this.a.length; }
    peek(){ return this.a[0]; }
    push(val){
      const a=this.a; a.push(val);
      let i=a.length-1;
      while(i>0){
        const p=(i-1>>1); // parent
        if(this.cmp(a[i], a[p])){ [a[i],a[p]]=[a[p],a[i]]; i=p; } else break;
      }
    }
    pop(){
      const a=this.a; if(a.length===0) return undefined;
      const top=a[0]; const last=a.pop();
      if(a.length){ a[0]=last; this._down(0);} 
      return top;
    }
    _down(i){
      const a=this.a; const n=a.length;
      while(true){
        let l=i*2+1, r=l+1, m=i;
        if(l<n && this.cmp(a[l], a[m])) m=l;
        if(r<n && this.cmp(a[r], a[m])) m=r;
        if(m===i) break;
        [a[i],a[m]]=[a[m],a[i]]; i=m;
      }
    }
  }

  // Score function: 0.5*stars + 0.3*forks + 0.2*recencyBoost(0..1)
  function computeScore(repo){
    const stars = repo.stargazers_count || 0;
    const forks = repo.forks_count || 0;
    const pushed = new Date(repo.pushed_at);
    const days = Math.max(0, (Date.now() - pushed.getTime()) / (24*3600*1000));
    const decay = 14; // days
    // exp decay mapped roughly to [0,1]
    const recency = Math.exp(-days/decay);
    return 0.5*stars + 0.3*forks + 0.2*recency*100; // scale recency for influence
  }

  function keyFor(filters){
    return JSON.stringify(filters);
  }

  function setStatus(msg, level='info'){
    if(!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = level==='error' ? '#b91c1c' : '#111827';
  }

  function renderCards(items){
    if(!resultsEl) return;
    if(!items || items.length===0){
      resultsEl.innerHTML = '<div class="muted">No repos matched your filters.</div>';
      return;
    }
    resultsEl.innerHTML = items.map(r => `
      <div class="repo-item">
        <div class="repo-name"><a href="${r.html_url}" target="_blank" rel="noopener">${escapeHtml(r.full_name)}</a></div>
        ${r.description ? `<div class="repo-desc">${escapeHtml(r.description)}</div>` : ''}
        <div class="repo-meta">
          <span>★ ${r.stargazers_count||0}</span>
          <span>⑂ ${r.forks_count||0}</span>
          ${r.language ? `<span>${escapeHtml(r.language)}</span>` : ''}
          <span>Pushed ${timeAgo(r.pushed_at)}</span>
        </div>
      </div>
    `).join('');
  }

  function escapeHtml(str){
    if(str==null) return '';
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s]));
  }

  function timeAgo(dateStr){
    const d = new Date(dateStr);
    const s = Math.floor((Date.now()-d.getTime())/1000);
    const units = [
      ['year', 365*24*3600],
      ['month', 30*24*3600],
      ['day', 24*3600],
      ['hour', 3600],
      ['minute', 60]
    ];
    for(const [name,secs] of units){
      const v = Math.floor(s/secs);
      if(v>=1) return `${v} ${name}${v>1?'s':''} ago`;
    }
    return 'just now';
  }

  async function ghJson(url){
    const res = await fetch(url, { headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'XAYTHEON-Community-Highlights'
    }});
    
    // Check for rate limiting
    if (res.status === 403 || res.status === 429) {
      const resetTime = res.headers.get('X-RateLimit-Reset');
      const remaining = res.headers.get('X-RateLimit-Remaining');
      
      if (remaining === '0' || res.status === 429) {
        const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : null;
        const waitTime = resetDate ? Math.ceil((resetDate - Date.now()) / 60000) : 'unknown';
        throw new Error(`⚠️ GitHub API rate limit exceeded. Please try again in ${waitTime} minutes.`);
      }
    }
    
    if(!res.ok){
      const text = await res.text();
      throw new Error(`GitHub API ${res.status}: ${text}`);
    }
    return res.json();
  }

  async function fetchRepos(filters){
    // Build search query: use pushed:>=date for activity; include language/topic if present.
    const { language, topic, days } = filters;
    const since = new Date(Date.now() - days*24*3600*1000).toISOString().slice(0,10);
    const parts = [`pushed:>=${since}`];
    if(language) parts.push(`language:${language}`);
    if(topic) parts.push(`topic:${topic}`);
    const q = encodeURIComponent(parts.join(' '));

    // Sort by stars as baseline; fetch first 100 results.
    const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=100`;
    const data = await ghJson(url);
    return Array.isArray(data.items) ? data.items : [];
  }

  function topK(items, k){
    if(!Array.isArray(items) || items.length===0) return [];
    const heap = new BinaryHeap((a,b)=>a.score<b.score); // min-heap on score
    for(const repo of items){
      const score = computeScore(repo);
      const item = { score, repo };
      if(heap.size()<k){
        heap.push(item);
      } else if(score > heap.peek().score){
        heap.pop();
        heap.push(item);
      }
    }
    // Extract to array high->low
    const out=[]; while(heap.size()) out.push(heap.pop());
    out.sort((a,b)=>b.score-a.score);
    return out.map(x=>({ ...x.repo, _score:x.score }));
  }

  function saveCache(key, value){
    const entry = { at: Date.now(), items: value, expiresAt: Date.now() + TTL_MS };
    memoryCache.set(key, entry);
    try{ localStorage.setItem('xaytheon:community:'+key, JSON.stringify(entry)); }catch{}
    updateCacheInfo(key, entry);
  }
  function loadCache(key){
    const mem = memoryCache.get(key);
    if(mem && Date.now() < mem.expiresAt) {
      updateCacheInfo(key, mem);
      return mem.items;
    }
    try{
      const raw = localStorage.getItem('xaytheon:community:'+key);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      if(parsed && Date.now() < parsed.expiresAt) {
        // Move to memory cache for faster access
        memoryCache.set(key, parsed);
        updateCacheInfo(key, parsed);
        return parsed.items;
      } else {
        // Remove expired entry
        localStorage.removeItem('xaytheon:community:'+key);
      }
    }catch{}
    return null;
  }
  
  function updateCacheInfo(key, entry) {
    if (!cacheInfoEl) return;
    if (entry) {
      const age = Date.now() - entry.at;
      const minutesOld = Math.floor(age / 60000);
      const timeLeft = Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 60000));
      cacheInfoEl.innerHTML = `Cached ${minutesOld} min ago, expires in ${timeLeft} min <button id="clear-community-cache" class="btn btn-sm" style="margin-left: 10px;">Clear Cache</button>`;
      
      // Add event listener for clear cache button
      setTimeout(() => {
        const clearBtn = document.getElementById('clear-community-cache');
        if (clearBtn) {
          clearBtn.onclick = () => {
            clearCache();
            cacheInfoEl.innerHTML = 'Cache cleared';
          };
        }
      }, 100);
    }
  }
  
  function clearCache() {
    memoryCache.clear();
    try {
      // Remove all community cache entries
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('xaytheon:community:')) {
          localStorage.removeItem(key);
        }
      }
    } catch {}
  }

  // Debounced update function
  const debouncedUpdate = debounce(async function update(){
    const filters = {
      language,
      topic,
      days,
      k: Math.max(1, Math.min(20, k))
    };
    const cacheKey = keyFor(filters);
    
    // Disable form during loading
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Loading...';
    }
    
    // Disable all form inputs
    const inputs = form.querySelectorAll('input, select, button');
    inputs.forEach(input => {
      if (input !== submitBtn) input.disabled = true;
    });
    
    setStatus('Loading trending repositories…');
    resultsEl.innerHTML = '<div class="muted">Loading…</div>';
    
    try {
      // Rate limiting check
      if (!API_TRACKER.canCall()) {
        setStatus('Please wait a moment before making another request.', 'error');
        return;
      }
      
      API_TRACKER.recordCall();
      
      const cached = loadCache(cacheKey);
      let items;
      if(cached){
        items = cached;
        setStatus('Loaded from cache (fetching fresh data in background)...');
        
        // Fetch fresh data in background
        setTimeout(async () => {
          try {
            const repos = await fetchRepos(filters);
            const top = topK(repos, filters.k);
            saveCache(cacheKey, top);
            
            // Only update UI if still relevant
            const currentFilters = {
              language: (langEl.value||'').trim(),
              topic: (topicEl.value||'').trim(),
              days: parseInt(windowEl.value||'30',10) || 30,
              k: Math.max(1, Math.min(20, parseInt(kEl.value||'10',10)))
            };
            const currentCacheKey = keyFor(currentFilters);
            if (currentCacheKey === cacheKey) {
              renderCards(top);
              setStatus('Updated with fresh data');
            }
          } catch(e) {
            console.warn('Background refresh failed:', e);
          }
        }, 100);
      } else {
        const repos = await fetchRepos(filters);
        const top = topK(repos, filters.k);
        items = top;
        saveCache(cacheKey, items);
      }
      
      renderCards(items);
      setStatus('Done');
    } catch(e) {
      console.error(e);
      setStatus(e.message || 'Failed to fetch trending repos', 'error');
      resultsEl.innerHTML = `<div class="muted">Couldn't load trending repositories right now.</div>
                            <button id="retry-btn" class="btn btn-sm" style="margin-top: 10px;">Retry</button>`;
      
      // Add retry button handler
      setTimeout(() => {
        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) {
          retryBtn.onclick = () => {
            update();
          };
        }
      }, 100);
    } finally {
      // Re-enable form
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update';
      }
      inputs.forEach(input => {
        if (input !== submitBtn) input.disabled = false;
      });
    }
  }, 300); // 300ms debounce

  // Events
  form.addEventListener('submit', (e)=>{ e.preventDefault(); debouncedUpdate(); });
  resetBtn.addEventListener('click', ()=>{
    langEl.value = '';
    topicEl.value = '';
    windowEl.value = '30';
    kEl.value = '10';
    debouncedUpdate();
  });

  // Initial load with defaults
  debouncedUpdate();
})();

const scrollTopBtn = document.getElementById("scrollTopBtn");

window.addEventListener("scroll", () => {
  if (window.scrollY > 300) {
    scrollTopBtn.style.display = "flex";
  } else {
    scrollTopBtn.style.display = "none";
  }
});

scrollTopBtn.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});
