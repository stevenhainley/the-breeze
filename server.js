const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
//  CHANGE THESE before putting your site online
// =============================================
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'coolbrsze';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

// =============================================
//  Supabase — set these as environment variables
// =============================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY environment variables.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// ---- Helpers ----
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
app.get('/api/posts', async (req, res) => {
    try {
        const isAdmin = req.session && req.session.authenticated;

        let query = supabase
            .from('posts')
            .select('id, title, slug, date, category, summary, published')
            .order('date', { ascending: false });

        if (!isAdmin) {
            query = query.eq('published', true);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('GET /api/posts error:', err.message);
        res.status(500).json({ error: 'Failed to load posts' });
    }
});

app.get('/api/posts/:slug', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .eq('slug', req.params.slug)
            .single();

        if (error || !data) return res.status(404).json({ error: 'Not found' });

        const isAdmin = req.session && req.session.authenticated;
        if (!data.published && !isAdmin) return res.status(404).json({ error: 'Not found' });

        res.json(data);
    } catch (err) {
        console.error('GET /api/posts/:slug error:', err.message);
        res.status(500).json({ error: 'Failed to load post' });
    }
});

app.post('/api/posts', requireAuth, async (req, res) => {
    try {
        const { title, category, summary, content, published } = req.body;
        if (!title || !content) return res.status(400).json({ error: 'Title and content required' });

        // Generate unique slug
        let slug = slugify(title);
        const { data: existing } = await supabase
            .from('posts')
            .select('slug')
            .like('slug', slug + '%');

        if (existing && existing.length > 0) {
            const taken = new Set(existing.map(p => p.slug));
            if (taken.has(slug)) {
                let counter = 1;
                while (taken.has(slug + '-' + counter)) counter++;
                slug = slug + '-' + counter;
            }
        }

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

        const { data, error } = await supabase
            .from('posts')
            .insert(post)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('POST /api/posts error:', err.message);
        res.status(500).json({ error: 'Failed to create post' });
    }
});

app.put('/api/posts/:slug', requireAuth, async (req, res) => {
    try {
        const { title, category, summary, content, published } = req.body;
        const updates = {};
        if (title !== undefined) updates.title = title;
        if (category !== undefined) updates.category = category;
        if (summary !== undefined) updates.summary = summary;
        if (content !== undefined) updates.content = content;
        if (published !== undefined) updates.published = published;

        const { data, error } = await supabase
            .from('posts')
            .update(updates)
            .eq('slug', req.params.slug)
            .select()
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Not found' });
        res.json(data);
    } catch (err) {
        console.error('PUT /api/posts/:slug error:', err.message);
        res.status(500).json({ error: 'Failed to update post' });
    }
});

app.delete('/api/posts/:slug', requireAuth, async (req, res) => {
    try {
        const { error } = await supabase
            .from('posts')
            .delete()
            .eq('slug', req.params.slug);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/posts/:slug error:', err.message);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

app.listen(PORT, () => {
    console.log('The Breeze is running at http://localhost:' + PORT);
});
