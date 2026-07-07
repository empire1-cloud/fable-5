/* FABLE-5 · Drafting Room controls
   Palette / texture / grid-scale, persisted to localStorage.
   The page renders fully without this script — it only powers the panel. */
(function () {
  'use strict';

  var STORAGE_KEY = 'fable5.draftingRoom';
  var DEFAULTS = { palette: 'cyan', texture: 'graph', grid: 36 };
  var PALETTES = ['cyan', 'mint', 'amber', 'violet'];
  var TEXTURES = ['graph', 'dots', 'plain'];

  var root = document.documentElement;

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      var saved = JSON.parse(raw);
      return {
        palette: PALETTES.indexOf(saved.palette) !== -1 ? saved.palette : DEFAULTS.palette,
        texture: TEXTURES.indexOf(saved.texture) !== -1 ? saved.texture : DEFAULTS.texture,
        grid: clampGrid(saved.grid)
      };
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* private mode / storage disabled — controls still work */ }
  }

  function clampGrid(n) {
    n = parseInt(n, 10);
    if (isNaN(n)) return DEFAULTS.grid;
    return Math.min(64, Math.max(20, Math.round(n / 4) * 4));
  }

  function apply(state) {
    root.setAttribute('data-palette', state.palette);
    root.setAttribute('data-texture', state.texture);
    root.style.setProperty('--grid-size', state.grid + 'px ' + state.grid + 'px');
  }

  function init() {
    var panel = document.getElementById('drafting-room');
    if (!panel) return;

    var state = loadState();
    apply(state);

    var toggle = document.getElementById('dr-toggle');
    var body = document.getElementById('dr-body');
    var slider = document.getElementById('dr-grid');
    var sliderVal = document.getElementById('dr-grid-val');
    var reset = document.getElementById('dr-reset');
    var paletteBtns = panel.querySelectorAll('[data-palette]');
    var textureBtns = panel.querySelectorAll('[data-texture]');

    function syncControls() {
      var i;
      for (i = 0; i < paletteBtns.length; i++) {
        paletteBtns[i].setAttribute('aria-pressed',
          String(paletteBtns[i].getAttribute('data-palette') === state.palette));
      }
      for (i = 0; i < textureBtns.length; i++) {
        textureBtns[i].setAttribute('aria-pressed',
          String(textureBtns[i].getAttribute('data-texture') === state.texture));
      }
      slider.value = state.grid;
      sliderVal.textContent = state.grid + 'px';
    }

    function update(patch) {
      Object.assign(state, patch);
      apply(state);
      syncControls();
      saveState(state);
    }

    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      body.hidden = open;
    });

    var i;
    for (i = 0; i < paletteBtns.length; i++) {
      paletteBtns[i].addEventListener('click', function () {
        update({ palette: this.getAttribute('data-palette') });
      });
    }
    for (i = 0; i < textureBtns.length; i++) {
      textureBtns[i].addEventListener('click', function () {
        update({ texture: this.getAttribute('data-texture') });
      });
    }

    slider.addEventListener('input', function () {
      update({ grid: clampGrid(this.value) });
    });

    reset.addEventListener('click', function () {
      update(Object.assign({}, DEFAULTS));
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
    });

    syncControls();
    panel.hidden = false; // panel is JS-driven; keep it hidden when JS is off
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
