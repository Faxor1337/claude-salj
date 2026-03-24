const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(session({
    store: new PgSession({ pool, tableName: 'sessions', createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || 'virea-salj-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, secure: false }
}));
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function requireAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Ej inloggad' });
    next();
}
function requireAdmin(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Ej inloggad' });
    if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Ej admin' });
    next();
}

// ===== INIT DB =====
async function initDb() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT DEFAULT 'user'
        );
        CREATE TABLE IF NOT EXISTS customers (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            city TEXT,
            address TEXT,
            status TEXT DEFAULT 'Prospekt',
            comment TEXT DEFAULT '',
            revenue BIGINT DEFAULT 0,
            contacted_by TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            email TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS clients (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            city TEXT,
            address TEXT,
            contact_person TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            email TEXT DEFAULT '',
            revenue BIGINT DEFAULT 0,
            start_date TEXT DEFAULT '',
            comment TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS contracts (
            client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
            invoice_info JSONB DEFAULT '{}',
            products JSONB DEFAULT '[]',
            global_margin INTEGER DEFAULT 30
        );
        CREATE TABLE IF NOT EXISTS invoices (
            id SERIAL PRIMARY KEY,
            nr INTEGER NOT NULL,
            client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
            client_name TEXT,
            type TEXT DEFAULT 'direct',
            date TIMESTAMPTZ DEFAULT NOW(),
            delivery_date TEXT DEFAULT '',
            followup_date TEXT DEFAULT '',
            due_date TEXT DEFAULT '',
            items JSONB DEFAULT '[]',
            total BIGINT DEFAULT 0,
            vat BIGINT DEFAULT 0,
            total_inc BIGINT DEFAULT 0,
            invoice_info JSONB DEFAULT '{}',
            status TEXT DEFAULT 'unpaid',
            created_by TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            rek_price INTEGER NOT NULL DEFAULT 0,
            sort_order INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS provpaket (
            id SERIAL PRIMARY KEY,
            client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            type TEXT DEFAULT 'in',
            invoice_id INTEGER,
            created_by TEXT DEFAULT '',
            date TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS notes (
            id SERIAL PRIMARY KEY,
            entity_type TEXT NOT NULL,
            entity_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            author TEXT NOT NULL,
            date TIMESTAMPTZ DEFAULT NOW()
        );
    `);
    // Cleanup orphaned provpaket deductions from deleted invoices
    await pool.query(`DELETE FROM provpaket WHERE type='out' AND invoice_id IS NOT NULL AND invoice_id NOT IN (SELECT id FROM invoices)`);

    // Seed admin user if no users
    const { rows } = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(rows[0].count) === 0) {
        const hash = await bcrypt.hash('admin123', 10);
        await pool.query("INSERT INTO users (username, password, name, role) VALUES ('admin', $1, 'Administratör', 'admin')", [hash]);
        const h2 = await bcrypt.hash('anna123', 10);
        await pool.query("INSERT INTO users (username, password, name, role) VALUES ('anna', $1, 'Anna Svensson', 'user')", [h2]);
        const h3 = await bcrypt.hash('erik123', 10);
        await pool.query("INSERT INTO users (username, password, name, role) VALUES ('erik', $1, 'Erik Johansson', 'user')", [h3]);
        const h4 = await bcrypt.hash('johan123', 10);
        await pool.query("INSERT INTO users (username, password, name, role) VALUES ('johan', $1, 'Johan Lindberg', 'user')", [h4]);
        console.log('Seeded default users');
    }
}

// ===== AUTH ROUTES =====
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (rows.length === 0) return res.status(401).json({ error: 'Fel' });
    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Fel' });
    const user = { id: rows[0].id, username: rows[0].username, name: rows[0].name, role: rows[0].role };
    req.session.user = user;
    res.json(user);
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Ej inloggad' });
    res.json(req.session.user);
});

// ===== USERS (admin) =====
app.get('/api/users', requireAdmin, async (req, res) => {
    const { rows } = await pool.query('SELECT id, username, name, role FROM users ORDER BY id');
    res.json(rows);
});

app.post('/api/users', requireAdmin, async (req, res) => {
    const { username, password, name, role } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query('INSERT INTO users (username, password, name, role) VALUES ($1,$2,$3,$4) RETURNING id, username, name, role', [username, hash, name, role || 'user']);
    res.json(rows[0]);
});

app.put('/api/users/:id', requireAdmin, async (req, res) => {
    const { name, username, role, password } = req.body;
    if (password) {
        const hash = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET name=$1, username=$2, role=$3, password=$4 WHERE id=$5', [name, username, role, hash, req.params.id]);
    } else {
        await pool.query('UPDATE users SET name=$1, username=$2, role=$3 WHERE id=$4', [name, username, role, req.params.id]);
    }
    res.json({ ok: true });
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
    if (parseInt(req.params.id) === req.session.user.id) return res.status(400).json({ error: 'Kan inte ta bort dig själv' });
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
});

// ===== CUSTOMERS (prospects) =====
app.get('/api/customers', requireAuth, async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM customers ORDER BY name');
    res.json(rows);
});

app.post('/api/customers', requireAuth, async (req, res) => {
    const { name, city, address, status, comment, revenue, contacted_by, phone, email } = req.body;
    const { rows } = await pool.query(
        'INSERT INTO customers (name,city,address,status,comment,revenue,contacted_by,phone,email) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
        [name, city, address, status || 'Prospekt', comment || '', revenue || 0, contacted_by || '', phone || '', email || '']
    );
    res.json(rows[0]);
});

app.put('/api/customers/:id', requireAuth, async (req, res) => {
    const { name, city, address, status, comment, revenue, contacted_by, phone, email } = req.body;
    await pool.query(
        'UPDATE customers SET name=$1,city=$2,address=$3,status=$4,comment=$5,revenue=$6,contacted_by=$7,phone=$8,email=$9 WHERE id=$10',
        [name, city, address, status, comment, revenue, contacted_by, phone, email, req.params.id]
    );
    res.json({ ok: true });
});

app.delete('/api/customers/:id', requireAuth, async (req, res) => {
    await pool.query('DELETE FROM customers WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
});

// ===== CLIENTS =====
app.get('/api/clients', requireAuth, async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM clients ORDER BY name');
    res.json(rows);
});

app.post('/api/clients', requireAuth, async (req, res) => {
    const { name, city, address, contact_person, phone, email, revenue, start_date, comment } = req.body;
    const { rows } = await pool.query(
        'INSERT INTO clients (name,city,address,contact_person,phone,email,revenue,start_date,comment) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
        [name, city, address, contact_person || '', phone || '', email || '', revenue || 0, start_date || '', comment || '']
    );
    res.json(rows[0]);
});

app.put('/api/clients/:id', requireAuth, async (req, res) => {
    const { name, city, address, contact_person, phone, email, revenue, start_date, comment } = req.body;
    await pool.query(
        'UPDATE clients SET name=$1,city=$2,address=$3,contact_person=$4,phone=$5,email=$6,revenue=$7,start_date=$8,comment=$9 WHERE id=$10',
        [name, city, address, contact_person, phone, email, revenue, start_date, comment, req.params.id]
    );
    res.json({ ok: true });
});

app.delete('/api/clients/:id', requireAuth, async (req, res) => {
    await pool.query('DELETE FROM clients WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
});

// ===== CONTRACTS =====
app.get('/api/contracts/:clientId', requireAuth, async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM contracts WHERE client_id=$1', [req.params.clientId]);
    res.json(rows[0] || { client_id: parseInt(req.params.clientId), invoice_info: {}, products: [], global_margin: 30 });
});

app.put('/api/contracts/:clientId', requireAuth, async (req, res) => {
    const { invoice_info, products, global_margin } = req.body;
    await pool.query(`
        INSERT INTO contracts (client_id, invoice_info, products, global_margin)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (client_id) DO UPDATE SET invoice_info=$2, products=$3, global_margin=$4
    `, [req.params.clientId, JSON.stringify(invoice_info), JSON.stringify(products), global_margin]);
    res.json({ ok: true });
});

// ===== INVOICES =====
app.get('/api/invoices', requireAuth, async (req, res) => {
    const clientId = req.query.client_id;
    if (clientId) {
        const { rows } = await pool.query('SELECT * FROM invoices WHERE client_id=$1 ORDER BY nr DESC', [clientId]);
        res.json(rows);
    } else {
        const { rows } = await pool.query('SELECT * FROM invoices ORDER BY nr DESC');
        res.json(rows);
    }
});

app.post('/api/invoices', requireAuth, async (req, res) => {
    const { nr, client_id, client_name, type, delivery_date, followup_date, due_date, items, total, vat, total_inc, invoice_info, status, created_by } = req.body;
    const { rows } = await pool.query(
        `INSERT INTO invoices (nr,client_id,client_name,type,delivery_date,followup_date,due_date,items,total,vat,total_inc,invoice_info,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [nr, client_id, client_name, type, delivery_date || '', followup_date || '', due_date, JSON.stringify(items), total, vat, total_inc, JSON.stringify(invoice_info), status || 'unpaid', created_by]
    );
    const invoice = rows[0];
    // Auto-deduct from provpaket when invoicing sold samples
    if (type === 'pending' && items && items.length > 0) {
        for (const item of items) {
            await pool.query(
                'INSERT INTO provpaket (client_id, product_name, quantity, type, invoice_id, created_by) VALUES ($1,$2,$3,$4,$5,$6)',
                [client_id, item.name, item.qty, 'out', invoice.id, created_by]
            );
        }
    }
    res.json(invoice);
});

app.put('/api/invoices/:id', requireAuth, async (req, res) => {
    const { status } = req.body;
    await pool.query('UPDATE invoices SET status=$1 WHERE id=$2', [status, req.params.id]);
    res.json({ ok: true });
});

app.delete('/api/invoices/:id', requireAdmin, async (req, res) => {
    await pool.query('DELETE FROM provpaket WHERE invoice_id=$1', [req.params.id]);
    await pool.query('DELETE FROM invoices WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
});

app.get('/api/invoices/next-nr', requireAuth, async (req, res) => {
    const { rows } = await pool.query('SELECT COALESCE(MAX(nr), 1000) + 1 AS next FROM invoices');
    res.json({ nr: rows[0].next });
});

// ===== NOTES =====
app.get('/api/notes/:type/:entityId', requireAuth, async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM notes WHERE entity_type=$1 AND entity_id=$2 ORDER BY date DESC', [req.params.type, req.params.entityId]);
    res.json(rows);
});

app.post('/api/notes', requireAuth, async (req, res) => {
    const { entity_type, entity_id, text } = req.body;
    const { rows } = await pool.query(
        'INSERT INTO notes (entity_type, entity_id, text, author) VALUES ($1,$2,$3,$4) RETURNING *',
        [entity_type, entity_id, text, req.session.user.name]
    );
    res.json(rows[0]);
});

// ===== PRODUCTS (global catalog) =====
app.get('/api/products', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM products ORDER BY sort_order, id');
        res.json(rows);
    } catch (err) {
        console.error('GET /api/products error:', err.message);
        res.json([]);
    }
});

app.post('/api/products', requireAdmin, async (req, res) => {
    const { name, rek_price } = req.body;
    const { rows } = await pool.query(
        'INSERT INTO products (name, rek_price) VALUES ($1, $2) RETURNING *',
        [name, rek_price || 0]
    );
    res.json(rows[0]);
});

app.put('/api/products/:id', requireAdmin, async (req, res) => {
    const { name, rek_price } = req.body;
    await pool.query('UPDATE products SET name=$1, rek_price=$2 WHERE id=$3', [name, rek_price, req.params.id]);
    res.json({ ok: true });
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
    await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
});

// ===== PROVPAKET =====
app.get('/api/provpaket/:clientId', requireAuth, async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM provpaket WHERE client_id=$1 ORDER BY date DESC',
        [req.params.clientId]
    );
    res.json(rows);
});

app.get('/api/provpaket/:clientId/balance', requireAuth, async (req, res) => {
    const { rows } = await pool.query(`
        SELECT product_name,
            SUM(CASE WHEN type='in' THEN quantity ELSE 0 END) as sent,
            SUM(CASE WHEN type='out' THEN quantity ELSE 0 END) as invoiced,
            SUM(CASE WHEN type='in' THEN quantity ELSE -quantity END) as balance
        FROM provpaket WHERE client_id=$1
        GROUP BY product_name
    `, [req.params.clientId]);
    res.json(rows);
});

app.post('/api/provpaket', requireAuth, async (req, res) => {
    const { client_id, product_name, quantity } = req.body;
    const { rows } = await pool.query(
        'INSERT INTO provpaket (client_id, product_name, quantity, type, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [client_id, product_name, quantity, 'in', req.session.user.name]
    );
    res.json(rows[0]);
});

app.delete('/api/provpaket/:id', requireAdmin, async (req, res) => {
    await pool.query('DELETE FROM provpaket WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
});

// ===== SEED CUSTOMERS =====
app.post('/api/seed-customers', requireAdmin, async (req, res) => {
    const { customers } = req.body;
    if (!customers || !customers.length) return res.status(400).json({ error: 'No data' });
    const { rows } = await pool.query('SELECT COUNT(*) FROM customers');
    if (parseInt(rows[0].count) > 0) return res.json({ message: 'Already seeded', count: rows[0].count });
    for (const c of customers) {
        await pool.query(
            'INSERT INTO customers (name,city,address,status,comment,revenue,contacted_by,phone,email) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            [c.name, c.city, c.address || '', c.status || 'Prospekt', c.comment || '', c.revenue || 0, c.contactedBy || '', c.phone || '', c.email || '']
        );
    }
    res.json({ message: 'Seeded', count: customers.length });
});

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Start
initDb().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
    console.error('DB init failed:', err);
    process.exit(1);
});
