# Vana App — Design Brief for Mockups

> **For:** ChatGPT (image generation) or any designer producing UI mockups.
> **Goal:** high-fidelity mockups of a **modern, clean, Apple-style** coach–client wellness app, to set the visual direction before the rebuild.
> **How to use:** read §1–6 once for context, then generate one screen at a time using the prompts in §8. Each prompt is self-contained.
> **All names and numbers in this brief are fictional.**

---

## 1. The product in one paragraph

Vana is a women's health coaching business in Perth, Australia, run by Coach Silvi. Clients use a phone app (installed to the home screen) to **log their weight and daily habits**, complete a **weekly check-in questionnaire** (reflecting on Monday–Sunday, opening Friday 9am, due Monday 5pm), and **read their coach's feedback** (text and voice notes). The coach uses a laptop to **review everyone's check-in each week** from one board, leave feedback, and keep an eye on progress, habits and billing. About 40 active clients.

## 2. Design direction: "Apple Health meets a calm wellness studio"

**Feel:** quiet, confident, premium, warm. Lots of white space. Content first. Nothing decorative that doesn't carry meaning.

**Take from Apple (iOS 18 / macOS Sequoia, Apple Health, Fitness, Reminders):**
- Large bold titles that sit on the page, not in a bar ("Today", "Check-in").
- Grouped, rounded cards ("inset grouped" lists) on a soft off-white background.
- System-like sans-serif typography (SF Pro style), strong size hierarchy, generous line height.
- One clear primary action per screen; secondary actions as plain text buttons.
- Subtle materials: translucent tab bar with blur, hairline separators, very soft shadows (or none).
- Rings, progress bars and simple charts like Apple Health/Fitness, with clean axes and no gridline clutter.
- SF Symbols-style line icons (thin-medium stroke, rounded).
- Calm motion cues (implied in mockups by state, not effects).

**Keep from Vana's brand:**
- **Gold `#DAA450`** as the single accent colour (Apple uses one tint colour per app; ours is gold).
- Warm off-white canvas instead of cold grey.
- A small "VANA" wordmark, used sparingly (top of the sign-in screen, coach sidebar).
- Optional: a refined serif for very large display numbers only (e.g. "72.4 kg"), otherwise all sans-serif. If in doubt, use sans-serif everywhere.

**Avoid:** gradients behind content, heavy drop shadows, emoji as icons, dense dashboards, more than one accent colour, stock-photo people, glassmorphism overload, dark sidebars, generic SaaS blue.

## 3. Design tokens

### Colour

| Token | Light mode | Use |
|-------|-----------|-----|
| Background | `#F7F5F2` (warm off-white) | Page canvas |
| Surface | `#FFFFFF` | Cards, sheets, inputs |
| Grouped separator | `#ECE8E3` | Hairlines between rows |
| Text primary | `#1C1A17` | Titles, body |
| Text secondary | `#6E6A65` | Captions, meta |
| Text tertiary | `#A39E98` | Placeholders, disabled |
| Accent (gold) | `#DAA450` | Primary buttons, active tab, rings, chart line, links |
| Accent pressed | `#C48E3A` | |
| Accent tint | `#FBF3E6` | Selected rows, chips, subtle highlights |
| On-accent text | `#1C1A17` (charcoal on gold, for contrast) | Text on gold buttons |
| Success | `#34C759` | Done ✓, goal met |
| Warning | `#FF9F0A` | Due soon, late |
| Destructive | `#FF3B30` | Delete, close account |

**Traffic-light score bands** (used for check-in scores, always with a text label, never colour alone):

| Band | Label | Colour | Tint |
|------|-------|--------|------|
| Red | Needs attention | `#FF453A` | `#FFECEB` |
| Orange | On track | `#FF9F0A` | `#FFF4E5` |
| Green | Excellent | `#30D158` | `#E8F9ED` |

Dark mode is optional for mockups; if shown, use near-black `#111110` background, `#1C1C1A` cards, the same gold.

### Typography (SF Pro style)

| Style | Size / weight | Use |
|-------|---------------|-----|
| Large title | 34 / Bold | Screen titles on phone ("Today") |
| Title 2 | 22 / Semibold | Card titles, coach page titles |
| Headline | 17 / Semibold | Row titles, buttons |
| Body | 17 / Regular | Question text, paragraphs |
| Subheadline | 15 / Regular | Secondary lines |
| Footnote | 13 / Regular | Meta, timestamps |
| Caption | 12 / Medium, uppercase, +0.5 tracking | Section labels ("THIS WEEK") |
| Big number | 48 / Semibold (or serif display) | Weight, score |
All numbers tabular. Desktop coach UI uses the same scale one step smaller for tables (15 body).

### Shape and spacing
- Grid: 8 pt. Screen margins 16 pt (phone), 32 pt (desktop).
- Card radius 20 pt; buttons fully rounded (capsule) height 50 pt (phone) / 40 pt (desktop); inputs radius 12 pt.
- Shadows: none, or `0 1px 2px rgba(0,0,0,0.04)`. Separation comes from background vs white cards.
- Touch targets ≥ 44 pt.

### Iconography
SF Symbols-like line icons: house (Today), checklist (Check-in), chart.line (Progress), ellipsis.circle (More), scalemass (weight), figure.walk (steps), drop (water), bed (sleep), waveform/mic (voice note), bubble (messages), bell (notifications).

## 4. Client app (iPhone, 393 × 852 pt, iOS style)

**Tab bar (translucent, blurred, bottom):** Today · Check-in · Progress · More. Active tab in gold, others secondary grey.

### Screen C1 — Today
- Large title "Today", small date line above "Monday 23 November". Avatar circle top right.
- **Check-in card (top, most important):** caption "THIS WEEK'S CHECK-IN". One of three states (pick one per mockup):
  - *To do:* "Week of 16 Nov" · "Due today, 5pm" (warning colour) · gold capsule button **Start check-in** · progress hint "12 questions · about 3 min".
  - *Submitted:* green check circle, "Submitted ✓", "Silvi will review it soon".
  - *Feedback ready:* "New feedback from Coach Silvi", play icon for a 0:42 voice note, **View feedback**.
- **Weight card:** "WEIGHT" caption, big number "72.4 kg", "Logged today ✓", small sparkline of last 14 days, secondary "6 of last 7 days".
- **Habits card:** three rows (Steps, Water, Sleep) each with icon, today's value and a small ring (Apple-Fitness-like): "8,240 steps / 10,000", "2.0 L / 2.5 L", "7 h 10 m / 7 h 30 m". Streak line "🔥 12-day streak" may use the flame symbol, not emoji.
- **Score card (smaller):** "CHECK-IN SCORE" · "78%" · pill "On track" (orange) · "+4 vs last week".

### Screen C2 — Check-in question (wizard)
- Top: "Cancel" (left, gold text), "Week of 16 Nov" (centre, footnote), overflow "•••" (right).
- Thin gold progress bar under the nav; "Question 3 of 12".
- Large question text: "How well did you sleep this week?" Helper: "Think about how rested you felt most mornings."
- Answer control: a row of 10 round tappable numbers (1–10), selected "7" filled gold with charcoal text; labels "Poorly" / "Very well" under the ends.
- "Add a note (optional)" field, single rounded input.
- Bottom: secondary "Back" text button and primary capsule **Next**. Small "Saved" with check near the bottom.

### Screen C3 — Check-in submitted (result)
- Centred large green check in a soft circle.
- Title "Check-in submitted". Subtitle "Week of 16 – 22 Nov".
- Score ring (Apple Activity style) with "78%" centre and label pill "On track".
- One-line message: "Solid week. Silvi will review it and get back to you."
- Primary **Back to Today**; secondary "View my answers".

### Screen C4 — Coach feedback
- Large title "Feedback", subtitle "Week of 9 Nov · Reviewed by Coach Silvi".
- Voice note player card: waveform, play button in gold, "0:42".
- Coach's overall note in a soft accent-tint card: "Great consistency with your steps this week…"
- Answers list (inset grouped): question, client answer, small band dot; one answer has an inline coach comment bubble.

### Screen C5 — Progress
- Large title "Progress". Segmented control "1M · 3M · 6M · All" (iOS style).
- Score trend chart: smooth gold line over pale band regions (red/orange/green tints), clean axis labels.
- Weight chart card: "−2.1 kg since start".
- Photos card: three thumbnails (Front, Side, Back) with soft placeholder silhouettes (no real people) and "Compare" button.
- Habits card: Monday-first week strip of dots for Steps/Water/Sleep.

## 5. Coach app (MacBook, 1440 × 900, macOS / web, light)

**Layout:** left sidebar 240 px on warm off-white with the "VANA" wordmark, items with line icons: This week · Clients · Messages · Library · Payments · Settings. Active item: gold icon and text on accent-tint rounded highlight. Top bar: search field "Search clients ⌘K", bell with badge, avatar.

### Screen K1 — This week board
- Title "This week" + subtitle "Week of 16 Nov 2026" with ‹ › arrows.
- Four stat tiles (white cards): "To review 9", "Submitted 31 of 40", "Not yet 9", "Needs attention 3" (red label).
- Segmented control: To review · Reviewed · Not submitted · All.
- Clean table (no vertical lines, hairline row separators, 56 px rows): Client (avatar initials + name), State (pill: "Submitted", "Reviewed", "Not yet", "Late"), Score (dot + "78%" + band label), Trend (five small dots), Weigh-ins ("6/7"), Habits ("86%"), Unread (small gold badge), Action (text button "Review →").
- Use fictional names: Ava Thompson, Mia Chen, Olivia Rossi, Grace Nguyen, Sophie Walker, Ella Patel, Chloe Martin, Zoe Harris.

### Screen K2 — Review a check-in
- Two columns. Header: "← This week", "Ava Thompson · Weekly check-in · Submitted Sun 22 Nov, 7:14 pm", and "‹ Previous · Next unreviewed ›".
- Left (wide): answers as cards: question, answer, client's note in secondary text, small band dot; under each a quiet "Add feedback" field with mic icon. At the bottom "Overall feedback" with a record button (red dot) and a text area; primary capsule **Mark as reviewed**.
- Right (narrow, sticky): score ring "78% On track", mini score trend (8 weeks), "Weight −0.4 kg this week", "Habits 86%", "Last week 74% (+4)", "View progress →".

## 6. Shared components to show consistently
Capsule primary button (gold, charcoal text), secondary text button (gold), inset grouped list rows, white cards on warm background, segmented control, score pill (dot + label), progress ring, iOS-style sheet with grabber, toast "Saved", empty state (line icon + one sentence + one button).

## 7. Accessibility and content rules
- Text contrast WCAG AA (charcoal text on gold buttons, never white on gold).
- Score colours always paired with a label ("On track").
- Australian English and formats: "23 Nov 2026", "kg", "5pm".
- No real people's photos or names; progress photos shown as neutral silhouettes or blurred placeholders.

## 8. Prompts for ChatGPT (one image each)

Use these one at a time. Ask for a single screen per image, flat front view, no hands or device photography unless stated.

**Prompt 1 — Client Today (iPhone)**
> Create a high-fidelity iPhone UI mockup (393×852, iOS 18 style) for a women's wellness coaching app called Vana. Screen: "Today". Apple Health–inspired, clean and calm: warm off-white background #F7F5F2, white rounded cards (20pt radius), SF Pro–style typography, large bold title "Today" with small date "Monday 23 November" above it, avatar top right. Single accent colour gold #DAA450. Cards top to bottom: (1) "THIS WEEK'S CHECK-IN" card: "Week of 16 Nov", "Due today, 5pm" in orange, gold capsule button with charcoal text "Start check-in", note "12 questions · about 3 min". (2) "WEIGHT" card: big "72.4 kg", "Logged today ✓", a thin gold sparkline. (3) Habits card with three rows and small Apple-Fitness-style rings: Steps 8,240 / 10,000; Water 2.0 L / 2.5 L; Sleep 7h 10m / 7h 30m; line "12-day streak" with a flame symbol. (4) Small "CHECK-IN SCORE" card: "78%", orange pill "On track", "+4 vs last week". Translucent blurred tab bar at the bottom: Today (gold, active), Check-in, Progress, More, with thin line icons. Generous white space, hairline separators, no gradients, no emoji, no heavy shadows.

**Prompt 2 — Check-in question (iPhone)**
> High-fidelity iPhone mockup (iOS 18 style, 393×852) for the Vana wellness app's weekly check-in. Warm off-white background, white content area, SF Pro–style type, accent gold #DAA450. Top: "Cancel" in gold on the left, "Week of 16 Nov" centred in small grey text, "•••" on the right; thin gold progress bar; "Question 3 of 12". Large question "How well did you sleep this week?" with helper text "Think about how rested you felt most mornings." Answer: a row of ten round tappable buttons numbered 1–10, number 7 selected (filled gold, charcoal text), labels "Poorly" and "Very well" under the ends. Below: rounded input "Add a note (optional)". Bottom: text button "Back" and a gold capsule button "Next" with charcoal text, small "Saved ✓" in grey. Minimal, calm, lots of space.

**Prompt 3 — Submitted (iPhone)**
> iPhone UI mockup, iOS 18 style, Vana wellness app, "Check-in submitted" confirmation. Warm off-white background, centred composition: soft green circle with a check mark, title "Check-in submitted", subtitle "Week of 16 – 22 Nov". An Apple-Activity-style ring in orange showing 78% with "78%" in the centre and a pill "On track". Message: "Solid week. Silvi will review it and get back to you." Gold capsule button "Back to Today" (charcoal text) and a gold text link "View my answers". Clean, premium, no confetti, no gradients.

**Prompt 4 — Coach feedback (iPhone)**
> iPhone mockup, iOS 18 style, Vana wellness app, screen "Feedback". Large title "Feedback", subtitle "Week of 9 Nov · Reviewed by Coach Silvi". A white card with a voice-note player: gold play button, waveform, "0:42". A pale gold tint card with the coach's note: "Great consistency with your steps this week — let's focus on getting to bed 30 minutes earlier." Below, an inset grouped list of answers: question in grey, answer in black, small coloured dot with label (Excellent / On track); one answer shows an inline speech-bubble comment from the coach. Warm off-white background, SF Pro–style type, gold accent #DAA450.

**Prompt 5 — Progress (iPhone)**
> iPhone mockup, iOS 18 style, Vana wellness app, screen "Progress". Large title, iOS segmented control "1M · 3M · 6M · All" with 3M selected. Card 1: "Check-in score" line chart in gold over three pale horizontal bands (light red, light orange, light green), minimal axes. Card 2: "Weight" chart, headline "−2.1 kg since start". Card 3: "Photos" with three neutral silhouette placeholders labelled Front, Side, Back and a "Compare" button. Card 4: a Monday-to-Sunday habit strip with small dots for Steps, Water, Sleep. Translucent tab bar with Progress active in gold. Apple Health aesthetic, warm off-white background.

**Prompt 6 — Coach "This week" board (desktop)**
> High-fidelity desktop web app mockup, 1440×900, macOS-inspired clean design, for "Vana" coach dashboard. Left sidebar (warm off-white #F7F5F2) with small "VANA" wordmark and items with thin line icons: This week (active: gold icon and text on pale gold rounded highlight), Clients, Messages, Library, Payments, Settings. Top bar: rounded search field "Search clients ⌘K", bell with small badge, avatar. Main: title "This week", subtitle "Week of 16 Nov 2026" with ‹ › arrows; four white stat cards: "To review 9", "Submitted 31 of 40", "Not yet 9", "Needs attention 3" (red label). iOS-style segmented control "To review · Reviewed · Not submitted · All". A clean table with hairline separators and 56px rows, columns: Client (initials avatar + name), State (pill), Score (coloured dot + % + label), Trend (five small dots), Weigh-ins (e.g. 6/7), Habits (e.g. 86%), Unread (small gold badge), and a gold text action "Review →". Fictional clients: Ava Thompson, Mia Chen, Olivia Rossi, Grace Nguyen, Sophie Walker, Ella Patel, Chloe Martin, Zoe Harris. SF Pro–style type, gold accent #DAA450, no heavy shadows, generous spacing.

**Prompt 7 — Coach review screen (desktop)**
> Desktop web app mockup, 1440×900, clean macOS-inspired design, Vana coach "Review check-in" screen. Same left sidebar as the dashboard. Header: "← This week", title "Ava Thompson · Weekly check-in", meta "Submitted Sun 22 Nov, 7:14 pm", and controls "‹ Previous" / "Next unreviewed ›". Two columns. Left: answer cards, each with the question, the answer in bold, the client's note in grey, a small coloured score dot, and a quiet "Add feedback…" field with a microphone icon. At the bottom "Overall feedback" with a red record button and text area, then a gold capsule button "Mark as reviewed" (charcoal text). Right sticky column: Apple-style ring "78% On track", small 8-week score sparkline, "Weight −0.4 kg this week", "Habits 86%", "Last week 74% (+4)", gold link "View progress →". Warm off-white background, white cards, hairline separators, generous whitespace.

## 9. What to send back
For each screen: the image, plus a short note on anything you changed from the brief and why. Keep the same tokens across all screens so they read as one product.
