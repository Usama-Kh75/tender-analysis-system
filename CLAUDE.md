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

The same build is also deployed to GitHub Pages (`https://usama-kh75.github.io/tender-analysis-system/`) so it can be installed as a Windows app from Edge/Chrome. `.github/workflows/pages.yml` deploys **only on a `v*` tag push** (not every push) — the installed app fetches the latest deployed version, so every release must be deliberate: bump `package.json` version, **if (and only if) the release adds a new function or addition that changes how the system is used, add a short Arabic entry at the top of `CHANGELOG` in `src/changelog.ts`** phrased as what the user can now do. Never explain changes there: no fixes, refactors or UI tweaks, and no improvements to existing features such as better reading, extra checks or flags, or clearer labels (user's explicit decision, tightened 2026-10-05). A release without such an addition gets no entry and shows no «ما الجديد» dialog, commit, then `git tag vX.Y.Z && git push origin vX.Y.Z`. The build also emits `dist/version.json`; an open app polls it (`checkForUpdate` in `src/pwa.ts`) and shows an «يتوفر إصدار جديد» banner (`src/components/UpdateNotice.tsx`). Its «حفظ والتحديث» button refuses to reload while a modal holding unapplied work is open (`blockingWork` in `App.tsx` — add any new such modal there), then saves the active tab + scroll position to sessionStorage (`src/resume.ts`) and restores them after the reload; project data itself needs no extra save because App persists `projects` to localStorage on every change. `RELEASE_STAGE` in `src/changelog.ts` appends "Beta" to the version in the UI only — never in the printed محضر; set it to `''` when the user declares the system stable. PWA pieces: `public/manifest.json` + icons, `pwa/sw.js` (template; the `serviceWorker()` plugin in `vite.config.ts` emits `dist/sw.js` with the version baked in), and `src/pwa.ts`, which activates only on `http(s)` so the portable `file://` copy is unaffected. The SW cache prefix `tender-analysis-` must stay unique: the origin `usama-kh75.github.io` is shared with other apps (localStorage too). Likewise the manifest `id` must stay the absolute `/tender-analysis-system/` — Chrome resolves `id` against the *origin*, not the manifest's folder, so `"id": "./"` gave this app the same identity as the contracts-instructions app on the same origin and installing one replaced the other (fixed in v1.2.6; verify with CDP `Page.getAppId`). Changing `id` again orphans every existing install. The installed app's data is separate from the portable file's; moving projects between them goes through the JSON backup.

## Architecture

**Stack**: React 19 + TypeScript, Vite 8, Tailwind CSS v4 (via `@tailwindcss/vite`), `vite-plugin-singlefile`. No router, no backend, no test framework.

**State shape and flow**: `App.tsx` is the single owner of state — an array of `TenderProject` (see `src/types/tender.ts`), loaded from and persisted to `localStorage` via `src/utils/storageService.ts`. There is no reducer/store library: every mutation follows the same pattern — compute a new `Bidder`/`TenderProject`, run it through `calculateBOQMetrics()` (`src/utils/calculations.ts`) to recompute all derived totals/deviations, optionally wrap it with `addAuditLog()`, then `setProjects(prev => prev.map(...))`. A `useEffect` in `App.tsx` persists `projects` to `localStorage` on every change. All mutation handlers live in `App.tsx` and are passed down as props — components under `src/components/` are largely presentational plus their own local UI state. Handlers build the new project from the render-time `currentProject`, so two handler calls in the same event overwrite each other: a compound edit (quantity + total, a correction + clearing its flag) must go through a single `handleUpdateItemFields(index, patch)` call. Until v1.8.3, «اعتماد حاصل الضرب» cleared the error flag but left the wrong amount. Also, `calculateBOQMetrics` rebuilds a zero `bidderTotal` from `bidderUnitPrice × quantity`, so clearing a price means clearing every price field (`withoutBidderPrices` in `App.tsx`), not just the total.

**The financial engine is the core domain logic**, and lives outside React entirely:
- `src/utils/calculations.ts` — `calculateBOQMetrics()` is the single source of truth for all derived numbers (deviation %, price ratio, weighted new price, math-error flags). Anything that changes bidder items must go through this function to stay consistent; also home to `parseArabicNumber()` (Arabic/Persian digit + currency-word normalization) and `tafqeetArabic()` (number → Arabic legal spelled-out text).
- `src/utils/bidderAuditEngine.ts` — `parseArabicTextToNumber()` parses Arabic spelled-out amounts (التفقيط) back into numbers via tokenization against `rawNumberMap`, used to detect conflicts between the written and numeric amount (legally, the written form wins per المادة 10/أولاً/ن and ضوابط رقم (4) خامساً/ب/1; the unit price beats a wrong item amount per خامساً/ب/2 — see `HANDOFF.md` §2 for the full legal/math rule table).
- `src/utils/recommendation.ts` — `buildRecommendation()` is the single source of the committee's recommendation wording, shared by `ExecutiveSummaryView` and `PrintReportModal`; never recompute it per component. It is derived from all bids (not the active tab): award (committee's explicit choice, else lowest eligible), tie (eligible bids equal or within 1% of estimated cost → ضوابط رقم (5) preference criteria), referral (13/ثالثاً/ب), re-tender (المادة 20). A bidder with no amounts yet (`hasBidAmounts` false) is not a bid: it is left out of the ranking, the recommendation, the summary, the printed محضر, the charts, and the Excel comparison sheet. Before any estimated cost exists (`hasNoEstimate`), the UI shows «بانتظار الكلفة التخمينية», never a zero deviation presented as compliance. The tie wording is contract-type specific via `src/utils/contractTypes.ts` (`TenderProject.contractType`: works/supply/services, chosen in `NewProjectModal` before data entry; consulting services deliberately unsupported).
- `src/utils/excelService.ts` — Excel import/export via `xlsx`, with fuzzy column-header matching for importing bidder/estimated-cost tables.
- `src/utils/bidderAuditExcel.ts` — `exportBidderAuditToExcel()`, the table bar's «تصدير الجدول» (since v1.12.0). It writes one workbook for the active bidder with two sheets:
  - «واقع الحال»: the bid as submitted. Its flags are recomputed with `auditRowAmounts` from the as-written numbers, so a committee-corrected row stays flagged there. «الكمية × المفرد» and the difference are formulas.
  - «الجدول المعدل»: the bid after committee corrections, with deviation and weighted prices. Each row's «التصحيح المعتمد» comes from the latest matching adoption entry in the audit log (action + itemNo + newValue, and `bidderId` when the entry has one; entries before v1.12.0 have none). Rows that still carry stored flags read «بانتظار قرار اللجنة».
  - The free `xlsx` build cannot style cells, so flags are text filtered by an autofilter. Adding a styling library was rejected because of the single-file size.
  - Adopting a tafqeet as the unit price overwrites `enteredUnitPrice`, so the bidder's digit is kept in `BOQItem.originalUnitPrice`. `isCommitteeCorrected` (`bidderAuditEngine.ts`) counts that field as a correction, and `handleCorrectReading` restores it when it cancels a correction. Adoptions made before v1.12.0 have no stored digit, and the export writes «غير محفوظ».
- `src/utils/ocrService.ts` — two independent extraction engines behind one `ExtractedTableData` interface:
  - `extractBOQWithGeminiVision(images[])` — calls the Gemini API directly from the browser (fetch, no SDK).
    - It takes all pages at once and sends them in batches of up to `GEMINI_PAGES_PER_REQUEST` (8), size-capped, so the model sees tables that span pages and a 7-page bid costs one request.
    - It asks for a strict reply (`responseMimeType` + `responseSchema`, object `{items, grandTotal, grandTotalText}`). A model that answers 400 is retried once without the schema and remembered for the session.
    - A `MAX_TOKENS` reply splits its batch in half.
    - `mergeContinuationRows` joins description-only rows into the previous item, including across batch boundaries.
    - «-» prices become `unpriced: true` (a `BOQItem` field shown in the table as «غير مسعّرة في العطاء»).
    - Models come from `testGeminiApiKey()`, ranked by `rankGeminiModels` (stable before preview, then flash, pro, flash-lite, newest first; voice, image, live and other non-document models excluded). The list is fetched once per read, never per page or batch, because that burns the free-tier quota fast.
    - `ImageOcrModal` compares the bid's written `grandTotal` with two sums: the amounts as the bidder wrote them, and Σ quantity × unit price. A difference fully explained by row multiplication errors is the bidder's own error, so it is inserted without a dialog and the rows get flagged for the committee. A difference that is not explained asks for confirmation, because a row dropped during reading is invisible after insertion.
    - On insert the `grandTotal` is saved as `Bidder.statedTotal` (the amount before arithmetic correction). `KPIStatsCards` shows it against `totals.totalBidderAmount` (after correction), and so does the «أولاً» table of the printed محضر. It can also be typed in manually, and every change is audit-logged. Ranking stays on the corrected total (ضوابط رقم (4) خامساً/ب/6).
    - While reading, `onProgress` passes the page range being read (`ReadingPages`). The preview jumps to the first page of each batch, and the thumbnails mark pages as read or being read.
    - Editing a row in the modal is correcting a misread, so `bidderTotal` updates `enteredBidderTotal` too and the row flags are recomputed with `auditRowAmounts` (`bidderAuditEngine.ts`). That function is shared with `mapGeminiRow` and `calculateBOQMetrics`.
    - A tafqeet can spell the unit price rather than the item amount, and the digits alone cannot settle which (the written digit may be the wrong one). So when the quantity is not 1, `BOQTable` offers two committee buttons: adopt it as the unit price × quantity (خامساً/ب/1 then ب/2), or adopt it as the item amount. `writtenAmountTarget` only highlights the likelier one.
    - The table bar has one import button (since v1.10.0), which opens `SmartTableImportModal`. The user picks the table type first (bidder / estimate / combined). Excel and CSV stay in that modal for column mapping. PDFs and images (including a pasted screenshot) go to `ImageOcrModal` through `onReadWithAi` → `OcrHandoff {id, files, destination}`, with the destination preset. The combined type is Excel-only, because AI reading extracts a single amount column. `ImageOcrModal`'s early `return null` sits just before its JSX, so the handoff `useEffect` stays above it.
    - The official field names come from the API discovery document (`generativelanguage.googleapis.com/$discovery/rest?version=v1beta`), since the docs pages describe the newer Interactions API instead.
    - The mocked-fetch browser test used to verify this lives outside the repo; there is no test suite.
  - `extractBOQFromImage()` — fully offline Tesseract.js OCR. It does **not** just concatenate recognized text: it reconstructs the table geometrically by finding the header row (matching known Arabic BOQ column keywords like ت/الوحدة/الكمية/سعر المفرد/المجموع) via word bounding boxes, then assigns every other word to the nearest column band by x-position (`detectHeaderColumns`/`buildRowsFromHeader`). Falls back to a cruder count-the-numbers-per-line heuristic (`buildRowsHeuristic`) only if no header is detected. This engine handles printed text only — it cannot read handwriting; that requires the Gemini engine. In practice it is also weak on gridded tables: measured mean confidence was 47% for a clean bordered table, 41% rotated 90°, 51% for a scanned page (all garbled) vs 82% for the same content without grid lines. `ImageOcrModal` therefore warns and requires confirmation before inserting when a page's `confidence` is below `LOW_CONFIDENCE` (65). Removing grid lines before OCR is the most promising improvement if the offline engine is ever revisited.
- `src/utils/pdfService.ts` — `pdfToImages()` renders each page of a digital or scanned PDF to a JPEG data URL, which then goes through either OCR engine like any uploaded image. Runs inside the single file and offline: pdf.js runs on the main thread (`globalThis.pdfjsWorker`, no separate worker URL), and its JBIG2/JPX scan decoders (WebAssembly) are embedded as base64 by the `embeddedPdfWasm()` plugin in `vite.config.ts` (virtual module `virtual:pdf-wasm`) and served through a custom `BinaryDataFactory`, because pdf.js otherwise fetches them from `wasmUrl`. This roughly tripled the HTML size (≈3.4 MB, ≈1.1 MB gzip).
- Tesseract hang on first visit: if the offline engine starts while the service worker is still installing/claiming the page, `createWorker` hangs forever at «التهيئة». `extractBOQFromImage` therefore awaits `waitForServiceWorkerControl()` first (no-op on `file://`).
- `src/utils/storageService.ts` — `localStorage` CRUD for projects, `createNewTenderProject()` (a genuinely blank tender with one zeroed bidder per entered name — never build new tenders from `createDefaultProject()`, which is the demo seed), plus `downloadProjectBackup()`/`parseProjectBackupFile()` for JSON export/import of a whole project (the user's substitute for cloud sync/multi-device support, given the no-backend constraint above).

**Multi-bidder / multi-page merge logic** (in `App.tsx`'s `handleApplyExtractedItems` and `ImageOcrModal`'s `processAllImages`) is intentionally conservative: imports merge row-by-row by array index, preserving whichever side (existing table vs. newly extracted) already has real data rather than blindly overwriting — e.g. importing bidder prices never touches `estimatedTotal`, and vice versa. Preserve this merge discipline when touching import/OCR code; it's what prevents an OCR misread from silently clobbering already-verified figures.

**Quantity is shared, and a bidder import keeps the table's quantity** (user decision, v1.11.10):
- Both `bidder_only` and `new_bidder` keep the table's quantity. They clear the extracted flags so `calculateBOQMetrics` rechecks the row with that quantity.
- Both previews list rows whose quantity differs (`quantityMismatches` + `QuantityMismatchNotice`), so the committee can fix the table quantity by hand if it is the wrong one.
- A blank placeholder row («فقرة N», quantity 1, no estimate, no bidder amount; `isBlankRow`) is not a reference, so the file's quantity applies there.
- An estimate import sets the quantity. Bidder rows whose quantity changed are rechecked, except committee-corrected rows.
- A file without a quantity column leaves quantities unchanged; `mapImportRows` returns `undefined`, not 1.
- `SmartTableImportModal.mapImportRows` is the single row mapping for both the preview audit and the insert. Keep them on it.
- Item identity is shared too (since v1.12.2). Both bidder merges take `itemNo`, description and unit from `sharedIdentity` in `App.tsx`:
  - An existing row keeps the table's values. The file's values apply only to a new row or a blank placeholder row.
  - Before this, a new bidder overwrote everyone's descriptions. Both paths also dropped `unit`, which `calculateBOQMetrics` then defaulted to «عدد» for every bidder.
- The merges pass the read unit price as `bidderUnitPrice` as well. `calculateBOQMetrics` derives a missing amount only from that field, so an amount that was not read is computed with the table quantity.
- A Gemini quantity that was not read stays `undefined`, not 1, and the reading window marks it. An amount that was not read is derived only from a quantity that was read. Otherwise it stays empty, with `enteredBidderTotal` undefined, so no recorded zero gets flagged.
- `mapImportRows` drops summary rows (`kept`) in two cases:
  - **Total word (`SUMMARY_WORD`):** «مجموع» or «إجمالي» as a whole word, never «مجموعة». The row is dropped if it has no item number or no amount.
  - **Total label (`TOTAL_LABEL`):** a label that is only a total phrase («المجموع», «مجموع الصفحة», «Grand Total»). This applies even when the row has a number and an amount.
  - It also drops a text label in the item-number cell with no description but with an amount (the totals block under a table).
  - A dropped row shifts the index merge, so never drop by substring alone.
- `autoDetectRoles` checks in this order: item number, description, computed columns («×», فرق, نسبة, موزون… → ignore), tafqeet, estimate, unit price, quantity, amount. Checking unit price first made «سعر المفرد كتابةً» a unit price, and made «الكمية × المفرد» the unit price whenever it came first.
- An import with no amount column stops with a message: no estimate-amount column for an estimate, and no amount or unit-price column for a bid. It used to write 0 over the existing values.

**Legal/audit framing matters for UI behavior**: arithmetic correction is the committee's act, notified to and signed by the bidder (ضوابط رقم (4) خامساً/ب/3), so the system never silently auto-corrects a bidder's submitted numbers — math-error and text-discrepancy detection only *flags* rows (`hasMathError`, `hasTextDiscrepancy` in `BOQItem`); correction is an explicit, logged committee action (see `correctionRationale`, `AuditLogEntry`). Keep this "detect and flag, never silently rewrite" pattern when adding audit features. Stored flags are sticky, so `recheckStoredFlags` (`storageService.ts`, since v1.12.2) runs them again on every load and backup restore:
- It covers only rows the committee did not correct (`isCommitteeCorrected`), and skips rows with an amount but no recorded amount.
- It logs every change as «إعادة فحص تلقائية».
- It fixes flags left stale by older parsers (item 41) or missing flags.
- It changes flags only, never amounts.

**A plain edit in the main table is a reading correction, not an arithmetic one** (since v1.11.7). Editing the quantity, unit price, item amount or tafqeet goes through `handleCorrectReading` in `App.tsx`, not `handleUpdateItemFields`:
- The new value becomes the bidder's recorded value (`enteredUnitPrice`/`enteredBidderTotal`).
- Both flags are cleared so `calculateBOQMetrics` recomputes them. Stored flags are otherwise sticky.
- No other number changes. A unit-price edit fills the amount only when it is empty, so a real multiplication error is never hidden.
- A quantity edit rechecks that row for every bidder.
- A committee-corrected row (`bidderTotal` ≠ a non-zero `enteredBidderTotal`) asks for confirmation first, then cancels the correction openly, with a log entry.
- `AmountInput` commits on blur or Enter, and Escape cancels; it no longer commits per keystroke.

**Verify every legal citation against the official text before adding it** — a wrong article number was shipped once ("13/ثانياً" for the tafqeet rule; that clause is actually about hiring outside expertise). The user's structured copy of the 2025 instructions is at `E:/Claude Projects/تعليمات 2025/contract-instructions-2025-offline/src/units/*.json` (one file per article/annex; each clause has `clause`, `title`, `officialText`, `printedPage`).
