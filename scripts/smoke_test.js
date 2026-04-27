/* Smoke test for the SVG keyboard wiring: load the page in JSDOM,
 * dispatch the same scripts the browser would, then click hit-targets
 * and assert the editor textarea ends up with the expected text.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("/tmp/node_modules/jsdom");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

const dom = new JSDOM(html, {
  url: "http://localhost/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  resources: "usable",
});

// JSDOM's fetch resolves URLs relative to file system roots. Stub it
// to load the SVG straight off disk.
dom.window.fetch = async (url) => {
  const p = url.replace("http://localhost/", "");
  const data = fs.readFileSync(path.join(ROOT, p), "utf8");
  return { ok: true, status: 200, text: async () => data };
};

// Wait for any inline scripts to finish, then inject ours and dispatch
// DOMContentLoaded so the bootstrap runs.
dom.window.addEventListener("load", () => {
  const scripts = [
    "assets/js/svg-keycaps.js",
    "assets/js/layouts/legal-en.js",
    "assets/js/keyboard.js",
    "assets/js/app.js",
  ];
  // The HTML's own <script src=...> tags will already have tried to
  // load (and failed) — re-evaluate from disk into the same window.
  for (const s of scripts) {
    const code = fs.readFileSync(path.join(ROOT, s), "utf8");
    const el = dom.window.document.createElement("script");
    el.textContent = code;
    dom.window.document.head.appendChild(el);
  }
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));

  // The keyboard renders asynchronously (fetch + parse). Give it a tick.
  setTimeout(() => {
    const doc = dom.window.document;
    const hits = doc.querySelectorAll(".kb-hit");
    const codes = [...hits].map((r) => r.dataset.code);
    const ok = (label, cond) =>
      console.log((cond ? "[ ok ] " : "[fail] ") + label);

    ok("SVG mounted", !!doc.querySelector("#keyboard svg"));
    ok("hit-target count is 104", hits.length === 104);
    for (const c of ["Escape", "KeyA", "Space", "Backspace", "NumpadAdd", "Legal1"]) {
      ok("covered: " + c, codes.includes(c));
    }

    const editor = doc.getElementById("editor");
    const click = (code) => {
      const r = doc.querySelector(`.kb-hit[data-code="${code}"]`);
      r.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    };

    editor.value = "";
    editor.selectionStart = editor.selectionEnd = 0;
    click("KeyA");
    console.log('  editor.value=', JSON.stringify(editor.value), 'sel=', editor.selectionStart);
    ok('"a" after KeyA', editor.value === "a");

    click("ShiftLeft");
    click("KeyA");
    console.log('  editor.value=', JSON.stringify(editor.value), 'sel=', editor.selectionStart);
    ok('"aA" after Shift+KeyA', editor.value === "aA");

    click("AltRight");
    click("KeyS");
    ok('"aA§" after AltGr+KeyS', editor.value === "aA§");

    click("Space");
    ok('"aA§ " after Space', editor.value === "aA§ ");

    click("Backspace");
    ok('"aA§" after Backspace', editor.value === "aA§");

    click("Legal1");
    ok('"aA§§" after Legal1', editor.value === "aA§§");

    click("NumpadAdd");
    ok('"aA§§+" after NumpadAdd', editor.value === "aA§§+");
  }, 200);
});
