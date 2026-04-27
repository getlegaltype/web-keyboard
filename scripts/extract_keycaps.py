#!/usr/bin/env python3
"""Parse keyboard.svg, extract every keycap shadow's bounding box, and
emit a JS data file (assets/js/svg-keycaps.js) mapping each keycap to a
KeyboardEvent.code so the rendered SVG can be wired up for clicks.

For each shadow group (Modifers_Keycap_Bottom / Alpha_Keycaps_Bottom /
F-Row_Bottom / Numpad_Keycaps_Bottom) we walk every direct child <rect>
or <path> and compute its bounding box. Rect bboxes come straight from
the element attributes; path bboxes come from parsing the path data.

Then we group boxes by their physical row (using y bands) and sort
within each row by x — that order matches the canonical key sequence
for that row, so we can zip it with a hand-written list of
KeyboardEvent.code values to produce the final mapping.
"""

from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SVG_PATH = ROOT / "assets" / "svg" / "keyboard.svg"
OUT_PATH = ROOT / "assets" / "js" / "svg-keycaps.js"

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)


# Path bounding box --------------------------------------------------------

def path_bbox(d: str) -> tuple[float, float, float, float]:
    """Approximate a path's bbox by walking its commands.

    Handles M/m, L/l, H/h, V/v, C/c, S/s, Q/q, T/t, Z/z. For curves we
    include all control points in the bbox; that overestimates slightly
    on rounded corners but the keycap shadows are convex enough that
    the bbox still hugs the visible keycap edges accurately.
    """
    xs: list[float] = []
    ys: list[float] = []
    cx = cy = 0.0
    start_x = start_y = 0.0
    cmd = ""
    nums: list[float] = []

    tokens = re.findall(r"([MmLlHhVvCcSsQqTtAaZz])|(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)", d)

    def flush():
        nonlocal cx, cy, start_x, start_y
        if not cmd:
            return
        n = nums
        if cmd in ("M", "L"):
            for k in range(0, len(n) - 1, 2):
                cx, cy = n[k], n[k + 1]
                xs.append(cx); ys.append(cy)
                if cmd == "M" and k == 0:
                    start_x, start_y = cx, cy
        elif cmd in ("m", "l"):
            for k in range(0, len(n) - 1, 2):
                cx += n[k]; cy += n[k + 1]
                xs.append(cx); ys.append(cy)
                if cmd == "m" and k == 0:
                    start_x, start_y = cx, cy
        elif cmd == "H":
            for v in n:
                cx = v; xs.append(cx); ys.append(cy)
        elif cmd == "h":
            for v in n:
                cx += v; xs.append(cx); ys.append(cy)
        elif cmd == "V":
            for v in n:
                cy = v; xs.append(cx); ys.append(cy)
        elif cmd == "v":
            for v in n:
                cy += v; xs.append(cx); ys.append(cy)
        elif cmd in ("C", "S", "Q", "T"):
            per = 6 if cmd == "C" else 4
            for k in range(0, len(n) - 1, per):
                seg = n[k : k + per]
                for j in range(0, len(seg) - 1, 2):
                    xs.append(seg[j]); ys.append(seg[j + 1])
                cx = seg[-2]; cy = seg[-1]
        elif cmd in ("c", "s", "q", "t"):
            per = 6 if cmd == "c" else 4 if cmd in ("s", "q") else 2
            for k in range(0, len(n) - 1, per):
                seg = n[k : k + per]
                for j in range(0, len(seg) - 1, 2):
                    xs.append(cx + seg[j]); ys.append(cy + seg[j + 1])
                cx += seg[-2]; cy += seg[-1]
        elif cmd in ("Z", "z"):
            cx, cy = start_x, start_y

    for letter, num in tokens:
        if letter:
            flush()
            cmd = letter
            nums = []
        else:
            nums.append(float(num))
    flush()

    if not xs or not ys:
        return (0.0, 0.0, 0.0, 0.0)
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    return (x0, y0, x1 - x0, y1 - y0)


# SVG parsing --------------------------------------------------------------

def find_group(root: ET.Element, gid: str) -> ET.Element | None:
    for g in root.iter(f"{{{SVG_NS}}}g"):
        if g.get("id") == gid:
            return g
    return None


def collect_keycaps(svg_path: Path) -> list[dict]:
    tree = ET.parse(svg_path)
    root = tree.getroot()
    wanted = [
        "Modifers_Keycap_Bottom",
        "Alpha_Keycaps_Bottom",
        "F-Row_Bottom",
        "Numpad_Keycaps_Bottom",
    ]
    boxes: list[dict] = []
    for name in wanted:
        g = find_group(root, name)
        if g is None:
            print(f"[warn] missing group: {name}")
            continue
        for child in g:
            tag = child.tag.split("}", 1)[-1]
            if tag == "rect":
                x = float(child.get("x", "0"))
                y = float(child.get("y", "0"))
                w = float(child.get("width", "0"))
                h = float(child.get("height", "0"))
                boxes.append({"x": x, "y": y, "w": w, "h": h, "src": name})
            elif tag == "path":
                d = child.get("d") or ""
                x, y, w, h = path_bbox(d)
                if w <= 0 or h <= 0:
                    continue
                boxes.append({"x": x, "y": y, "w": w, "h": h, "src": name})
    return boxes


# Row classification + code assignment -------------------------------------

# The SVG has six physical rows (no separate number row): F-row, alpha
# top, home, bottom alpha, modifier row 1 (above space), and the space
# row. Numpad and nav cluster line up with these same y-bands. We use
# y-center bands so the wider keys (whose path bboxes drift a few px
# off-grid) still land in the right row.
ROWS = [
    ("F",  390, 440),    # Esc + F1..F12 + PrtScn/ScrLk/Pause
    ("R1", 470, 535),    # Tab Q..P [ ] \ Backspace + Ins/Home/PgUp + numpad row 1
    ("R2", 545, 595),    # Caps A..L ; ' Enter + Del/End/PgDn + numpad row 2
    ("R3", 605, 660),    # LShift Z..M , . / RShift + numpad row 3
    ("R4", 670, 710),    # Mod row 1 above space + ArrowUp + numpad row 4
    ("R5", 720, 770),    # Spacebar + arrows + Numpad0/. + NumpadEnter
]


def assign_row(box: dict) -> str | None:
    cy = box["y"] + box["h"] / 2
    for label, lo, hi in ROWS:
        if lo <= cy < hi:
            return label
    return None


# Hand-written code list per row, in left-to-right order matching the SVG.
# The SVG is laid out as: F-row (no number row), then five rows of keys
# matching a 100% layout. Row R4 is the bottom alpha row; row R5 is
# the legal-symbol/modifier row that LegalType keyboards add above the
# spacebar; row R6 is the space row. We zip each row's box list with
# the codes below in left-to-right order.
ROW_CODES = {
    # Row F: Esc + F1–F12 + PrtScn / ScrollLock / Pause (16 keys).
    "F":  ["Escape",
           "F1", "F2", "F3", "F4",
           "F5", "F6", "F7", "F8",
           "F9", "F10", "F11", "F12",
           "PrintScreen", "ScrollLock", "Pause"],

    # Row 1: Tab Q W E R T Y U I O P [ ] Backspace + nav cluster
    # + numpad row 1 (21 keys). The wider rightmost path on this row is
    # the Backspace key.
    "R1": ["Tab",
           "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT",
           "KeyY", "KeyU", "KeyI", "KeyO", "KeyP",
           "BracketLeft", "BracketRight", "Backspace",
           "Insert", "Home", "PageUp",
           "NumLock", "NumpadDivide", "NumpadMultiply", "NumpadSubtract"],

    # Row 2: Caps + tall-special + A–L + ; ' + Enter + nav + numpad (21).
    # 'IntlBackslash' is the tall key tucked between Caps and A on this
    # custom layout; if the rendered keyboard doesn't need it we treat
    # clicks as a no-op.
    "R2": ["CapsLock", "IntlBackslash",
           "KeyA", "KeyS", "KeyD", "KeyF", "KeyG",
           "KeyH", "KeyJ", "KeyK", "KeyL",
           "Semicolon", "Quote", "Enter",
           "Delete", "End", "PageDown",
           "Numpad7", "Numpad8", "Numpad9", "NumpadAdd"],

    # Row 3: LShift Z X C V B N M , . / [ISO-extra] RShift + Numpad4/5/6
    # (16 keys). The keyboard has an ISO-extra key between Slash and
    # RShift; we expose it as 'IntlRo' so layouts can map it.
    "R3": ["ShiftLeft",
           "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB",
           "KeyN", "KeyM", "Comma", "Period", "Slash",
           "IntlRo", "ShiftRight",
           "Numpad4", "Numpad5", "Numpad6"],

    # Row 4: LegalType custom row — a wide left, ten dedicated
    # legal-symbol keys, a wide right, ArrowUp, then Numpad 1–3 plus
    # the top half of NumpadEnter (17 keys total).
    "R4": ["LegalLeft",
           "Legal1", "Legal2", "Legal3", "Legal4", "Legal5",
           "Legal6", "Legal7", "Legal8", "Legal9", "Legal10",
           "LegalRight",
           "ArrowUp",
           "Numpad1", "Numpad2", "Numpad3", "NumpadEnter"],

    # Row 5: LCtrl LWin LAlt Space RAlt RWin Menu RCtrl + arrows +
    # Numpad 0 / NumpadDecimal (13 keys).
    "R5": ["ControlLeft", "MetaLeft", "AltLeft",
           "Space",
           "AltRight", "MetaRight", "ContextMenu", "ControlRight",
           "ArrowLeft", "ArrowDown", "ArrowRight",
           "Numpad0", "NumpadDecimal"],
}


def assign_codes(boxes: list[dict]) -> list[dict]:
    by_row: dict[str, list[dict]] = {}
    for b in boxes:
        row = assign_row(b)
        if row is None:
            print(f"[warn] unrouted box at x={b['x']:.1f} y={b['y']:.1f} w={b['w']:.1f} h={b['h']:.1f} src={b['src']}")
            continue
        by_row.setdefault(row, []).append(b)

    out: list[dict] = []
    for row in ("F", "R1", "R2", "R3", "R4", "R5"):
        items = by_row.get(row, [])
        items.sort(key=lambda b: b["x"] + b["w"] / 2)
        codes = ROW_CODES.get(row, [])
        for box, code in zip(items, codes):
            out.append({
                "code": code,
                "x": round(box["x"], 2),
                "y": round(box["y"], 2),
                "w": round(box["w"], 2),
                "h": round(box["h"], 2),
                "row": row,
            })
        if len(items) != len(codes):
            print(f"[warn] row {row}: {len(items)} boxes vs {len(codes)} codes")
            for b in items[len(codes):]:
                print(f"       extra box at x={b['x']:.1f} y={b['y']:.1f} w={b['w']:.1f}")
            for c in codes[len(items):]:
                print(f"       missing slot for {c}")

    return out


# Emit ---------------------------------------------------------------------

def emit_js(records: list[dict]) -> str:
    rows_json = json.dumps(records, indent=2)
    return (
        "/* Auto-generated by scripts/extract_keycaps.py — do not edit by hand.\n"
        " * Bounding boxes (in SVG viewBox units) of every keycap shadow in\n"
        " * assets/svg/keyboard.svg, mapped to KeyboardEvent.code values so the\n"
        " * rendered SVG can be made interactive.\n"
        " */\n"
        "(function (global) {\n"
        '  "use strict";\n'
        f"  global.LegalTypeKeycapBoxes = {rows_json};\n"
        "})(window);\n"
    )


def main() -> None:
    boxes = collect_keycaps(SVG_PATH)
    print(f"found {len(boxes)} keycap shadows")
    if any(arg == "--dump" for arg in __import__("sys").argv[1:]):
        for b in sorted(boxes, key=lambda b: (b["y"], b["x"])):
            cy = b["y"] + b["h"] / 2
            print(f"  x={b['x']:7.1f} y={b['y']:6.1f} w={b['w']:5.1f} h={b['h']:5.1f} cy={cy:6.1f} src={b['src']}")
        return
    records = assign_codes(boxes)
    print(f"mapped {len(records)} keycaps to codes")
    OUT_PATH.write_text(emit_js(records), encoding="utf-8")
    print(f"wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
