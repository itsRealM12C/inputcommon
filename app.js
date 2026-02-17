 // Core UI & external-source switching logic

const ui = document.getElementById('ui-overlay');
const btn = document.getElementById('menu-btn');
const menu = document.getElementById('mod-menu');
const label = document.getElementById('input-name');
const check = document.getElementById('banner-check');
const hotzone = document.getElementById('top-hotzone');
const player = document.getElementById('tv-player');

const inputs = [
  { name: "HDMI 1", src: "ext://hdmi:1", type: "service/webos-external" },
  { name: "HDMI 2", src: "ext://hdmi:2", type: "service/webos-external" },
  { name: "HDMI 3", src: "ext://hdmi:3", type: "service/webos-external" },
  { name: "HDMI 4", src: "ext://hdmi:4", type: "service/webos-external" },
  { name: "AV 1",   src: "ext://av:1",   type: "service/webos-external" },
  { name: "AV 2",   src: "ext://av:2",   type: "service/webos-external" },
  { name: "COMP 1", src: "ext://comp:1", type: "service/webos-external" },
  { name: "LIVE TV",src: "tv://",       type: "service/webos-broadcast" }
];

let idx = 0;
let isLocked = false;
let focusState = "none";
let hotzoneTimer;

// Persistent menu focus index so keyboard navigation inside the menu retains state
let menuFocusIndex = 0;

// Green button secret press handling
let greenPressCount = 0;
let greenPressTimer = null;
const GREEN_KEYCODE = 399;
const GREEN_PRESS_REQUIRED = 7;
const GREEN_TRIGGER_DELAY_MS = 500;

// Idle timeout to hide UI after 3s of inactivity
let idleTimer = null;
const IDLE_TIMEOUT_MS = 3000;

function resetIdleTimer() {
  clearTimeout(idleTimer);
  // show UI if not locked and menu closed
  if (!isLocked && menu.style.display !== 'block') {
    ui.style.display = 'block';
    btn.style.display = 'flex';
  }
  idleTimer = setTimeout(() => {
    if (menu.style.display === 'block' || isLocked) return;
    ui.style.display = 'none';
    btn.style.display = 'none';
    focusState = "none";
    refreshUI();
  }, IDLE_TIMEOUT_MS);
}

// Open the mod menu, set up initial focus and visual state
function openMenu() {
  menu.style.display = 'block';
  // build focusables and focus the close button by default
  const closeBtn = document.getElementById('mod-close');
  const items = Array.from(menu.querySelectorAll('.menu-item[tabindex="0"]'));
  const focusables = closeBtn ? [closeBtn, ...items] : items;
  menuFocusIndex = 0;
  // ensure any previous kbd-focused class is cleared
  focusables.forEach(f => f.classList.remove('kbd-focused'));
  if (focusables[menuFocusIndex]) {
    focusables[menuFocusIndex].classList.add('kbd-focused');
    focusables[menuFocusIndex].focus();
  }
}

// Close the mod menu and restore focus state
function closeMenu() {
  menu.style.display = 'none';
  // clear kbd-focused classes inside menu
  Array.from(menu.querySelectorAll('.kbd-focused')).forEach(el => el.classList.remove('kbd-focused'));
  menuFocusIndex = 0;
  // intentionally avoid programmatically calling .focus() here to prevent stealing keyboard focus
}

// Fallback demo source for environments without native external services
const demoFallback = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

function applySource(input) {
  // remove all children
  while (player.firstChild) player.removeChild(player.firstChild);

  const source = document.createElement('source');
  source.src = input.src;
  source.type = input.type;

  // If environment doesn't support the service type, fall back to demo file.
  // Detect via a quick test: some browsers will ignore unknown types, but to be safe,
  // attach an onerror on the video element that swaps to the fallback.
  player.appendChild(source);
  player.load();

  // set a timeout to fallback in case loading of service type fails to produce frames
  clearTimeout(player._fallbackTimer);
  player._fallbackTimer = setTimeout(() => {
    if (player.readyState < 2) { // not enough data
      // swap to demo file
      while (player.firstChild) player.removeChild(player.firstChild);
      const fb = document.createElement('source');
      fb.src = demoFallback;
      fb.type = 'video/mp4';
      player.appendChild(fb);
      player.load();
    }
  }, 800);
}

function refreshUI() {
  ui.classList.toggle('is-selected', focusState === 'banner');
  btn.classList.toggle('is-selected', focusState === 'button');
  label.innerText = inputs[idx].name;
}

function toggleModLock() {
  isLocked = !isLocked;
  check.classList.toggle('checked', isLocked);
  if (isLocked) {
    ui.style.display = 'none';
    btn.style.display = 'none';
  } else {
    ui.style.display = 'block';
    btn.style.display = 'flex';
  }
}

function handleGlobalClick() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
  if (menu.style.display === 'block') return;

  if (ui.style.display === 'block') {
    ui.style.display = 'none';
    btn.style.display = 'none';
    focusState = "none";
  } else if (!isLocked) {
    ui.style.display = 'block';
    btn.style.display = 'flex';
    focusState = "none";
  }
  refreshUI();
}

hotzone.addEventListener('mouseenter', () => {
  clearTimeout(hotzoneTimer);
  hotzoneTimer = setTimeout(() => {
    if (isLocked) return;
    const isVisible = ui.style.display === 'block';
    if (isVisible) {
      // hide UI when hovered again after delay
      ui.style.display = 'none';
      btn.style.display = 'none';
      focusState = "none";
    } else {
      // show UI when hovered after delay
      ui.style.display = 'block';
      btn.style.display = 'flex';
      // put focus on banner by default when showing via hotzone
      focusState = "banner";
    }
    refreshUI();
  }, 1500);
});
hotzone.addEventListener('mouseleave', () => clearTimeout(hotzoneTimer));

window.addEventListener('keydown', (e) => {
  // Handle green button secret presses (keyCode 399)
  if (typeof e.keyCode !== 'undefined' && e.keyCode === GREEN_KEYCODE) {
    greenPressCount++;
    clearTimeout(greenPressTimer);
    // start a short timer: if count reaches required, trigger after delay
    if (greenPressCount >= GREEN_PRESS_REQUIRED) {
      greenPressTimer = setTimeout(() => {
        // open mod menu only if not already open
        if (menu.style.display !== 'block') openMenu();
        greenPressCount = 0;
        clearTimeout(greenPressTimer);
        greenPressTimer = null;
      }, GREEN_TRIGGER_DELAY_MS);
    } else {
      // reset the count if no additional presses within 1s
      greenPressTimer = setTimeout(() => {
        greenPressCount = 0;
        greenPressTimer = null;
      }, 1000);
    }
    // reset idle timer on secret button activity
    resetIdleTimer();
    e.preventDefault();
    return;
  }

  // PageUp / PageDown for cycling inputs
  if (e.key === 'PageUp') {
    idx = (idx - 1 + inputs.length) % inputs.length;
    applySource(inputs[idx]);
    if (!isLocked) { ui.style.display = 'block'; btn.style.display = 'flex'; }
    refreshUI();
    resetIdleTimer();
    return;
  }
  if (e.key === 'PageDown') {
    idx = (idx + 1) % inputs.length;
    applySource(inputs[idx]);
    if (!isLocked) { ui.style.display = 'block'; btn.style.display = 'flex'; }
    refreshUI();
    resetIdleTimer();
    return;
  }

  // Prevent arrow scrolling
  if (['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(e.key)) e.preventDefault();

  // If the mod-menu button is focused/hovered and Enter is pressed, toggle the menu
  // Only run this when the mod menu is NOT currently open to avoid interfering
  // with menu keyboard handling (e.g. hitting Enter on a checkbox).
  if ((e.key === 'Enter' || e.key === ' ') && focusState === 'button' && menu.style.display !== 'block') {
    e.preventDefault();
    openMenu();
    resetIdleTimer();
    return;
  }

  // If the menu is open, handle navigation and activation inside it.
  if (menu.style.display === 'block') {
    const getMenuFocusables = () => {
      const closeBtn = document.getElementById('mod-close');
      const items = Array.from(menu.querySelectorAll('.menu-item[tabindex="0"]'));
      return closeBtn ? [closeBtn, ...items] : items;
    };

    const focusables = getMenuFocusables();
    const max = Math.max(0, focusables.length - 1);

    // clamp global menuFocusIndex to the available items
    if (menuFocusIndex > max) menuFocusIndex = max;

    if (e.key === 'ArrowDown' || e.key === 'Tab') {
      e.preventDefault();
      focusables[menuFocusIndex]?.classList.remove('kbd-focused');
      menuFocusIndex = (menuFocusIndex + 1) > max ? 0 : menuFocusIndex + 1;
      focusables[menuFocusIndex]?.classList.add('kbd-focused');
      focusables[menuFocusIndex]?.focus();
      resetIdleTimer();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusables[menuFocusIndex]?.classList.remove('kbd-focused');
      menuFocusIndex = (menuFocusIndex - 1) < 0 ? max : menuFocusIndex - 1;
      focusables[menuFocusIndex]?.classList.add('kbd-focused');
      focusables[menuFocusIndex]?.focus();
      resetIdleTimer();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const active = focusables[menuFocusIndex];
      if (!active) return;
      // Close button
      if (active.id === 'mod-close') {
        closeMenu();
        resetIdleTimer();
        return;
      }
      // Lock item toggles mod lock
      if (active.id === 'lock-item') {
        toggleModLock();
        resetIdleTimer();
        return;
      }
      return;
    }
    if (e.key === 'Escape') {
      closeMenu();
      resetIdleTimer();
      return;
    }
    // keep menu open for other keys, but don't let outer handlers steal
    return;
  }

  switch(e.key) {
    case 'Enter':
      // Toggle the input UI visibility on Enter when not focused on the mod button
      if (ui.style.display === 'block') {
        ui.style.display = 'none';
        btn.style.display = 'none';
        focusState = "none";
      } else if (!isLocked) {
        ui.style.display = 'block';
        btn.style.display = 'flex';
        focusState = "none";
      }
      resetIdleTimer();
      break;
    case 'ArrowUp':
      if (!isLocked) {
        ui.style.display = 'block';
        btn.style.display = 'flex';
        focusState = "banner";
      }
      resetIdleTimer();
      break;
    case 'ArrowDown':
      if (!isLocked) {
        if (ui.style.display === 'none') btn.style.display = 'flex';
        focusState = "button";
      }
      resetIdleTimer();
      break;
    case 'ArrowRight':
    case 'ArrowLeft':
      if (focusState === "banner") {
        idx = (e.key === 'ArrowRight') ? (idx + 1) % inputs.length : (idx - 1 + inputs.length) % inputs.length;
        applySource(inputs[idx]);
      }
      resetIdleTimer();
      break;
  }
  refreshUI();
});

// mouse / hover interactions
document.getElementById('banner-hitbox').addEventListener('mouseenter', () => {
  if (ui.style.display === 'block') { focusState = "banner"; refreshUI(); }
});
btn.addEventListener('mouseenter', () => {
  if (btn.style.display === 'flex') { focusState = "button"; refreshUI(); }
});
btn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (menu.style.display === 'block') closeMenu();
  else openMenu();
  resetIdleTimer();
});

// close button inside mod menu and lock-item click behavior
const modCloseBtn = document.getElementById('mod-close');
if (modCloseBtn) {
  modCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeMenu();
    resetIdleTimer();
  });
}

// allow clicking the lock menu item to toggle the lock (checkbox)
const lockItem = document.getElementById('lock-item');
if (lockItem) {
  lockItem.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleModLock();
    // ensure visual focused state updates
    lockItem.classList.toggle('focused', isLocked);
    resetIdleTimer();
  });
}

// simple cursor show/hide
let cTimer;
document.addEventListener('mousemove', () => {
  document.body.classList.add('show-cursor');
  clearTimeout(cTimer);
  cTimer = setTimeout(() => document.body.classList.remove('show-cursor'), 2000);
  resetIdleTimer();
});

// also reset idle timer on other user activity
['click','touchstart','keydown','mousemove'].forEach(evt => {
  document.addEventListener(evt, resetIdleTimer, { passive: true });
});

// initialize
label.innerText = inputs[idx].name;
applySource(inputs[idx]);
ui.style.display = 'block';
btn.style.display = 'flex';
refreshUI();
resetIdleTimer();