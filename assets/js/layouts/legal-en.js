/* LegalType Web Keyboard — US QWERTY + Legal AltGr layer
 *
 * Each key spec:
 *   { code, base, shift, altgr, altgrShift?, label?, width?, mod? }
 *
 * - `code` matches KeyboardEvent.code so physical keys map cleanly.
 * - `base`   is what the key produces with no modifiers.
 * - `shift`  is what it produces with Shift held.
 * - `altgr`  is what it produces with AltGr (Right Alt) held — this is
 *            the "legal" layer, mirroring the desktop LegalType app.
 * - `mod`    flags the key as a modifier (Shift / Ctrl / Alt / AltGr / etc.)
 *            so the keyboard renderer styles it as a control key.
 */
(function (global) {
  "use strict";

  const KEY = (code, base, shift, altgr, extras = {}) => Object.assign(
    { code, base, shift, altgr }, extras
  );

  const layout = {
    id: "legal-en",
    name: "Legal (US QWERTY)",
    rows: [
      // Row 1 — number row
      [
        KEY("Backquote", "`", "~", null),
        KEY("Digit1", "1", "!", null),
        KEY("Digit2", "2", "@", null),
        KEY("Digit3", "3", "#", null),
        KEY("Digit4", "4", "$", null),
        KEY("Digit5", "5", "%", null),
        KEY("Digit6", "6", "^", null),
        KEY("Digit7", "7", "&", null),
        KEY("Digit8", "8", "*", null),
        KEY("Digit9", "9", "(", null),
        KEY("Digit0", "0", ")", null),
        KEY("Minus", "-", "_", "–"),    // en dash
        KEY("Equal", "=", "+", "≠"),
        KEY("Backspace", "Backspace", "Backspace", "Backspace",
            { label: "⌫ Backspace", width: 2, mod: true }),
      ],
      // Row 2 — QWERTY top
      [
        KEY("Tab", "\t", "\t", "\t",
            { label: "Tab", width: 1.5, mod: true }),
        KEY("KeyQ", "q", "Q", null),
        KEY("KeyW", "w", "W", "₩"),     // Won
        KEY("KeyE", "e", "E", "€"),     // Euro
        KEY("KeyR", "r", "R", "®"),     // Registered
        KEY("KeyT", "t", "T", "™", { altgrShift: "℠" }),  // Trademark / Service Mark
        KEY("KeyY", "y", "Y", "¥"),     // Yen
        KEY("KeyU", "u", "U", null),
        KEY("KeyI", "i", "I", null),
        KEY("KeyO", "o", "O", "˚"),     // Degree
        KEY("KeyP", "p", "P", "π"),     // Pi
        KEY("BracketLeft", "[", "{", null),
        KEY("BracketRight", "]", "}", null),
        KEY("Backslash", "\\", "|", null, { width: 1.5 }),
      ],
      // Row 3 — Caps + home row
      [
        KEY("CapsLock", "CapsLock", "CapsLock", "CapsLock",
            { label: "Caps Lock", width: 1.75, mod: true }),
        KEY("KeyA", "a", "A", "₳"),     // Cardano (per LegalType desktop)
        KEY("KeyS", "s", "S", "§"),     // Section
        KEY("KeyD", "d", "D", "Δ"),     // Delta
        KEY("KeyF", "f", "F", null),
        KEY("KeyG", "g", "G", null),
        KEY("KeyH", "h", "H", null),
        KEY("KeyJ", "j", "J", "✓"),     // Check
        KEY("KeyK", "k", "K", "•"),     // Bullet
        KEY("KeyL", "l", "L", "£"),     // Pound
        KEY("Semicolon", ";", ":", null),
        KEY("Quote", "'", '"', null),
        KEY("Enter", "\n", "\n", "\n",
            { label: "↵ Enter", width: 2.25, mod: true }),
      ],
      // Row 4 — Shift + bottom row
      [
        KEY("ShiftLeft", "Shift", "Shift", "Shift",
            { label: "⇧ Shift", width: 2.25, mod: true }),
        KEY("KeyZ", "z", "Z", "¶"),     // Paragraph
        KEY("KeyX", "x", "X", null),
        KEY("KeyC", "c", "C", "©"),     // Copyright
        KEY("KeyV", "v", "V", null),
        KEY("KeyB", "b", "B", "₿"),     // Bitcoin
        KEY("KeyN", "n", "N", null),
        KEY("KeyM", "m", "M", "µ"),     // Micro
        KEY("Comma", ",", "<", "—", { altgrShift: "–" }),  // em dash / en dash
        KEY("Period", ".", ">", null),
        KEY("Slash", "/", "?", null),
        KEY("ShiftRight", "Shift", "Shift", "Shift",
            { label: "⇧ Shift", width: 2.75, mod: true }),
      ],
      // Row 5 — modifiers + spacebar (no Ctrl — not useful on a web keyboard)
      [
        KEY("AltLeft", "Alt", "Alt", "Alt",
            { label: "Alt", width: 1.25, mod: true }),
        KEY("Space", " ", " ", " ",
            { label: "Space", width: 12.5 }),
        KEY("AltRight", "AltGr", "AltGr", "AltGr",
            { label: "AltGr", width: 1.25, mod: true }),
      ],
    ],
  };

  // Register globally so keyboard.js can find it.
  global.LegalTypeLayouts = global.LegalTypeLayouts || {};
  global.LegalTypeLayouts[layout.id] = layout;
})(window);
