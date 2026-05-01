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

  // macOS doesn't have a dedicated AltGr key — both Option (⌥) keys behave
  // the same and access the OS-level alternate-character layer. Many Mac
  // laptops don't even have a right Option key. So on Mac we treat *both*
  // AltLeft and AltRight as the AltGr modifier; on Windows / Linux we keep
  // the convention of AltGr == Right Alt only (Left Alt is reserved for
  // app/menu shortcuts).
  const IS_MAC = (() => {
    const nav = global.navigator || {};
    const platform = (nav.userAgentData && nav.userAgentData.platform)
      || nav.platform
      || "";
    return /Mac|iPhone|iPad|iPod/i.test(platform);
  })();

  const ALTGR_CODES = IS_MAC
    ? new Set(["AltLeft", "AltRight"])
    : new Set(["AltRight"]);

  const isAltGrCode = (code) => ALTGR_CODES.has(code);

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

      // Timestamp (ms) until which we should swallow input/composition
      // events on the target. Used to cancel macOS dead-key composition
      // (e.g. Option+E producing both "€" via our handler AND "´" via
      // the OS-level acute-accent dead key). Set whenever we intercept
      // an AltGr keypress and manually insert a character.
      this._suppressInputUntil = 0;

      // code -> button element, so we can highlight physical keypresses.
      this.keyButtons = new Map();

      this._render();
      this._bindClicks();
      this._bindPhysicalKeys();
      this._bindDeadKeySuppression();
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
      glyph.textContent = this._labelFor(key);
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

    /** Pick the on-key label, applying platform-specific overrides. */
    _labelFor(spec) {
      if (IS_MAC) {
        // Mac users know these keys as Option (⌥), not Alt / AltGr.
        if (spec.code === "AltLeft")  return "⌥ Option";
        if (spec.code === "AltRight") return "⌥ Option";
      }
      return spec.label || spec.base;
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
          glyph.textContent = this._labelFor(spec);
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
      // On macOS the left Option key also acts as AltGr, so mirror the
      // toggled state on it for visual feedback.
      if (IS_MAC) this._reflectMod("AltLeft", this.state.altgr);
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
      // On Mac, clicking the on-screen "Alt" key (AltLeft) should also
      // toggle the AltGr layer, since that's how the physical Option key
      // behaves on macOS.
      if (isAltGrCode(spec.code)) {
        this.state.altgr = !this.state.altgr;
        this._refreshGlyphs();
        return;
      }
      switch (spec.code) {
        case "ShiftLeft":
        case "ShiftRight":
          this.state.shift = !this.state.shift;
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
        if (isAltGrCode(e.code)) {
          this._physical.altgr = true;
          this.state.altgr = true;
          this._refreshGlyphs();
          // On Windows, pressing AltGr also synthesizes a ControlLeft
          // keydown. Prevent the default on AltRight (and on AltLeft on
          // macOS, where Option acts as AltGr) so the browser doesn't
          // fire any Alt-related menu/shortcut behavior while we're
          // using it as a layer modifier.
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
          || (e.ctrlKey && e.altKey)
          // macOS: Option (either key) sets altKey but not ctrlKey, and
          // never sets the AltGraph modifier state. Treat altKey alone as
          // AltGr on Mac so that even if we missed the AltLeft/AltRight
          // keydown (e.g. focus changed mid-press) we still apply the
          // AltGr layer.
          || (IS_MAC && e.altKey && !e.metaKey && !e.ctrlKey);
        if (entry && !entry.spec.mod && (this.state.altgr || altgrHeld)) {
          const shiftActive = this._physical.shift || e.shiftKey;
          if (shiftActive && entry.spec.altgrShift) {
            e.preventDefault();
            this._armDeadKeySuppression();
            this._insert(entry.spec.altgrShift);
            if (!this._physical.altgr && !altgrHeld) {
              this.state.altgr = false;
              this._refreshGlyphs();
            }
            return;
          }
          if (entry.spec.altgr) {
            e.preventDefault();
            this._armDeadKeySuppression();
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
        } else if (isAltGrCode(e.code)) {
          this._physical.altgr = false;
          this.state.altgr = false;
          this._refreshGlyphs();
        }
      };

      // Safety net: if the window loses focus while AltGr was held (common
      // on macOS when Cmd-Tabbing or when the OS swallows a keyup), the
      // modifier state can get "stuck". Clear it on blur.
      const onBlur = () => {
        if (this._physical.altgr || this._physical.shift) {
          this._physical.altgr = false;
          this._physical.shift = false;
          this.state.altgr = false;
          this.state.shift = false;
          this._refreshGlyphs();
        }
      };

      window.addEventListener("keydown", onDown);
      window.addEventListener("keyup", onUp);
      window.addEventListener("blur", onBlur);
    }

    /* ---- macOS dead-key suppression ------------------------------- */

    /** Mark a short window during which we should swallow IME/dead-key
     *  input on the target. Called immediately after we intercept an
     *  AltGr keypress and insert the layer character ourselves.
     *
     *  Why: on macOS, several Option+letter combinations are dead keys
     *  (Option+E = ´, Option+U = ¨, Option+I = ˆ, Option+N = ˜,
     *  Option+` = `). When the user holds Option and presses one of
     *  these, two things happen concurrently:
     *    1. our keydown handler inserts the AltGr-layer character (e.g. €);
     *    2. macOS itself starts a composition for the dead-key accent,
     *       which the browser delivers via `compositionstart` /
     *       `beforeinput` (inputType: "insertCompositionText"). Calling
     *       `preventDefault()` on the keydown does NOT cancel that
     *       composition path, so the accent character ends up appended
     *       to our inserted glyph ("€´").
     *  We can cancel it by preventing the `beforeinput` /
     *  `compositionstart` events that fire in the very next tick. */
    _armDeadKeySuppression() {
      this._suppressInputUntil = Date.now() + 120;
    }

    _bindDeadKeySuppression() {
      const shouldSuppress = () => Date.now() < this._suppressInputUntil;

      // beforeinput is the most reliable hook in modern Chromium /
      // WebKit: preventing it stops the composition text from being
      // inserted into the textarea. Only suppress composition-style
      // input — never plain `insertText` from regular typing — so we
      // can't accidentally swallow the user's next keystroke.
      this.target.addEventListener("beforeinput", (e) => {
        if (!shouldSuppress()) return;
        if (e.inputType === "insertCompositionText"
            || e.inputType === "insertReplacementText") {
          e.preventDefault();
        }
      });

      // Belt-and-braces: cancel the composition itself, which also
      // clears macOS's pending dead-key state so the *next* normal
      // keystroke isn't combined with the swallowed accent.
      this.target.addEventListener("compositionstart", (e) => {
        if (shouldSuppress()) e.preventDefault();
      });
      this.target.addEventListener("compositionupdate", (e) => {
        if (shouldSuppress()) e.preventDefault();
      });
      this.target.addEventListener("compositionend", (e) => {
        if (!shouldSuppress()) return;
        e.preventDefault();
        // If the composition still managed to insert characters
        // (Safari sometimes does this even after preventDefault on the
        // earlier events), strip them off the end of the textarea.
        const data = e.data || "";
        if (data && this.target.value.endsWith(data)) {
          const ta = this.target;
          const cut = ta.value.length - data.length;
          ta.value = ta.value.slice(0, cut);
          ta.selectionStart = ta.selectionEnd = cut;
        }
      });
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
