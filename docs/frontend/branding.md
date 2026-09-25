# ErgonX Branding

Status: adopted 2026-09-24 · Assets: `public/brand/` · Generator: `scripts/generate-brand-assets.py` · Components: `src/components/brand/`

## Asset set

All derivatives come from the approved high-resolution lockup `public/ergonx-logo.png` via `scripts/generate-brand-assets.py`. The only operations are background removal (colour-to-alpha against the measured off-white field), cropping, compositing and solid fills. **No glyph is redrawn, distorted or gradient-recoloured.** Re-run the script whenever the source artwork changes.

| File | Role | Where it is used |
|---|---|---|
| `ergonx-logo-primary.png` | **Primary full logo** — navy wordmark, blue X | Login/auth (mobile), onboarding header, offline page, Platform header (light), major product moments |
| `ergonx-logo-primary-reversed.png` | Primary lockup with white wordmark, X unchanged | Navy surfaces: expanded sidebar, auth brand panel, dark-mode headers |
| `ergonx-mark.png` | **Sidebar mark** — the X symbol | Collapsed sidebar, splash screen, compact brand spots |
| `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`, `favicon-32.png`, `favicon-48.png` | **App icon / favicon** — X on the navy gradient tile | Browser tab, PWA manifest, installed/shortcut icon |
| `ergonx-logo-mono.png` | **Monochrome logo** (navy) | Payslips, financial statements, print/PDF, footers, watermarks, formal surfaces |
| `ergonx-logo-mono-white.png` | Monochrome, white | Formal attribution on dark surfaces |

`<Logo variant="primary | reversed | mark | mono | mono-white" height={…} />` renders these with correct aspect ratio; `<AdaptiveLogo>` swaps primary ↔ reversed with the theme.

## Rules

- Keep the approved geometry and proportions; never stretch, skew, re-letter or apply CSS filters to the logo.
- Minimum clear space around any lockup: the height of the "E" cap on all sides. Minimum height: 20 px (lockup), 16 px (mark).
- Backgrounds: primary on light/neutral surfaces; reversed on navy (`--brand-navy`) or dark surfaces; mono on print and formal documents. Do not place the full-colour logo on the signature gradient.
- The splash screen, auth brand panel and hero art may use the signature gradient *around* the logo; the logo itself stays as supplied.

## Multicolour X — current status

The approved direction is for the X to carry the **teal → aqua → royal blue → violet** gradient. The supplied artwork is raster-only and its X uses the earlier **cyan → blue** gradient. Per the brief we did **not** recolour it programmatically.

- Implemented: the full signature gradient in the UI (`--gradient-signature`, `bg-signature`, `text-signature`), sidebar active bars, hero/auth/splash art, onboarding progress.
- **Outstanding (design deliverable):** vector (SVG) master artwork for the primary, reversed, mark and app-icon roles with the multicolour X. When supplied, replace the PNGs in `public/brand/` (keep file names) or add SVG variants to `Logo.tsx`. No code changes are otherwise needed.
- Also outstanding: an official reversed (white-wordmark) lockup and official app-icon master; the current ones are faithful composites of approved elements and should be replaced by designed masters.

## App icon / favicon

The icon tile reproduces the supplied app-icon layout: X mark centred on a vertical navy gradient (`#014299 → #011C48`, sampled from the supplied icon) with ~22% corner radius; the maskable variant is full-bleed square. Declared in `app/layout.tsx` metadata and `public/manifest.webmanifest`; `/favicon.ico` redirects to `favicon-48.png`. The service-worker cache name was bumped (`ergonx-static-v2`) so old icons are evicted.

## Sidebar logo transition

Formal requirement, implemented in `SidebarLogo.tsx`:

- Two layered assets in one fixed 120×36 container — no layout shift.
- **Collapsing:** the reversed wordmark scales to 72% toward the left (symbol position), fades and softly blurs; the X mark scales 50% → 100% and fades in with a 40 ms delay.
- **Expanding:** reverse.
- Timing 220 ms, `ease-standard`. No shimmer or perpetual motion. Under `prefers-reduced-motion` the swap is instant.
- The collapsed rail always shows the ErgonX X mark; tenant logos are never squeezed into it. A dedicated compact tenant mark could be added later only if one is explicitly configured.

## Signature gradient

`linear-gradient(120deg, #14D2B8 0%, #22D3EE 30%, #2F6BFF 68%, #7C5CFF 100%)`. A brand-expression device, not a background for components. Approved uses: auth brand panel art, hero art (Home, Employee Home, Executive header glow), splash progress, sidebar active indicator and ambient glow, onboarding progress bar, institution monogram. Not for buttons, cards, tables or charts.

## Institution branding

- Tenant identity is prominent: institution name in the top bar context line, sidebar footer (monogram + name + code), Home greeting, document headers.
- ErgonX identity is subtle but persistent: sidebar logo, "on ErgonX" mono attribution in the sidebar footer, "Generated with ErgonX" on documents.
- Tenant-generated documents (`DocumentFrame`: payslips, financial statements): institution name is primary; ErgonX appears only as monochrome attribution in the footer.
- Institution logo images: the backend stores private `ImageAsset`s for institutions, but the session/bootstrap does not yet expose a *current* institution logo reference (tracked as a backend follow-up in the discrepancy register: "persisted current-image references"). Until it does, the UI uses a generated monogram. When available, render it in `Sidebar` footer and `DocumentFrame` header.
