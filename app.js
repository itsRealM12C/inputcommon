 // Core UI & external-source switching logic
// Added compatibility helpers for older browsers (e.g. Chrome 53)

(function () {
  // Safe helpers
  function safeForEach(nodeList, cb) {
    if (!nodeList) return;
    try {
      // NodeList.forEach may not exist on very old engines
      if (typeof nodeList.forEach === 'function') {
        nodeList.forEach(cb);
      } else {
        for (var i = 0; i < nodeList.length; i++) cb(nodeList[i], i);
      }
    } catch (e) {
      for (var j = 0; j < nodeList.length; j++) cb(nodeList[j], j);
    }
  }

  // AddEventListener with fallback for browsers that don't accept options object
  function addListenerSafe(el, evt, handler, opts) {
    try {
      el.addEventListener(evt, handler, opts || false);
    } catch (err) {
      // some old engines throw when passing an options object - fallback to boolean capture
      el.addEventListener(evt, handler, !!(opts && opts.capture));
    }
  }

  // Normalize key input across old browsers (use keyCode fallback)
  function keyName(e) {
    if (!e) return '';
    if (typeof e.key === 'string') {
      // Normalize some vendor differences
      var k = e.key;
      if (k === ' ' || k === 'Spacebar') return 'Space';
      return k;
    }
    // fallback to keyCode mapping
    var kc = e.keyCode || e.which || 0;
    switch (kc) {
      case 13: return 'Enter';
      case 32: return 'Space';
      case 27: return 'Escape';
      case 9:  return 'Tab';
      case 33: return 'PageUp';
      case 34: return 'PageDown';
      case 37: return 'ArrowLeft';
      case 38: return 'ArrowUp';
      case 39: return 'ArrowRight';
      case 40: return 'ArrowDown';
      default: return String.fromCharCode(kc);
    }
  }

  // Query helpers
  var ui = document.getElementById('ui-overlay');
  var btn = document.getElementById('menu-btn');
  var menu = document.getElementById('mod-menu');
  var label = document.getElementById('input-name');
  var check = document.getElementById('banner-check');
  var hotzone = document.getElementById('top-hotzone');
  var player = document.getElementById('tv-player');

  var inputs = [
    { name: "HDMI 1", src: "ext://hdmi:1", type: "service/webos-external" },
    { name: "HDMI 2", src: "ext://hdmi:2", type: "service/webos-external" },
    { name: "HDMI 3", src: "ext://hdmi:3", type: "service/webos-external" },
    { name: "HDMI 4", src: "ext://hdmi:4", type: "service/webos-external" },
    { name: "AV 1",   src: "ext://av:1",   type: "service/webos-external" },
    { name: "AV 2",   src: "ext://av:2",   type: "service/webos-external" },
    { name: "COMP 1", src: "ext://comp:1", type: "service/webos-external" },
    { name: "LIVE TV",src: "tv://",       type: "service/webos-broadcast" }
  ];

  var idx = 0;
  var isLocked = false;
  var focusState = "none";
  var hotzoneTimer;

  var menuFocusIndex = 0;

  var greenPressCount = 0;
  var greenPressTimer = null;
  var GREEN_KEYCODE = 399;
  var GREEN_PRESS_REQUIRED = 7;
  var GREEN_TRIGGER_DELAY_MS = 500;

  var idleTimer = null;
  var IDLE_TIMEOUT_MS = 3000;

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    if (!isLocked && menu && menu.style.display !== 'block') {
      if (ui) ui.style.display = 'block';
      if (btn) btn.style.display = 'flex';
    }
    idleTimer = setTimeout(function () {
      if (!menu) return;
      if (menu.style.display === 'block' || isLocked) return;
      if (ui) ui.style.display = 'none';
      if (btn) btn.style.display = 'none';
      focusState = "none";
      refreshUI();
    }, IDLE_TIMEOUT_MS);
  }

  function openMenu() {
    if (!menu) return;
    menu.style.display = 'block';
    var closeBtn = document.getElementById('mod-close');
    var items = menu.querySelectorSelectorAll ? menu.querySelectorSelectorAll('.menu-item[tabindex="0"]') : menu.querySelectorAll('.menu-item[tabindex="0"]');
    items = Array.prototype.slice.call(menu.querySelectorAll('.menu-item[tabindex="0"]'));
    var focusables = closeBtn ? [closeBtn].concat(items) : items;
    menuFocusIndex = 0;
    safeForEach(focusables, function (f) {
      if (f && f.classList) f.classList.remove('kbd-focused');
    });
    if (focusables[menuFocusIndex]) {
      var el = focusables[menuFocusIndex];
      if (el.classList) el.classList.add('kbd-focused');
      try { el.focus && el.focus(); } catch (e) {}
    }
  }

  function closeMenu() {
    if (!menu) return;
    menu.style.display = 'none';
    var k = menu.querySelectorAll('.kbd-focused');
    safeForEach(k, function (el) {
      if (el.classList) el.classList.remove('kbd-focused');
    });
    menuFocusIndex = 0;
  }

  var demoFallback = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

  function applySource(input) {
    if (!player) return;
    while (player.firstChild) player.removeChild(player.firstChild);

    var source = document.createElement('source');
    source.src = input.src;
    source.type = input.type;

    player.appendChild(source);
    try { player.load(); } catch (e) {}

    clearTimeout(player._fallbackTimer);
    player._fallbackTimer = setTimeout(function () {
      try {
        if (player.readyState < 2) {
          while (player.firstChild) player.removeChild(player.firstChild);
          var fb = document.createElement('source');
          fb.src = demoFallback;
          fb.type = 'video/mp4';
          player.appendChild(fb);
          try { player.load(); } catch (e) {}
        }
      } catch (ex) {}
    }, 800);
  }

  function refreshUI() {
    try {
      if (ui && ui.classList) ui.classList.toggle('is-selected', focusState === 'banner');
      if (btn && btn.classList) btn.classList.toggle('is-selected', focusState === 'button');
      if (label) label.innerText = inputs[idx].name;
    } catch (e) {}
  }

  function toggleModLock() {
    isLocked = !isLocked;
    if (check && check.classList) check.classList.toggle('checked', isLocked);
    if (isLocked) {
      if (ui) ui.style.display = 'none';
      if (btn) btn.style.display = 'none';
    } else {
      if (ui) ui.style.display = 'block';
      if (btn) btn.style.display = 'flex';
    }
  }

  function handleGlobalClick() {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(function () {});
      }
    } catch (e) {}
    if (menu && menu.style.display === 'block') return;

    if (ui && ui.style.display === 'block') {
      ui.style.display = 'none';
      if (btn) btn.style.display = 'none';
      focusState = "none";
    } else if (!isLocked) {
      if (ui) ui.style.display = 'block';
      if (btn) btn.style.display = 'flex';
      focusState = "none";
    }
    refreshUI();
  }

  // Expose to global for inline handlers (older environments / inline onclick)
  try { window.handleGlobalClick = handleGlobalClick; } catch (e) {}

  if (hotzone) {
    addListenerSafe(hotzone, 'mouseenter', function () {
      clearTimeout(hotzoneTimer);
      hotzoneTimer = setTimeout(function () {
        if (isLocked) return;
        var isVisible = ui && ui.style.display === 'block';
        if (isVisible) {
          if (ui) ui.style.display = 'none';
          if (btn) btn.style.display = 'none';
          focusState = "none";
        } else {
          if (ui) ui.style.display = 'block';
          if (btn) btn.style.display = 'flex';
          focusState = "banner";
        }
        refreshUI();
      }, 1500);
    });
    addListenerSafe(hotzone, 'mouseleave', function () { clearTimeout(hotzoneTimer); });
  }

  addListenerSafe(window, 'keydown', function (ev) {
    var e = ev || window.event;
    // Green button secret presses (keyCode 399)
    var kc = e.keyCode || e.which || 0;
    if (kc === GREEN_KEYCODE) {
      greenPressCount++;
      clearTimeout(greenPressTimer);
      if (greenPressCount >= GREEN_PRESS_REQUIRED) {
        greenPressTimer = setTimeout(function () {
          if (menu && menu.style.display !== 'block') openMenu();
          greenPressCount = 0;
          clearTimeout(greenPressTimer);
          greenPressTimer = null;
        }, GREEN_TRIGGER_DELAY_MS);
      } else {
        greenPressTimer = setTimeout(function () {
          greenPressCount = 0;
          greenPressTimer = null;
        }, 1000);
      }
      resetIdleTimer();
      try { e.preventDefault(); } catch (ex) {}
      return;
    }

    var name = keyName(e);

    // PageUp / PageDown for cycling inputs
    if (name === 'PageUp') {
      idx = (idx - 1 + inputs.length) % inputs.length;
      applySource(inputs[idx]);
      if (!isLocked && ui) { ui.style.display = 'block'; if (btn) btn.style.display = 'flex'; }
      refreshUI();
      resetIdleTimer();
      return;
    }
    if (name === 'PageDown') {
      idx = (idx + 1) % inputs.length;
      applySource(inputs[idx]);
      if (!isLocked && ui) { ui.style.display = 'block'; if (btn) btn.style.display = 'flex'; }
      refreshUI();
      resetIdleTimer();
      return;
    }

    // Prevent arrow scrolling for older engines (try/catch)
    if (name === 'ArrowLeft' || name === 'ArrowUp' || name === 'ArrowRight' || name === 'ArrowDown') {
      try { e.preventDefault(); } catch (er) {}
    }

    // Enter on mod button opens menu (only when menu not open)
    if ((name === 'Enter' || name === 'Space') && focusState === 'button' && (!menu || menu.style.display !== 'block')) {
      try { e.preventDefault(); } catch (ex) {}
      openMenu();
      resetIdleTimer();
      return;
    }

    if (menu && menu.style.display === 'block') {
      var getMenuFocusables = function () {
        var closeBtn = document.getElementById('mod-close');
        var items = Array.prototype.slice.call(menu.querySelectorAll('.menu-item[tabindex="0"]'));
        return closeBtn ? [closeBtn].concat(items) : items;
      };

      var focusables = getMenuFocusables();
      var max = Math.max(0, focusables.length - 1);

      if (menuFocusIndex > max) menuFocusIndex = max;

      if (name === 'ArrowDown' || name === 'Tab') {
        try { e.preventDefault(); } catch (err) {}
        if (focusables[menuFocusIndex] && focusables[menuFocusIndex].classList) focusables[menuFocusIndex].classList.remove('kbd-focused');
        menuFocusIndex = (menuFocusIndex + 1) > max ? 0 : menuFocusIndex + 1;
        if (focusables[menuFocusIndex] && focusables[menuFocusIndex].classList) focusables[menuFocusIndex].classList.add('kbd-focused');
        try { focusables[menuFocusIndex] && focusables[menuFocusIndex].focus(); } catch (f) {}
        resetIdleTimer();
        return;
      }
      if (name === 'ArrowUp') {
        try { e.preventDefault(); } catch (err) {}
        if (focusables[menuFocusIndex] && focusables[menuFocusIndex].classList) focusables[menuFocusIndex].classList.remove('kbd-focused');
        menuFocusIndex = (menuFocusIndex - 1) < 0 ? max : menuFocusIndex - 1;
        if (focusables[menuFocusIndex] && focusables[menuFocusIndex].classList) focusables[menuFocusIndex].classList.add('kbd-focused');
        try { focusables[menuFocusIndex] && focusables[menuFocusIndex].focus(); } catch (f) {}
        resetIdleTimer();
        return;
      }
      if (name === 'Enter' || name === 'Space') {
        try { e.preventDefault(); } catch (err) {}
        var active = focusables[menuFocusIndex];
        if (!active) return;
        if (active.id === 'mod-close') {
          closeMenu();
          resetIdleTimer();
          return;
        }
        if (active.id === 'lock-item') {
          toggleModLock();
          resetIdleTimer();
          return;
        }
        return;
      }
      if (name === 'Escape') {
        closeMenu();
        resetIdleTimer();
        return;
      }
      return;
    }

    // global handlers when menu not open
    switch (name) {
      case 'Enter':
        if (ui && ui.style.display === 'block') {
          ui.style.display = 'none';
          if (btn) btn.style.display = 'none';
          focusState = "none";
        } else if (!isLocked) {
          if (ui) ui.style.display = 'block';
          if (btn) btn.style.display = 'flex';
          focusState = "none";
        }
        resetIdleTimer();
        break;
      case 'ArrowUp':
        if (!isLocked) {
          if (ui) ui.style.display = 'block';
          if (btn) btn.style.display = 'flex';
          focusState = "banner";
        }
        resetIdleTimer();
        break;
      case 'ArrowDown':
        if (!isLocked) {
          if (ui && ui.style.display === 'none') { if (btn) btn.style.display = 'flex'; }
          focusState = "button";
        }
        resetIdleTimer();
        break;
      case 'ArrowRight':
      case 'ArrowLeft':
        if (focusState === "banner") {
          idx = (name === 'ArrowRight') ? (idx + 1) % inputs.length : (idx - 1 + inputs.length) % inputs.length;
          applySource(inputs[idx]);
        }
        resetIdleTimer();
        break;
    }
    refreshUI();
  }, false);

  // mouse / hover interactions (safely)
  var bannerHit = document.getElementById('banner-hitbox');
  if (bannerHit) {
    addListenerSafe(bannerHit, 'mouseenter', function () {
      if (ui && ui.style.display === 'block') { focusState = "banner"; refreshUI(); }
    });
  }
  if (btn) {
    addListenerSafe(btn, 'mouseenter', function () {
      if (btn.style.display === 'flex') { focusState = "button"; refreshUI(); }
    });
    addListenerSafe(btn, 'click', function (e) {
      try { e.stopPropagation(); } catch (ex) {}
      if (menu && menu.style.display === 'block') closeMenu();
      else openMenu();
      resetIdleTimer();
    });
  }

  var modCloseBtn = document.getElementById('mod-close');
  if (modCloseBtn) {
    addListenerSafe(modCloseBtn, 'click', function (e) {
      try { e.stopPropagation(); } catch (ex) {}
      closeMenu();
      resetIdleTimer();
    });
  }

  var lockItem = document.getElementById('lock-item');
  if (lockItem) {
    addListenerSafe(lockItem, 'click', function (e) {
      try { e.stopPropagation(); } catch (ex) {}
      toggleModLock();
      try {
        if (lockItem.classList) {
          if (isLocked) lockItem.classList.add('focused'); else lockItem.classList.remove('focused');
        }
      } catch (er) {}
      resetIdleTimer();
    });
  }

  // cursor show/hide
  var cTimer;
  addListenerSafe(document, 'mousemove', function () {
    try { document.body.classList.add('show-cursor'); } catch (e) {}
    clearTimeout(cTimer);
    cTimer = setTimeout(function () { try { document.body.classList.remove('show-cursor'); } catch (e) {} }, 2000);
    resetIdleTimer();
  });

  // reset idle timer on other user activity
  var events = ['click', 'touchstart', 'keydown', 'mousemove'];
  for (var i = 0; i < events.length; i++) {
    addListenerSafe(document, events[i], resetIdleTimer, false);
  }

  // initialize
  try { if (label) label.innerText = inputs[idx].name; } catch (e) {}
  applySource(inputs[idx]);
  if (ui) ui.style.display = 'block';
  if (btn) btn.style.display = 'flex';
  refreshUI();
  resetIdleTimer();

})();