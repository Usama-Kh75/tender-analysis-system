# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

نظام تحليل العطاءات التجاري المتكامل — a generic commercial tender/bid analysis system for Iraqi government (or private-sector) tender committees, not tied to any specific entity. It automates the financial audit work of a tender-opening committee: comparing bidder prices against the estimated cost (الكلفة التخمينية), detecting arithmetic errors and discrepancies between numeric and Arabic-spelled-out (تفقيط) amounts, computing deviation percentages, and producing an official printable committee report — per Iraq's "تعليمات تنفيذ العقود الحكومية لعام 2025" (2025 Government Contract Execution Instructions). The contracting entity's name is a per-project setting (`TenderProject.entityName`), not hardcoded.

**Deployment model is a hard constraint**: the deliverable is a single portable `نظام_تحليل_العطاءات.html` file that any committee member can copy to any Windows PC and just open — no install, no server, no database, no internet required for core use (internet is only needed for the optional AI OCR engine). Do not introduce dependencies that require installing anything on the end-user's machine (local LLM runtimes, native helper apps, local servers/daemons) — this has been explicitly rejected before in favor of portability. Data lives only in the browser's `localStorage`; there is no backend.

## Commands

```bash
npm install       # install dependencies
npm run dev        # start Vite dev server
npm run build       # tsc -b type-check, then vite build (outputs dist/index.html)
npm run lint        # oxlint
npm run preview      # preview the production build
```

There is no test suite in this repo.

### Publishing a change to the standalone HTML file

The single-file deliverable is **not** auto-generated on every edit — after making changes under `src/`, you must rebuild and manually refresh it:

```bash
npm run build
cp dist/index.html "نظام_تحليل_العطاءات.html"
```

(`vite-plugin-singlefile` inlines all JS/CSS into one `dist/index.html`; the copy step is what the end user actually opens via `تشغيل_النظام.bat`.) Always run `npm run build` (which runs `tsc -b` first) before considering a change done — it is the project's only type/build check.

### Installable web app (PWA)

The same build is also deployed to GitHub Pages (`https://usama-kh75.github.io/tender-analysis-system/`) so it can be installed as a Windows app from Edge/Chrome. `.github/workflows/pages.yml` deploys **only on a `v*` tag push** (not every push) — the installed app fetches the latest deployed version, so every release must be deliberate: bump `package.json` version, **add a user-facing Arabic entry at the top of `CHANGELOG` in `src/changelog.ts`** (shown once after update in the «ما الجديد» dialog), commit, then `git tag vX.Y.Z && git push origin vX.Y.Z`. The build also emits `dist/version.json`; an open app polls it (`checkForUpdate` in `src/pwa.ts`) and shows an «يتوفر إصدار جديد» banner (`src/components/UpdateNotice.tsx`). `RELEASE_STAGE` in `src/changelog.ts` appends "Beta" to the version in the UI only — never in the printed محضر; set it to `''` when the user declares the system stable. PWA pieces: `public/manifest.json` + icons, `pwa/sw.js` (template; the `serviceWorker()` plugin in `vite.config.ts` emits `dist/sw.js` with the version baked in), and `src/pwa.ts`, which activates only on `http(s)` so the portable `file://` copy is unaffected. The SW cache prefix `tender-analysis-` must stay unique: the origin `usama-kh75.github.io` is shared with other apps (localStorage too). Likewise the manifest `id` must stay the absolute `/tender-analysis-system/` — Chrome resolves `id` against the *origin*, not the manifest's folder, so `"id": "./"` gave this app the same identity as the contracts-instructions app on the same origin and installing one replaced the other (fixed in v1.2.6; verify with CDP `Page.getAppId`). Changing `id` again orphans every existing install. The installed app's data is separate from the portable file's; moving projects between them goes through the JSON backup.

## Architecture

**Stack**: React 19 + TypeScript, Vite 8, Tailwind CSS v4 (via `@tailwindcss/vite`), `vite-plugin-singlefile`. No router, no backend, no test framework.

**State shape and flow**: `App.tsx` is the single owner of state — an array of `TenderProject` (see `src/types/tender.ts`), loaded from and persisted to `localStorage` via `src/utils/storageService.ts`. There is no reducer/store library: every mutation follows the same pattern — compute a new `Bidder`/`TenderProject`, run it through `calculateBOQMetrics()` (`src/utils/calculations.ts`) to recompute all derived totals/deviations, optionally wrap it with `addAuditLog()`, then `setProjects(prev => prev.map(...))`. A `useEffect` in `App.tsx` persists `projects` to `localStorage` on every change. All mutation handlers live in `App.tsx` and are passed down as props — components under `src/components/` are largely presentational plus their own local UI state.

**The financial engine is the core domain logic**, and lives outside React entirely:
- `src/utils/calculations.ts` — `calculateBOQMetrics()` is the single source of truth for all derived numbers (deviation %, price ratio, weighted new price, math-error flags). Anything that changes bidder items must go through this function to stay consistent; also home to `parseArabicNumber()` (Arabic/Persian digit + currency-word normalization) and `tafqeetArabic()` (number → Arabic legal spelled-out text).
- `src/utils/bidderAuditEngine.ts` — `parseArabicTextToNumber()` parses Arabic spelled-out amounts (التفقيط) back into numbers via tokenization against `rawNumberMap`, used to detect conflicts between the written and numeric amount (legally, the written form wins per المادة 10/أولاً/ن and ضوابط رقم (4) خامساً/ب/1; the unit price beats a wrong item amount per خامساً/ب/2 — see `HANDOFF.md` §2 for the full legal/math rule table).
- `src/utils/recommendation.ts` — `buildRecommendation()` is the single source of the committee's recommendation wording, shared by `ExecutiveSummaryView` and `PrintReportModal`; never recompute it per component. It is derived from all bids (not the active tab): award (committee's explicit choice, else lowest eligible), tie (eligible bids equal or within 1% of estimated cost → ضوابط رقم (5) preference criteria), referral (13/ثالثاً/ب), re-tender (المادة 20). The tie wording is contract-type specific via `src/utils/contractTypes.ts` (`TenderProject.contractType`: works/supply/services, chosen in `NewProjectModal` before data entry; consulting services deliberately unsupported).
- `src/utils/excelService.ts` — Excel import/export via `xlsx`, with fuzzy column-header matching for importing bidder/estimated-cost tables.
- `src/utils/ocrService.ts` — two independent extraction engines behind one `ExtractedTableData` interface:
  - `extractBOQWithGeminiVision()` — calls the Gemini API directly from the browser (fetch, no SDK) with a JSON-array-extraction prompt; dynamically discovers available Gemini vision models per the user's API key (`testGeminiApiKey()`) and tries them in order, with 429 retry/backoff. Model discovery is cached across multi-page uploads (see `ImageOcrModal`) — do not call `testGeminiApiKey` per page, that burns the free-tier quota fast.
  - `extractBOQFromImage()` — fully offline Tesseract.js OCR. It does **not** just concatenate recognized text: it reconstructs the table geometrically by finding the header row (matching known Arabic BOQ column keywords like ت/الوحدة/الكمية/سعر المفرد/المجموع) via word bounding boxes, then assigns every other word to the nearest column band by x-position (`detectHeaderColumns`/`buildRowsFromHeader`). Falls back to a cruder count-the-numbers-per-line heuristic (`buildRowsHeuristic`) only if no header is detected. This engine handles printed text only — it cannot read handwriting; that requires the Gemini engine.
- `src/utils/storageService.ts` — `localStorage` CRUD for projects, plus `downloadProjectBackup()`/`parseProjectBackupFile()` for JSON export/import of a whole project (the user's substitute for cloud sync/multi-device support, given the no-backend constraint above).

**Multi-bidder / multi-page merge logic** (in `App.tsx`'s `handleApplyExtractedItems` and `ImageOcrModal`'s `processAllImages`) is intentionally conservative: imports merge row-by-row by array index, preserving whichever side (existing table vs. newly extracted) already has real data rather than blindly overwriting — e.g. importing bidder prices never touches `estimatedTotal`, and vice versa. Preserve this merge discipline when touching import/OCR code; it's what prevents an OCR misread from silently clobbering already-verified figures.

**Legal/audit framing matters for UI behavior**: arithmetic correction is the committee's act, notified to and signed by the bidder (ضوابط رقم (4) خامساً/ب/3), so the system never silently auto-corrects a bidder's submitted numbers — math-error and text-discrepancy detection only *flags* rows (`hasMathError`, `hasTextDiscrepancy` in `BOQItem`); correction is an explicit, logged committee action (see `correctionRationale`, `AuditLogEntry`). Keep this "detect and flag, never silently rewrite" pattern when adding audit features.

**Verify every legal citation against the official text before adding it** — a wrong article number was shipped once ("13/ثانياً" for the tafqeet rule; that clause is actually about hiring outside expertise). The user's structured copy of the 2025 instructions is at `E:/Claude Projects/تعليمات 2025/contract-instructions-2025-offline/src/units/*.json` (one file per article/annex; each clause has `clause`, `title`, `officialText`, `printedPage`).
