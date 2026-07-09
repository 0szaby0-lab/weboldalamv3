require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// ==========================================
// MONGODB + ADMIN PANEL
// ==========================================
const { connectDB, BannedIP, VisitorLog, SecurityLog, SystemStat, incVisitorStat, incSecurityStat, limitCollection } = require('./db');
const adminRouter = require('./admin-panel');

// MongoDB kapcsolat indítása (aszinkron, nem blokkolja a szervert)
connectDB();

// ==========================================
// SOCKS PROXY TÁMOGATÁS
// Telepítés: npm install socks-proxy-agent
// ==========================================
const { SocksProxyAgent } = require('socks-proxy-agent');

const app = express();
app.set('trust proxy', true); // Ha proxy vagy CDN (pl. Cloudflare) mögött futsz

// ==========================================
// SZERVER SZINTŰ BIZTONSÁG (SECURITY HEADERS & LIMITS)
// ==========================================
app.disable('x-powered-by'); // Elrejtjük, hogy Express szerver fut

app.use((req, res, next) => {
    // Iframe Framekiller (X-Frame-Options)
    res.setHeader('X-Frame-Options', 'DENY');
    // Ne próbálja meg kitalálni a fájltípusokat
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Cross-Site Scripting (XSS) beépített böngésző védelem aktiválása
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer házirend (Ne küldjön át adatot, ha más oldalra kattintanak)
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
});

// Payload (POST adat) méretének szigorú korlátozása (DDoS védelem kiegészítése)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// RENDER.COM KEEP-ALIVE - Legfelülre tesszük, hogy a védelmek (middleware-ek) ne blokkolják
app.get('/api/ping', (req, res) => res.send('pong'));

// ==========================================
// KONFIGURÁCIÓ ÉS VÁLTOZÓK
// ==========================================
const PORT = process.env.PORT || 3000;

// Webhookok beolvasása
const MAIN_WEBHOOK = process.env.MAIN_WEBHOOK;
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK; // Belső logok (F12, Admin, Valós hibák)
const REPORT_WEBHOOK = process.env.REPORT_WEBHOOK; // Támadások logja (Spam, Manipulált kérések)

// Ha nincs külön PROXY_WEBHOOK, akkor az ALERT_WEBHOOK-ra küldi az infókat
const PROXY_WEBHOOK = process.env.PROXY_WEBHOOK || process.env.ALERT_WEBHOOK;

const PROXYCHECK_API_KEY = process.env.PROXYCHECK_API_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // Jelszó az /admin oldalhoz
const COUNTER_API_URL = process.env.COUNTER_API_URL; 

// --- EGYEDI ÜZENET A NORMÁL LOGOKHOZ ---
const EGYEDI_UZENET = ">>> **SZABY RENDSZER AKTÍV!** Új látogató a rendszeren. Minden védelem éles.";

// --- GLOBÁLIS VÁLTOZÓ A JELENLEGI "MŰKÖDŐ" PROXYNAK (Sticky Logic) ---
// Ez tárolja az aktuálisat, amit épp használunk, hogy ne ugráljon
let CURRENT_MASTER_PROXY = null; 
let proxyList = []; // Ez a teljes lista a memóriában


/* ==========================================================
   SEGÉDFÜGGVÉNY: PROXY ÁLLAPOT KÜLDÉSE DISCORDRA
   ========================================================== */
async function logProxyStatus(title, message, color) {
    if (!PROXY_WEBHOOK) return;
    
    try {
        await axios.post(PROXY_WEBHOOK, {
            username: "Proxy Monitor",
            embeds: [{
                title: title,
                description: message,
                color: color, 
                footer: { 
                    text: `Rendszeridő: ${new Date().toLocaleTimeString()}` 
                }
            }]
        });
    } catch (e) { 
        console.error("Webhook küldési hiba:", e.message); 
    }
}


/* ==========================================================
   PROXY KONFIGURÁLÓ FÜGGVÉNY (HTTP, HTTPS, SOCKS4/5, AUTH)
   ========================================================== */
function getProxyConfig(proxyStr) {
    if (!proxyStr) return null;
    
    let protocol = 'http';
    let cleanStr = proxyStr;

    // Ha van előtag (pl. socks5://), leválasztjuk
    if (proxyStr.includes('://')) {
        const split = proxyStr.split('://');
        protocol = split[0];
        cleanStr = split[1];
    }

    const parts = cleanStr.split(':');
    if (parts.length < 2) return null;

    const host = parts[0];
    const port = parseInt(parts[1]);
    const username = parts[2] || null;
    const password = parts[3] || null;

    // SOCKS PROXY KEZELÉS
    if (protocol.startsWith('socks')) {
        let socksUrl = `${protocol}://`;
        
        if (username && password) {
            socksUrl += `${username}:${password}@`;
        }
        
        socksUrl += `${host}:${port}`;
        
        const agent = new SocksProxyAgent(socksUrl);
        return { 
            httpAgent: agent, 
            httpsAgent: agent 
        };
    }

    // HTTP/HTTPS PROXY KEZELÉS (Sima Axios config)
    const axiosConfig = {
        proxy: { 
            protocol: 'http', 
            host: host, 
            port: port 
        }
    };

    if (username && password) {
        axiosConfig.proxy.auth = { 
            username: username, 
            password: password 
        };
    }

    return axiosConfig;
}


/* ==========================================================
   LISTA KEZELÉS & HÁTTÉRFOLYAMAT
   ========================================================== */
function loadProxiesFromFile() {
    try {
        if (fs.existsSync('proxies.txt')) {
            const content = fs.readFileSync('proxies.txt', 'utf8');
            return content.split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 0);
        }
    } catch (err) { 
        console.log("Hiba a fájl olvasásakor:", err.message); 
    }
    return [];
}

// Kezdő betöltés
proxyList = loadProxiesFromFile();


async function checkProxiesInBackground() {
    // Mindig frissítjük a listát a fájlból, hátha a felhasználó módosította közben
    const rawList = loadProxiesFromFile();
    
    // Ha a jelenlegi Master Proxyt törölték a fájlból, felejtsük el, hogy ne használjunk olyat ami már nincs
    if (CURRENT_MASTER_PROXY && !rawList.includes(CURRENT_MASTER_PROXY)) {
        console.log("⚠️ A jelenlegi Master Proxyt törölték a fájlból, leváltás...");
        CURRENT_MASTER_PROXY = null;
    }

    proxyList = rawList;

    if (rawList.length > 0) {
        // Itt nem logolunk minden percben, csak ha hiba van, vagy változás
        // console.log(`🔄 [Háttér] Proxy lista frissítve (${rawList.length} db). Jelenlegi Master: ${CURRENT_MASTER_PROXY || 'Nincs (Keresés alatt)'}`);
    } else {
        console.log("⚠️ FIGYELEM: A proxies.txt üres vagy nem található!");
    }
    
    // 5 percenként fut le újra a fájl beolvasása
    scheduleNextProxyCheck();
}

function scheduleNextProxyCheck() {
    setTimeout(checkProxiesInBackground, 5 * 60 * 1000); 
}

// Indítás után 5 másodperccel induljon a háttérfolyamat
setTimeout(checkProxiesInBackground, 5000);


/* ==========================================================
   RÉSZLETES GEO LOG LISTÁK (TELJES ADATOKKAL)
   ========================================================== */

function formatGeoDataTeljes(geo) {
  return (
    `**IP-cím:** ${geo.ip || 'Ismeretlen'}\n` +
    `**Sikeres lekérdezés:** ${geo.success || 'Ismeretlen'}\n` +
    `**Típus:** ${geo.type || 'Ismeretlen'}\n` +
    `**Kontinens:** ${geo.continent || 'Ismeretlen'}\n` +
    `**Kontinens kód:** ${geo.continent_code || 'Ismeretlen'}\n` +
    `**Ország:** ${geo.country || 'Ismeretlen'}\n` +
    `**Országkód:** ${geo.country_code || 'Ismeretlen'}\n` +
    `**Ország zászló:** ${geo.country_flag || 'Ismeretlen'}\n` +
    `**Főváros:** ${geo.country_capital || 'Ismeretlen'}\n` +
    `**Ország hívószám:** ${geo.country_phone || 'Ismeretlen'}\n` +
    `**Szomszédos országok:** ${geo.country_neighbours || 'Ismeretlen'}\n` +
    `**Régió:** ${geo.region || 'Ismeretlen'}\n` +
    `**Város:** ${geo.city || 'Ismeretlen'}\n` +
    `**Szélesség:** ${geo.latitude || 'Ismeretlen'}\n` +
    `**Hosszúság:** ${geo.longitude || 'Ismeretlen'}\n` +
    `**ASN:** ${geo.asn || 'Ismeretlen'}\n` +
    `**Szervezet:** ${geo.org || 'Ismeretlen'}\n` +
    `**Hálózat:** ${geo.isp || 'Ismeretlen'}\n` +
    `**Időzóna:** ${geo.timezone || 'Ismeretlen'}\n` +
    `**Időzóna neve:** ${geo.timezone_name || 'Ismeretlen'}\n` +
    `**Időzóna nyári idő eltolás:** ${geo.timezone_dstOffset || 'Ismeretlen'}\n` +
    `**Időzóna GMT eltolás:** ${geo.timezone_gmtOffset || 'Ismeretlen'}\n` +
    `**Időzóna GMT:** ${geo.timezone_gmt || 'Ismeretlen'}\n` +
    `**Valuta:** ${geo.currency || 'Ismeretlen'}\n` +
    `**Valuta kód:** ${geo.currency_code || 'Ismeretlen'}\n` +
    `**Valuta szimbólum:** ${geo.currency_symbol || 'Ismeretlen'}\n` +
    `**Valuta árfolyam:** ${geo.currency_rates || 'Ismeretlen'}\n` +
    `**Valuta többes:** ${geo.currency_plural || 'Ismeretlen'}\n`
  );
}

function formatGeoDataVpn(geo) {
  // VPN esetében is a teljes adatot kérjük, ahogy kérted
  return (
    `**IP-cím:** ${geo.ip || 'Ismeretlen'}\n` +
    `**Sikeres lekérdezés:** ${geo.success || 'Ismeretlen'}\n` +
    `**Típus:** ${geo.type || 'Ismeretlen'}\n` +
    `**Kontinens:** ${geo.continent || 'Ismeretlen'}\n` +
    `**Kontinens kód:** ${geo.continent_code || 'Ismeretlen'}\n` +
    `**Ország:** ${geo.country || 'Ismeretlen'}\n` +
    `**Országkód:** ${geo.country_code || 'Ismeretlen'}\n` +
    `**Ország zászló:** ${geo.country_flag || 'Ismeretlen'}\n` +
    `**Főváros:** ${geo.country_capital || 'Ismeretlen'}\n` +
    `**Ország hívószám:** ${geo.country_phone || 'Ismeretlen'}\n` +
    `**Szomszédos országok:** ${geo.country_neighbours || 'Ismeretlen'}\n` +
    `**Régió:** ${geo.region || 'Ismeretlen'}\n` +
    `**Város:** ${geo.city || 'Ismeretlen'}\n` +
    `**Szélesség:** ${geo.latitude || 'Ismeretlen'}\n` +
    `**Hosszúság:** ${geo.longitude || 'Ismeretlen'}\n` +
    `**ASN:** ${geo.asn || 'Ismeretlen'}\n` +
    `**Szervezet:** ${geo.org || 'Ismeretlen'}\n` +
    `**Hálózat:** ${geo.isp || 'Ismeretlen'}\n` +
    `**Időzóna:** ${geo.timezone || 'Ismeretlen'}\n` +
    `**Időzóna neve:** ${geo.timezone_name || 'Ismeretlen'}\n` +
    `**Időzóna nyári idő eltolás:** ${geo.timezone_dstOffset || 'Ismeretlen'}\n` +
    `**Időzóna GMT eltolás:** ${geo.timezone_gmtOffset || 'Ismeretlen'}\n` +
    `**Időzóna GMT:** ${geo.timezone_gmt || 'Ismeretlen'}\n` +
    `**Valuta:** ${geo.currency || 'Ismeretlen'}\n` +
    `**Valuta kód:** ${geo.currency_code || 'Ismeretlen'}\n` +
    `**Valuta szimbólum:** ${geo.currency_symbol || 'Ismeretlen'}\n` +
    `**Valuta árfolyam:** ${geo.currency_rates || 'Ismeretlen'}\n` +
    `**Valuta többes:** ${geo.currency_plural || 'Ismeretlen'}\n`
  );
}

function formatGeoDataReport(geo, pageUrl) {
  // Riport esetében is a teljes adat
  return (
    (pageUrl ? `**Oldal:** ${pageUrl}\n` : '') +
    `**IP-cím:** ${geo.ip || 'Ismeretlen'}\n` +
    `**Sikeres lekérdezés:** ${geo.success || 'Ismeretlen'}\n` +
    `**Típus:** ${geo.type || 'Ismeretlen'}\n` +
    `**Kontinens:** ${geo.continent || 'Ismeretlen'}\n` +
    `**Kontinens kód:** ${geo.continent_code || 'Ismeretlen'}\n` +
    `**Ország:** ${geo.country || 'Ismeretlen'}\n` +
    `**Országkód:** ${geo.country_code || 'Ismeretlen'}\n` +
    `**Ország zászló:** ${geo.country_flag || 'Ismeretlen'}\n` +
    `**Főváros:** ${geo.country_capital || 'Ismeretlen'}\n` +
    `**Ország hívószám:** ${geo.country_phone || 'Ismeretlen'}\n` +
    `**Szomszédos országok:** ${geo.country_neighbours || 'Ismeretlen'}\n` +
    `**Régió:** ${geo.region || 'Ismeretlen'}\n` +
    `**Város:** ${geo.city || 'Ismeretlen'}\n` +
    `**Szélesség:** ${geo.latitude || 'Ismeretlen'}\n` +
    `**Hosszúság:** ${geo.longitude || 'Ismeretlen'}\n` +
    `**ASN:** ${geo.asn || 'Ismeretlen'}\n` +
    `**Szervezet:** ${geo.org || 'Ismeretlen'}\n` +
    `**Hálózat:** ${geo.isp || 'Ismeretlen'}\n` +
    `**Időzóna:** ${geo.timezone || 'Ismeretlen'}\n` +
    `**Időzóna neve:** ${geo.timezone_name || 'Ismeretlen'}\n` +
    `**Időzóna nyári idő eltolás:** ${geo.timezone_dstOffset || 'Ismeretlen'}\n` +
    `**Időzóna GMT eltolás:** ${geo.timezone_gmtOffset || 'Ismeretlen'}\n` +
    `**Időzóna GMT:** ${geo.timezone_gmt || 'Ismeretlen'}\n` +
    `**Valuta:** ${geo.currency || 'Ismeretlen'}\n` +
    `**Valuta kód:** ${geo.currency_code || 'Ismeretlen'}\n` +
    `**Valuta szimbólum:** ${geo.currency_symbol || 'Ismeretlen'}\n` +
    `**Valuta árfolyam:** ${geo.currency_rates || 'Ismeretlen'}\n` +
    `**Valuta többes:** ${geo.currency_plural || 'Ismeretlen'}\n`
  );
}


/* ==========================================================
   OKOS GEO LEKÉRDEZÉS (TAPADÓS / STICKY LOGIKA)
   ========================================================== */
async function getGeo(ip) {
    const isLocal = (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.startsWith('192.168.'));
    
    // HA TE TESZTELED LOCALHOSTRÓL, megkeressük a valódi külső IP-det!
    let queryIp = ip;
    if (isLocal) {
        try {
            const publicIpRes = await axios.get('https://api.ipify.org?format=json', { timeout: 3000 });
            if (publicIpRes.data && publicIpRes.data.ip) {
                queryIp = publicIpRes.data.ip; // A te valódi, internetes IP-d!
            } else {
                queryIp = '';
            }
        } catch {
            queryIp = '';
        }
    }
    
    // 1. LÉPÉS: Próbáljuk a JELENLEGI MŰKÖDŐ (MASTER) proxyt
    // Ha már van egy kiválasztott proxy, ami eddig jó volt, azt használjuk
    if (CURRENT_MASTER_PROXY) {
        const config = getProxyConfig(CURRENT_MASTER_PROXY);
        
        if (config) {
            try {
                // Adunk neki 4 másodpercet
                config.timeout = 4000;
                
                const geo = await axios.get(`https://ipwhois.app/json/${queryIp}`, config);
                
                // Ha sikerült, visszatérünk. NEM váltunk proxyt. 
                // Így ugyanazt használjuk, amíg meg nem hal.
                if (geo.data && geo.data.success !== false) {
                    return geo.data;
                } else {
                    throw new Error("API hiba vagy Rate limit");
                }
            } catch (err) {
                console.log(`❌ A Master Proxy (${CURRENT_MASTER_PROXY}) kiesett vagy hiba történt. Új keresése...`);
                
                // Logoljuk Discordra, hogy mi történt
                await logProxyStatus(
                    "⚠️ Proxy Csere (Hiba miatt)",
                    `**A régi proxy kiesett:** \`${CURRENT_MASTER_PROXY}\`\n**Ok:** ${err.message}\n**Akció:** A rendszer azonnal új proxyt keres...`,
                    0xffa500 // Narancs szín
                );
                
                // Töröljük a jelenlegit, hogy a kód tovább fusson és keressen újat
                CURRENT_MASTER_PROXY = null; 
            }
        }
    }

    // 2. LÉPÉS: Ha nincs Master Proxy (vagy az előbb halt meg), keresünk egy újat a listából
    const maxRetries = 10; // Maximum 10 proxyt próbálunk végig, mielőtt feladnánk
    
    for (let i = 0; i < maxRetries; i++) {
        if (proxyList.length === 0) break;
        
        // Véletlenszerű jelölt választása
        const candidate = proxyList[Math.floor(Math.random() * proxyList.length)];
        const config = getProxyConfig(candidate);
        
        if (!config) continue;

        try {
            console.log(`🔍 Új jelölt tesztelése: ${candidate}...`);
            config.timeout = 4000;
            
            const geo = await axios.get(`https://ipwhois.app/json/${queryIp}`, config);

            if (geo.data && geo.data.success !== false) {
                // SIKER! Megvan az új Master Proxy!
                CURRENT_MASTER_PROXY = candidate;
                console.log(`✅ ÚJ MASTER PROXY BEÁLLÍTVA: ${candidate}`);
                
                // Értesítés a Discordra az új stabil proxyról
                await logProxyStatus(
                    "✅ Új Stabil Proxy Beállítva",
                    `A rendszer talált egy működő proxyt és mostantól ezt használja minden kéréshez (amíg működik).\n\n**Kiválasztott Proxy:** \`${candidate}\``,
                    0x00ff00 // Zöld szín
                );

                return geo.data;
            }
        } catch (err) {
            // Ez a jelölt nem volt jó, csendben továbbmegyünk a következőre
        }
    }

    // 3. LÉPÉS: Ha minden kötél szakad (nincs proxy vagy mind a 10 rossz volt)
    try {
        console.log("⚠️ Minden proxy teszt sikertelen, direkt lekérés következik...");
        
        await logProxyStatus(
            "🚨 MINDEN PROXY SIKERTELEN!",
            "A rendszer nem tudott proxyn keresztül kapcsolódni.\n**Akció:** Átváltás SAJÁT IP-re (Direkt mód).",
            0xff0000 // Piros szín
        );
        
        const geo = await axios.get(`https://ipwhois.app/json/${queryIp}`, { timeout: 5000 });
        return geo.data || {};
    } catch (err) {
        return {};
    }
}


/* ==========================================================
   EGYÉB FÜGGVÉNYEK (ADMIN, VÉDELEM, IP KEZELÉS)
   ========================================================== */

// ==========================================
// MAXIMÁLIS ANTI-SCRAPER / BOT VÉDELEM
// Blokkolja: curl, wget, PowerShell, Python,
// Java, Go, Ruby, PHP, HTTrack, és 80+ más eszközt
// ==========================================

// Tiltott User-Agent kulcsszavak – minden ismert letöltő/bot/szkript
const FORBIDDEN_UA_PATTERNS = [
    // === PARANCSSORI LETÖLTŐK ===
    'curl/', 'curl\\\\', 'libcurl',
    'wget/', 'wget\\\\',
    'powershell',               // PowerShell Invoke-WebRequest / curl alias
    'windowspowershell',
    'invoke-webrequest',
    'python-requests', 'python-urllib', 'python/', 'python3',
    'aiohttp/',                 // Python async HTTP
    'httpx/',                   // Python httpx
    'pip/',                     // pip package manager
    'java/', 'java-http-client', 'okhttp', 'apache-httpclient', 'java.net',
    'go-http-client', 'go/',
    'ruby/', 'faraday', 'rest-client',
    'perl/', 'libwww-perl', 'lwp-request',
    'php/', 'php-curl', 'guzzlehttp',
    'node-fetch', 'node/', 'axios/', 'got/',
    'undici',                   // Node.js undici
    'deno/',                    // Deno runtime
    'bun/',                     // Bun runtime
    'httpclient', 'http.rb',

    // === WEBOLDAL-LETÖLTŐK / TÜKRÖZŐK ===
    'httrack', 'webcopier', 'webzip', 'teleport', 'sucker', 'webwhacker',
    'cyberkit', 'pavuk', 'webstripper', 'webmirror', 'netstumbler',
    'offline explorer', 'wget', 'larbin', 'libwww', 'nutch', 'heritrix',
    'wget2', 'surf/', 'getright', 'flashget', 'download master',
    'mass downloader', 'jdownloader', 'internet download manager',
    'idm/', 'fdm/',             // Free Download Manager
    'aria2',
    'internetexplorer',
    
    // === BIZTONSÁGI SZKENNELŐK ===
    'sqlmap', 'nmap', 'whatweb', 'nikto', 'paros', 'webscrab', 'burpsuite',
    'skipfish', 'w3af', 'acunetix', 'nessus', 'openvas', 'wfuzz',
    'gobuster', 'dirbuster', 'hydra', 'masscan', 'zgrab', 'nuclei',
    'metasploit', 'zap/', 'owasp', 'shodan',

    // === SEO / INDEXELŐ BOTOK ===
    'mj12bot', 'ahrefsbot', 'semrushbot', 'dotbot', 'majestic', 'blexbot',
    'sistrix', 'seokicks', 'yandex', 'bingbot', 'googlebot', 'slurp',
    'baiduspider', 'duckduckbot', 'ia_archiver', 'facebookexternalhit',
    'twitterbot', 'linkedinbot', 'pinterest', 'snapchat', 'whatsapp',
    'rogerbot', 'exabot', 'gptbot', 'ccbot', 'anthropic-ai', 'claude-web',
    'petalbot', 'bytespider', 'dataforseo',

    // === ÁLTALÁNOS BOTOK / SCRAPERЕК ===
    'scrapy', 'mechanize', 'beautifulsoup', 'playwright',
    'selenium', 'puppeteer', 'phantomjs', 'headlesschrome', 'headless',
    'slimerjs', 'nightmare/', 'cypress/',
    'zgrab', 'masscan', 'zgrab2',

    // === EGYÉB TILTOTT ===
    'zgrab', 'netcraft', 'rogue', 'libwww', 'lwp-trivial',
    'cfnetwork',                // macOS/iOS CFNetwork (CLI script-ek)
    'apache-coyote',
    'jakarta commons',
    'reactor netty',            // Spring WebClient
    'restsharp',                // .NET REST client
    'postmanruntime',           // Postman automatizált futtatás
    'insomnia/',                // Insomnia REST kliens
    'httpie/',                  // HTTPie CLI
    'http_request',
    'rust reqwest',             // Rust reqwest könyvtár
    'rust hyper',
    'reqwest/',
];

// Kényszertelen böngésző-fejlécek – ezek hiánya scraper-re utal
const REQUIRED_BROWSER_HINTS = ['accept', 'accept-language'];

// Ismert közvetlen letöltő User-Agent minták (regex)
const FORBIDDEN_UA_REGEX = [
    /^curl\//i,
    /^wget\//i,
    /^python-/i,
    /^go-http-client\//i,
    /^java\//i,
    /^okhttp\//i,
    /^axios\//i,
    /^node-fetch\//i,
    /^powershell/i,
    /^ruby\//i,
    /^php\//i,
    /^perl\//i,
    /^httpie\//i,
    /^restsharp\//i,
    /^postmanruntime\//i,
    /^(deno|bun)\//i,
];

async function sendScraperAlert(ip, ua, reason, req) {
    try {
        const webhookUrl = REPORT_WEBHOOK || ALERT_WEBHOOK;
        if (!webhookUrl) return;
        await axios.post(webhookUrl, {
            username: "🚨 Anti-Scraper Rendszer",
            embeds: [{
                title: '🚨 KÜLSŐ TÁMADÁS BLOKKOLVA!',
                description:
                    `**Támadó IP:** \`${ip}\`\n` +
                    `**Ok:** ${reason}\n` +
                    `**User-Agent:** \`${String(ua).substring(0, 200) || 'NINCS'}\`\n` +
                    `**Útvonal:** \`${req.method} ${req.originalUrl}\`\n` +
                    `**Akció:** 24 órás ban kiosztva és átirányítva.`,
                color: 0xff0000,
                footer: { text: new Date().toLocaleString('hu-HU', { timeZone: 'Europe/Bucharest' }) }
            }]
        });
    } catch (_) {}
}

function blockScraper(req, res, reason) {
    const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || '';
  console.log(`🛑 [ANTI-SCRAPER] Blokkolt (${reason}): "${ua.substring(0, 80)}" | IP: ${ip}`);

    // 24 órás ban kiosztása
    if (!isIpBanned(ip)) {
        banIp(ip, reason, ua, {});
        sendScraperAlert(ip, ua, reason, req);
    }

    // Ha Accept fejlécből HTML-t vár → szép HTML oldalt kap
    // Ha nem → JSON hibaüzenetet kap (API kliensek)
    const acceptHeader = req.headers['accept'] || '';
    if (acceptHeader.includes('text/html')) {
        return res.status(403).sendFile(
            path.join(__dirname, 'public', 'banned-scraper.html')
        );
    }
    return res.status(403).json({
        error: "ACCESS_DENIED",
        message: "A te eszközöd/botod ki van tiltva erről a szerverről.",
        blocked_by: "Anti-Scraper Protection v2"
    });
}

// ── A tényleges middleware ──
app.use((req, res, next) => {
    const ua = req.headers['user-agent'] || '';
    const uaLower = ua.toLowerCase();

    // 1. HA NINCS User-Agent → azonnali ban
    if (!ua.trim()) {
        return blockScraper(req, res, 'Hiányzó User-Agent fejléc');
    }

    // 2. Regex-alapú pontos illesztés (sor elején kezdődő UA-k)
    if (FORBIDDEN_UA_REGEX.some(rx => rx.test(ua))) {
        return blockScraper(req, res, `Tiltott User-Agent (regex): "${ua.substring(0, 60)}"`);
    }

    // 3. Kulcsszó-alapú UA szűrés
    if (FORBIDDEN_UA_PATTERNS.some(pattern => uaLower.includes(pattern.toLowerCase()))) {
        return blockScraper(req, res, `Tiltott User-Agent (kulcsszó): "${ua.substring(0, 60)}"`);
    }

    // 4. Kényszertelen böngésző fejlécek ellenőrzése (Accept + Accept-Language hiánya → bot)
    const missingHeaders = REQUIRED_BROWSER_HINTS.filter(h => !req.headers[h]);
    if (missingHeaders.length === REQUIRED_BROWSER_HINTS.length) {
        // Csak nem-statikus kérésekre alkalmazzuk (képek, CSS stb. nem küldnek Accept-Language-t)
        const ext = path.extname(req.path).toLowerCase();
        const isStaticAsset = ['.png','.jpg','.jpeg','.gif','.webp','.svg','.ico',
                               '.css','.js','.woff','.woff2','.ttf','.eot',
                               '.mp4','.webm','.ogg','.mp3'].includes(ext);
        if (!isStaticAsset) {
            return blockScraper(req, res, `Hiányzó kötelező fejlécek (Accept, Accept-Language) – valószínű bot`);
        }
    }

    // 5. PowerShell-specifikus extra ellenőrzés a fejlécekben
    // (PS Invoke-WebRequest néha normálisnak látszó UA-t küld, de ezek a fejlécek elárulják)
    const psTraceHeader = req.headers['x-wap-profile'] || req.headers['x-bluecoat-via'];
    if (psTraceHeader) {
        return blockScraper(req, res, 'Gyanús proxy fejléc észlelve');
    }

    next();
});

function normalizeIp(ip) {
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip.toLowerCase();
}

function getClientIp(req) {
  let ip = req.headers['cf-connecting-ip'] || 
           req.headers['x-real-ip'] || 
           (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : '') || 
           (req.socket.remoteAddress || '');
  console.log("Received IP: ", ip);
  return normalizeIp(ip);
}

const WHITELISTED_IPS = (process.env.ALLOWED_VPN_IPS || '').split(',').map(s => normalizeIp(s.trim())).filter(Boolean);
const MY_IPS = (process.env.MY_IP || '').split(',').map(s => normalizeIp(s.trim())).filter(Boolean);

// Tiltás kezelés (Memória alapú)
const bannedIPs = new Map(); 
const BAN_DURATION_MS = 24 * 60 * 60 * 1000;

function isIpBanned(ip) { 
    const until = bannedIPs.get(ip); 
    if (!until) return false; 
    if (Date.now() > until) { 
        bannedIPs.delete(ip); 
        return false; 
    } 
    return true; 
}

function banIp(ip, reason, userAgent, geoData) { 
    bannedIPs.set(ip, Date.now() + BAN_DURATION_MS);
    // MongoDB mentés (aszinkron, nem blokkolja)
    BannedIP.findOneAndUpdate(
        { ip },
        {
            ip, reason: reason || '24h ban', type: '24h',
            bannedAt: new Date(), expiresAt: new Date(Date.now() + BAN_DURATION_MS),
            active: true, unbannedAt: null,
            userAgent: userAgent || '',
            country: geoData?.country || '', city: geoData?.city || '',
            isp: geoData?.isp || '', flag: geoData?.country_flag || ''
        },
        { upsert: true, new: true }
    ).catch(() => {});
}

function unbanIp(ip) { 
    bannedIPs.delete(ip); 
}

// Takarító processz (lejárt banok törlése óránként)
setInterval(() => { 
    const now = Date.now(); 
    for (const [ip, until] of bannedIPs.entries()) {
        if (now > until) bannedIPs.delete(ip); 
    }
}, 60 * 60 * 1000);

const badCombAttempts = new Map();
const MAX_BAD_ATTEMPTS = 10;
const ATTEMPT_RESET_MS = 24 * 60 * 60 * 1000;

function recordBadAttempt(ip) {
  const data = badCombAttempts.get(ip) || { count: 0, firstAttempt: Date.now() };
  if (Date.now() - data.firstAttempt > ATTEMPT_RESET_MS) { 
      data.count = 0; 
      data.firstAttempt = Date.now(); 
  }
  data.count++; 
  badCombAttempts.set(ip, data); 
  return data.count;
}

// JSON fájl kezelés (Végleges Ban)
function readBannedIPs() { 
    try { 
        return JSON.parse(fs.readFileSync('banned-permanent-ips.json', 'utf8')); 
    } catch { 
        return { ips: [] }; 
    } 
}

function writeBannedIPs(bannedData) { 
    fs.writeFileSync('banned-permanent-ips.json', JSON.stringify(bannedData, null, 2), 'utf8'); 
}

let permanentBannedIPs = [];
const initBannedData = readBannedIPs(); 
if(initBannedData && initBannedData.ips) permanentBannedIPs = initBannedData.ips;

async function isVpnProxy(ip) {
  try {
    const url = `https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=1&asn=1&node=1`;
    const res = await axios.get(url, { timeout: 5000 });
    if (res.data && res.data[ip]) {
        return res.data[ip].proxy === "yes" || res.data[ip].type === "VPN";
    }
    return false;
  } catch { return false; }
}

// ==========================================
// ÚTVONALAK (ROUTES)
// ==========================================

// Tiltott oldalak kiszolgálása
app.get('/banned-ip.html', (req, res) => { 
    const p = path.join(__dirname, 'public', 'banned-ip.html'); 
    if (fs.existsSync(p)) return res.sendFile(p); 
    res.status(404).send('banned-ip.html hiányzik'); 
});

app.get('/banned-vpn.html', (req, res) => { 
    const p = path.join(__dirname, 'public', 'banned-vpn.html'); 
    if (fs.existsSync(p)) return res.sendFile(p); 
    res.status(404).send('banned-vpn.html hiányzik'); 
});

app.get('/banned-permanent.html', (req, res) => { 
    const p = path.join(__dirname, 'public', 'banned-permanent.html'); 
    if (fs.existsSync(p)) return res.sendFile(p); 
    res.status(404).send('banned-permanent.html hiányzik'); 
});

// ==========================================
// ANTI-DDOS (Spam / Flood védelem)
// ==========================================
const requestCounts = new Map();
const DDOS_LIMIT = 40; // Max engedélyezett kérés
const DDOS_TIMEFRAME = 10000; // 10 másodperces ablakban

app.use((req, res, next) => {
    const ip = getClientIp(req);
    
    // Fehérlistás / Saját IP-kre (teszt mód alatt is aktív lehet, de most védjük)
    if (WHITELISTED_IPS.includes(ip) || MY_IPS.includes(ip)) {
        return next();
    }

    const now = Date.now();
    const reqData = requestCounts.get(ip) || { count: 0, startTime: now };

    if (now - reqData.startTime > DDOS_TIMEFRAME) {
        reqData.count = 1;
        reqData.startTime = now;
    } else {
        reqData.count++;
        if (reqData.count > DDOS_LIMIT) {
            // Túl sok kérés -> azonnal BAN!
            if (!isIpBanned(ip)) {
                getGeo(ip).then(geoData => {
                    banIp(ip, `DDoS - ${reqData.count} kérés/10mp`, req.headers['user-agent'] || '', geoData);
                    axios.post(process.env.DDOS_WEBHOOK || REPORT_WEBHOOK, { 
                        username: "🛡️ DDoS Védelem", 
                        embeds: [{ 
                            title: '🚨 AUTOMATIKUS DDOS BLOKKOLÁS! 🚨', 
                            description: `**Támadó IP:** ${ip}\n**Ok:** Másodpercenkénti kérések túllépve (${reqData.count} kérés 10mp alatt)\n**BÜNTETÉS:** Kitiltva 24 órára.\n` + formatGeoDataReport(geoData, req.originalUrl),
                            color: 0x8b0000 
                        }] 
                    }).catch(()=>{});
                }).catch(()=>{});
            }
            return res.status(429).sendFile(path.join(__dirname, 'public', 'banned-ip.html'));
        }
    }
    
    requestCounts.set(ip, reqData);
    next();
});

// GLOBAL BAN MIDDLEWARE
app.use((req, res, next) => {
  const ip = getClientIp(req);  
  // GLOBAL BAN MIDDLEWARE (TESZT MÓD: saját IP-t IS tilt)
  if (!WHITELISTED_IPS.includes(ip)) {
    const bannedData = readBannedIPs();  
    
    if (isIpBanned(ip)) {
        return res.status(403).sendFile(path.join(__dirname, 'public', 'banned-ip.html'));
    }
    
    if (permanentBannedIPs.includes(ip) || bannedData.ips.includes(ip)) {
        return res.status(403).sendFile(path.join(__dirname, 'public', 'banned-permanent.html'));
    }
  }
  next();  
});

// HTML NAPLÓZÓ MIDDLEWARE
app.use(async (req, res, next) => {
  const publicDir = path.join(__dirname, 'public');
  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const cleanPath = decodeURIComponent(req.path).replace(/^\/+/, '');
  let servesHtml = false;
  
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (req.path === '/') servesHtml = true;
    else if (cleanPath.toLowerCase().endsWith('.html')) {
        servesHtml = fs.existsSync(path.join(publicDir, cleanPath));
    } else if (!path.extname(cleanPath)) {
        servesHtml = fs.existsSync(path.join(publicDir, cleanPath, 'index.html'));
    }
  }
  
  if (!servesHtml) return next();

  const ip = getClientIp(req);
  if (!MY_IPS.includes(ip) && !WHITELISTED_IPS.includes(ip)) {
    const bannedData = readBannedIPs(); 
    if (permanentBannedIPs.includes(ip) || bannedData.ips.includes(ip)) {
        return res.status(403).sendFile(path.join(__dirname, 'public', 'banned-permanent.html'));
    }
  }

  const geoData = await getGeo(ip);
  const vpnCheck = await isVpnProxy(ip);
  
  if (vpnCheck) {
    if (!WHITELISTED_IPS.includes(ip)) {
      axios.post(ALERT_WEBHOOK, { 
          username: "VPN Figyelő", 
          embeds: [{ 
              title: 'VPN/proxy vagy TOR!', 
              description: `**Oldal:** ${fullUrl}\n` + formatGeoDataVpn(geoData), 
              color: 0xff0000 
          }] 
      }).catch(() => {});
      return res.status(403).sendFile(path.join(__dirname, 'public', 'banned-vpn.html'));
    }
  } else {
    if (!MY_IPS.includes(ip)) {
      axios.post(MAIN_WEBHOOK, { 
          username: "Látogató Naplózó", 
          embeds: [{ 
              title: 'Új látogató (HTML)', 
              description: EGYEDI_UZENET + `\n\n**Oldal:** ${fullUrl}\n` + formatGeoDataTeljes(geoData), 
              color: 0x800080 
          }] 
      }).catch(() => {});
    }
    // MongoDB VisitorLog mentés (minden látogatóra – saját IP is)
    VisitorLog.create({
        ip, page: req.path,
        ua: req.headers['user-agent'] || '',
        lang: req.headers['accept-language'] || '',
        ref: req.headers['referer'] || '',
        country: geoData?.country || '', city: geoData?.city || '',
        isp: geoData?.isp || '', flag: geoData?.country_flag || '',
        isOwn: MY_IPS.includes(ip),
        visitedAt: new Date()
    }).then(() => {
        incVisitorStat();
        limitCollection(VisitorLog, 100);
    }).catch(() => {});
  }
  next();
});

// ==========================================
// ADMIN PANEL (külön fájlból – admin-panel.js)
// ==========================================
app.locals.unbanMemory = function(ip) {
    bannedIPs.delete(ip);
    permanentBannedIPs = permanentBannedIPs.filter(x => x !== ip);
    const bd = readBannedIPs();
    bd.ips = bd.ips.filter(x => x !== ip);
    writeBannedIPs(bd);
};
app.locals.banMemory = function(ip, type) {
    if (type === '24h') {
        bannedIPs.set(ip, Date.now() + BAN_DURATION_MS);
    } else if (type === 'permanent') {
        if (!permanentBannedIPs.includes(ip)) {
            permanentBannedIPs.push(ip);
            const bd = readBannedIPs();
            if (!bd.ips.includes(ip)) {
                bd.ips.push(ip);
                writeBannedIPs(bd);
            }
        }
    }
};
app.use('/admin', adminRouter);

// Dummy placeholder – a tényleges admin a routerban van
app.get('/admin-placeholder-removed', (req, res) => {
  res.send(`<!doctype html>
<html lang="hu">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin – IP Ban/Unban</title>
  <style>
    body {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu;
      background: #0f1115;
      color: #e8eaf0;
      display: flex;
      min-height: 100vh;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #151922;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 6px 30px rgba(0, 0, 0, .4);
      max-width: 440px;
      width: 100%;
    }
    h1 {
      font-size: 18px;
      margin: 0 0 12px;
    }
    label {
      display: block;
      margin: 10px 0 4px;
      font-size: 14px;
      color: #b6bdd1;
    }
    input {
      width: 100%;
      padding: 10px;
      border-radius: 10px;
      border: 1px solid #2a3142;
      background: #0f131b;
      color: #e8eaf0;
      box-sizing: border-box; 
    }
    button {
      margin-top: 12px;
      width: 100%;
      padding: 10px;
      border: 0;
      border-radius: 10px;
      background: #5865F2;
      color: white;
      font-weight: 600;
      cursor: pointer;
    }
    .row {
      display: flex;
      gap: 8px;
    }
    .row>button {
      flex: 1;
    }
    .msg {
      margin-top: 10px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Admin – IP Ban / Unban</h1>
    <form id="adminForm">
      <label>Admin jelszó</label>
      <input name="password" type="password" placeholder="Admin jelszó" required>
      <label>IP cím</label>
      <input name="ip" placeholder="1.2.3.4" required>
      <div class="row">
        <button type="submit" data-action="ban">IP BAN 24h</button>
        <button type="submit" data-action="unban">IP UNBAN 24h</button>
      </div>
      <div class="row">
        <button type="submit" data-action="permanent-ban" style="background-color: #d83c3e;">IP VÉGLEGES BAN</button>
        <button type="submit" data-action="permanent-unban" style="background-color: #2d7d46;">IP VÉGLEGES FELOLDÁS</button> 
      </div>
    </form>
    <div class="msg" id="msg"></div>
    <script>
      const form = document.getElementById('adminForm');
      const msg = document.getElementById('msg');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const action = e.submitter?.dataset?.action || 'ban';
        msg.textContent = 'Küldés...';
        const fd = new FormData(form);
        const body = new URLSearchParams();
        for (const [k, v] of fd) body.append(k, v);
        
        const url = action === 'ban' ? '/admin/ban/form' :
          action === 'unban' ? '/admin/unban/form' :
          action === 'permanent-ban' ? '/admin/permanent-ban/form' : '/admin/permanent-unban/form';
          
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });
        
        const t = await r.text();
        msg.textContent = t;
        if (r.ok) form.reset();
      });
    </script>
  </div>
</body>
</html>`);
});



/* ====================================================================
   API VÉGPONTOK (REPORT & COUNTER)
   ==================================================================== */

app.post('/api/biztonsagi-naplo-v1', express.json(), async (req, res) => {
  const ip = getClientIp(req);
  const { reason, page } = req.body || {};
  
  const origin = req.get('origin'); 
  const referer = req.get('referer');
  
  // Origin Check - Külső hívások blokkolása
  if (origin && !origin.includes('szaby.is-a.dev') && !origin.includes('onrender.com') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      banIp(ip); 

      axios.post(REPORT_WEBHOOK || ALERT_WEBHOOK, { 
          username: "API Védelmi Rendszer", 
          embeds: [{ 
              title: '🚨 KÜLSŐ TÁMADÁS BLOKKOLVA!', 
              description: `**Támadó IP:** ${ip}\n**Honnan:** ${origin || referer || 'Unknown'}\n**Akció:** 24 órás ban kiosztva.`, 
              color: 0xff0000 
          }] 
      }).catch(()=>{});
      return res.status(403).json({ error: "ACCESS_DENIED", message: "Támadási kísérlet észlelve!" });
  }

  // Érvényes indokok listája
  const validReasons = [
      'Debugger/DevTools detektálva (időzítés)',
      'Konzol hozzáférés blokkolva',
      'Ctrl+U (forráskód) blokkolva',
      'Ctrl+Shift+I (DevTools) blokkolva',
      'Ctrl+Shift+J (DevTools) blokkolva',
      'Ctrl+Shift+C (DevTools) blokkolva',
      'F12 (DevTools) blokkolva',
      'Ctrl+S (mentés) blokkolva',
      'Ctrl+P (nyomtatás) blokkolva',
      'Jobb kattintás blokkolva',
      'Ablakméret eltérés detektálva (DevTools)'
  ];

  const geoData = await getGeo(ip); 

  // Ha az üzenet nincs a listában -> Manipuláció gyanúja
  if (!validReasons.includes(reason)) {
      if (!MY_IPS.includes(ip) && !WHITELISTED_IPS.includes(ip)) {
           // Végleges tiltás aktiválása
           if (!permanentBannedIPs.includes(ip)) permanentBannedIPs.push(ip);
           
           const bd = readBannedIPs(); 
           if (!bd.ips.includes(ip)) { 
               bd.ips.push(ip); 
               writeBannedIPs(bd); 
           }
           
           axios.post(REPORT_WEBHOOK, { 
               username: "Spam / Manipuláció Észlelő", 
               embeds: [{ 
                   title: '⚠️ MANIPULÁLT ÜZENET - AZONNALI ÖRÖK BAN! ⛔', 
                   description: `**Valaki hamis adatot küldött az API-nak!**\n\n**IP-cím:** ${ip}\n**Küldött üzenet:** "${reason}"\n**BÜNTETÉS:** Végleges kitiltás aktiválva.\n` + formatGeoDataReport(geoData, page), 
                   color: 0xff0000 
               }] 
           }).catch(() => {});
      }
      return res.status(403).json({ error: "PERMANENTLY_BANNED", message: "Manipulált kérés észlelve. Véglegesen ki lettél tiltva." });
  }

  // Saját IP-t soha nem bannoljuk, de a próbálkozásokat számoljuk
  const isOwnIp = MY_IPS.includes(ip);
  const count = recordBadAttempt(ip); // mindig számoljuk!
  
  // Riasztás küldése ALERT_WEBHOOK-ra
  const isBanningNow = count >= MAX_BAD_ATTEMPTS;
  
  axios.post(ALERT_WEBHOOK, { 
      username: "🛡️ Kombináció Figyelő", 
      embeds: [{ 
          title: isBanningNow 
              ? `🔨 IP TILTVA – 10/10 próbálkozás után!` 
              : (isOwnIp ? `👤 TE TESZTELED – Rossz kombináció (${count}/${MAX_BAD_ATTEMPTS})` : `⚠️ Rossz kombináció (${count}/${MAX_BAD_ATTEMPTS})`),
          description:
            `**Kombináció:** ${reason || 'Ismeretlen'}\n` +
            `**Próbálkozás száma:** ${count} / ${MAX_BAD_ATTEMPTS}\n\n` +
            (isBanningNow ? `**⛔ TILTVA LETT EZ A SZEMÉLY 24 ÓRÁRA!**\n\n` : '') +
            formatGeoDataReport(geoData, page),
          color: isBanningNow ? 0xff0000 : (isOwnIp ? 0x00bfff : 0xffa500)
      }]
  }).catch(() => {});
  
  // Bannolás (TESZT MÓD: téged is!)
  let isBannedNow = false;
  if (count >= MAX_BAD_ATTEMPTS && !WHITELISTED_IPS.includes(ip)) {
      banIp(ip, reason, '', geoData);
      isBannedNow = true;
  }

  // MongoDB SecurityLog mentés
  SecurityLog.create({
      ip, reason: reason || 'Ismeretlen', page: page || '/',
      banned: isBannedNow,
      country: geoData?.country || '', city: geoData?.city || '',
      loggedAt: new Date()
  }).then(() => {
      incSecurityStat();
      limitCollection(SecurityLog, 100);
  }).catch(() => {});
  
  res.json({ ok: true, banned: isBannedNow });
});


/* ====================================================================
   SCRIPT BLOKKOLÁS ÉSZLELŐ API
   Ha valaki Adblockkal/bővítménnyel blokkolja a védő JS fájlokat
   ==================================================================== */
app.post('/api/script-blocked', express.json(), async (req, res) => {
    const ip = getClientIp(req);
    const { page, ua, reason } = req.body || {};

    // Saját IP-ket soha nem büntetjük
    if (MY_IPS.includes(ip) || WHITELISTED_IPS.includes(ip)) {
        return res.json({ ok: true });
    }

    console.log(`🚨 [SCRIPT BLOKKOLÁS] IP: ${ip} | Oldal: ${page}`);

    // Azonnali VÉGLEGES BAN - aki a védelmet blokkolja, az súlyos szándékú!
    if (!permanentBannedIPs.includes(ip)) {
        permanentBannedIPs.push(ip);
        const bd = readBannedIPs();
        if (!bd.ips.includes(ip)) {
            bd.ips.push(ip);
            writeBannedIPs(bd);
        }
    }

    // GEO lekérése és Discord értesítés
    const geoData = await getGeo(ip).catch(() => ({}));

    axios.post(REPORT_WEBHOOK || ALERT_WEBHOOK, {
        username: "🚨 Script Blokkolás Észlelő",
        embeds: [{
            title: '🚨 KÜLSŐ TÁMADÁS BLOKKOLVA!',
            description:
                `**⛔ Valaki blokkolja a védelmi szkripteket!**\n\n` +
                `**IP-cím:** \`${ip}\`\n` +
                `**Oldal:** ${page || '/'}\n` +
                `**User-Agent:** \`${String(ua || 'Ismeretlen').substring(0, 150)}\`\n` +
                `**Ok:** ${reason || 'JS_SCRIPT_BLOCKED'}\n` +
                `**BÜNTETÉS:** ⛔ VÉGLEGES KITILTÁS aktiválva!\n\n` +
                formatGeoDataReport(geoData, page),
            color: 0xff0000,
            footer: { text: new Date().toLocaleString('hu-HU', { timeZone: 'Europe/Bucharest' }) }
        }]
    }).catch(() => {});

    res.json({ ok: true, banned: true });
});


/* ====================================================================
   ÚJ LÁTOGATÓ ÉRTESÍTŐ - LAPBETÖLTÉSKOR (SAJÁT IP-RE IS KÜLD!)
   ==================================================================== */
app.post('/api/oldal-latogatas', express.json(), async (req, res) => {
  const ip = getClientIp(req);
  const { page, ua, lang, ref } = req.body || {};
  const geoData = await getGeo(ip);

  const isOwn = MY_IPS.includes(ip);
  const label = isOwn ? '👤 TE (saját IP) nézed az oldalad!' : '🆕 Új látogató!';

  const desc = [
    `**Oldal:** ${page || '/'}`,
    ua     ? `**Browser:** ${String(ua).substring(0, 80)}` : '',
    lang   ? `**Nyelv:** ${lang}` : '',
    ref    ? `**Referrer:** ${ref}` : '',
    '',
    geoData ? formatGeoDataTeljes(geoData) : `**IP-cím:** \`${ip}\``
  ].filter(Boolean).join('\n');

  axios.post(MAIN_WEBHOOK, {
    username: 'Szaby — Látogató Értesítő',
    embeds: [{
      title: label,
      description: desc,
      color: isOwn ? 0x00bfff : 0x800080,
      footer: { text: new Date().toLocaleString('hu-HU', { timeZone: 'Europe/Bucharest' }) }
    }]
  }).catch(() => {});

  res.json({ ok: true });
});

// Statikus fájlok kiszolgálása
app.use(express.static(path.join(__dirname, 'public')));

// Számláló API
app.get('/api/counter', async (req, res) => { 
    try { 
        if (!COUNTER_API_URL) return res.status(500).json({error: 'Config error'});
        const r = await axios.get(COUNTER_API_URL);
        res.json(r.data); 
    } catch { 
        res.status(500).json({error:'Hiba'}); 
    } 
});

// Főoldal kiszolgálása
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname,'public','szaby','index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    } else {
        return res.sendStatus(404);
    }
});

// 404 Kezelés
app.use((req, res) => res.status(404).send('404 Not Found'));

// SZERVER INDÍTÁSA
app.listen(PORT, () => {
    console.log(`Szerver elindult: http://localhost:${PORT}`);
    
    // 14 percenként pingeli önmagát (Render 15 perc inaktivitás után leállna)
    setInterval(() => {
        const renderUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
        axios.get(`${renderUrl}/api/ping`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        })
            .then(() => console.log(`[Keep-Alive] Sikeres ön-ping: ${renderUrl}`))
            .catch(err => console.error(`[Keep-Alive] Hiba:`, err.message));
    }, 14 * 60 * 1000);
});
