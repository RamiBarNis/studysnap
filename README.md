# StudySnap — frontend demo (mock data)

Snap a photo of your homework → get a checklist, a study plan, AI explanations,
and a focus timer. This is a **frontend-only demo**: all data is mocked in
`js/data.js`, nothing leaves your machine.

## Run it

No build step, no dependencies — just open the file:

```
open index.html
```

(or double-click it in Finder). Works fully offline; the Google Font falls back
to the system font when offline.

## What's inside

| Piece | Where |
|---|---|
| Landing page (hero, features, how-it-works, CTA) | `index.html` `#view-landing` |
| Image upload + mock scan flow | Upload card → `initUpload()` in `js/app.js` |
| Homework checklist (filters, progress, subtasks) | `renderTasks()` in `js/app.js` |
| Study plan recommendation card | `renderPlan()` in `js/app.js` |
| Pomodoro timer (plan-driven session queue, skip/reset, beep) | `js/pomodoro.js` |
| Task details modal (subtasks, focus trap, Esc to close) | `openTaskModal()` in `js/app.js` |
| AI explanation (step-by-step reveal) | `renderAI()` in `js/app.js` |
| Learning resources (subject filters) | `renderResources()` in `js/app.js` |
| Mock data (tasks, plan, resources, AI steps) | `js/data.js` |
| Inline SVG icon set (Lucide-style) | `js/icons.js` |
| Study planner algorithm prototype (Python) | `planner.py` |

## Design system

- **Style**: warm minimalism — playful orange `#F97316` + trust blue `#2563EB`,
  cream background, rounded cards
- **Type**: Plus Jakarta Sans (400–800), `system-ui` fallback
- **Themes**: light + dark (toggle in the navbar, persisted in `localStorage`)
- **Tokens**: all colors/shadows/radii are CSS custom properties in
  `css/styles.css`
- **A11y**: 44px touch targets, visible focus rings, aria labels/roles,
  `prefers-reduced-motion` respected, semantic color + icon pairing

## Notes

- "Try a sample scan" simulates the OCR flow without needing a photo; choosing
  or dropping a real image shows its preview before the mock scan runs.
- "Start focus session" (task modal) and "Start first block" (plan card) drive
  the Pomodoro timer via `window.StudySnapTimer`.
