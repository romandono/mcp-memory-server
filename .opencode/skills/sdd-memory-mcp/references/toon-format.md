# TOON Format Decode Key

`toon-r` and `toon-d` are compact response formats that cut tokens by abbreviating field names and
enum values. `toon-r` keeps a small object with **renamed keys**; `toon-d` is **denser**, using
positional **arrays** (no keys at all). Read this file to decode any TOON payload. `json` format is
never abbreviated — use it when you cannot decode TOON.

## Contents

- [Envelope](#envelope)
- [Enum abbreviations](#enum-abbreviations)
- [Payload by response type](#payload-by-response-type)
- [Record field maps](#record-field-maps)
- [Budgets, cursor, metrics](#budgets-cursor-metrics)
- [Worked example](#worked-example)

## Envelope

Every `toon-*` response is wrapped:

```json
{ "v": 1, "fmt": "toon-d", "t": "<type>", "ok": 1, "d": <payload>, "m": { "tr": 0, "n": 3, "next": null } }
```

- `v` — format version (1)
- `fmt` — `toon-r` or `toon-d`
- `t` — response type: `entry_summary`, `entry_ctx`, `entry_search`, `project_compact`, `facts`
- `ok` — 1 on success
- `d` — the payload (shape depends on `t`, below)
- `m.tr` — truncated flag (1 = a budget cut the result)
- `m.n` — number of items returned
- `m.next` — next cursor id, or `null`. Pass it back as the `cursor` arg to continue.

`json` responses are **not** wrapped: data sits at the top level, and compact JSON adds `truncated`,
`next_cursor`, and `metrics` fields instead of the `m` object.

## Enum abbreviations

These abbreviations appear in `entry` (`sec`, `st`), `task` (`st`, `pr`), and `relationship` (`rt`)
fields. **`facts` carry raw, unabbreviated strings** — do not decode fact values with these tables.

| Field | Code → meaning |
| --- | --- |
| section (`sec`) | `p`=plan, `d`=design, `t`=tasks, `g`=general |
| entry status (`st`) | `dr`=draft, `rv`=review, `dn`=done |
| task status (`st`) | `pd`=pending, `ip`=in_progress, `cp`=completed, `cx`=cancelled |
| priority (`pr`) | `l`=low, `m`=medium, `h`=high, `c`=critical |
| relationship (`rt`) | `dep`=depends_on, `imp`=implements, `rel`=related_to, `sup`=supersedes |

## Payload by response type

`d` payload shape per `t`:

| `t` | `d` shape |
| --- | --- |
| `entry_summary` | a single `entry` record |
| `entry_search` | `{ es: entry[] }` |
| `entry_ctx` | `{ e: entry, ds: decision[], rs: relationship[], fs: fact[] }` |
| `project_compact` | `{ p: project, es: entry[], ts: task[], cs: classification[] }` |
| `facts` | `{ fs: fact[] }` |

## Record field maps

For each record type: `toon-r` object keys, then `toon-d` array order (decode by position).
Note: TOON entries do **not** include `summary_dense` (only `summary_short`). Use `format: json` if
you need `summary_dense`.

### entry
- `toon-r`: `{ id, p: project_id, sec, st, ttl: title, sum: summary_short, kw: keywords[] }`
- `toon-d`: `[ id, project_id, sec, st, title, summary_short, keywords[] ]`

### task
- `toon-r`: `{ id, p: project_id, e: sdd_entry_id|null, ttl: title, st, pr }`
- `toon-d`: `[ id, project_id, sdd_entry_id|null, title, st, pr ]`

### decision
- `toon-r`: `{ id, d: decision, r: rationale }`
- `toon-d`: `[ id, decision, rationale ]`

### relationship
- `toon-r`: `{ s: source_entry_id, t: target_entry_id, rt }`
- `toon-d`: `[ source_entry_id, target_entry_id, rt ]`

### fact (values are raw strings, not abbreviated)
- `toon-r`: `{ k: kind, s: subject, p: predicate, o: object, w: weight }`
- `toon-d`: `[ kind, subject, predicate, object, weight ]`
- Typical facts: `section`/`has_section`/`plan`; `status`/`has_status`/`done`;
  `decision`/`decides`/`<decision text>`; `relationship`/`<type>`/`entry:<id>`.

### project (inside `project_compact`)
- `toon-r`: `{ id, n: name, st: status }`
- `toon-d`: `[ id, name, status ]`

### classification (inside `project_compact`)
- `toon-r`: `{ id, t: tag, c: confidence }`
- `toon-d`: `[ id, tag, confidence ]`

## Budgets, cursor, metrics

- `max_items` caps item count; `max_chars` caps total characters. Either sets `m.tr`/`truncated` = 1.
  At least one item is always returned even if it exceeds `max_chars`.
- `max_chars` measures derived text length: for entries `title + summary_short + summary_dense +
  keywords`; for facts `kind + subject + predicate + object`.
- To page: read `m.next` (TOON) or `next_cursor` (JSON); if non-null, repeat the call with
  `cursor` set to that value. Stop when it is `null`.
- Compact **JSON** responses include `metrics: { bytes, chars, estimated_tokens }` where
  `estimated_tokens = ceil(chars / 4)`. Use it to confirm a response fits a budget. TOON responses
  omit metrics (they are already minimal).

## Worked example

`entry-search` with `view: "compact"`, `format: "toon-d"` might return:

```json
{ "v":1, "fmt":"toon-d", "t":"entry_search", "ok":1,
  "d": { "es": [ ["a1f2","projX","d","rv","Auth design","Auth design :: JWT in middleware",["jwt","middleware"]] ] },
  "m": { "tr":1, "n":1, "next":"a1f2" } }
```

Decode: one entry, id `a1f2`, project `projX`, section `d`=design, status `rv`=review,
title "Auth design", summary "Auth design :: JWT in middleware", keywords jwt/middleware. `tr:1`
means more results exist — repeat with `cursor: "a1f2"` to get the next page.
