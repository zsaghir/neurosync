# Handoff: NeuroSync (ADHD Task App) Redesign — Final Direction (4a)

## Overview
Calm, low-cognitive-load redesign for the NeuroSync Expo/React Native app (tasks, subtasks, timers, Time Map insights, settings). Target codebase: `zsaghir/neurosync` (Expo Router, Tamagui, Clerk auth).

## About the Design Files
The bundled `.dc.html` file is a **design reference built in HTML** — a prototype of look, layout, and states, not production code. The task is to **recreate this design inside the existing Expo/Tamagui codebase**, using its existing components (`Button`, `Card`, `Input`, `XStack`/`YStack` from Tamagui), navigation (`expo-router` tabs), and data layer (Clerk auth, existing task/timer stores) — not to port the HTML/CSS directly.

## Fidelity
**High-fidelity.** Colors, spacing, type sizes, radii, and copy are final. Recreate pixel-close using Tamagui's theming (extend/override the current Tamagui config's tokens rather than hardcoding), matching the values below.

## Screens (all in the "4a — Final design" section of the HTML file)
1. **Today** — greeting, quick-capture bar, "Up next" featured task with Start focus CTA, up to 2 additional tasks + "See all," supportive daily-effort line (no analytics).
2. **Tasks** — flat single-column list; each collapsed row shows checkbox + title + optional estimate + optional subtask progress only. Collapsed "Completed" row at bottom. FAB (+) opens Add task.
3. **Add task** — bottom sheet: title input, progressive-disclosure estimate chips (Quick/Medium/Long/Skip), primary "Add task" button.
4. **Task details** — drill-in (not modal-stacked): title + checkbox, Start focus CTA, subtasks list with inline add, collapsed Notes disclosure, secondary text actions (Adjust time / Add time manually / Delete).
5. **Active focus timer** — full-screen dark, task name, large mono-weight countdown, muted estimate line, Done as primary text action, Pause secondary.
6. **Timer review** — plain-language summary ("Nice work showing up." / "You guessed 45 — it ran shorter. That's useful data, not a miss."), Save primary, Adjust time / Don't count this one as secondary text links.
7. **Time Map** — 3 stat cards (typical session, sessions counted, weekly total), a flat 7-bar weekly bar graph (no gridlines/decoration), one supportive insight line, recent sessions list with "See all."
8. **Settings** — profile row + Sign out, **Sign-in method row showing "Connected with Google"** (Clerk `oauth_google` SSO, matches `components/SignInWithGoogle.tsx`) with Manage action, time-estimation-mode radio group, appearance toggle (Light/Dark pill buttons).
9. **Manual time entry** — bottom sheet: numeric minutes field, quick-pick chips (5/20/30/60m), Save time primary button.

Also included in the file (earlier "3" section): loading, empty, error, and active-timer-in-list states for the Tasks screen, plus long-title and many-subtask row examples.

## Interactions & Behavior
- Today → tapping "Up next" card or "Start focus" opens Active focus timer directly (skip task details for the primary flow).
- Tasks row tap → Task details (push navigation, not modal).
- Timer Done → Timer review (auto-navigates back to task details or Tasks on Save).
- FAB → Add task bottom sheet (slide up, dismiss via drag/×).
- Settings → Sign-in "Manage" opens a secondary sheet/screen with disconnect/switch-account options (not mocked in detail — standard Clerk account management flow).
- All secondary controls (delete, adjust time, notes, manual time) are text links, not icon buttons, to keep touch targets ≥44×44 and labels self-evident for screen readers.

## State Management
- Task list: active/completed arrays, `expanded` per task for subtasks, `subtaskProgress` derived count.
- Add/Edit task: draft title, estimate mode (quick/medium/long/skip) driven by the user's Settings preference.
- Timer: `status` (idle/running/paused), `elapsedSeconds`, `estimateSeconds`.
- Timer review: `actualSeconds`, `estimateSeconds`, computed variance copy (shorter/longer/close), `counted` boolean.
- Time Map: per-day minute totals (7-day window) for the bar graph, aggregate stats (typical session median, sessions counted, weekly total).
- Settings: `estimationMode` enum, `appearance` (light/dark), `authProvider` (google/email) read from Clerk session.

## Design Tokens
**Colors**
- Background: `#f7f4ef`
- Surface: `#fffefb`
- Border/hairline: `#e6e0d5`
- Text (primary): `#1c1b18`
- Text (subtle): `#7d766b`
- Text (faint, e.g. completed): `#a39b8d` / `#c9c2b4`
- Accent (primary/CTA): `#9c5b3f`
- Accent soft (backgrounds/insight banners): `#f0e2da`, insight text `#7a4128`
- Success/muted-positive bar: `#e3cabc` (unselected day), `#9c5b3f` (highlighted day)
- Error (muted, non-alarming): background `#f5e6e2`, text `#a14b3f`
- Dark surfaces (timer, sheet scrims): `#1c1b18`, `#2a221c`, scrim `rgba(20,15,10,.5)`
- Google "G" mark background: white chip, `#4285f4` letter (do not restyle the Google mark itself)

**Typography** (system-ui / Tamagui default stack)
- Screen title: 26px / weight 800
- Card title: 20px / weight 700
- Task row title: 17px / weight 600
- Body: 15px / weight 500
- Meta/caption: 13px / weight 400, color subtle
- Section label: 12px / weight 700, uppercase, letter-spacing 0.06em, color subtle

**Spacing** — 8px base scale: 4, 8, 12, 16, 20, 24, 32, 40, 48

**Corner radii**
- sm: 8px (chips inside inputs, day bars)
- md: 12px (inputs, small cards)
- lg: 16px (cards, sheets top corners)
- pill: 999px (buttons, chips, estimate pills)

**Buttons**
- Primary: accent fill `#9c5b3f`, white text, pill radius, height 48–52px
- Secondary: surface fill, 1px border `#e6e0d5`, pill radius, height 44px
- Text button: no fill, accent or subtle text color, min 44px tap height

**Touch targets:** all interactive rows/buttons ≥44×44px.

## Assets
No custom icons/illustrations used — checkboxes, chevrons, and bars are drawn with plain divs/borders (no SVG decoration). The Google sign-in row uses a plain "G" letterform placeholder; swap in the official Google "G" logo asset per Google's brand guidelines when implementing.

## Files
- `ADHD App Directions.dc.html` — full design file. The final recommended direction is turn 4 ("4a — Final design", id `#4a`) near the top of the file. Earlier turns (1, 2, 3) are exploratory directions/iterations kept for reference; not part of the final direction.
