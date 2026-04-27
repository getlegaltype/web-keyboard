/* LegalType Web Keyboard — keyboard renderer + input handler
 *
 * Responsibilities:
 *   - Render an on-screen keyboard from a layout definition.
 *   - Track modifier state (Shift, AltGr, CapsLock).
 *   - Insert characters into the bound textarea on click or physical key.
 *   - Highlight the on-screen key when its physical counterpart is pressed.
 */
(function (global) {
  "use strict";

  const MODIFIER_CODES = new Set([
    "ShiftLeft", "ShiftRight",
    "ControlLeft", "ControlRight",
    "AltLeft", "AltRight",
    "CapsLock",
  ]);

  class Keyboard {
    constructor({ container, target, layout }) {
      this.container = container;
      this.target = target;
      this.layout = layout;

      this.state = {
        shift: false,
        altgr: false,
        capsLock: false,
      };

      // Whether a modifier is currently held on the *physical* keyboard.
      // We track this separately from `state` because `state` can also be
      // toggled by clicking the on-screen modifier (sticky behavior), and
      // we need to know whether to release that sticky toggle after a
      // single keypress consumes it.
      this._physical = { shift: false, altgr: false };

      // code -> button element, so we can highlight physical keypresses.
      this.keyButtons = new Map();

      this._render();
      this._bindClicks();
      this._bindPhysicalKeys();
    }

    setLayout(layout) {
      this.layout = layout;
      this.keyButtons.clear();
      this.container.innerHTML = "";
      this._render();
    }

    /* ---- rendering ------------------------------------------------ */

    _render() {
      for (const row of this.layout.rows) {
        const rowEl = document.createElement("div");
        rowEl.className = "kb-row";
        for (const key of row) {
          rowEl.appendChild(this._renderKey(key));
        }
        this.container.appendChild(rowEl);
      }
      this._refreshGlyphs();
    }

    _renderKey(key) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "kb-key";
      if (key.mod) btn.classList.add("is-mod");
      if (key.width) btn.dataset.width = String(key.width);
      btn.dataset.code = key.code;

      const glyph = document.createElement("span");
      glyph.className = "kb-glyph";
      glyph.textContent = key.label || key.base;
      btn.appendChild(glyph);

      if (key.altgr && !key.mod) {
        const alt = document.createElement("span");
        alt.className = "kb-altgr";
        alt.textContent = key.altgr;
        btn.appendChild(alt);
      }
      if (key.altgrShift && !key.mod) {
        const altS = document.createElement("span");
        altS.className = "kb-altgr-shift";
        altS.textContent = key.altgrShift;
        btn.appendChild(altS);
      }

      this.keyButtons.set(key.code, { el: btn, glyph, spec: key });
      return btn;
    }

    /** Update the visible glyph on each key based on current modifier state. */
    _refreshGlyphs() {
      for (const { el, glyph, spec } of this.keyButtons.values()) {
        if (spec.mod) continue;
        const out = this._resolveOutput(spec);
        // Only update visible glyphs for printable, single characters.
        if (out && out.length === 1 && out !== "\n" && out !== "\t") {
          glyph.textContent = out;
        } else {
          glyph.textContent = spec.label || spec.base;
        }
        // Toggle highlight for active modifiers like CapsLock.
        if (spec.code === "CapsLock") {
          el.classList.toggle("is-toggled", this.state.capsLock);
        }
      }
      // Also reflect held modifiers visually (Shift / AltGr).
      this._reflectMod("ShiftLeft", this.state.shift);
      this._reflectMod("ShiftRight", this.state.shift);
      this._reflectMod("AltRight", this.state.altgr);
    }

    _reflectMod(code, active) {
      const entry = this.keyButtons.get(code);
      if (!entry) return;
      entry.el.classList.toggle("is-toggled", !!active);
    }

    /** Pick the character a given key should produce given current state. */
    _resolveOutput(spec) {
      if (this.state.altgr && this.state.shift && spec.altgrShift) return spec.altgrShift;
      if (this.state.altgr && spec.altgr) return spec.altgr;
      const isUpper = this.state.shift !== this.state.capsLock;
      // CapsLock only flips letters, not punctuation. Detect a letter by
      // base being a single ASCII alpha character.
      const isLetter = /^[a-zA-Z]$/.test(spec.base);
      if (isLetter) {
        return isUpper ? spec.shift : spec.base;
      }
      return this.state.shift ? spec.shift : spec.base;
    }

    /* ---- click handling ------------------------------------------- */

    _bindClicks() {
      this.container.addEventListener("click", (e) => {
        const btn = e.target.closest(".kb-key");
        if (!btn) return;
        const code = btn.dataset.code;
        const entry = this.keyButtons.get(code);
        if (!entry) return;
        this._handleClick(entry.spec);
      });
    }

    _handleClick(spec) {
      switch (spec.code) {
        case "ShiftLeft":
        case "ShiftRight":
          this.state.shift = !this.state.shift;
          this._refreshGlyphs();
          return;
        case "AltRight":
          this.state.altgr = !this.state.altgr;
          this._refreshGlyphs();
          return;
        case "CapsLock":
          this.state.capsLock = !this.state.capsLock;
          this._refreshGlyphs();
          return;
        case "Backspace":
          this._deleteBack();
          return;
        case "Tab":
          this._insert("\t");
          break;
        case "Enter":
          this._insert("\n");
          break;
        default: {
          if (spec.mod) return; // Other modifiers are no-ops on click.
          const out = this._resolveOutput(spec);
          if (out && out.length >= 1) this._insert(out);
        }
      }

      // Click-style sticky modifiers: if user toggled Shift/AltGr by clicking,
      // releasing them after one keypress matches typical on-screen-keyboard UX.
      if (this.state.shift) {
        this.state.shift = false;
        this._refreshGlyphs();
      }
      if (this.state.altgr) {
        this.state.altgr = false;
        this._refreshGlyphs();
      }
    }

    /* ---- physical keyboard ---------------------------------------- */

    _bindPhysicalKeys() {
      const onDown = (e) => {
        const entry = this.keyButtons.get(e.code);
        if (entry) entry.el.classList.add("is-pressed");

        // Track held modifiers so AltGr / Shift layers are reflected on
        // screen even when the user types physically.
        if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
          this._physical.shift = true;
          this.state.shift = true;
          this._refreshGlyphs();
          return;
        }
        if (e.code === "AltRight") {
          this._physical.altgr = true;
          this.state.altgr = true;
          this._refreshGlyphs();
          // On Windows, pressing AltGr also synthesizes a ControlLeft
          // keydown. Prevent the default on AltRight so the browser
          // doesn't fire any Alt-related menu/shortcut behavior while
          // we're using it as a layer modifier.
          e.preventDefault();
          return;
        }
        if (e.code === "CapsLock") {
          // CapsLock state isn't reliably exposed cross-browser via
          // KeyboardEvent — flip it locally for visual feedback.
          this.state.capsLock = !this.state.capsLock;
          this._refreshGlyphs();
          return;
        }

        // If AltGr is active (held physically or toggled via click) and
        // this key has an AltGr-layer binding, intercept the event,
        // suppress whatever the OS would normally type, and insert the
        // layer character. This mirrors what _handleClick does for the
        // virtual keyboard path.
        //
        // Detect physical AltGr two ways: our own _physical flag (set on
        // AltRight keydown) and the event's modifier state. The latter
        // catches the case where AltGr was already held when the page
        // got focus, before we saw its keydown.
        const altgrHeld = this._physical.altgr
          || e.getModifierState("AltGraph")
          // Windows reports AltGr as Ctrl+Alt on the next keypress.
          || (e.ctrlKey && e.altKey);
        if (entry && !entry.spec.mod && (this.state.altgr || altgrHeld)) {
          const shiftActive = this._physical.shift || e.shiftKey;
          if (shiftActive && entry.spec.altgrShift) {
            e.preventDefault();
            this._insert(entry.spec.altgrShift);
            if (!this._physical.altgr && !altgrHeld) {
              this.state.altgr = false;
              this._refreshGlyphs();
            }
            return;
          }
          if (entry.spec.altgr) {
            e.preventDefault();
            this._insert(entry.spec.altgr);
            // If AltGr was a click-sticky toggle (no physical key held),
            // release it now so the next keypress goes back to the base
            // layer — same UX as _handleClick.
            if (!this._physical.altgr && !altgrHeld) {
              this.state.altgr = false;
              this._refreshGlyphs();
            }
            return;
          }
        }

        // If Shift was sticky-toggled by clicking and the user then types
        // a physical key, release the sticky toggle after this keypress
        // (browser handles the actual shifted character itself).
        if (this.state.shift && !this._physical.shift
            && entry && !entry.spec.mod) {
          // Defer so we don't race the keypress.
          setTimeout(() => {
            if (!this._physical.shift) {
              this.state.shift = false;
              this._refreshGlyphs();
            }
          }, 0);
        }
      };

      const onUp = (e) => {
        const entry = this.keyButtons.get(e.code);
        if (entry) entry.el.classList.remove("is-pressed");

        if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
          this._physical.shift = false;
          this.state.shift = false;
          this._refreshGlyphs();
        } else if (e.code === "AltRight") {
          this._physical.altgr = false;
          this.state.altgr = false;
          this._refreshGlyphs();
        }
      };

      window.addEventListener("keydown", onDown);
      window.addEventListener("keyup", onUp);
    }

    /* ---- text manipulation ---------------------------------------- */

    _insert(text) {
      const ta = this.target;
      ta.focus();
      const start = ta.selectionStart ?? ta.value.length;
      const end = ta.selectionEnd ?? ta.value.length;
      ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
      const caret = start + text.length;
      ta.selectionStart = ta.selectionEnd = caret;
    }

    _deleteBack() {
      const ta = this.target;
      ta.focus();
      const start = ta.selectionStart ?? 0;
      const end = ta.selectionEnd ?? 0;
      if (start !== end) {
        ta.value = ta.value.slice(0, start) + ta.value.slice(end);
        ta.selectionStart = ta.selectionEnd = start;
      } else if (start > 0) {
        ta.value = ta.value.slice(0, start - 1) + ta.value.slice(start);
        ta.selectionStart = ta.selectionEnd = start - 1;
      }
    }
  }

  global.LegalTypeKeyboard = Keyboard;
})(window);
