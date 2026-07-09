// ==========================================
// OLDAL BETÖLTÉS ÉRTESÍTŐ (DISCORD WEBHOOK)
// ==========================================
(function sendPageVisitNotification() {
  try {
    fetch('/api/oldal-latogatas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: window.location.pathname,
        ua: navigator.userAgent,
        lang: navigator.language,
        ref: document.referrer || ''
      })
    }).catch(() => {});
  } catch(e) {}
})();

// ==========================================
// ULTIMATE ANTI-SKID PROTECTION v2
// ==========================================

// 1. Framebusting (Iframe védelem)
if (window.top !== window.self) {
    window.top.location = window.self.location;
}

// 6. Esemény jelentése a szervernek (ELŐSZÖR DEFINIÁLJUK!)
function reportBadActivity(_0x3bb2ef) {
  try {
      const _0x597c4b = window.location.pathname;
      const _0x3debf6 = {
        reason: _0x3bb2ef,
        page: _0x597c4b
      };
      fetch("/api/biztonsagi-naplo-v1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(_0x3debf6)
      })
      .then(r => r.json())
      .then(data => {
          if (data && data.banned) {
              window.location.replace('/banned-scraper.html');
          }
      })
      .catch(e => {});
  } catch (e) {}
}

// ==========================================
// DEVTOOLS-DETECTOR LIBRARY INTEGRÁCIÓ
// A js-devtools-detector.js-t lokálisan tároljuk!
// ==========================================
(function initDevtoolsDetector() {
    // Megvárjuk hogy a devtoolsDetector globális változó elérhető legyen
    if (typeof devtoolsDetector === 'undefined') {
        // Ha nincs betöltve a library → blokkolva lett → tiltás
        console && console.warn && console.warn('devtools-detector hiányzik!');
        // Átirányítás a tiltott oldalra (script blokkolva)
        document.documentElement.style.cssText = 'display:none!important';
        setTimeout(() => { window.location.replace('/banned-scraper.html'); }, 100);
        return;
    }

    // devtoolsDetector aktiválása
    devtoolsDetector.addListener(function(isOpen, detail) {
        if (isOpen) {
            // DevTools nyitva van → AZONNALI átirányítás, semmi késleltetés!
            window.location.replace('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        }
    });

    // Indítás 500ms-es ellenőrzési időközzel (alapértelmezett)
    devtoolsDetector.launch();
})();

// 2. Kiegészítő DevTools Detektor Timer (debugger alapú – régi módszer, most is fut)
let devtoolsOpen = false;
const devtoolsCheck = setInterval(() => {
    const start = performance.now();
    debugger;
    const end = performance.now();
    if (end - start > 100) {
        devtoolsOpen = true;
        reportBadActivity("Debugger/DevTools detektálva (időzítés)");
        window.location.replace('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    }
}, 1000);

// 3. Konzol tiltása / törlése
Object.defineProperty(window, 'console', {
    get: function() {
        reportBadActivity("Konzol hozzáférés blokkolva");
        return {
            log: function(){},
            warn: function(){},
            error: function(){},
            info: function(){},
            table: function(){},
            clear: function(){}
        };
    }
});

// 3B. DevTools Resize Detector eltávolítva az ablakméretezési tiltások elkerülése végett

// 3C. DOM Tampering Detection (Script törlés elleni védelem)
// Ellenőrzi, hogy az extra.js ÉS a js-devtools-detector.js script tagek megvannak-e
setInterval(() => {
    const scriptTags = document.querySelectorAll('script[src]');
    let foundExtra = false;
    let foundDetector = false;
    
    scriptTags.forEach(s => {
        if (s.src && s.src.includes('extra.js')) foundExtra = true;
        if (s.src && s.src.includes('js-devtools-detector.js')) foundDetector = true;
    });

    if (!foundExtra || !foundDetector) {
        // Ha kitörölték a script tageket a DOM-ból → befagyasztás!
        document.documentElement.style.cssText = 'display:none!important';
        setTimeout(() => { window.location.replace('/banned-scraper.html'); }, 100);
    }
}, 3000);

// 3D. PrintScreen Blokkoló (Képernyőkép lopás ellen)
document.addEventListener("keyup", (e) => {
    if (e.key === "PrintScreen") {
        navigator.clipboard.writeText("Lopás elleni védelem aktív! Képernyőkép nem engedélyezett.");
        reportBadActivity("PrintScreen (Képernyőkép) gomb lenyomva");
        document.body.style.display = "none";
        setTimeout(() => { document.body.style.display = "block"; }, 2000);
    }
});

// 4. Billentyűparancsok tiltása
document.addEventListener("keydown", _0x57069f => {
  const ctrlOrMeta = _0x57069f.ctrlKey || _0x57069f.metaKey;
  
  if (ctrlOrMeta && _0x57069f.key === "u") {
    _0x57069f.preventDefault();
    reportBadActivity("Ctrl+U (forráskód) blokkolva");
  }
  if (ctrlOrMeta && _0x57069f.shiftKey && _0x57069f.key === "I") {
    _0x57069f.preventDefault();
    reportBadActivity("Ctrl+Shift+I (DevTools) blokkolva");
  }
  if (ctrlOrMeta && _0x57069f.shiftKey && _0x57069f.key === "J") {
    _0x57069f.preventDefault();
    reportBadActivity("Ctrl+Shift+J (DevTools) blokkolva");
  }
  if (ctrlOrMeta && _0x57069f.shiftKey && _0x57069f.key === "C") {
    _0x57069f.preventDefault();
    reportBadActivity("Ctrl+Shift+C (DevTools) blokkolva");
  }
  if (_0x57069f.key === "F12") {
    _0x57069f.preventDefault();
    reportBadActivity("F12 (DevTools) blokkolva");
  }
  if (ctrlOrMeta && _0x57069f.key === "s") {
    _0x57069f.preventDefault();
    reportBadActivity("Ctrl+S (mentés) blokkolva");
  }
  if (ctrlOrMeta && _0x57069f.key === "p") {
    _0x57069f.preventDefault();
    reportBadActivity("Ctrl+P (nyomtatás) blokkolva");
  }
});

// 5. Jobb klikk tiltása
document.addEventListener("contextmenu", _0x440092 => {
  _0x440092.preventDefault();
  reportBadActivity("Jobb kattintás blokkolva");
});
