const cursor = document.getElementById("custom-cursor");
document.addEventListener("mousemove", _0x26145b => {
  cursor.style.left = _0x26145b.clientX + "px";
  cursor.style.top = _0x26145b.clientY + "px";
});
document.addEventListener("mousedown", () => cursor.classList.add("clicking"));
document.addEventListener("mouseup", () => cursor.classList.remove("clicking"));
document.querySelectorAll("a, button, input").forEach(_0x536370 => {
  _0x536370.addEventListener("mouseenter", () => cursor.classList.add("hovering"));
  _0x536370.addEventListener("mouseleave", () => cursor.classList.remove("hovering"));
});
document.addEventListener("contextmenu", _0x4ac501 => _0x4ac501.preventDefault());
document.addEventListener("keydown", _0x2da47e => {
  if (_0x2da47e.key === "F12" || _0x2da47e.ctrlKey && _0x2da47e.shiftKey && (_0x2da47e.key === "I" || _0x2da47e.key === "J") || _0x2da47e.ctrlKey && _0x2da47e.key === "u") {
    _0x2da47e.preventDefault();
  }
});
const initSpace = () => {
  // Inicializáljuk a Vanta.js Halo effektet
  if (typeof VANTA !== 'undefined') {
    VANTA.HALO({
      el: "#starfield-canvas",
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200.00,
      minWidth: 200.00,
      baseColor: 0x0,
      backgroundColor: 0x030305,
      amplitudeFactor: 1.50,
      xOffset: 0.1,
      yOffset: 0.1,
      size: 1.2
    });
  }
};

// Terminál gomb logika
document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      document.getElementById('welcome-overlay').style.opacity = '0';
      setTimeout(() => {
        document.getElementById('welcome-overlay').style.display = 'none';
        const audio = document.getElementById("bg-music");
        if(audio) audio.play().catch(e => console.log("Audio autoplay prevented"));
      }, 500);
    });
  }
});
function formatTime(_0x51fd69) {
  if (isNaN(_0x51fd69)) {
    return "0:00";
  }
  const _0x660c74 = Math.floor(_0x51fd69 / 60);
  const _0x451959 = Math.floor(_0x51fd69 % 60);
  return _0x660c74 + ":" + (_0x451959 < 10 ? "0" : "") + _0x451959;
}
const DISCORD_ID = "1095731086513930260";
let discordHandle = "Szaby";
let gameStartTime = null;
let spotifyData = null;
let lastKnownActivityHTML = "";
async function updateData() {
  try {
    const _0x57e1dc = await fetch("https://api.lanyard.rest/v1/users/" + DISCORD_ID);
    const _0x9eb0bc = await _0x57e1dc.json();
    if (_0x9eb0bc.success) {
      const _0x466a86 = _0x9eb0bc.data;
      const _0x4ac4f5 = _0x466a86.discord_user;
      discordHandle = _0x4ac4f5.username + (_0x4ac4f5.discriminator !== "0" ? "#" + _0x4ac4f5.discriminator : "");
      document.getElementById("d-name").innerText = _0x4ac4f5.global_name || _0x4ac4f5.username;
      document.getElementById("d-avatar").src = "https://cdn.discordapp.com/avatars/" + DISCORD_ID + "/" + _0x4ac4f5.avatar + ".png";
      const _0x3b604a = {
        online: "#22c55e",
        idle: "#eab308",
        dnd: "#ef4444",
        offline: "#6b7280"
      };
      document.getElementById("d-status-dot").style.backgroundColor = _0x3b604a[_0x466a86.discord_status] || "#6b7280";
      const _0x28342b = _0x466a86.activities.find(_0x5e73bc => _0x5e73bc.type === 4);
      let _0x4d6aba = _0x28342b ? _0x28342b.state || "Online" : _0x466a86.discord_status.toUpperCase();
      document.getElementById("d-custom-status").innerText = _0x4d6aba;
      let _0xeee3d7 = "";
      const _0x5593a3 = _0x466a86.activities.find(_0x22e802 => _0x22e802.type === 0 || _0x22e802.type === 1);
      if (_0x5593a3) {
        if (!gameStartTime || _0x5593a3.timestamps?.start && _0x5593a3.timestamps.start !== gameStartTime) {
          gameStartTime = _0x5593a3.timestamps?.start || null;
        }
        let _0x4609b6 = _0x5593a3.assets?.large_image ? _0x5593a3.assets.large_image.startsWith("mp:") ? _0x5593a3.assets.large_image.replace(/mp:external\/([^\/]*)\/(https?)(:|\/)/, "$2:/") : "https://cdn.discordapp.com/app-assets/" + _0x5593a3.application_id + "/" + _0x5593a3.assets.large_image + ".png" : "https://placehold.co/50x50/000/fff?text=GAME";
        _0xeee3d7 += "\n                <div class=\"activity-item game\">\n                    <img src=\"" + _0x4609b6 + "\" class=\"w-10 h-10 rounded bg-gray-800 object-cover\">\n                    <div class=\"flex-1 min-w-0\">\n                        <p class=\"text-xs font-bold text-white truncate\">" + _0x5593a3.name + "</p>\n                        <p class=\"text-[10px] text-[#00f3ff] truncate\">" + (_0x5593a3.state || "Játékban") + "</p>\n                        <p id=\"game-timer-display\" class=\"text-[10px] text-gray-400 font-mono mt-1\">...</p>\n                    </div>\n                    <i class=\"fas fa-gamepad text-[#00f3ff]\"></i>\n                </div>";
      } else {
        gameStartTime = null;
      }
      if (_0x466a86.listening_to_spotify) {
        const _0x3e27d7 = _0x466a86.spotify;
        spotifyData = _0x3e27d7;
        _0xeee3d7 += "\n                <div class=\"activity-item spotify\" data-song-id=\"" + _0x3e27d7.track_id + "\">\n                    <div class=\"flex items-center gap-3\">\n                        <img src=\"" + _0x3e27d7.album_art_url + "\" class=\"w-10 h-10 rounded bg-gray-800 object-cover\">\n                        <div class=\"flex-1 min-w-0\">\n                            <p class=\"text-xs font-bold text-white truncate\">" + _0x3e27d7.song + "</p>\n                            <p class=\"text-[10px] text-[#1db954] truncate\">" + _0x3e27d7.artist + "</p>\n                        </div>\n                        <i class=\"fab fa-spotify text-[#1db954]\"></i>\n                    </div>\n                    <div class=\"spotify-bar-container\">\n                        <div id=\"discord-spotify-bar\" class=\"spotify-bar-fill\"></div>\n                    </div>\n                    <div class=\"spotify-time-labels\">\n                        <span id=\"discord-spotify-curr\">0:00</span>\n                        <span id=\"discord-spotify-end\">0:00</span>\n                    </div>\n                </div>";
      } else {
        spotifyData = null;
      }
      if (_0xeee3d7 === "") {
        _0xeee3d7 = "<div class=\"py-2 text-center text-xs text-gray-500 italic\">Jelenleg inaktív...</div>";
      }
      let _0x18673d = true;
      if (lastKnownActivityHTML === _0xeee3d7) {
        _0x18673d = false;
      }
      const _0x448e1a = document.querySelector(".activity-item.spotify");
      if (_0x448e1a && _0x466a86.listening_to_spotify && _0x448e1a.getAttribute("data-song-id") === _0x466a86.spotify.track_id && lastKnownActivityHTML === _0xeee3d7) {
        _0x18673d = false;
      }
      if (_0x18673d) {
        document.getElementById("activity-list").innerHTML = _0xeee3d7;
        lastKnownActivityHTML = _0xeee3d7;
      }
    }
  } catch (_0x28d18f) {
    console.log(_0x28d18f);
  }
}
setInterval(() => {
  document.getElementById("local-clock").innerText = new Date().toLocaleTimeString("hu-HU");
  if (gameStartTime) {
    const _0x3ca198 = Math.floor((Date.now() - gameStartTime) / 1000);
    const _0x22d949 = document.getElementById("game-timer-display");
    if (_0x22d949) {
      _0x22d949.innerText = formatTime(_0x3ca198) + " ideje";
    }
  }
  if (spotifyData) {
    const _0x12f199 = spotifyData.timestamps.start;
    const _0x3964c5 = spotifyData.timestamps.end;
    const _0x44c92a = Date.now();
    if (_0x3964c5 > _0x12f199) {
      const _0x1eebcc = _0x3964c5 - _0x12f199;
      const _0x49f2a2 = _0x44c92a - _0x12f199;
      const _0x409075 = Math.min(_0x49f2a2 / _0x1eebcc * 100, 100);
      const _0xb1e2d4 = document.getElementById("discord-spotify-bar");
      const _0x166021 = document.getElementById("discord-spotify-curr");
      const _0x105203 = document.getElementById("discord-spotify-end");
      if (_0xb1e2d4) {
        _0xb1e2d4.style.width = _0x409075 + "%";
      }
      if (_0x166021) {
        _0x166021.innerText = formatTime(_0x49f2a2 / 1000);
      }
      if (_0x105203) {
        _0x105203.innerText = formatTime(_0x1eebcc / 1000);
      }
    }
  }
}, 1000);
function copyDiscord() {
  navigator.clipboard.writeText(discordHandle).then(() => alert("Discord név másolva!")).catch(() => {});
}
const playlist = [{
  title: "UP DOWN",
  artist: "Dyce",
  src: "https://files.catbox.moe/o0rcu1.mp3"
}, {
  title: "Night Drift",
  artist: "SYSTEM",
  src: "https://commondatastorage.googleapis.com/codeskulptor-demos/riceracer_assets/music/race2.ogg"
}, {
  title: "Ambient Core",
  artist: "LOFI",
  src: "https://commondatastorage.googleapis.com/codeskulptor-demos/pyman_assets/ateapill.ogg"
}];
let trackIdx = 0;
const audio = document.getElementById("bg-music");
function loadTrack(_0x24fd54) {
  const _0x317f7c = playlist[_0x24fd54];
  audio.src = _0x317f7c.src;
  document.getElementById("track-title").innerText = _0x317f7c.title;
  document.getElementById("track-artist").innerText = _0x317f7c.artist;
}
document.getElementById("play-btn").addEventListener("click", () => {
  const _0x49afed = document.getElementById("play-btn");
  if (audio.paused) {
    audio.play();
    _0x49afed.innerHTML = "<i class=\"fas fa-pause\"></i>";
  } else {
    audio.pause();
    _0x49afed.innerHTML = "<i class=\"fas fa-play\"></i>";
  }
});
document.getElementById("next-btn").addEventListener("click", () => {
  trackIdx = (trackIdx + 1) % playlist.length;
  loadTrack(trackIdx);
  audio.play();
});
document.getElementById("prev-btn").addEventListener("click", () => {
  trackIdx = (trackIdx - 1 + playlist.length) % playlist.length;
  loadTrack(trackIdx);
  audio.play();
});
audio.addEventListener("timeupdate", () => {
  if (audio.duration) {
    const _0x408677 = audio.currentTime / audio.duration * 100;
    document.getElementById("music-bar").style.width = _0x408677 + "%";
    document.getElementById("current-time").innerText = formatTime(audio.currentTime);
    document.getElementById("total-time").innerText = formatTime(audio.duration);
  }
});
audio.volume = 0.2;
document.getElementById("volume-slider").addEventListener("input", _0x267eb7 => audio.volume = _0x267eb7.target.value);
function countVisitor() {
  fetch("/api/counter").then(_0x269003 => _0x269003.json()).then(_0x3d4a78 => document.getElementById("visit-count").innerText = _0x3d4a78.count).catch(() => {});
}
window.onload = () => {
  initSpace();
  updateData();
  setInterval(updateData, 5000);
  loadTrack(0);
  
  const startBtn = document.getElementById("start-btn");

  if(startBtn) {
      startBtn.addEventListener("click", () => {
        const overlay = document.getElementById("welcome-overlay");
        overlay.style.opacity = "0";
        setTimeout(() => overlay.remove(), 500);

        countVisitor();
        audio.play().then(() => {
          document.getElementById("play-btn").innerHTML = "<i class=\"fas fa-pause\"></i>";
        });
      });
  } else {
      countVisitor();
  }
};

document.addEventListener("dragstart", function (_0x5c36b3) {
  _0x5c36b3.preventDefault();
  return false;
});