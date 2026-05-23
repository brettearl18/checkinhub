# CheckinHUB — Theme Design

Design CheckinHUB to match **Vana Recipe Hub** (Vana Health product family).

**Aesthetic:** Warm, calm, premium wellness app — not generic SaaS. Cream/oat backgrounds, warm charcoal text, gold accents, soft shadows, generous rounding.

---

## Brand context

| Item | Guidance |
|------|----------|
| Product family | Vana Health |
| Reference product | Vana Recipe Hub |
| App role | Coach–client health portal (check-ins, habits, progress, messaging) |
| Feel | Clean cards, pill buttons, small uppercase section headers, gold highlight for important cross-app links (e.g. Check-in portal) |

---

## Color palette

### Core tokens

| Token | Hex / value | Usage |
|-------|-------------|--------|
| Page background | `#faf7f2` | App shell, main canvas |
| Card / surface | `#fffdf9` | Cards, panels, inputs |
| Text (primary) | `#2c2825` | Headings, body emphasis |
| Brand gold (primary) | `#daa450` | CTAs, active states, highlighted links, logo bar |

### Semantic & UI

| Role | Palette | Notes |
|------|---------|--------|
| UI neutrals | Tailwind **stone** | Borders `stone-200/80`; secondary text `stone-500`–`stone-600` |
| Success | **emerald** | Confirmations, positive status |
| Warning / pending | **amber** | Pending states, cautions |
| Error | **rose** | Errors, destructive emphasis |

### CSS / Tailwind mapping (suggested)

```css
--color-page-bg: #faf7f2;
--color-surface: #fffdf9;
--color-text: #2c2825;
--color-brand: #daa450;
--color-brand-ring: rgb(218 164 80 / 0.15); /* focus: ring-brand/15 */
```

Use `stone-*` for borders, muted copy, and inactive UI. Reserve gold for primary actions and brand moments only.

---

## Typography

### Font families

| Role | Family | Weights | Class / alias |
|------|--------|---------|----------------|
| Headings & display numbers | **Fraunces** (serif) | 400–600 | `font-display` |
| Body & UI | **Plus Jakarta Sans** | 400–600 | Default sans |

### Type scale & treatment

| Element | Spec |
|---------|------|
| Section labels | `10px`, uppercase, wide letter-spacing, `stone-400` |
| Page titles | Fraunces ~`text-3xl`, `font-medium`, `stone-800` |
| Body | `text-sm`, `stone-600`, relaxed line-height |
| Metrics / numbers | **tabular-nums** (`font-variant-numeric: tabular-nums`) |

Headings should feel editorial and calm (Fraunces), not corporate sans. UI chrome and paragraphs use Plus Jakarta Sans.

---

## Layout

### Breakpoints & structure

- **Mobile-first** — default layouts stack; touch-friendly spacing.
- **Desktop** — fixed left sidebar **~224px** (`w-56`), cream surface, `stone` border.
- **Main content** — offset on desktop to clear sidebar; full width on mobile.
- **Mobile header** — sticky top bar for nav and context.

### Spacing & density

- Generous padding inside cards and between sections.
- Avoid dense enterprise tables as the default list pattern; prefer card rows or spaced lists.

---

## Components

### Cards

- `rounded-2xl`
- Border: `stone-200/80`
- Shadow: `shadow-sm`
- Background: `#fffdf9` (surface) or white on surface where contrast is needed

### Buttons

- Shape: **pill** — `rounded-full`
- **Primary:** gold background (`#daa450`), white text
- Secondary: stone borders / muted fills; no purple or blue gradients

### Inputs

- `rounded-xl`
- Background: surface (`#fffdf9`)
- Focus: gold ring — `ring-brand/15` (or equivalent `focus:ring-[#daa450]/15`)

### Navigation & highlights

- Sidebar: cream/oat surface, stone dividers
- Active nav: gold accent or gold left border — subtle, not loud
- Cross-app / portal links: gold text or gold underline on hover

### Logo

- **White Vana logo** on **solid gold** (`#daa450`) header strip **only**
- Do not place the white logo on cream or white backgrounds without the gold bar

---

## Do / Do not

### Do

- Cream/oat page backgrounds (`#faf7f2`)
- Warm charcoal text (`#2c2825`)
- Gold (`#daa450`) for primary CTAs and brand chrome
- Fraunces + Plus Jakarta Sans
- Soft shadows, `rounded-2xl` cards, `rounded-full` buttons
- Stone palette for neutrals and borders
- Wellness-portal clarity: coach and client views share the same tokens

### Do not

| Avoid | Why |
|-------|-----|
| Cold pure white (`#fff`) as **page** background | Breaks warm Vana family feel |
| Inter / Roboto as **primary** fonts | Reads as generic SaaS |
| Purple / blue startup gradients | Off-brand for Vana Health |
| Sharp **4px** corners as default | Too utilitarian; use generous radius |
| Dense enterprise tables as default UI | Wrong density for coach–client wellness |

---

## Trial status

**Client portal trial (live):** `data-theme="vana"` on `src/app/client/layout.tsx` (`VANA_THEME_TRIAL`). Fonts in `src/lib/fonts.ts`; tokens in `globals.css`; gold brand bar in `VanaBrandBar.tsx`. Dashboard (`/client`) is the primary preview. Set `VANA_THEME_TRIAL = false` in the client layout to revert the shell.

---

## Implementation checklist

When building or refactoring UI:

1. [x] Load **Fraunces** and **Plus Jakarta Sans** (`src/lib/fonts.ts`, root layout).
2. [x] CSS variables under `[data-theme="vana"]` in `globals.css`.
3. [x] Primary buttons pill-shaped via `--radius-button` (list rows/inputs use `--radius-md` → `rounded-xl`).
4. [x] `.vana-card` utility + dashboard cards.
5. [ ] Input focus ring to brand gold at ~15% opacity (global).
6. [x] Client layout: 224px sidebar, sticky mobile header, gold brand bar.
7. [x] White Vana mark on `#daa450` strip (`VanaBrandBar`).
8. [x] Client portal page bg `#faf7f2` (vana theme).

---

## Related docs

- `docs/DATA_SCHEMA_FOR_NEW_UI.md` — data shapes for UI
- `docs/COACH_UX_OLD_STYLE_PLAN.md` — coach experience notes
