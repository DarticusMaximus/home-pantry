# AI Prompts — Current State

Single source: `app/(app)/ai/actions.ts`. Prompts are verbatim below (as of this extraction). Three AI touchpoints exist: text parse, photo scan, speech transcription. Only the first two use prompts — transcription is promptless audio-to-text.

Models are not hardcoded — they come from env (`lib/ai/openai-client.ts`): `AI_MODEL` / `OPENROUTER_MODEL` for chat+vision, `AI_TRANSCRIBE_MODEL` / `OPENROUTER_TRANSCRIBE_MODEL` for speech. Any OpenAI-compatible endpoint works via `AI_BASE_URL`.

Both prompts are rules-first: behavioral rules up top, then a trailing `Known data:` block listing the household's storage locations, item templates, categories, and the app's unit list. The model is told to use only vocabulary from that block — anything the model returns off-list is reconciled afterward by the normalizers (see [Reconciliation backstops](#reconciliation-backstops)).

---

## 1. Text Parse (paste a list)

- **Prompt:** `buildSystemPrompt()` — `app/(app)/ai/actions.ts:73`
- **Used by:** `parseTextToBatchReview()` — `app/(app)/ai/actions.ts:364`
- **User message:** the pasted text, verbatim, no wrapper.
- **Structured output:** `TextParseResponseSchema` (see below), response_format name `text_parse_response`.

### System prompt (template)

`{intent}` is `extract grocery/food items to ADD to a home pantry inventory` or `extract food/pantry items to REMOVE from a home pantry inventory`. `{operation}` is `add` or `remove`. `{locationList}` / `{templateList}` / `{categoryList}` are comma-joined names, or `none provided`; `{unitList}` is the app's full unit list.

```
You are a helpful assistant that parses text into structured food inventory items.
Your goal is to {intent}.

Rules:
- Extract item name, quantity, and unit as reliable basics. These are most important.
- When quantity, unit, or expiry is omitted from the paste, you may guess those values. If you guess rather than read a value from the paste, set isUncertain to true with a short uncertaintyReason.
- categoryName must be a name from the known categories below, or null when no known category clearly fits. Never invent a category name.
- unit must be a unit from the known units below. When the paste spells a known unit differently (for example "gallons" for "gal"), return the known unit. When the paste's unit has no close equivalent in the list, return the unit exactly as the paste wrote it.
- Fill explicitLocationName only when it matches a known location below. Never invent a location name.
- Prefer the singular/template item name when the input is plural, for example "steaks" should become "Steak" when Steak is a known template below.
- The operation is: {operation}.

Known data:
- Storage locations: {locationList}
- Item templates: {templateList}
- Categories: {categoryList}
- Units: {unitList}
```

### Response schema

```ts
items: Array<{
  name: string
  quantity: number | null
  unit: string | null
  categoryName: string | null
  explicitLocationName: string | null
  expirationHint: string | null
  sourceLine: string | null
  isUncertain: boolean
  uncertaintyReason: string | null
}>
ignoredLines: string[] | null
```

---

## 2. Photo Scan (grocery haul photo)

- **Prompt:** `buildImageSystemPrompt()` — `app/(app)/ai/actions.ts:109`
- **Used by:** `scanImageToBatchReview()` — `app/(app)/ai/actions.ts:185`
- **User message:** fixed text `List the food items in this image.` + the image (data URL), sent with `detail: 'low'` to cut cost/latency.
- **Structured output:** `ImageParseResponseSchema`, response_format name `image_parse_response`.

### System prompt (template)

Same `{locationList}` / `{templateList}` / `{categoryList}` / `{unitList}` interpolation as text parse.

```
You are a helpful assistant that identifies food items from a photo of groceries or food.
The operation is {operation} — do not infer intent from the image; use this exact operation.
List visible food even if the shot is crowded or a bit soft.
Prefer generic pantry names (e.g., "Milk", "Eggs", "Pasta"). Put brand or packaging info in notes.
When quantity, unit, or expiry is not visible in the photo, you may guess those values. If you guess rather than saw the value, set isUncertain to true with a short uncertaintyReason.
categoryName must be a name from the known categories below, or null when no known category clearly fits. Never invent a category name.
unit must be a unit from the known units below. When the packaging spells a known unit differently (for example "gallons" for "gal"), return the known unit. When the visible unit has no close equivalent in the list, return the unit exactly as it appears.
Fill explicitLocationName only when it matches a known location below. Never invent a location name.
Prefer known template names.
Ignore non-food objects entirely.

Known data:
- Storage locations: {locationList}
- Item templates: {templateList}
- Categories: {categoryList}
- Units: {unitList}
```

### Response schema

```ts
items: Array<{
  name: string
  quantity: number | null
  unit: string | null
  categoryName: string | null
  explicitLocationName: string | null
  expirationHint: string | null
  isUncertain: boolean
  uncertaintyReason: string | null
  notes: string | null
}>
skippedObjects: Array<{ name: string | null; reason: string }> | null
imageSummary: string | null
```

---

## 3. Speech Transcription (voice clip)

- **Used by:** `transcribeSpeechClip()` — `app/(app)/ai/actions.ts:501`
- **No prompt.** Plain `audio.transcriptions.create({ file, model, response_format: 'json' })`. The transcript text then flows into the text-parse flow above.

---

## Reconciliation backstops

The prompts ask for in-vocabulary output, but prompts are advisory. Two backstops guarantee no AI-written row invents vocabulary the pantry does not use.

### Unit coercion — `coerceParsedUnit` (`lib/ai/unit-coercion.ts:56`)

Runs inside `createAddReviewRow` (`lib/ai/review-row-build.ts:104`) before template defaults are applied. Ladder, per raw unit string:

1. `null` or blank (after trim/lowercase/trailing-dot strip) → `''` (no unit).
2. Already a canonical unit from `UNITS` (case-insensitive) → kept as-is.
3. Matches `UNIT_ALIASES` (pure renames/plurals: `gallon`/`gallons`/`gals`→`gal`, `quart`/`quarts`→`qt`, `pint`/`pints`→`pt`, `pound`/`pounds`/`lbs`→`lb`, `ounce`/`ounces`→`oz`, `kilogram`/`kilograms`/`kilo`/`kilos`→`kg`, `gram`/`grams`/`gms`→`g`, `cup`/`cups`→`cup`, `bag`/`bags`→`bag`, `bottle`/`bottles`→`bottle`, `box`/`boxes`→`box`, `can`/`cans`→`can`, `pack`/`packs`/`pk`→`pack`, `jar`/`jars`→`jar`, `container`/`containers`→`container`, `piece`/`pieces`/`pcs`→`each`, `head`/`heads`→`each`, `bunch`/`bunches`→`each`) → mapped to its target.
4. Anything else → `'each'` plus a reason naming the raw unit.

The reason always lands in `parseWarnings`; it sets `isUncertain` only when no template matches the row's name — a template match implies the household already trusts the name's defaults.

### Category pipeline

Categories never come from the model's imagination at save time — they resolve through the household's own category list:

1. The AI hub (`app/(app)/ai/page.tsx`) loads categories via `useCategories` (`hooks/use-categories.ts:14`).
2. It passes them as `knownCategories` into both `parseTextToBatchReview` and `scanImageToBatchReview`.
3. The action interpolates the names into the prompt's `Known data:` block and builds `categoryLookup` (lowercased name → id).
4. The lookup is forwarded to the normalizers (`normalizeParsedTextToReviewRows`, `normalizeParsedImageToReviewRows`), which only attach a `categoryId` when the model's `categoryName` matches a known name — otherwise the row saves with no category instead of an invented one.

---

## Refinement notes (pre-release observations)

1. **Known-data lists scale linearly.** Every request ships all location names, template names, category names, and units inline. Fine for a family pantry; token cost and prompt dilution grow with template/category count before public release.
2. **No response-format descriptions.** The zod schemas carry no `.describe()` text — field semantics (`expirationHint` format, unit casing) live only in the system prompt. Adding schema descriptions would tighten structured-output adherence.
3. **`expirationHint` format is unspecified.** The prompt never tells the model the normalizer wants `YYYY-MM-DD` — anything else is discarded by `isValidDateString` (`lib/ai/review-row-build.ts:73`).
4. **Image detail pinned to `low`** — cost win, but a likely accuracy ceiling for crowded hauls. Worth an env knob.
5. **Remove-operation matching is prompt-light.** For `remove`, the model still returns free-form names and matching happens client-side (`applyRemoveMatch`, `lib/batch/remove-matching.ts:80`) — the prompt doesn't ask for exact inventory-name matching, so fuzzy matches may over-fire.
