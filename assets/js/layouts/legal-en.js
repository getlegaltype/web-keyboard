/* LegalType Web Keyboard — Legal (US) layout for the SVG keyboard
 *
 * The SVG (assets/svg/keyboard.svg) renders all the visible legends —
 * letters, AltGr symbols, F-row marks, etc. — as vector paths. This
 * layout file says only what each KeyboardEvent.code should _produce_
 * when clicked or pressed, keyed by code:
 *
 *   { base, shift, altgr, mod? }
 *
 * - `base`   is the character produced with no modifiers.
 * - `shift`  is the character produced with Shift.
 * - `altgr`  is the character produced with AltGr (the legal layer,
 *            mirroring the LegalType desktop app).
 * - `mod`    flags pure modifier keys.
 *
 * Keys not listed here fall through to the keyboard renderer's
 * built-in fallbacks (numpad echoes its label, nav cluster is inert).
 */
(function (global) {
  "use strict";

  const M = { mod: true };

  const specs = {
    // Modifiers ------------------------------------------------------
    ShiftLeft:    Object.assign({ base: "Shift",  shift: "Shift",  altgr: "Shift"  }, M),
    ShiftRight:   Object.assign({ base: "Shift",  shift: "Shift",  altgr: "Shift"  }, M),
    ControlLeft:  Object.assign({ base: "Ctrl",   shift: "Ctrl",   altgr: "Ctrl"   }, M),
    ControlRight: Object.assign({ base: "Ctrl",   shift: "Ctrl",   altgr: "Ctrl"   }, M),
    AltLeft:      Object.assign({ base: "Alt",    shift: "Alt",    altgr: "Alt"    }, M),
    AltRight:     Object.assign({ base: "AltGr",  shift: "AltGr",  altgr: "AltGr"  }, M),
    MetaLeft:     Object.assign({ base: "Meta",   shift: "Meta",   altgr: "Meta"   }, M),
    MetaRight:    Object.assign({ base: "Meta",   shift: "Meta",   altgr: "Meta"   }, M),
    ContextMenu:  Object.assign({ base: "Menu",   shift: "Menu",   altgr: "Menu"   }, M),
    CapsLock:     Object.assign({ base: "Caps",   shift: "Caps",   altgr: "Caps"   }, M),
    Tab:          { base: "\t", shift: "\t", altgr: "\t" },
    Enter:        { base: "\n", shift: "\n", altgr: "\n" },
    NumpadEnter:  { base: "\n", shift: "\n", altgr: "\n" },
    Backspace:    Object.assign({ base: "Backspace", shift: "Backspace", altgr: "Backspace" }, M),
    Space:        { base: " ",  shift: " ",  altgr: " " },
    Escape:       Object.assign({ base: "Esc", shift: "Esc", altgr: "Esc" }, M),

    // Alpha — qwerty top row -----------------------------------------
    KeyQ: { base: "q", shift: "Q", altgr: null },
    KeyW: { base: "w", shift: "W", altgr: null },
    KeyE: { base: "e", shift: "E", altgr: "€" },   // Euro
    KeyR: { base: "r", shift: "R", altgr: "®" },   // Registered
    KeyT: { base: "t", shift: "T", altgr: "™" },   // Trademark
    KeyY: { base: "y", shift: "Y", altgr: "¥" },   // Yen
    KeyU: { base: "u", shift: "U", altgr: null },
    KeyI: { base: "i", shift: "I", altgr: null },
    KeyO: { base: "o", shift: "O", altgr: "˚" },   // Degree
    KeyP: { base: "p", shift: "P", altgr: "π" },   // Pi
    BracketLeft:  { base: "[", shift: "{", altgr: null },
    BracketRight: { base: "]", shift: "}", altgr: null },
    // The SVG renders the rightmost top-row key as Backspace; the
    // separate Backslash key isn't on this layout. We keep a spec
    // here in case a future layout needs it, but the keyboard SVG
    // routes the wide top-right key to Backspace.
    Backslash:    Object.assign({ base: "\\", shift: "|", altgr: null }, M),

    // Alpha — home row ----------------------------------------------
    KeyA: { base: "a", shift: "A", altgr: "₳" },   // Cardano
    KeyS: { base: "s", shift: "S", altgr: "§" },   // Section
    KeyD: { base: "d", shift: "D", altgr: "Δ" },   // Delta
    KeyF: { base: "f", shift: "F", altgr: null },
    KeyG: { base: "g", shift: "G", altgr: null },
    KeyH: { base: "h", shift: "H", altgr: null },
    KeyJ: { base: "j", shift: "J", altgr: "✓" },   // Check
    KeyK: { base: "k", shift: "K", altgr: "•" },   // Bullet
    KeyL: { base: "l", shift: "L", altgr: "£" },   // Pound
    Semicolon: { base: ";", shift: ":", altgr: null },
    Quote:     { base: "'", shift: "\"", altgr: null },
    IntlBackslash: { base: "", shift: "", altgr: "", mod: true },

    // Alpha — bottom row --------------------------------------------
    KeyZ: { base: "z", shift: "Z", altgr: "¶" },   // Paragraph
    KeyX: { base: "x", shift: "X", altgr: null },
    KeyC: { base: "c", shift: "C", altgr: "©" },   // Copyright
    KeyV: { base: "v", shift: "V", altgr: null },
    KeyB: { base: "b", shift: "B", altgr: "₿" },   // Bitcoin
    KeyN: { base: "n", shift: "N", altgr: null },
    KeyM: { base: "m", shift: "M", altgr: "µ" },   // Micro
    Comma:  { base: ",", shift: "<", altgr: "—" }, // em dash
    Period: { base: ".", shift: ">", altgr: "…" }, // ellipsis
    Slash:  { base: "/", shift: "?", altgr: null },
    IntlRo: { base: "", shift: "", altgr: "", mod: true },

    // F-row ---------------------------------------------------------
    F1: Object.assign({ base: "F1", shift: "F1", altgr: "F1" }, M),
    F2: Object.assign({ base: "F2", shift: "F2", altgr: "F2" }, M),
    F3: Object.assign({ base: "F3", shift: "F3", altgr: "F3" }, M),
    F4: Object.assign({ base: "F4", shift: "F4", altgr: "F4" }, M),
    F5: Object.assign({ base: "F5", shift: "F5", altgr: "F5" }, M),
    F6: Object.assign({ base: "F6", shift: "F6", altgr: "F6" }, M),
    F7: Object.assign({ base: "F7", shift: "F7", altgr: "F7" }, M),
    F8: Object.assign({ base: "F8", shift: "F8", altgr: "F8" }, M),
    F9: Object.assign({ base: "F9", shift: "F9", altgr: "F9" }, M),
    F10: Object.assign({ base: "F10", shift: "F10", altgr: "F10" }, M),
    F11: Object.assign({ base: "F11", shift: "F11", altgr: "F11" }, M),
    F12: Object.assign({ base: "F12", shift: "F12", altgr: "F12" }, M),

    // LegalType custom row — clicking inserts the legend symbol that's
    // already drawn on the key in the SVG. The user's gesture ends up
    // being "click the symbol I see and get that exact symbol".
    LegalLeft:  Object.assign({ base: "", shift: "", altgr: "" }, M),
    LegalRight: Object.assign({ base: "", shift: "", altgr: "" }, M),
    Legal1:  { base: "§", shift: "§", altgr: "§" },
    Legal2:  { base: "¶", shift: "¶", altgr: "¶" },
    Legal3:  { base: "©", shift: "©", altgr: "©" },
    Legal4:  { base: "®", shift: "®", altgr: "®" },
    Legal5:  { base: "™", shift: "™", altgr: "™" },
    Legal6:  { base: "Δ", shift: "Δ", altgr: "Δ" },
    Legal7:  { base: "†", shift: "†", altgr: "†" },
    Legal8:  { base: "‡", shift: "‡", altgr: "‡" },
    Legal9:  { base: "•", shift: "•", altgr: "•" },
    Legal10: { base: "—", shift: "—", altgr: "—" },

    // Nav cluster + system keys — inert click targets so the user can
    // see the highlight but the page doesn't try to navigate.
    Insert:      Object.assign({ base: "", shift: "", altgr: "" }, M),
    Home:        Object.assign({ base: "", shift: "", altgr: "" }, M),
    PageUp:      Object.assign({ base: "", shift: "", altgr: "" }, M),
    Delete:      Object.assign({ base: "", shift: "", altgr: "" }, M),
    End:         Object.assign({ base: "", shift: "", altgr: "" }, M),
    PageDown:    Object.assign({ base: "", shift: "", altgr: "" }, M),
    PrintScreen: Object.assign({ base: "", shift: "", altgr: "" }, M),
    ScrollLock:  Object.assign({ base: "", shift: "", altgr: "" }, M),
    Pause:       Object.assign({ base: "", shift: "", altgr: "" }, M),
    NumLock:     Object.assign({ base: "", shift: "", altgr: "" }, M),
    ArrowUp:     Object.assign({ base: "", shift: "", altgr: "" }, M),
    ArrowDown:   Object.assign({ base: "", shift: "", altgr: "" }, M),
    ArrowLeft:   Object.assign({ base: "", shift: "", altgr: "" }, M),
    ArrowRight:  Object.assign({ base: "", shift: "", altgr: "" }, M),
  };

  const layout = {
    id: "legal-en",
    name: "Legal (US QWERTY)",
    specs,
  };

  global.LegalTypeLayouts = global.LegalTypeLayouts || {};
  global.LegalTypeLayouts[layout.id] = layout;
})(window);
