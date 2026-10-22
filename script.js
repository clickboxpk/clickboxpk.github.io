(() => {
  'use strict';

  /* ===== Settings – sirf yahan se change karein ===== */
  const CONFIG = {
    user: 'clickboxpk',
    hide: ['clickboxpk.github.io'], // in repos ko list me nahi dikhana
    showForks: false,               // true karein to forked repos bhi dikhengi
    cacheMinutes: 10                // itni der API dobara call nahi hogi (fast loading)
  };

  const $ = (id) => document.getElementById(id);
  const listEl = $('list'), statusEl = $('status'), countEl = $('count'), qEl = $('q');
  const CACHE_KEY = 'repos:' + CONFIG.user;
  let repos = [];

  /* ---------- Theme ---------- */
  $('theme').addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  $('year').textContent = new Date().getFullYear();

  /* ---------- Helpers ---------- */
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  function ago(iso) {
    const days = Math.round((new Date(iso) - Date.now()) / 864e5);
    if (Math.abs(days) < 1) return 'today';
    if (Math.abs(days) < 30) return rtf.format(days, 'day');
    if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), 'month');
    return rtf.format(Math.round(days / 365), 'year');
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function link(cls, text, href) {
    const a = el('a', cls, text);
    a.href = href;
    a.rel = 'noopener';
    return a;
  }

  /* ---------- Render ---------- */
  function render(items) {
    listEl.replaceChildren();
    countEl.textContent = items.length ? items.length : '';

    if (!items.length) {
      showStatus(qEl.value ? 'No project matches your search.' : 'No public projects yet.');
      return;
    }
    statusEl.hidden = true;

    const frag = document.createDocumentFragment();
    for (const r of items) {
      const li = el('li', 'item');
      const row = el('div', 'row');

      row.append(el('div', 'name', r.name));
      row.append(el('p', 'desc', r.description || 'No description yet.'));

      const meta = el('div', 'meta');
      if (r.language) meta.append(el('span', '', r.language));
      if (r.stargazers_count) meta.append(el('span', '', '★ ' + r.stargazers_count));
      meta.append(el('span', '', 'Updated ' + ago(r.pushed_at || r.updated_at)));
      row.append(meta);

      const actions = el('div', 'actions');
      const live = r.homepage || (r.has_pages ? `https://${CONFIG.user}.github.io/${r.name}/` : '');
      if (live) actions.append(link('btn primary', 'Live', live));
      actions.append(link('btn', 'Code', r.html_url));
      row.append(actions);

      li.append(row);
      frag.append(li);
    }
    listEl.append(frag);
  }

  function showStatus(msg, linkText, href) {
    statusEl.hidden = false;
    statusEl.textContent = msg + ' ';
    if (href) statusEl.append(link('', linkText, href));
  }

  function applyFilter() {
    const q = qEl.value.trim().toLowerCase();
    render(!q ? repos : repos.filter((r) =>
      (r.name + ' ' + (r.description || '') + ' ' + (r.language || '')).toLowerCase().includes(q)));
  }

  /* ---------- Data (cached for speed) ---------- */
  function readCache() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY));
      return c && Array.isArray(c.data) ? c : null;
    } catch (e) { return null; }
  }

  function clean(data) {
    return data
      .filter((r) => !CONFIG.hide.includes(r.name) && (CONFIG.showForks || !r.fork))
      .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
  }

  /* Structured data (ItemList) so Google understands the project list */
  function addSchema() {
    const old = document.getElementById('projects-schema');
    if (old) old.remove();
    if (!repos.length) return;
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = 'projects-schema';
    s.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'ClickBox PK projects',
      itemListElement: repos.map((r, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: r.name,
        url: r.homepage || (r.has_pages ? `https://${CONFIG.user}.github.io/${r.name}/` : r.html_url)
      }))
    });
    document.head.append(s);
  }

  function setRepos(data) {
    repos = clean(data);
    applyFilter();
    addSchema();
  }

  async function load() {
    const cached = readCache();
    if (cached) {
      setRepos(cached.data);
      if (Date.now() - cached.time < CONFIG.cacheMinutes * 60000) return;
    }

    try {
      const res = await fetch(`https://api.github.com/users/${CONFIG.user}/repos?per_page=100&type=owner`, {
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data })); } catch (e) {}
      setRepos(data);
    } catch (err) {
      if (!cached) {
        listEl.replaceChildren();
        showStatus('Could not load projects right now.', 'View them on GitHub', `https://github.com/${CONFIG.user}?tab=repositories`);
      }
    }
  }

  qEl.addEventListener('input', applyFilter);
  load();
})();
