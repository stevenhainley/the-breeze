// ===== State =====
let editingSlug = null;

// ===== Views =====
function showView(id) {
    document.querySelectorAll('.admin-view').forEach(v => v.style.display = 'none');
    document.getElementById(id).style.display = 'block';
}

function showLogin() { showView('view-login'); }

function showDashboard() {
    editingSlug = null;
    showView('view-dashboard');
    loadPosts();
}

function showEditor(slug) {
    editingSlug = slug || null;
    showView('view-editor');

    document.getElementById('editor-title').value = '';
    document.getElementById('editor-category').value = 'world-news';
    document.getElementById('editor-summary').value = '';
    document.getElementById('editor-content').value = '';
    document.getElementById('editor-delete').style.display = editingSlug ? 'inline-block' : 'none';

    if (editingSlug) {
        fetch('/api/posts/' + encodeURIComponent(editingSlug))
            .then(r => r.json())
            .then(post => {
                document.getElementById('editor-title').value = post.title;
                document.getElementById('editor-category').value = post.category;
                document.getElementById('editor-summary').value = post.summary;
                document.getElementById('editor-content').value = post.content;
            });
    }

    document.getElementById('editor-title').focus();
}

// ===== Auth =====
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';

    const username = document.getElementById('login-user').value;
    const password = document.getElementById('login-pass').value;

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    if (res.ok) {
        showDashboard();
    } else {
        errEl.textContent = 'Invalid username or password.';
    }
});

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    showLogin();
}

// ===== Check session on load =====
(async function() {
    const res = await fetch('/api/session');
    const data = await res.json();
    if (data.authenticated) {
        showDashboard();
    } else {
        showLogin();
    }
})();

// ===== Posts =====
async function loadPosts() {
    const res = await fetch('/api/posts');
    const posts = await res.json();
    const list = document.getElementById('posts-list');

    if (posts.length === 0) {
        list.innerHTML = '<p class="admin-empty">No posts yet. Click "+ New Post" to write your first article.</p>';
        return;
    }

    list.innerHTML = posts.map(post => `
        <div class="admin-post-row">
            <div class="admin-post-info">
                <span class="admin-post-title">${escapeHtml(post.title)}</span>
                <div class="admin-post-meta">
                    <span class="admin-post-cat">${escapeHtml(formatCat(post.category))}</span>
                    <span class="admin-post-date">${post.date}</span>
                    <span class="admin-post-status ${post.published ? 'status-published' : 'status-draft'}">${post.published ? 'published' : 'draft'}</span>
                </div>
            </div>
            <div class="admin-post-actions">
                <button onclick="showEditor('${post.slug}')" class="admin-btn-sm">Edit</button>
            </div>
        </div>
    `).join('');
}

// ===== Save =====
async function savePost(publish) {
    const title = document.getElementById('editor-title').value.trim();
    const category = document.getElementById('editor-category').value;
    const summary = document.getElementById('editor-summary').value.trim();
    const content = document.getElementById('editor-content').value.trim();

    if (!title) return alert('Please add a title.');
    if (!content) return alert('Please write some content.');

    const body = { title, category, summary, content, published: publish };

    let res;
    if (editingSlug) {
        res = await fetch('/api/posts/' + encodeURIComponent(editingSlug), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    } else {
        res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    }

    if (res.ok) {
        showDashboard();
    } else {
        alert('Error saving post. Please try again.');
    }
}

// ===== Delete =====
async function deleteCurrentPost() {
    if (!editingSlug) return;
    if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) return;

    const res = await fetch('/api/posts/' + encodeURIComponent(editingSlug), { method: 'DELETE' });
    if (res.ok) {
        showDashboard();
    } else {
        alert('Error deleting post.');
    }
}

// ===== Markdown toolbar =====
function insertMd(before, after) {
    const ta = document.getElementById('editor-content');
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end) || 'text';
    ta.value = ta.value.substring(0, start) + before + selected + after + ta.value.substring(end);
    ta.focus();
    ta.selectionStart = start + before.length;
    ta.selectionEnd = start + before.length + selected.length;
}

// ===== Helpers =====
function formatCat(cat) {
    return cat.replace(/-/g, ' ');
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}
