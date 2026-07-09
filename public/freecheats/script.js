document.addEventListener("dragstart", function (_0x5873ec) {
  _0x5873ec.preventDefault();
  return false;
});
const games = [{
  id: "gta5-legacy",
  category: "GTA5",
  title: "GTA 5 Legacy",
  version: "Christmas Nightly Build",
  image: "https://img.gurugamer.com/resize/1200x-/photo_galleries/2024/09/25/yimmenu-shut-down-2-086d.png",
  videoUrl: "https://drive.google.com/file/d/1UPqOA7MucdGjohP4kWSjelgeLWlR1Uch/preview",
  description: "A klasszikus YimMenu ünnepi kiadása. Stabil működés és megbízható védelem a havas Los Santosban.",
  status: "UNDETECTED",
  statusColor: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  features: ["Protection", "Lua Loader", "Snow Mode"],
  links: {
    download: "https://github.com/Mr-X-GTA/YimMenu/releases/download/nightly/YimMenu.dll",
    fsl: "https://files.catbox.moe/mpkr24.rar",
    injector: "https://files.catbox.moe/d321k2.zip"
  }
}, {
  id: "gta5-enhanced",
  category: "GTA5",
  title: "GTA V Enhanced",
  version: "v2.0 Winter Update",
  image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSxpcTcoDKXRkQoTt67rqoRY5u2KpfPhjiY2BWpPbq_cg&s=10",
  videoUrl: "https://drive.google.com/file/d/1E7VPEIJfq2H48BpGaWAqFGRtDr3SA_oW/preview",
  description: "Felturbózott élmény. Mostantól extra karácsonyi járművekkel és ajándék spawnolással.",
  status: "UNDETECTED",
  statusColor: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  features: ["Visual FX", "Vehicle Mods", "Gift Spawner"],
  links: {
    download: "https://github.com/Deadlineem/ChronixV2/releases/download/nightly/ChronixV2.dll",
    fsl: "https://files.catbox.moe/mpkr24.rar",
    injector: "https://files.catbox.moe/d321k2.zip"
  }
}, {
  id: "rdr2-terminus",
  category: "RDR2",
  title: "RDR2 Terminus",
  version: "North Pole Edition",
  image: "https://i.imgur.com/lrsUG1D.png",
  videoUrl: "https://drive.google.com/file/d/169ONbZdq3b2sLy9dyjCGzu-LL3PBYdxj/preview",
  description: "A vadnyugat téli arca. Végtelen lőszer, arany spawnolás és repülő szán mód.",
  status: "UNDETECTED",
  statusColor: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  features: ["Gold Spawner", "No Clip", "God Mode"],
  links: {
    download: "https://files.catbox.moe/ynhjuu.zip",
    fsl: null,
    injector: null
  }
}];
document.addEventListener("DOMContentLoaded", function () {
  const _0x3c478e = document.getElementById("year");
  if (_0x3c478e) {
    _0x3c478e.textContent = new Date().getFullYear();
  }
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
  renderGames("ALL");
});
function closeWarning() {
  document.getElementById("warningPopup").style.display = "none";
}
function renderGames(_0x37c37c) {
  const _0x5c5520 = document.getElementById("gamesGrid");
  if (!_0x5c5520) {
    return;
  }
  _0x5c5520.innerHTML = "";
  const _0x4f493c = _0x37c37c === "ALL" ? games : games.filter(_0x4762c7 => _0x4762c7.category === _0x37c37c);
  _0x4f493c.forEach((_0x335bd6, _0x154d02) => {
    const _0xaf1878 = document.createElement("div");
    _0xaf1878.className = "glass-card rounded-2xl overflow-hidden cursor-pointer group fade-in-up";
    _0xaf1878.style.animationDelay = _0x154d02 * 0.1 + "s";
    _0xaf1878.onclick = () => openModal(_0x335bd6.id);
    let _0xf90a83 = _0x335bd6.features.map(_0xa92f53 => "<span class=\"text-[10px] font-bold px-2 py-1 rounded bg-white/5 text-gray-300 border border-white/5 flex items-center gap-1\"><i data-lucide=\"check\" class=\"w-3 h-3 text-emerald-500\"></i> " + _0xa92f53 + "</span>").join("");
    _0xaf1878.innerHTML = "\n            <div class=\"relative h-52 overflow-hidden\">\n                <div class=\"absolute inset-0 bg-black/40 z-10 group-hover:bg-black/20 transition-colors\"></div>\n                <img src=\"" + _0x335bd6.image + "\" class=\"w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700\">\n                <div class=\"absolute top-3 left-3 z-20\"><span class=\"px-2 py-1 text-[10px] font-bold uppercase rounded border backdrop-blur-md " + _0x335bd6.statusColor + "\">" + _0x335bd6.status + "</span></div>\n                <div class=\"absolute inset-0 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity\"><div class=\"w-12 h-12 bg-white/10 backdrop-blur rounded-full flex items-center justify-center border border-white/20\"><i data-lucide=\"play\" class=\"w-5 h-5 text-white ml-1\"></i></div></div>\n            </div>\n            <div class=\"p-5\"><h3 class=\"text-xl font-bold text-white mb-1 group-hover:text-sky-400 transition-colors font-heading\">" + _0x335bd6.title + "</h3><p class=\"text-xs text-gray-500 font-mono mb-4\">" + _0x335bd6.version + "</p><div class=\"flex flex-wrap gap-2 mb-4\">" + _0xf90a83 + "</div></div>\n        ";
    _0x5c5520.appendChild(_0xaf1878);
  });
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}
function filterGames(_0x36cf99, _0x5edf21) {
  document.querySelectorAll(".category-btn").forEach(_0x57f80 => {
    _0x57f80.className = "category-btn px-5 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-all";
  });
  _0x5edf21.className = "category-btn active px-5 py-2 rounded-lg text-sm font-bold bg-white/10 text-white shadow-sm transition-all";
  renderGames(_0x36cf99);
}
function openModal(_0x47ebe9) {
  const _0x1f3543 = games.find(_0x3c6982 => _0x3c6982.id === _0x47ebe9);
  if (!_0x1f3543) {
    return;
  }
  document.getElementById("modalTitle").textContent = _0x1f3543.title;
  document.getElementById("modalVersion").textContent = _0x1f3543.version;
  document.getElementById("modalDescription").textContent = _0x1f3543.description;
  document.getElementById("modalVideo").src = _0x1f3543.videoUrl;
  const _0xaded33 = document.getElementById("modalStatus");
  _0xaded33.textContent = _0x1f3543.status;
  _0xaded33.className = "text-[10px] font-bold uppercase tracking-wider mb-2 block " + _0x1f3543.statusColor.split(" ")[0];
  const _0x29ffa9 = document.getElementById("btnDownload");
  const _0x172b44 = document.getElementById("extraButtons");
  _0x29ffa9.onclick = _0x2c4df3 => dl(_0x2c4df3, _0x1f3543.links.download, _0x1f3543.id + ".dll");
  if (_0x1f3543.links.fsl || _0x1f3543.links.injector) {
    _0x172b44.classList.remove("hidden");
    document.getElementById("btnFsl").onclick = _0x276541 => dl(_0x276541, _0x1f3543.links.fsl, "fsl.rar");
    document.getElementById("btnInjector").onclick = _0x2fdccf => dl(_0x2fdccf, _0x1f3543.links.injector, "injector.zip");
    document.getElementById("btnFsl").style.display = _0x1f3543.links.fsl ? "flex" : "none";
    document.getElementById("btnInjector").style.display = _0x1f3543.links.injector ? "flex" : "none";
  } else {
    _0x172b44.classList.add("hidden");
  }
  document.getElementById("downloadModal").style.display = "flex";
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}
function closeModal() {
  document.getElementById("downloadModal").style.display = "none";
  document.getElementById("modalVideo").src = "";
}
function dl(_0xd453b1, _0x342e2c, _0x4abdc8) {
  _0xd453b1.preventDefault();
  if (!_0x342e2c) {
    return;
  }
  const _0x1ac0c9 = document.createElement("a");
  _0x1ac0c9.href = _0x342e2c;
  _0x1ac0c9.download = _0x4abdc8;
  document.body.appendChild(_0x1ac0c9);
  _0x1ac0c9.click();
  document.body.removeChild(_0x1ac0c9);
}