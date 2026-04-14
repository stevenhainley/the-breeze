const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
//  CHANGE THESE before putting your site online
// =============================================
const ADMIN_USERNAME = 'coolbrsze';
const ADMIN_PASSWORD = 'changeme';

const SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const DATA_FILE = path.join(__dirname, 'data', 'posts.json');

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// ---- Helpers ----
function readPosts() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function writePosts(posts) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2));
}

function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80);
}

function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) return next();
    res.status(401).json({ error: 'Not authenticated' });
}

// ---- Auth ----
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.authenticated = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/session', (req, res) => {
    res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

// ---- Posts API ----
app.get('/api/posts', (req, res) => {
    const posts = readPosts();
    const isAdmin = req.session && req.session.authenticated;
    const visible = isAdmin ? posts : posts.filter(p => p.published);
    res.json(visible.map(({ content, ...rest }) => rest));
});

app.get('/api/posts/:slug', (req, res) => {
    const posts = readPosts();
    const post = posts.find(p => p.slug === req.params.slug);
    if (!post) return res.status(404).json({ error: 'Not found' });
    const isAdmin = req.session && req.session.authenticated;
    if (!post.published && !isAdmin) return res.status(404).json({ error: 'Not found' });
    res.json(post);
});

app.post('/api/posts', requireAuth, (req, res) => {
    const posts = readPosts();
    const { title, category, summary, content, published } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content required' });

    let slug = slugify(title);
    let counter = 1;
    const base = slug;
    while (posts.some(p => p.slug === slug)) { slug = base + '-' + counter++; }

    const post = {
        id: Date.now().toString(),
        title,
        slug,
        date: new Date().toISOString().split('T')[0],
        category: category || 'uncategorized',
        summary: summary || '',
        content,
        published: published !== false
    };

    posts.unshift(post);
    writePosts(posts);
    res.json(post);
});

app.put('/api/posts/:slug', requireAuth, (req, res) => {
    const posts = readPosts();
    const idx = posts.findIndex(p => p.slug === req.params.slug);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const { title, category, summary, content, published } = req.body;
    if (title !== undefined) posts[idx].title = title;
    if (category !== undefined) posts[idx].category = category;
    if (summary !== undefined) posts[idx].summary = summary;
    if (content !== undefined) posts[idx].content = content;
    if (published !== undefined) posts[idx].published = published;

    writePosts(posts);
    res.json(posts[idx]);
});

app.delete('/api/posts/:slug', requireAuth, (req, res) => {
    const posts = readPosts();
    const idx = posts.findIndex(p => p.slug === req.params.slug);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    posts.splice(idx, 1);
    writePosts(posts);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log('The Breeze is running at http://localhost:' + PORT);
});
