# UX redesign progress (`ux-redesign`)

> Live production stays on `main`. This branch only.

## Done (slice 1 — foundations + client Today)

- Design tokens aligned to `vana-app-design-brief.md` (warm `#F7F5F2`, gold `#DAA450`, charcoal-on-gold buttons, score band colours).
- `Button` / `Card` updated (capsule primary, soft cards, no heavy borders).
- Client shell: tab bar **Today · Check-in · Progress · More**; gold brand strip removed from mobile chrome; quiet **VANA** wordmark on desktop sidebar.
- Client home restyled as **Today**: large title + date, avatar initials, check-in card first, then weight, then score glance.

## Next slices

1. Polish `TodayWeightCard` + habits strip to rings/rows (brief C1).
2. Check-in wizard (C2) and submitted screen (C3).
3. Progress tab (C5).
4. Coach shell + **This week** board (K1).

## How to preview

```bash
git checkout ux-redesign
npm run dev
```

Open `/client` on phone width. Do **not** merge to `main` until Silvi is happy.
