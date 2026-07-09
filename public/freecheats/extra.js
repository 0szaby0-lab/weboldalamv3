document.addEventListener("keydown", _0x57069f => {
  if ((_0x57069f.ctrlKey || _0x57069f.metaKey) && _0x57069f.key === "u") {
    _0x57069f.preventDefault();
    reportBadActivity("Ctrl+U kombináció blokkolva (forráskód megtekintés)");
  }
  if ((_0x57069f.ctrlKey || _0x57069f.metaKey) && _0x57069f.shiftKey && _0x57069f.key === "I") {
    _0x57069f.preventDefault();
    reportBadActivity("Ctrl+Shift+I kombináció blokkolva (fejlesztői eszközök)");
  }
  if ((_0x57069f.ctrlKey || _0x57069f.metaKey) && _0x57069f.shiftKey && _0x57069f.key === "J") {
    _0x57069f.preventDefault();
    reportBadActivity("Ctrl+Shift+J kombináció blokkolva (fejlesztői konzol)");
  }
  if (_0x57069f.key === "F12") {
    _0x57069f.preventDefault();
    reportBadActivity("F12 gomb blokkolva (fejlesztői eszközök)");
  }
  if ((_0x57069f.ctrlKey || _0x57069f.metaKey) && _0x57069f.key === "s") {
    _0x57069f.preventDefault();
    reportBadActivity("Ctrl+S kombináció blokkolva (oldal mentése)");
  }
  if ((_0x57069f.ctrlKey || _0x57069f.metaKey) && _0x57069f.key === "p") {
    _0x57069f.preventDefault();
    reportBadActivity("Ctrl+P kombináció blokkolva (oldal nyomtatása)");
  }
});
document.addEventListener("contextmenu", _0x440092 => {
  _0x440092.preventDefault();
  reportBadActivity("Jobb kattintás blokkolva (kontextus menü)");
});
function reportBadActivity(_0x3bb2ef) {
  const _0x597c4b = window.location.pathname;
  const _0x3debf6 = {
    reason: _0x3bb2ef,
    page: _0x597c4b
  };
  const _0x2e2bdf = _0x3debf6;
  fetch("/api/biztonsagi-naplo-v1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(_0x2e2bdf)
  }).then(_0x1eca2e => _0x1eca2e.json()).then(_0xf0cdea => {
    console.log("Rendszer válasza:", _0xf0cdea);
  }).catch(_0x275847 => {});
}
document.getElementById("acceptBtn").onclick = function () {
  document.getElementById("blockModal").style.display = "none";
  document.getElementById("audio").play();
};
function isDesktop() {
  return window.innerWidth > 768;
}
if (isDesktop()) {
  setInterval(() => {
    const _0xf1f092 = 160;
    if (window.outerWidth - window.innerWidth > _0xf1f092 || window.outerHeight - window.innerHeight > _0xf1f092) {
      window.location.href = "https://www.google.com/hibaoldal.html";
    }
  }, 1000);
}