# TeamLoad Smoke Test Checklist

Use this checklist before and after product-routing, demo, persistence or deployment changes.

## 1. Landing page

### Desktop

- Open `/`.
- Confirm the TeamLoad brand is visible in the fixed header.
- Confirm the cinematic desktop hero is visible and does not overlap following sections.
- Confirm the main message is clear: sessions, availability, final attendance and load context.
- Click `Watch interactive demo`.
- Confirm it opens `/coach/dashboard` in demo mode.

### Mobile

- Open `/` on iPhone/Safari or a narrow responsive viewport.
- Confirm the hero does not overlap the Product Focus section.
- Confirm the header CTA remains tappable.
- Confirm headline, paragraph and metrics are readable without horizontal scroll.
- Confirm scrolling from Hero to Product Focus feels clean.
- Click `Watch interactive demo`.
- Confirm it opens `/coach/dashboard` in demo mode.

## 2. Demo routing

Start from a fresh browser session if possible.

- Open `/`.
- Click `Watch interactive demo`.
- Confirm the URL becomes `/coach/dashboard`.
- Confirm no login screen appears.
- Confirm no setup wizard appears.
- Confirm the Coach Workspace header shows demo context.
- Confirm the demo toggle cannot accidentally disable the local demo workspace.

## 3. Coach demo pages

Verify these paths work by clicking navigation and by direct URL refresh:

- `/coach/dashboard`
- `/coach/sessions`
- `/coach/calendar`
- `/coach/attendance`
- `/coach/load-monitor`
- `/coach/players`
- `/coach/groups`

For each path:

- Page loads without redirecting to `/select-role`.
- Page does not show an auth wall.
- Demo data is visible where expected.
- Browser back/forward keeps the app inside the coach workspace.

## 4. Direct route refresh

Paste each URL directly into the browser and refresh:

- `/coach/dashboard`
- `/coach/sessions`
- `/coach/calendar`
- `/coach/attendance`
- `/coach/load-monitor`

Expected:

- Vercel serves the SPA correctly.
- No 404 page appears.
- App resolves into the correct route or safe demo/role state.

## 5. Athlete availability flow

From an athlete/calendar context:

- Mark `Komme`.
- Mark `Spaeter` with minutes.
- Mark `Unsicher` with a reason.
- Mark `Absage` with a reason.
- Try submitting `Unsicher` or `Absage` without reason and confirm validation prevents it.

Expected model:

- Players are expected by default.
- Only exceptions require action.
- Late requires minutes.
- Maybe/no require a reason.

## 6. Final attendance flow

From `/coach/attendance`:

- Select a session.
- Set a player to `Present`.
- Set a player to `Late`.
- Set a player to `Partial`.
- Set a player to `Excused absent`.
- Set a player to `Unexcused absent`.

Expected:

- Final attendance is separate from athlete availability.
- Coach-final state remains visible after navigation within the session.
- Demo/local persistence works in the current browser session.

## 7. Pre-persistence caveat

Before cloud persistence is implemented, verify and communicate this clearly:

- Availability and final attendance may still be local/demo-first.
- Cross-device correctness is not guaranteed until the persistence layer is implemented.
- A production-ready team workflow requires cloud-backed availability and final attendance.

## 8. Regression watchlist

Check especially after major changes:

- Old FitFuel tour must not appear in Coach routes.
- `/coach/*` must not route back to `/select-role` during demo.
- Mobile landing must not show overlapping hero/product sections.
- Bottom nav must remain usable on mobile.
- No TypeScript build errors from unused imports or unused parameters.
