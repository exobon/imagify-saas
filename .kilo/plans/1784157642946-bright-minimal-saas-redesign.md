# Plan: Bright Minimal SaaS Redesign (Stockgen / Imagify)

## Goal
Make the app look like a polished, modern SaaS product (Stripe/Linear-style) across **all pages**, without breaking the already-working upscaler/dashboard JavaScript.

## Locked decisions
- **Scope:** landing, dashboard, login, register, admin — all pages.
- **Aesthetic:** bright minimal SaaS — light-first, generous whitespace, subtle borders, soft shadows, restrained accent.
- **Accent:** indigo/blue `#6366F1` (kept from current brand).
- **Dark mode:** light is the DEFAULT; existing `body.dark-mode` toggle must keep working (polish both).
- **Tech:** vanilla CSS only — extend the existing `static/css/styles.css` (1432 lines). NO build step, NO Tailwind.
- **Strategy:** extend in place — reuse existing class names / IDs so `app.js` selectors keep working. Do NOT restructure markup in a way that breaks JS.

## Current state (verified)
- `styles.css` already a "Premium SaaS Style System": `:root` tokens, `body.dark-mode` + `body:not(.dark-mode)` overrides, Inter/Outfit via Google Fonts `@import`. Currently dark-first.
- Pages: `templates/landing.html` (972 lines), `dashboard.html`, `login.html`, `register.html`, `admin.html`.
- JS already working: model select, upscaler upload panel (`#upscaler-section`, `#upscaler-file`, `#upscaler-preview`, `.upscale-res-btn`, `.upscale-fmt-btn`), gallery, waitlist, admin settings. **Do not change element IDs/classes used by `app.js`.**

## Design system changes (`styles.css`)
1. **Light-first tokens** — add/adjust `:root`:
   - `--bg-main-light: #f6f8fb` (page), `--bg-card-light: #ffffff`, `--bg-glass-light: rgba(255,255,255,0.7)`.
   - Text: `--text-primary` light `#0f172a`, `--text-secondary` `#475569`, `--text-muted` `#94a3b8`.
   - `--border-color: rgba(15,23,42,0.08)`, soft `--shadow-md/sm` for light.
   - Keep `--primary: #6366F1`, add `--primary-soft: rgba(99,102,241,0.08)` for chips/bg.
2. **Default to light** — make `body` (no class) render the light palette; `body.dark-mode` keeps the dark palette (existing vars). Ensure the theme toggle JS still flips the class.
3. **Component polish (reuse existing classes):**
   - Buttons `.btn`, `.btn-primary`: solid indigo, subtle shadow, 6–8px radius, hover lift.
   - Cards `.feature-card`, `.gallery-card`, pricing cards, model grid: white bg, 1px border, 12–16px radius, soft shadow, hover border-glow.
   - Nav/header: sticky, translucent white with blur, thin bottom border.
   - Forms/inputs `.form-input`: white, 8px radius, focus ring in `--primary`.
   - Spacing scale: increase section padding, max-width container (~1100–1200px) for breathing room.
   - Typography: tighter heading weights (Outfit 600–800), comfortable line-height, muted secondary text.
4. **Micro-interactions:** smooth `transition`, button/card hover lift, focus-visible outlines, reduced-motion safe.
5. **Responsive:** confirm grids already `auto-fit minmax(...)`; add light-mode spacing tweaks, ensure no overflow on mobile.

## Page-level updates (HTML, keep IDs/classes for JS)
- **landing.html:** light hero, gradient text on headline, clean feature grid, pricing cards with clear CTA, before/after enhancer section already merged. Verify model count = "10" consistency (done earlier). Keep `.features-grid`, `.pricing-grid` classes.
- **dashboard.html:** light workspace; prompt textarea + upscaler panel (`#upscaler-section`) styled for light; gallery grid light cards; credit badge; keep all `app.js`-referenced IDs (`#prompt-input`, `#upscaler-file`, `#upscaler-preview`, `#upscaler-resolution-group`, `#upscaler-format-group`, `.upscale-res-btn`, `.upscale-fmt-btn`, `#btn-generate`, `#gallery-grid`).
- **login.html / register.html:** centered card, light, indigo primary button, link to switch.
- **admin.html:** light tables/forms, keep `#settings-wavespeed-api-key` and other IDs used by `app.js`.

## Dark mode
- Keep `body.dark-mode` working. Light tokens become the default; dark tokens already exist — only align radii/shadows/spacing so dark also looks refined. No JS changes.

## Out of scope / risks
- No backend changes (main.py/database.py) — purely frontend/CSS+HTML.
- Do NOT touch `app.js` logic or element IDs/classes it depends on.
- Risk: changing a class name that `app.js` queries → breaks upscaler/gallery. Mitigation: grep `app.js` for every `getElementById`/`querySelector` before editing HTML; keep them identical.
- Keep existing `static/images` (logo.webp, enhancer before/after) — just restyle containers.

## Validation
1. `grep -n "getElementById\|querySelector" static/js/app.js` → list all required IDs/classes; confirm each still present in updated HTML.
2. Visual QA: open landing, dashboard (incl. select DiGi Image Upscaler → upload panel shows), login, register, admin.
3. Toggle dark mode on each page → both palettes render, no broken layout.
4. Responsive QA at 375px / 768px / 1280px — no horizontal overflow, grids wrap.
5. Functional smoke test: generate a normal image + run an upscale end-to-end (upload → 2K/4K/8K → result in gallery).

## Deliverables
- Updated `static/css/styles.css` (tokens + components, light-first + dark).
- Updated `templates/landing.html`, `dashboard.html`, `login.html`, `register.html`, `admin.html` (HTML/markup/styling only; IDs/classes preserved).
- No changes to `static/js/app.js`, `main.py`, `database.py`.
