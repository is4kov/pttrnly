# pttrnly

A browser tool for composing complex CSS backgrounds from multiple stacked `background-*` layers. Users add layers (gradients, repeating gradients, images, solid colors), tune each one in an editor panel (colors, size, position, repeat, opacity, blend mode), reorder the stack, and copy the resulting CSS.

The generated CSS is the product. Everything in the app exists to make that output easy to author and easy to trust.

---

## Stack

| Concern     | Choice                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| Framework   | React 19 + TypeScript (strict)                                                                              |
| Build       | Vite, SPA — no SSR                                                                                          |
| Styling     | styled-components v6                                                                                        |
| State       | Redux Toolkit                                                                                               |
| Routing     | React Router (needed for share-link state)                                                                  |
| Tests       | Vitest + React Testing Library, Playwright for editor flows, `vitest-axe` / `@axe-core/playwright` for a11y |
| Lint/format | ESLint (typescript-eslint) + Prettier                                                                       |

Do not add a UI component library, a CSS framework, or a second styling solution. All styling goes through styled-components.

---

## Scope — what's in and what's deliberately out

**In scope:**

- Multi-layer background editor: add, edit, delete, duplicate, drag-to-reorder, per-layer visibility toggle, per-layer `mix-blend-mode` / `background-blend-mode`.
- Visual gradient stop editor: draggable multi-stop bar, click-to-add, double-click/Delete-to-remove, per-stop color + alpha + position.
- Shareable links: the entire pattern serialized into the URL.
- Export: copy CSS to clipboard, with user-selectable output format (see **Output contract**).
- Preset gallery (built-in starters) + user patterns saved to `localStorage`.

**Out of scope for now — do not build these unprompted:**

- **PNG / image export.** Deliberately deferred: there is no reliable way to rasterize CSS gradients without either re-implementing the entire gradient renderer on canvas or going through SVG `foreignObject` (which has font and cross-origin caveats). Not worth the cost yet. If it's ever revived, it must render from the same generated CSS string as the preview, and be covered by a visual-diff test.
- **Undo/redo.** Deferred. **However**, all state changes must still go through dispatched Redux actions that describe the edit semantically (`layerUpdated`, `stopMoved`) rather than replacing blobs of state. This keeps a history middleware a cheap addition later. Never mutate outside a reducer, and never keep authoritative layer state in component-local `useState`.
- User accounts, backend, server persistence. The app is fully client-side.
- Animated backgrounds / keyframes.

---

## Architecture

```
src/
  app/            store.ts, root reducer, typed hooks (useAppDispatch/useAppSelector)
  features/
    layers/       slice, selectors, layer list UI, drag-reorder
    editor/       per-layer-type editor panels, gradient stop editor
    preview/      preview surface
    export/       CSS serialization, output-format toggles, clipboard
    share/        URL encode/decode, validation, schema migration
    presets/      built-in presets, localStorage persistence
  domain/         layer types, color model, CSS generation, validation — pure, framework-free
  components/     generic reusable primitives (Slider, ColorSwatch, Popover…)
  styles/         theme, global styles, media query helpers
  test/           setup, factories, render helpers
```

**`src/domain/` is the core and must stay pure.** No React, no Redux, no DOM. It owns the `Layer` types, the color model, validation, and the functions that turn state into a CSS string. This is what gets unit-tested hardest.

**The preview renders by applying the generated CSS string.** It must never have its own parallel rendering implementation. If the preview and the copied CSS can diverge, users stop trusting the output — and that trust is the entire product. One generator, one string, consumed by both.

---

## Data model

Every pattern is a versioned document:

```ts
type Pattern = {
  v: number; // schema version — bump on any breaking shape change
  layers: Layer[]; // index 0 = TOP-most layer (see CSS ordering note)
  canvas: { width: number; height: number; baseColor: Color };
};
```

Rules:

- `Layer` is a discriminated union on `kind` (`'linear-gradient' | 'radial-gradient' | 'conic-gradient' | 'repeating-linear-gradient' | ... | 'solid' | 'image'`). Never widen this to an optional-everything bag of fields. Exhaustive `switch` on `kind` with a `never` fallback is required in CSS generation and editor panel selection.
- Every layer has a stable `id` (`crypto.randomUUID()`), generated in a prepared-action creator — never inside a reducer, never during render.
- Adding a field to `Layer` requires either a safe default in the URL decoder or a `v` bump plus a migration in `features/share`. Old links must never break silently — a link that can't be migrated shows an explicit error, not a blank canvas.

---

## Color model

**Internally, every color is OKLCH.** One canonical representation, defined once in `src/domain/color.ts`, converted only at the edges (input parsing, CSS output, native color picker interop). Do not let hex strings, `rgba()` strings, and objects circulate side by side — mixed representations are the most common source of color bugs.

Why OKLCH: it's perceptually uniform, so gradient midpoints between saturated hues stay vivid instead of sliding through grey. It also lets us emit interpolation hints (`linear-gradient(in oklch, …)`) for noticeably better gradients.

```ts
type Color = { l: number; c: number; h: number; alpha: number }; // l 0–1, c 0–0.4ish, h 0–360, alpha 0–1
```

**Output format is a user-facing toggle, not an internal decision.** The export panel lets the user emit colors as `oklch()`, `hex`, `rgb()`, or `hsl()`. All four serialize from the same `Color`.

**Gamut mapping is required.** OKLCH can describe colors outside sRGB. When serializing to hex/rgb/hsl, clip using a defined gamut-mapping function (reduce chroma, preserve lightness and hue) rather than naive channel clamping. When a color in the current pattern cannot be represented in the selected output format, surface a subtle indicator in the UI — silently changing the user's colors is worse than telling them.

---

## Output contract

The generated CSS string is the deliverable, so its shape is a product decision, not an implementation detail.

- **Two output modes, user-toggleable in the export panel:**
  - _Longhand, pretty-printed_ (default): separate `background-image` / `background-size` / `background-position` / `background-repeat` declarations, one layer per line, aligned. Readable and easy to hand-edit after pasting.
  - _Shorthand, compact_: the `background` shorthand. Note the footgun — the shorthand resets `background-color`, so `canvas.baseColor` must be emitted inside it, not as a separate declaration.
- Both modes must produce visually identical rendering. This is a test: for a given pattern, longhand and shorthand outputs render the same.
- Combined with the color-format toggle, the serializer has a small matrix of modes. Test the matrix, not just the defaults.
- **Declare a browser baseline** in this file once chosen, and don't emit syntax below it without a fallback. Where a pattern uses something newer than the baseline (e.g. `oklch()`, conic gradients), the export panel shows a short, factual note about support — not a scary warning.
- Output must be deterministic: same pattern in, byte-identical string out. Tests assert exact strings.

---

## CSS ordering — the thing everyone gets wrong

In the `background` shorthand, **the first layer listed paints on top; the last paints at the bottom.** Our layer list UI shows index 0 at the top, which matches this — but it's the opposite of how canvas/z-index painting usually reads, so it's a recurring source of bugs.

Also: `background-color` applies only beneath the final layer. Model the base color as a separate `canvas.baseColor`, not as an entry in `layers`.

Any change to layer ordering, reversal, or the preview stack must be covered by a test asserting the exact generated CSS string.

---

## Security — patterns from URLs are untrusted input

A share link is data authored by a stranger that ends up inside a `style` block. React escapes text content, so the risk here isn't classic XSS — it's **CSS injection** and malicious URL schemes.

- **Validate, don't cast.** The URL decoder must parse into `Pattern` through an explicit validating parser that checks every field's type, range, and enum membership. `JSON.parse(...) as Pattern` is banned. A failed validation shows an explicit "this link is invalid or corrupted" state.
- **Never interpolate raw user strings into CSS.** Every emitted value is reconstructed from validated, typed data — numbers formatted by us, keywords from closed enums, colors serialized from `Color`. No pass-through of decoded strings into the output.
- **Image layer URLs are allowlisted** to `https:` and `data:image/*`. Reject `javascript:`, `blob:`, relative URLs, and anything else. Escape/quote the URL when emitting `url("…")`, and reject strings containing quotes, parentheses, backslashes, or newlines rather than trying to sanitize them.
- Numeric fields are clamped to sane ranges on decode — not just for safety but to prevent a link that renders a 900000px layer and freezes the tab.
- The URL codec has fuzz/adversarial tests: malformed payloads, wrong types, out-of-range numbers, and injection attempts must all land in the error state without throwing uncaught.

---

## Loading and persistence precedence

Three sources can supply a pattern on load: the URL, the autosaved working session in `localStorage`, and a preset. Ambiguity here reads to users as data loss, so the rule is explicit:

1. **A pattern in the URL always wins** for what gets displayed.
2. **Opening a share link never silently discards autosaved work.** If autosave contains a pattern that differs from the incoming link, keep the autosave intact and offer a clear way back to it.
3. **With no URL pattern**, restore the autosaved session.
4. **With neither**, open the default/empty state — not a random preset.
5. Loading a preset is an explicit user action and follows the same non-destructive rule.

Storage rules:

- Autosave and URL sync are debounced (~300ms) and use `replaceState` — never one history entry per slider tick.
- `localStorage` is small and shared. Handle `QuotaExceededError` explicitly with a user-visible message; never let a failed save corrupt or silently drop the saved list.
- Saved patterns are versioned with the same `v` + migration path as share links.

---

## Mobile

Mobile is a first-class target, not a responsive afterthought.

- Layout: preview and editor share the screen on desktop; on small viewports the editor becomes a bottom sheet over a full-bleed preview.
- All interactive controls have a minimum 44×44px hit target, including gradient stop handles (the visual handle may be smaller than the touch area — use a transparent padded hit region).
- Every drag interaction (reorder, gradient stops, position pads) must work with Pointer Events, not mouse events. Handle touch explicitly: set `touch-action: none` on drag surfaces so the page doesn't scroll mid-drag.
- Respect `prefers-reduced-motion`; respect safe-area insets on the bottom sheet.
- Test at 360px width minimum.

---

## Accessibility

a11y is a requirement, not a nice-to-have. A feature isn't done if it's mouse-only.

- **The gradient stop editor must be fully keyboard-operable.** Each stop is a focusable `role="slider"` with `aria-valuemin/max/now/text`; arrow keys nudge position (Shift = coarse step), Delete removes, Enter opens the color picker. Announce changes via an `aria-live="polite"` region.
- **Layer reordering must have a non-drag path** — keyboard shortcuts and/or explicit move up/down buttons. Drag-and-drop alone is not accessible.
- Semantic HTML first. `role` attributes are a last resort, and every custom widget follows the matching APG pattern.
- Visible focus indicators everywhere; never remove outlines without an equal replacement.
- Color inputs must expose a text field with the color value — pickers alone are not usable without sight, and the app is literally about color.
- Labels on every control. Icon-only buttons need `aria-label`.
- App chrome must meet WCAG 2.2 AA contrast. (The user's _generated_ pattern is content, not chrome — but where we show a preset's contrast, be accurate.)
- Automated axe checks run in CI on key screens. Passing axe is the floor, not proof of accessibility — verify keyboard flows manually.

---

## UI foundations

Conventions specific to a tool about color. Decide once, apply everywhere.

- **Alpha checkerboard** behind every color swatch, the gradient stop bar, and the preview surface. Without it, "transparent" and "white" are indistinguishable — a constant source of confusion in this class of tool.
- **Dark and light app chrome**, following `prefers-color-scheme` with a manual override. A background-design tool gets judged on how it looks; also, a pattern reads completely differently against dark vs. light chrome, so users need both.
- **One keyboard-shortcut registry** in a single module — the source of truth for both the handlers and the help dialog. Never bind a shortcut inline in a component. Avoid clobbering browser defaults.
- **Defined empty and edge states**: zero layers, all layers hidden, a gradient with a single stop, an image layer that fails to load. Each gets an intentional design, not a blank rectangle.
- Copy-to-clipboard always confirms visibly. A silent copy button feels broken.

---

## Performance

Sliders fire continuously; a naive implementation re-renders every layer on every pixel of drag.

Budgets (enforced in CI where possible):

- Initial JS bundle ≤ 200KB gzipped.
- Dragging any control holds 60fps (≤16ms frames) with 20 layers on a mid-range device.
- Interaction latency (INP) < 200ms.
- The editor stays usable at 50+ layers.

Rules:

- Selectors must be narrow. A layer row subscribes to _its_ layer, not to `state.layers`. Use memoized/parametric selectors and `createSelector`; never `useAppSelector(state => state.layers)` in a leaf component.
- Never return a new array/object from a selector without memoization.
- Preview updates during a drag go through a throttled/rAF path.
- Prefer CSS custom properties for values that change at high frequency, so a drag mutates a variable instead of regenerating styles.
- Memoize rows with `React.memo` and stable callbacks.

---

## styled-components conventions

- One `theme` in `src/styles/theme.ts` — colors, spacing scale, radii, breakpoints, z-index scale. No hardcoded hex values or magic pixel numbers in component files.
- Media queries via theme helpers, not raw strings.
- Transient props (`$active`, `$size`) for anything that shouldn't hit the DOM.
- Define styled components at module scope. Defining them inside a render function remounts the subtree on every render — a real bug, not a style nit.

---

## Privacy and offline

- Fully client-side. No backend, no accounts, no network calls for core functionality. Patterns live in the URL and `localStorage` and never leave the browser.
- **No analytics, telemetry, or third-party scripts.** Adding any is a product decision requiring explicit approval, not a routine change.
- The app should work offline once loaded. Ship a service worker for the app shell; keep it simple and make sure it can't serve a stale build indefinitely.
- No external font/CDN requests at runtime — self-host anything needed.

---

## Quality bar

- **TypeScript strict**, plus `noUncheckedIndexedAccess`. `any` is banned; `unknown` + narrowing instead. Type assertions need a comment explaining why they're sound.
- **Tests are expected with each change:**
  - `src/domain/` — unit tests, high coverage. CSS generation tested by asserting exact output strings, across the output-mode × color-format matrix.
  - Components — React Testing Library, queried by role/label (which doubles as an a11y check). No snapshot tests of whole trees.
  - Editor flows (add layer → edit → copy CSS, share link round-trip, gradient stop drag) — Playwright, including a keyboard-only run.
  - Round-trip property test: `decode(encode(pattern)) === pattern`.
  - Adversarial decode tests for the URL codec (see **Security**).
- ESLint and Prettier must pass. No disable comments without a justification.
- CI runs: typecheck, lint, unit, e2e, axe, bundle size. Green CI is required to merge.

### Test environment gotchas

Known traps — don't rediscover these the hard way:

- **jsdom has no Pointer Events.** Anything drag-based (stop editor, layer reorder, position pads) cannot be meaningfully unit-tested — those go in Playwright. Don't fake it with `mouseDown` and call it covered.
- **jsdom has no real clipboard.** Stub the clipboard API in unit tests; verify actual copy behavior in Playwright.
- **`crypto.randomUUID` breaks deterministic assertions.** Seed or stub it in `src/test/setup.ts` so layer IDs are stable, and build fixtures through shared factories in `src/test/`.
- **`matchMedia` is unimplemented in jsdom** — needs a stub for anything reading `prefers-color-scheme` or `prefers-reduced-motion`.
- Don't assert on styled-components' generated class names. Assert on role, label, or computed style.

---

## Git — do not commit without permission

Repository: `https://github.com/is4kov/pttrnly`

**Never run `git commit` unless the user explicitly asks for a commit in that message.** Finishing a task, passing tests, or reaching a "good stopping point" is not permission. Leave changes in the working tree and say what's staged/unstaged instead.

- **The commit message is always discussed first.** Propose a message, wait for approval or edits, then commit. Never write a message and commit in the same step.
- This applies to everything that writes history: `git commit`, `git commit --amend`, `git push`, `git merge`, `git rebase`, `git reset --hard`, `git checkout`/`switch` that would discard work, and branch deletion. Ask first.
- Never bundle unrelated changes into one commit. If the working tree has several concerns in it, say so and propose how to split them.
- No auto-generated commit trailers, co-author lines, or tool attribution unless the user asks for them.

### Branch strategy

**`main` is protected and must always be green.** Never commit or push to `main` directly — no exceptions, including docs-only or "trivial" changes.

- Every task branch is cut **from an up-to-date `main`**, never from another task branch.
- Branch name: `PTRN-{n}-short-slug` — e.g. `PTRN-4-gradient-stop-editor`. Lowercase kebab slug, a few words.
- The bracketed form `[PTRN-{n}]` is the prefix for **commit messages and PR titles**, not for branch names (brackets in refs need shell quoting and confuse some tooling).

**Allocating `{n}`:** take the highest `PTRN-` number appearing in _any_ pull request on the repo — open, closed, or merged — and add one. Scan PRs rather than branches: merged branches get deleted, PRs do not. Never reuse a number, even from an abandoned task.

**`TASKS.md` is a local, gitignored convenience ledger** — one row per allocated number, with a link to its PR. It is deliberately _not_ under version control: keeping it tracked would force every PR to edit a file unrelated to its own concern. Pull request history is the authoritative record; `TASKS.md` is just a readable index of it.

### Pull request flow

All changes reach `main` through a PR. The sequence is fixed:

1. Agree the task and the number with the user.
2. Cut `PTRN-{n}-slug` from current `main`.
3. Do the work. Keep the PR to **one concern** — a PR that needs "and" in its title is usually two PRs.
4. **Ask for permission to commit, and agree the message.** This does not change because it's a branch instead of `main`.
5. Commit as `[PTRN-{n}] type: subject` — Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`), imperative mood, scope when useful: `[PTRN-4] feat(editor): add gradient stop editor`.
6. Push the branch, open the PR, and **post the PR link in chat.**
7. The user reviews, approves, and merges. Claude never merges, never approves, never force-pushes over a branch under review.

- **Squash merge only.** One commit per PR on `main`, so the PR title becomes the commit message — meaning the PR title must be agreed exactly like a commit message.
- Merged branches are deleted; the PR history preserves the record.
- CI must be green before a PR is mergeable. A red PR gets fixed, not merged.
- Review feedback is addressed with new commits on the same branch, not by rewriting history under the reviewer.

---

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # typecheck + production build
npm run typecheck
npm run lint         # add --fix to autofix
npm run test         # Vitest watch
npm run test:run     # Vitest once (CI)
npm run e2e          # Playwright
```

---

## Working agreements

- Read `src/domain/` before touching anything that generates CSS.
- When adding a new layer `kind`: add it to the union, handle it in the CSS generator's exhaustive switch, add an editor panel, add a URL codec case with validation, add tests for the generated string, and add at least one preset using it. Skipping any of these leaves the app subtly broken.
- Prefer deleting code over adding flags.
- Never commit without being asked, and never commit a message that hasn't been agreed (see **Git**).
- If a change makes an existing share link produce different output, that's a breaking change — bump `v` and write the migration.
- Ask before adding a dependency.
