// ===== Theme =====
function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

(function() {
    const saved = localStorage.getItem('theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', saved);
})();

// ===== Date =====
function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

(function() {
    const el = document.getElementById('header-date');
    if (el) {
        const d = new Date();
        el.textContent = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
})();

// ===== Category =====
function formatCategory(cat) {
    return cat.replace(/-/g, ' ');
}

// ===== Helpers =====
function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

// ===== Posts =====
let allPosts = [];
let currentFilter = 'all';

function filterPosts(category) {
    currentFilter = category;
    document.querySelectorAll('.nav-filter').forEach(l =>
        l.classList.toggle('active', l.dataset.filter === category));
    renderPosts();
}

function renderPosts() {
    const leadEl = document.getElementById('lead-post');
    const gridEl = document.getElementById('posts-grid');
    const noEl = document.getElementById('no-posts');
    const ruleEl = document.querySelector('.section-rule');
    if (!leadEl || !gridEl) return;

    const filtered = currentFilter === 'all'
        ? allPosts
        : allPosts.filter(p => p.category === currentFilter);

    if (filtered.length === 0) {
        leadEl.innerHTML = '';
        gridEl.innerHTML = '';
        if (ruleEl) ruleEl.style.display = 'none';
        if (noEl) noEl.style.display = 'block';
        return;
    }

    if (noEl) noEl.style.display = 'none';
    if (ruleEl) ruleEl.style.display = 'block';

    const lead = filtered[0];
    leadEl.innerHTML = `
        <a href="post.html?slug=${encodeURIComponent(lead.slug)}">
            <span class="lead-category">${escapeHtml(formatCategory(lead.category))}</span>
            <h2 class="lead-title">${escapeHtml(lead.title)}</h2>
            <p class="lead-summary">${escapeHtml(lead.summary)}</p>
            <span class="lead-date">${formatDate(lead.date)}</span>
        </a>`;

    const rest = filtered.slice(1);
    if (rest.length === 0) {
        gridEl.innerHTML = '';
        if (ruleEl) ruleEl.style.display = 'none';
        return;
    }

    gridEl.innerHTML = rest.map(p => `
        <a href="post.html?slug=${encodeURIComponent(p.slug)}" class="post-card">
            <span class="card-category">${escapeHtml(formatCategory(p.category))}</span>
            <h3>${escapeHtml(p.title)}</h3>
            <p class="card-summary">${escapeHtml(p.summary)}</p>
            <span class="card-date">${formatDate(p.date)}</span>
        </a>`).join('');
}

// ===== Load =====
(function() {
    const gridEl = document.getElementById('posts-grid');
    const loadingEl = document.getElementById('loading');
    if (!gridEl) return;

    fetch('/api/posts')
        .then(r => r.json())
        .then(posts => {
            posts.sort((a, b) => new Date(b.date) - new Date(a.date));
            allPosts = posts;
            if (loadingEl) loadingEl.style.display = 'none';
            renderPosts();
        })
        .catch(() => {
            if (loadingEl) loadingEl.textContent = 'Could not load posts.';
        });
})();
