// ============================================================
// db.js – MongoDB modellek és kapcsolat (Mongoose)
// ============================================================
const mongoose = require('mongoose');

// ── Kapcsolat ──────────────────────────────────────────────
async function connectDB() {
    if (mongoose.connection.readyState >= 1) return;
    try {
        // DNS javítás: sok otthoni router (pl. D-Link) blokkolja az SRV lekérdezéseket. 
        // Ezzel a Google DNS-re váltjuk át csak a Node.js-en belül, így azonnal csatlakozik!
        const dns = require('dns');
        dns.setServers(['8.8.8.8', '8.8.4.4']);

        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log('✅ MongoDB kapcsolat sikeres!');
    } catch (err) {
        console.error('❌ MongoDB kapcsolati hiba:', err.message);
    }
}

// ── BannedIP Schema ────────────────────────────────────────
const bannedIPSchema = new mongoose.Schema({
    ip: { type: String, required: true, index: true },
    reason: { type: String, default: 'Ismeretlen' },
    type: { type: String, enum: ['24h', 'permanent'], default: '24h' },
    bannedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },   // null = soha (permanent)
    active: { type: Boolean, default: true },
    unbannedAt: { type: Date, default: null },
    // Geo adatok
    country: { type: String, default: '' },
    city: { type: String, default: '' },
    isp: { type: String, default: '' },
    flag: { type: String, default: '' },
    // Request info
    userAgent: { type: String, default: '' },
    path: { type: String, default: '' },
}, { timestamps: true });

// ── VisitorLog Schema ──────────────────────────────────────
const visitorLogSchema = new mongoose.Schema({
    ip: { type: String, default: '' },
    page: { type: String, default: '/' },
    ua: { type: String, default: '' },
    lang: { type: String, default: '' },
    ref: { type: String, default: '' },
    country: { type: String, default: '' },
    city: { type: String, default: '' },
    isp: { type: String, default: '' },
    flag: { type: String, default: '' },
    isOwn: { type: Boolean, default: false },
    visitedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// ── SecurityLog Schema ─────────────────────────────────────
// Minden biztonsági esemény (DevTools, jobb klikk stb.)
const securityLogSchema = new mongoose.Schema({
    ip: { type: String, default: '' },
    reason: { type: String, default: '' },
    page: { type: String, default: '' },
    banned: { type: Boolean, default: false },
    country: { type: String, default: '' },
    city: { type: String, default: '' },
    loggedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const BannedIP = mongoose.model('BannedIP', bannedIPSchema);
const VisitorLog = mongoose.model('VisitorLog', visitorLogSchema);
const SecurityLog = mongoose.model('SecurityLog', securityLogSchema);

const systemStatSchema = new mongoose.Schema({
    totalVisitors: { type: Number, default: 0 },
    todayVisitors: { type: Number, default: 0 },
    lastDay: { type: String, default: '' },
    totalSecurity: { type: Number, default: 0 }
});
const SystemStat = mongoose.model('SystemStat', systemStatSchema);

async function incVisitorStat() {
    try {
        const today = new Date().toISOString().split('T')[0];
        let stat = await SystemStat.findOne();
        if (!stat) stat = await SystemStat.create({ lastDay: today, totalVisitors: 0, todayVisitors: 0 });
        if (stat.lastDay !== today) {
            stat.todayVisitors = 0;
            stat.lastDay = today;
            await stat.save();
        }
        await SystemStat.updateOne({ _id: stat._id }, { $inc: { totalVisitors: 1, todayVisitors: 1 } });
    } catch(e){}
}

async function incSecurityStat() {
    try {
        let stat = await SystemStat.findOne();
        if (!stat) stat = await SystemStat.create({ lastDay: new Date().toISOString().split('T')[0] });
        await SystemStat.updateOne({ _id: stat._id }, { $inc: { totalSecurity: 1 } });
    } catch(e){}
}

async function limitCollection(Model, max = 100) {
    try {
        const count = await Model.countDocuments();
        if (count > max) {
            const oldest = await Model.find().sort({ _id: 1 }).limit(count - max).select('_id');
            await Model.deleteMany({ _id: { $in: oldest.map(o => o._id) } });
        }
    } catch(e) {}
}

module.exports = { connectDB, BannedIP, VisitorLog, SecurityLog, SystemStat, incVisitorStat, incSecurityStat, limitCollection };
