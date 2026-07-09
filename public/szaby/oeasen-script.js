const userID = "1095731086513930260";
const textToType = "Creator | FiveM ESX Developer | Web UI Designer";
const typingSpeed = 68;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  body: document.body,
  introOverlay: $("#intro-overlay"),
  introText: $("#intro-text"),
  loadingAnim: $("#loading-animation"),
  desc: $("#desc-text"),
  avatar: $("#discord-avatar"),
  username: $("#discord-username"),
  status: $("#status-indicator"),
  activity: $("#discord-activity"),
  activityIcon: $("#activity-icon"),
  gameIcon: $("#default-game-icon"),
  spotifyIcon: $("#spotify-icon"),
  navToggle: $("#nav-toggle"),
  navLinks: $("#nav-links")
};

const state = {
  windowLoaded: false,
  lanyardLoaded: false,
  introReady: false,
  siteStarted: false,
  typingIndex: 0,
  timer: null,
  heartbeatTimer: null,
  ws: null,
  reconnectTimer: null,
  effects: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  session: {
    type: "default",
    gameName: null,
    appId: null,
    iconUrl: null,
    startTimestamp: null,
    spotifyTrackId: null
  }
};

init();

function init() {
  els.body.setAttribute("tabindex", "0");
  if (!state.effects) els.body.classList.add("low-effects");

  bindUI();
  initRevealObserver();
  initTiltEffect();
  lanyardConnect();

  if (els.activityIcon) {
    els.activityIcon.addEventListener("error", () => {
      setHidden(els.activityIcon, true);
      if (state.session.type === "game") setHidden(els.gameIcon, false);
    });
  }

  window.addEventListener("load", () => {
    state.windowLoaded = true;
    tryRevealIntro();

    window.setTimeout(() => {
      if (!state.lanyardLoaded) {
        state.lanyardLoaded = true;
        setDiscordStatus("offline");
        renderDefaultUI("Discord status unavailable");
        tryRevealIntro();
      }
    }, 2800);
  });
}

function bindUI() {
  document.addEventListener("click", (event) => {
    if (!state.introReady || state.siteStarted) return;
    if (els.introOverlay?.contains(event.target)) startSite();
  });

  els.introText?.addEventListener("click", startSite);

  els.navToggle?.addEventListener("click", () => {
    const isOpen = els.navLinks?.classList.toggle("open") || false;
    els.navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  $$(".nav-links a, .side-dots a").forEach((link) => {
    link.addEventListener("click", () => {
      els.navLinks?.classList.remove("open");
      els.navToggle?.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      els.navLinks?.classList.remove("open");
      els.navToggle?.setAttribute("aria-expanded", "false");
    }
  });
}

function tryRevealIntro() {
  if (!state.windowLoaded || !state.lanyardLoaded || state.introReady) return;
  state.introReady = true;
  els.loadingAnim?.classList.add("hidden");
  window.setTimeout(() => els.introText?.classList.add("visible"), 420);
}

function startSite() {
  if (state.siteStarted) return;
  state.siteStarted = true;

  els.introText?.classList.remove("visible");
  if (state.effects) activateWarpSpeed();

  window.setTimeout(() => {
    els.introOverlay?.classList.add("fade-out");
    els.body.classList.remove("no-scroll");
    els.body.focus();
  }, state.effects ? 760 : 120);

  window.setTimeout(typeWriter, state.effects ? 1450 : 250);
  startClockLoop();
  initVideoObserver();
  updateActiveSection();
  startLocalClock();
  fetchWeather();
}

function typeWriter() {
  if (!els.desc || state.typingIndex >= textToType.length) return;
  els.desc.textContent += textToType.charAt(state.typingIndex);
  state.typingIndex += 1;
  window.setTimeout(typeWriter, typingSpeed);
}

// =====================================
// WIDGET LOGIKA (ÓRA & IDŐJÁRÁS)
// =====================================
function startLocalClock() {
  const timeEl = document.getElementById('local-time');
  if (!timeEl) return;
  
  setInterval(() => {
    const d = new Date();
    // Románia időzóna
    const timeStr = d.toLocaleTimeString('hu-HU', { timeZone: 'Europe/Bucharest', hour12: false });
    timeEl.textContent = timeStr;
  }, 1000);
}

async function fetchWeather() {
  const tempEl = document.getElementById('weather-temp');
  const descEl = document.getElementById('weather-desc');
  const iconEl = document.getElementById('weather-icon');
  if (!tempEl) return;

  try {
    // Open-Meteo API (Románia, Bukarest: 44.4268, 26.1025)
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=44.4268&longitude=26.1025&current=temperature_2m,weather_code&timezone=Europe%2FBucharest');
    const data = await res.json();
    
    if (data && data.current) {
      const temp = Math.round(data.current.temperature_2m);
      const code = data.current.weather_code;
      
      tempEl.textContent = `${temp}°C`;
      
      // Egyszerűsített WMO weather kód map
      let icon = 'fa-cloud';
      let desc = 'Felhős';
      
      if (code === 0) { icon = 'fa-sun'; desc = 'Tiszta égbolt'; }
      else if (code === 1 || code === 2 || code === 3) { icon = 'fa-cloud-sun'; desc = 'Részben felhős'; }
      else if (code === 45 || code === 48) { icon = 'fa-smog'; desc = 'Ködös'; }
      else if (code >= 51 && code <= 67) { icon = 'fa-cloud-rain'; desc = 'Esős'; }
      else if (code >= 71 && code <= 77) { icon = 'fa-snowflake'; desc = 'Havas'; }
      else if (code >= 80 && code <= 82) { icon = 'fa-cloud-showers-heavy'; desc = 'Zápor'; }
      else if (code >= 95) { icon = 'fa-bolt'; desc = 'Zivatar'; }
      
      descEl.textContent = desc;
      iconEl.innerHTML = `<i class="fas ${icon}"></i>`;
    }
  } catch (err) {
    descEl.textContent = 'Hiba történt';
    iconEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i>`;
  }
}
// =====================================

function initRevealObserver() {
  if (!("IntersectionObserver" in window)) {
    $$(".reveal").forEach((el) => el.classList.add("visible"));
    return;
  }

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  }, { threshold: 0.12 });

  $$(".reveal").forEach((el) => revealObserver.observe(el));

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) setActiveSection(entry.target.id);
    });
  }, { rootMargin: "-35% 0px -45% 0px", threshold: 0.01 });

  $$(".page-section").forEach((section) => sectionObserver.observe(section));
  window.addEventListener("scroll", updateActiveSection, { passive: true });
}

function setActiveSection(id) {
  $$(".nav-links a").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
  });
  $$(".side-dots a").forEach((dot) => {
    dot.classList.toggle("active", dot.dataset.section === id);
  });
}

function updateActiveSection() {
  const sections = $$(".page-section");
  let current = sections[0]?.id || "home";
  const middle = window.scrollY + window.innerHeight * 0.48;

  for (const section of sections) {
    if (middle >= section.offsetTop) current = section.id;
  }

  setActiveSection(current);
}

function initVideoObserver() {
  // Oeasen V2.1 uses poster backgrounds instead of YouTube iframes.
  // This removes YouTube play buttons and adblock console noise.
  return;
}

function lanyardConnect() {
  clearTimeout(state.reconnectTimer);
  clearInterval(state.heartbeatTimer);

  try {
    state.ws = new WebSocket("wss://api.lanyard.rest/socket");
  } catch {
    handleLanyardUnavailable();
    return;
  }

  state.ws.addEventListener("open", () => {
    safeSendWS({ op: 2, d: { subscribe_to_id: userID } });
  });

  state.ws.addEventListener("message", (event) => {
    const payload = safeJSON(event.data);
    if (!payload) return;

    if (payload.op === 1) {
      const interval = Number(payload.d?.heartbeat_interval) || 30000;
      clearInterval(state.heartbeatTimer);
      safeSendWS({ op: 3 });
      state.heartbeatTimer = window.setInterval(() => safeSendWS({ op: 3 }), interval);
      return;
    }

    if (payload.t === "INIT_STATE" || payload.t === "PRESENCE_UPDATE") {
      processLanyardUpdate(payload.d);
      if (!state.lanyardLoaded) {
        state.lanyardLoaded = true;
        tryRevealIntro();
      }
    }
  });

  state.ws.addEventListener("close", () => {
    clearInterval(state.heartbeatTimer);
    if (!state.lanyardLoaded) handleLanyardUnavailable();
    state.reconnectTimer = window.setTimeout(lanyardConnect, 5000);
  });

  state.ws.addEventListener("error", () => {
    if (!state.lanyardLoaded) handleLanyardUnavailable();
  });
}

function handleLanyardUnavailable() {
  state.lanyardLoaded = true;
  setDiscordStatus("offline");
  renderDefaultUI("Discord status unavailable");
  tryRevealIntro();
}

function safeSendWS(data) {
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(data));
  }
}

function safeJSON(text) {
  try { return JSON.parse(text); }
  catch { return null; }
}

function processLanyardUpdate(data) {
  if (!data) return;

  const user = data.discord_user;
  if (user) {
    if (els.username) els.username.textContent = user.global_name || user.username || "Oeasen";
    if (user.avatar && els.avatar) {
      els.avatar.src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
    }
  }

  const status = data.discord_status || "offline";
  setDiscordStatus(status);

  const activities = data.activities || [];
  const game = activities.find((act) => act.type === 0);
  const custom = activities.find((act) => act.type === 4);

  if (game) return handleGameUpdate(game);
  if (data.spotify) return handleSpotifyUpdate(data.spotify);

  const readable = getReadableStatus(status);
  renderDefaultUI(custom?.state || readable);
}

function setDiscordStatus(status = "offline") {
  if (els.status) els.status.className = `status-indicator ${status}`;
}

function getReadableStatus(status = "offline") {
  return {
    online: "Online",
    idle: "Idle",
    dnd: "Do Not Disturb",
    offline: "Offline"
  }[status] || "Offline";
}

function handleGameUpdate(game) {
  state.session.type = "game";
  state.session.gameName = game.name || "a game";
  state.session.appId = game.application_id || null;
  state.session.iconUrl = getActivityIcon(game);
  state.session.startTimestamp = getStartTimestamp(game);
  renderGameUI();
}

function handleSpotifyUpdate(spotify) {
  state.session.type = "spotify";
  state.session.gameName = spotify.song || "music";
  state.session.iconUrl = spotify.album_art_url || null;
  state.session.startTimestamp = spotify.timestamps?.start || null;
  state.session.spotifyTrackId = spotify.track_id || null;
  renderSpotifyUI();
}

function renderGameUI() {
  setHidden(els.spotifyIcon, true);

  if (state.session.iconUrl && els.activityIcon) {
    els.activityIcon.src = state.session.iconUrl;
    setHidden(els.activityIcon, false);
    setHidden(els.gameIcon, true);
  } else {
    setHidden(els.activityIcon, true);
    setHidden(els.gameIcon, false);
  }

  updateClockText();
}

function renderSpotifyUI() {
  setHidden(els.activityIcon, true);
  setHidden(els.gameIcon, true);
  setHidden(els.spotifyIcon, false);

  if (!els.activity) return;

  if (state.session.spotifyTrackId) {
    const link = `https://open.spotify.com/track/${state.session.spotifyTrackId}`;
    els.activity.innerHTML = `Listening to <a href="${link}" target="_blank" rel="noopener" class="highlight-link">${escapeHTML(state.session.gameName)}</a>`;
  } else {
    els.activity.textContent = `Listening to ${state.session.gameName}`;
  }
}

function renderDefaultUI(text) {
  state.session.type = "default";
  setHidden(els.activityIcon, true);
  setHidden(els.gameIcon, true);
  setHidden(els.spotifyIcon, true);
  if (els.activity) els.activity.textContent = text || "Offline";
}

function setHidden(element, hidden) {
  if (!element) return;
  element.hidden = hidden;
  element.style.display = hidden ? "none" : "inline-flex";
}

function getActivityIcon(activity) {
  const asset = activity.assets?.large_image;
  if (asset && activity.application_id) return resolveDiscordAsset(activity.application_id, asset);
  if (activity.application_id) return `https://dcdn.dstn.to/app-icons/${activity.application_id}`;
  return null;
}

function resolveDiscordAsset(appId, assetId) {
  if (!appId || !assetId) return null;
  if (assetId.startsWith("mp:")) return `https://media.discordapp.net/${assetId.replace("mp:", "")}`;
  return `https://cdn.discordapp.com/app-assets/${appId}/${assetId}.png`;
}

function getStartTimestamp(activity) {
  let start = activity.timestamps?.start || activity.created_at || null;
  if (!start) return null;
  if (start < 100000000000) start *= 1000;
  return Number(start);
}

function startClockLoop() {
  clearInterval(state.timer);
  state.timer = window.setInterval(() => {
    if (state.session.type === "game") updateClockText();
  }, 1000);
}

function updateClockText() {
  if (!els.activity || state.session.type !== "game") return;

  let elapsed = "";
  if (state.session.startTimestamp) elapsed = formatTime(Date.now() - state.session.startTimestamp);
  els.activity.textContent = `Playing ${state.session.gameName}${elapsed ? ` • ${elapsed}` : ""}`;
}

function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const seconds = total % 60;
  const minutes = Math.floor((total / 60) % 60);
  const hours = Math.floor(total / 3600);
  const pad = (n) => String(n).padStart(2, "0");
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

function escapeHTML(text = "") {
  return String(text).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;"
  }[char]));
}

function initTiltEffect() {
  if (!state.effects || window.matchMedia("(max-width: 900px)").matches) return;

  $$(".tilt-card").forEach((card) => {
    if (card.dataset.tiltReady === "true") return;
    card.dataset.tiltReady = "true";

    let frame = null;

    card.addEventListener("mousemove", (event) => {
      if (!state.effects) return;
      if (frame) cancelAnimationFrame(frame);

      frame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -5;
        const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 5;
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
      });
    });

    card.addEventListener("mouseleave", () => {
      if (frame) cancelAnimationFrame(frame);
      card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)";
    });
  });
}

function activateWarpSpeed() {
  if ($("#warp-canvas")) return;

  const isMobile = window.innerWidth < 768;
  const canvas = document.createElement("canvas");
  canvas.id = "warp-canvas";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
  let width = 0;
  let height = 0;
  let centerX = 0;
  let centerY = 0;
  let active = true;
  let speed = isMobile ? 34 : 46;
  const stars = [];
  const starCount = isMobile ? 180 : 420;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    centerX = width / 2;
    centerY = height / 2;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
  }

  function resetStar(star) {
    star.x = (Math.random() - 0.5) * width * 2;
    star.y = (Math.random() - 0.5) * height * 2;
    star.z = Math.random() * width;
    star.pz = star.z;
  }

  resize();
  for (let i = 0; i < starCount; i += 1) {
    const star = {};
    resetStar(star);
    stars.push(star);
  }

  window.addEventListener("resize", resize, { passive: true });

  function animate() {
    if (!active) return;
    ctx.clearRect(0, 0, width, height);
    speed = Math.max(0.18, speed * 0.969);
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(0.6, speed / (isMobile ? 18 : 13));

    stars.forEach((star) => {
      star.pz = star.z;
      star.z -= speed * 1.8;
      if (star.z <= 1) resetStar(star);

      const sx = (star.x / star.z) * width + centerX;
      const sy = (star.y / star.z) * height + centerY;
      const px = (star.x / star.pz) * width + centerX;
      const py = (star.y / star.pz) * height + centerY;

      if (speed > 2) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.4, (1 - star.z / width) * 1.6), 0, Math.PI * 2);
        ctx.fill();
      }
    });

    requestAnimationFrame(animate);
  }

  canvas.style.opacity = "0";
  canvas.style.transition = "opacity 0.5s ease";
  requestAnimationFrame(() => { canvas.style.opacity = "1"; });
  animate();

  window.setTimeout(() => {
    canvas.style.opacity = "0";
    window.setTimeout(() => {
      active = false;
      canvas.remove();
      window.removeEventListener("resize", resize);
    }, 1200);
  }, 3300);
}

// =====================================
// PARTICLES.JS INIT
// =====================================
if (window.particlesJS) {
  particlesJS("particles-js", {
    "particles": {
      "number": { "value": 80, "density": { "enable": true, "value_area": 800 } },
      "color": { "value": "#ffffff" },
      "shape": { "type": "circle" },
      "opacity": { "value": 0.3, "random": false },
      "size": { "value": 2, "random": true },
      "line_linked": {
        "enable": true,
        "distance": 150,
        "color": "#a855f7",
        "opacity": 0.2,
        "width": 1
      },
      "move": {
        "enable": true,
        "speed": 1.5,
        "direction": "none",
        "random": false,
        "straight": false,
        "out_mode": "out",
        "bounce": false
      }
    },
    "interactivity": {
      "detect_on": "window",
      "events": {
        "onhover": { "enable": true, "mode": "grab" },
        "onclick": { "enable": true, "mode": "push" },
        "resize": true
      },
      "modes": {
        "grab": { "distance": 180, "line_linked": { "opacity": 0.6 } },
        "push": { "particles_nb": 4 }
      }
    },
    "retina_detect": true
  });
}
// =====================================
// NAV SCROLL LOGIKA
// =====================================
window.addEventListener("scroll", () => {
  const nav = document.querySelector(".top-nav");
  if (nav) {
    if (window.scrollY > 50) {
      nav.classList.add("nav-scrolled");
    } else {
      nav.classList.remove("nav-scrolled");
    }
  }
}, { passive: true });
