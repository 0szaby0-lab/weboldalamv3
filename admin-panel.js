// ============================================================
// admin-panel.js – Különálló, Prémium Admin Dashboard
// ============================================================
const express      = require('express');
const cookieParser = require('cookie-parser');
const os           = require('os');
const path         = require('path');
const { BannedIP, VisitorLog, SecurityLog, SystemStat } = require('./db');

const router = express.Router();
router.use(cookieParser());
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const COOKIE_NAME    = 'szaby_admin_session';
const COOKIE_SECRET  = 'auth-success-2026';

// ── Hitelesítő Middleware ──────────────────────────────────
function requireAuth(req, res, next) {
    if (req.cookies[COOKIE_NAME] === COOKIE_SECRET) {
        return next();
    }
    // Ha böngészős lekérés (HTML), átirányítjuk a login oldalra
    if (req.accepts('html') && !req.xhr) {
        return res.redirect('/admin/login');
    }
    // Ha API lekérés, 401-et adunk
    res.status(401).json({ error: 'Nincs bejelentkezve!' });
}

// ── API: Bejelentkezés ─────────────────────────────────────
router.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.cookie(COOKIE_NAME, COOKIE_SECRET, { 
            httpOnly: true, 
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: 'strict'
        });
        return res.json({ ok: true });
    }
    res.status(401).json({ error: 'Hibás jelszó!' });
});

// ── Kijelentkezés ──────────────────────────────────────────
router.get('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.redirect('/admin/login');
});

// ── GET /admin/login – Gyönyörű Bejelentkező Oldal ─────────
router.get('/login', (req, res) => {
    if (req.cookies[COOKIE_NAME] === COOKIE_SECRET) {
        return res.redirect('/admin');
    }
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// ── GET /admin – A Fő Dashboard (Védett) ───────────────────
router.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// ── API: Rendszer és Adatbázis Statisztikák ────────────────
router.get('/api/stats', requireAuth, async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const totalMem = os.totalmem();
        const freeMem  = os.freemem();
        const usedMem  = totalMem - freeMem;
        const memPercent = ((usedMem / totalMem) * 100).toFixed(1);
        const uptimeSeconds = os.uptime();
        const uptimeDays = Math.floor(uptimeSeconds / 86400);
        const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
        
        if (mongoose.connection.readyState !== 1) {
            return res.json({ 
                total: '⏳', active24h: '⏳', permanent: '⏳', todayVisitors: '⏳', totalVisitors: '⏳', recentSecurity: '⏳',
                os: { memPercent, uptime: `${uptimeDays}n ${uptimeHours}ó` },
                chart: { labels: [], visitors: [], bans: [] }
            });
        }
        
        const [total, active24h, permanent, statDoc] = await Promise.all([
            BannedIP.countDocuments({ active: true }),
            BannedIP.countDocuments({ active: true, type: '24h' }),
            BannedIP.countDocuments({ active: true, type: 'permanent' }),
            SystemStat.findOne()
        ]);
        
        const todayVisitors = statDoc ? statDoc.todayVisitors : 0;
        const totalVisitors = statDoc ? statDoc.totalVisitors : 0;
        const recentSecurity = statDoc ? statDoc.totalSecurity : 0;

        const chartLabels = [];
        const visitorsData = [];
        const bansData = [];
        const today = new Date();
        today.setHours(0,0,0,0);

        for(let i=6; i>=0; i--) {
            const start = new Date(today); start.setDate(start.getDate() - i);
            const end = new Date(start); end.setDate(end.getDate() + 1);
            
            const dayStr = start.toLocaleDateString('hu-HU', { weekday: 'short' });
            chartLabels.push(dayStr);
            
            const [vc, bc] = await Promise.all([
                VisitorLog.countDocuments({ visitedAt: { $gte: start, $lt: end } }),
                BannedIP.countDocuments({ bannedAt: { $gte: start, $lt: end } })
            ]);
            visitorsData.push(vc);
            bansData.push(bc);
        }

        res.json({ 
            total, active24h, permanent, todayVisitors, totalVisitors, recentSecurity,
            os: { memPercent, uptime: `${uptimeDays}n ${uptimeHours}ó` },
            chart: { labels: chartLabels, visitors: visitorsData, bans: bansData }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/api/banned', requireAuth, async (req, res) => {
    try {
        const { type, search, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (type === '24h')        filter.type = '24h';
        if (type === 'permanent')  filter.type = 'permanent';
        if (type === 'inactive')   filter.active = false;
        else                       filter.active = true;
        if (search) filter.ip = { $regex: search, $options: 'i' };

        const [docs, totalCount] = await Promise.all([
            BannedIP.find(filter).sort({ bannedAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
            BannedIP.countDocuments(filter),
        ]);
        res.json({ docs, totalCount, page: Number(page), pages: Math.ceil(totalCount / limit) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/api/visitors', requireAuth, async (req, res) => {
    try {
        const { page = 1, limit = 30 } = req.query;
        const [docs, totalCount] = await Promise.all([
            VisitorLog.find().sort({ visitedAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
            VisitorLog.countDocuments(),
        ]);
        res.json({ docs, totalCount, page: Number(page) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/api/security', requireAuth, async (req, res) => {
    try {
        const { page = 1, limit = 30 } = req.query;
        const [docs, totalCount] = await Promise.all([
            SecurityLog.find().sort({ loggedAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
            SecurityLog.countDocuments(),
        ]);
        res.json({ docs, totalCount, page: Number(page) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/ban', requireAuth, async (req, res) => {
    try {
        const { ip, type = '24h', reason = 'Admin kézi ban' } = req.body;
        if (!ip) return res.status(400).json({ error: 'IP hiányzik!' });
        const expiresAt = type === '24h' ? new Date(Date.now() + 86400000) : null;
        await BannedIP.findOneAndUpdate(
            { ip },
            { ip, reason, type, bannedAt: new Date(), expiresAt, active: true, unbannedAt: null },
            { upsert: true, new: true }
        );
        if (req.app && req.app.locals && typeof req.app.locals.banMemory === 'function') {
            req.app.locals.banMemory(ip, type);
        }
        res.json({ ok: true, message: `${ip} tiltva (${type})` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/unban', requireAuth, async (req, res) => {
    try {
        const { ip } = req.body;
        if (!ip) return res.status(400).json({ error: 'IP hiányzik!' });
        await BannedIP.findOneAndUpdate({ ip }, { active: false, unbannedAt: new Date() });
        if (req.app && req.app.locals && typeof req.app.locals.unbanMemory === 'function') {
            req.app.locals.unbanMemory(ip);
        }
        res.json({ ok: true, message: `${ip} feloldva` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
