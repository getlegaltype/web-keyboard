# LegalType Web Keyboard

A browser-based virtual keyboard for typing legal symbols and characters
(e.g., §, ¶, ©, ®, ™, Δ, π, €, £, ¥, †, ‡). Inspired in layout and
behavior by gate2home.com — but built specifically for legal writing.

This is the web companion to the desktop
[LegalType AutoHotkey](https://github.com/getlegaltype/legaltype-autohotkey)
app. Anywhere you can't install software (a Chromebook, a kiosk, a
courthouse computer), you can drop into this page and type the same
symbols.

## Features (planned)

- Standard QWERTY US layout shown on screen.
- Each keycap also shows the legal/special symbol available via
  `AltGr` (Right Alt), in the bottom-right corner — matching the
  desktop LegalType keyboard.
- Click keys with the mouse, or type on your physical keyboard.
- Hold `AltGr` (or click the on-screen `AltGr` toggle) to access the
  legal symbol layer.
- One-click Copy, Clear, Select All. Search & translate buttons.
- Mobile-friendly responsive layout.
- No tracking, no ads, no backend — pure static HTML/CSS/JS.

## Project layout

```
.
├── index.html              # Main page
├── assets/
│   ├── css/styles.css      # Styling
│   └── js/
│       ├── app.js          # Bootstraps the keyboard
│       ├── keyboard.js     # Renders + handles keypresses
│       └── layouts/
│           └── legal-en.js # US QWERTY + legal AltGr layer
├── .github/workflows/
│   └── pages.yml           # Auto-deploy to GitHub Pages
├── LICENSE
└── README.md
```

## Local development

It's static — open `index.html` in a browser, or serve the folder:

```bash
# Python 3
python3 -m http.server 8000

# Node
npx serve .
```

Then visit http://localhost:8000.

## Deployment

Pushes to `main` deploy to GitHub Pages via `.github/workflows/pages.yml`.

## Reference

Layout and interaction patterns inspired by
[gate2home.com](https://gate2home.com/French-Keyboard) (without the
ads). Symbol mappings come from the LegalType AutoHotkey project.

## License

Copyright © 2026 LegalType. All rights reserved. See [LICENSE](LICENSE).

Questions or concerns? info@legaltype.com
