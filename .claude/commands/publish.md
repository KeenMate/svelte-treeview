---
description: Prepare @keenmate/svelte-treeview for npm publish — bump version, finalize CHANGELOG/README, build, test, commit
argument-hint: rc|release|patch|minor|major
---

# /publish — prepare an npm release of @keenmate/svelte-treeview

You are preparing this package for `npm publish`. **Do not run `npm publish`** — the user logs in and publishes manually.

This command follows the canonical `/publish` structure defined in the BlissFramework component guidelines at
`web-components/publish-command.md`. Sections marked **[canonical]** are byte-identical across every
component's `/publish`; sections marked **[per-repo]** are customized for this repo's layout, build, and tests.

## Argument [canonical]

The release type: **$ARGUMENTS**

Must be one of:

- `rc` — ship the WIP rc as-is. The topmost CHANGELOG heading (e.g. `## [5.0.0-rc11] - 2026-06-18`) gets ` [PUBLISHED]` appended.
- `release` — promote a WIP rc to a final release. `X.Y.Z-rcN` → `X.Y.Z`. CHANGELOG heading is renamed to match the new version.
- `patch` — SemVer patch bump. Drops any `-rc` suffix.
- `minor` — SemVer minor bump. Drops `-rc`. Resets patch.
- `major` — SemVer major bump. Drops `-rc`. Resets minor and patch.

If missing or invalid, stop and ask the user which one to use (don't guess).

## Repo layout [per-repo]

Single-package repo, everything at root:

- **`./package.json`** — `version` field is the source of truth.
- **`./CHANGELOG.md`** — at the root. Topmost `## [X.Y.Z] - YYYY-MM-DD` heading **without** the `[PUBLISHED]` marker is the WIP section.
- **`./README.md`** — at the root. Carries `## What's New in vX.Y.Z` sections near the top (one per release, the **two most recent** retained).
- **`./dist/`** — gitignored. Produced by `npm run build` (`prepack` → svelte-kit sync → svelte-package → lightningcss → publint). Never staged.
- **`./src/lib/constants.generated.ts`** — **auto-generated** from `package.json` by `npm run generate-constants` (chained into `prepack`). Tracked in git but never hand-edited; stage it if the build changes it.

## CHANGELOG convention in this repo [canonical]

There is **no `## [Unreleased]` section**. The WIP section is the topmost `## [X.Y.Z] - YYYY-MM-DD` heading without a `[PUBLISHED]` tag. Already-released sections carry `[PUBLISHED]` at the end of their heading:

```
## [5.0.0-rc11] - 2026-06-18                  ← WIP, the one you're shipping
### Added
- ...

## [5.0.0-rc10] - 2026-06-09 [PUBLISHED]
### Added
- ...
```

Publishing the WIP section means **appending ` [PUBLISHED]`** to its heading — exact format: `## [X.Y.Z] - YYYY-MM-DD [PUBLISHED]`. The next development cycle creates a fresh `## [next-version] - <date>` heading on its first CHANGELOG edit.

**Historical drift in this repo:** This repo just migrated from the `## [Unreleased]` accumulator convention to the `[PUBLISHED]`-tag-on-WIP convention (2026-06-18). The first WIP section under the new convention is `5.0.0-rc11`. Older sections (5.0.0-rc10 and earlier) lack `[PUBLISHED]` tags — that's expected; we don't retro-fix.

## Resolve versions [canonical]

Read `./package.json` `version` as `CURRENT_VERSION`.
Read the topmost `## [X.Y.Z...]` heading from `./CHANGELOG.md` as `WIP_VERSION` (the version the latest WIP section is tagged for).

Compute `NEW_VERSION`:

| Argument | Logic |
|---|---|
| `rc` | If `CURRENT_VERSION` matches `X.Y.Z-rcN`, `NEW_VERSION = CURRENT_VERSION` (no bump — we're shipping what's already in package.json). If `CURRENT_VERSION` is not an rc, stop and ask the user (they probably wanted `release`/`patch`/etc.). |
| `release` | If `CURRENT_VERSION` matches `X.Y.Z-rcN`, `NEW_VERSION = X.Y.Z`. Otherwise stop. |
| `patch` | Strip any `-rcN`, then bump patch. |
| `minor` | Strip any `-rcN`, then bump minor, reset patch. |
| `major` | Strip any `-rcN`, then bump major, reset minor and patch. |

If `WIP_VERSION` ≠ `NEW_VERSION` (e.g. the WIP is `X.Y.Z-rcN` but the user asked for `release`), the CHANGELOG heading rename in step 3 also re-tags the section to `NEW_VERSION` — call this out in the report so the user notices.

## Steps (in order)

### 1. Sanity checks [canonical]

- Run `git status`. The repo intentionally keeps `.claude/`, `test-results/`, `playwright-report/`, and `clipboard-implementation.md` untracked — those are fine. If there are **other** uncommitted changes that aren't `CHANGELOG.md`, `README.md`, or `package.json`, list them and ask the user before continuing. (Typical case: substantive source changes belonging in this release that haven't been committed yet — confirm they're intended for this version before bumping.)
- **Verify the new version isn't already on npm.** Run `npm view @keenmate/svelte-treeview@<NEW_VERSION> version 2>/dev/null` — if it returns the version string, that version is already published and **stop**: bumping over it would fail at publish time and pollute the commit.
- **Verify the registry hasn't drifted past you.** Run `npm view @keenmate/svelte-treeview version` to fetch the latest published version on the `latest` tag; if it's higher than `NEW_VERSION` (e.g. someone shipped from another machine, or there's a registry-vs-local mismatch from before the [PUBLISHED] convention landed), warn the user and ask before continuing.
- Confirm the WIP CHANGELOG section has at least one bullet of substantive content under `### Added`, `### Changed`, `### Removed`, `### Fixed`, or `### Internal`. If empty, stop — there's nothing meaningful to release.
- Confirm `./README.md` has a `## What's New in vWIP_VERSION` section. If it's missing, draft one from the CHANGELOG and present it to the user for approval before continuing:
  - Read the WIP CHANGELOG section, distill it to 5–8 scannable bullets covering the Added/Changed themes (paraphrase, don't copy CHANGELOG bullets verbatim — those are exhaustive; What's New is the highlight reel). Pure internal refactors and Fixed-only entries don't need coverage, though headline bug fixes worth advertising are worth a bullet.
  - **Follow the canonical "What's New" format** defined in the BlissFramework component guidelines (`web-components/readme-structure.md` → "`## What's New in vX.Y.Z` — canonical format"). Auto-check **C-RS-16** in `readme-structure.checks.sh` enforces it. Concretely:
    - **Heading:** `## What's New in vNEW_VERSION` — lowercase `v`, no backticks around the version, no date.
    - **Each bullet:** `- **<area or component> — <one-line headline>** — <engineer-level prose, 3–8 sentences>`. Bold-wrapped lead phrase, then a true em-dash (` — `, U+2014 with surrounding spaces), then a prose body explaining *what changed*, *why* (regression history / motivation), *what surface is affected* (concrete component / prop / file names listed inline), and *the mechanism* (the technique used). Plain hyphens or en-dashes fail the check.
    - **No `### ` sub-headings** inside a What's New section — no `### Added` / `### Fixed` lifted from the CHANGELOG. It's a flat bullet list.
    - **Reference implementation:** the `## What's New in v1.3.3` / `v1.3.2` sections at the top of `svelte-fluentui/README.md` are the canonical shape — mirror that voice and structure.
  - Show the user the proposed draft as plain markdown in your reply. Ask whether to (a) insert as-is, (b) edit, or (c) abort so they can write it themselves.
  - Only proceed past step 1 once the user approves the draft (or supplies their own). On approval, insert the section directly above the current top `## What's New in vX.Y.Z` heading in `./README.md`, then continue.
  - Do not silently insert the draft without confirmation — release highlights are a writing call and the user owns the voice.

### 2. Bump version (if needed) [canonical]

If `NEW_VERSION` ≠ `CURRENT_VERSION`, edit `./package.json` and change `"version": "CURRENT_VERSION"` to `"version": "NEW_VERSION"`.

For `rc` arg this is normally a no-op — version was bumped earlier in the development cycle.

Note: `./src/lib/constants.generated.ts` is auto-generated from `package.json` by `npm run generate-constants` (chained into `prepack`, which runs as part of `npm run build`). Do not hand-edit it; the build step in Section 8 takes care of it and you'll stage the result in Section 10.

### 3. Finalize CHANGELOG [canonical]

In `./CHANGELOG.md`:

- If `WIP_VERSION` ≠ `NEW_VERSION` (e.g. promoting `X.Y.Z-rcN` → `X.Y.Z`), rename the WIP heading from `## [WIP_VERSION] - <date>` to `## [NEW_VERSION] - <today>` (today's date from system context).
- If `WIP_VERSION` == `NEW_VERSION`, leave the bracketed version alone but update the date to today **if** the existing date is stale (more than a few days old). The WIP date is usually whatever day the section was opened; refresh it so the changelog reflects the actual ship date.
- In either case, **append ` [PUBLISHED]`** to the heading so it reads exactly: `## [NEW_VERSION] - YYYY-MM-DD [PUBLISHED]`.
- Leave all bullet content untouched.
- **Do not** create an empty new WIP section — the next dev cycle's first CHANGELOG edit will create one.

### 4. Update README "What's New" — only if version changed [canonical]

In `./README.md`:

- If the existing `## What's New in vWIP_VERSION` section's version differs from `NEW_VERSION` (e.g. promoting `X.Y.Z-rcN` → `X.Y.Z`), rename its heading to `## What's New in vNEW_VERSION`. (No content rewrites — the text was already curated for this release.)
- Then count the `## What's New in vX.Y.Z` headings. If there are more than **two**, delete the oldest ones so only the **two most recent** remain (the just-finalized one plus the one before it).

For `rc` arg this is normally a no-op on the heading itself — only trims if someone left an extra-old section behind.

### 5. Validate README reflects the release [canonical]

Read both the finalized CHANGELOG section and the matching `What's New in vNEW_VERSION` section. Every **Added** or **Changed** bullet in the CHANGELOG that represents a user-facing feature or behavior change should have a corresponding hit in the What's New section (paraphrased, not verbatim). Pure internal refactors and `Fixed`-only entries don't need coverage, though headline bug fixes worth advertising (e.g. "X used to silently fail; now works") are worth a bullet.

If you find a significant CHANGELOG entry that isn't reflected in What's New, add a bullet for it. If the section ends up with more than ~8 bullets after this pass, condense — What's New should be scannable, not exhaustive.

### 6. Validate CHANGELOG entries match recent work [canonical]

Find the previous `[PUBLISHED]` tag in CHANGELOG (the version just before NEW_VERSION) and locate the commit that bumped to it — usually a commit whose subject starts with `v<previous-version>` or `- v<previous-version>`. Run `git log --oneline <previous-publish-commit>..HEAD` to list commits since.

Also check `git diff` (or `git status`) for any uncommitted source/test work outside the files you're editing in this command.

For every substantive commit or uncommitted change, verify the WIP CHANGELOG section mentions it. If something significant is missing, **stop and ask the user** before finalizing — don't invent entries on their behalf. Pure example/doc tweaks and trivial typo fixes don't need entries.

### 7. Run tests [per-repo]

Run `npm run test:e2e`. e2e tests via Playwright. All specs must pass.

If anything fails, **stop and report**. Do not proceed to build/commit. The user fixes the regression (or decides to fixme the spec) before the publish flow can continue.

If Playwright complains that chromium isn't installed, suggest `npx playwright install chromium` and stop.

### 8. Build the package [per-repo]

Run `npm run build`. This chains:

1. **`prepack`** — runs `npm run generate-constants` (regenerates `src/lib/constants.generated.ts` from `package.json`) then `svelte-kit sync`.
2. **`svelte-package`** — emits `dist/` (ESM + d.ts).
3. **`lightningcss`** — bundles/minifies CSS into `dist/`.
4. **`publint`** — validates the package against npm conventions. publint errors stop the build — fix them before continuing.

**Build gotcha:** `src/lib/constants.generated.ts` is regenerated on every build. If you hand-edit it, the next `npm run build` will overwrite your edits. Always change `package.json` (or the generator script) instead.

If anything fails, stop and report.

After build, smoke-check:
- `./dist/` is non-empty and includes ESM + d.ts.
- `./src/lib/constants.generated.ts` reflects the version currently in `./package.json`.

### 9. Verify the package contents [per-repo]

Run `npm pack --dry-run` and confirm the file list includes the standard svelte-package output:

- `dist/` (ESM + d.ts + bundled CSS)
- `package.json`
- `README.md`
- `LICENSE`

If anything user-facing is missing or anything private leaked in (e.g. `src/`, `e2e/`, `*.spec.ts`, `tsconfig.json`, `svelte.config.js`, `test-results/`, `playwright-report/`), stop and report — the `files` field in `package.json` controls this and the leak needs fixing before publish.

### 10. Commit [canonical]

Stage:

- `./CHANGELOG.md`
- `./README.md`
- `./package.json`
- `./src/lib/constants.generated.ts` (only if `npm run build` changed it)

Do **not** stage `dist/` — it's gitignored.

Commit message format:

```
vNEW_VERSION - <one-line summary of the headline change>

<grouped bullets paraphrased from the CHANGELOG section — split into the same
groups the CHANGELOG used: Added, Fixed, Changed, Internal, etc. Keep bullets
terse; full prose lives in the CHANGELOG.>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

### 11. Report [canonical]

Report back with:

- The new version number
- The commit SHA
- The exact commands to publish. **Pick the right one for the arg type:**
  - For `rc` (publishing a pre-release):
    ```
    npm login          # if not already logged in
    npm publish --tag rc
    ```
    The `--tag rc` is critical — without it npm assigns the `latest` dist-tag, which would make the pre-release the default install for everyone running `npm install @keenmate/svelte-treeview`. With `--tag rc`, the `latest` tag stays put and consumers opt in via `@rc` or pinning the exact version.
  - For `release` / `patch` / `minor` / `major` (publishing a stable release):
    ```
    npm login          # if not already logged in
    npm publish
    ```
    No `--tag` needed — it correctly lands as `latest`.
- A reminder that the CHANGELOG `[PUBLISHED]` tag is now in place — if `npm publish` fails, the user should revert both the tag (CHANGELOG heading) and the version bump (`package.json`) before retrying, since the registry will refuse to re-publish the same version.

## Things not to do [canonical]

- **Do not run `npm publish`.** The user publishes manually after `npm login`.
- **Do not push to git remote.** The commit stays local until the user pushes.
- **Do not create an empty `[Unreleased]` or new WIP heading** in CHANGELOG after finalizing — the next dev cycle's first edit creates the next heading.
- **Do not retro-fix older CHANGELOG sections** that are missing the `[PUBLISHED]` tag or carry legacy markers — only finalize the section you're shipping.
- **Do not silently insert a drafted What's New section.** If you draft one in Step 1 because it's missing, you must present it and wait for explicit approval (or edits) before inserting — the writing voice is the user's call, even when you're handing them a starting point.
- **Do not keep more than two `## What's New in vX.Y.Z` sections in the README.** Step 4 trims older ones; if you see three or more after Step 4, you missed one.
- **Do not skip the build step** — without it `dist/` is stale and the publish would ship outdated artifacts (or fail entirely if `dist/` was wiped by `make clean`).
- **Do not skip the test gate** if the repo has one — the gate is what catches regressions before they ship.
- **Do not invent CHANGELOG entries** to cover commits you find; ask the user if something's missing.
- **Do not bump if there's nothing meaningful in the WIP section** — stop and explain.

### Repo-specific don'ts

- **Do not edit `./src/lib/constants.generated.ts` directly** — it's auto-generated from `package.json` by `npm run generate-constants` and will be overwritten on the next build. Change `package.json` (or the generator) instead.
- **Do not stage `e2e/`, `test-results/`, or `playwright-report/`** — they're either ignored or test artifacts.
