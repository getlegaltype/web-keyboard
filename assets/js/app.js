/* LegalType Web Keyboard — app bootstrap
 *
 * Wires the keyboard module to the page: editor, toolbar buttons, layout
 * picker. Kept intentionally small.
 */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const editor = document.getElementById("editor");
    const kbContainer = document.getElementById("keyboard");
    const layoutSelect = document.getElementById("layout-select");

    const layouts = window.LegalTypeLayouts || {};
    const initialId = layoutSelect.value || "legal-en";
    const initialLayout = layouts[initialId];

    if (!initialLayout) {
      kbContainer.textContent = "Failed to load keyboard layout: " + initialId;
      return;
    }

    const keyboard = new window.LegalTypeKeyboard({
      container: kbContainer,
      target: editor,
      layout: initialLayout,
    });

    // Layout switcher (only one layout for now, but wired for the future).
    layoutSelect.addEventListener("change", () => {
      const next = layouts[layoutSelect.value];
      if (next) keyboard.setLayout(next);
    });

    // Toolbar buttons.
    document.querySelector(".toolbar").addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;

      switch (action) {
        case "copy":
          await copyText(editor.value);
          break;
        case "cut":
          await copyText(editor.value);
          editor.value = "";
          break;
        case "paste":
          try {
            const text = await navigator.clipboard.readText();
            insertAtCursor(editor, text);
          } catch (err) {
            // Some browsers block clipboard read without a user gesture
            // chain — silently ignore.
            console.warn("Paste failed:", err);
          }
          break;
        case "select-all":
          editor.focus();
          editor.select();
          break;
        case "clear":
          editor.value = "";
          editor.focus();
          break;
      }
    });
  });

  async function copyText(text) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Fallback for older browsers.
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (_) { /* ignore */ }
      document.body.removeChild(ta);
    }
  }

  function insertAtCursor(ta, text) {
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
    const caret = start + text.length;
    ta.selectionStart = ta.selectionEnd = caret;
    ta.focus();
  }
})();
