# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

A pnpm workspace. `git init` has run (branch `main`) but there are no commits yet.

- [packages/core/](packages/core/) — `@amakefe/core`: the Supabase client, generated DB types, domain models, the whole query layer, design tokens and self-hosted fonts. Framework-free on purpose — it is imported by tests and will be imported by Edge Functions.
- [packages/ui/](packages/ui/) — `@amakefe/ui`: the React components both apps share. `StoryProse` renders a story document; `StoryReading` is the whole reading surface. The reader uses it for the real screen and the studio renders the same component in a phone-sized frame to preview a draft, so the two cannot drift.
- [reader_web/](reader_web/) — the reader PWA (React + Vite). All seven screens are built: Home, Stories, the story reader, Community, Ask Her, Profile and Support, plus the Share Your Story take-over.
- [author_web/](author_web/) — the creator's publishing PWA. Dashboard, a **Stories** section (All stories · New story · Schedule), Moderation and Supporters. The one surface with real accounts. See "Two screens, one story" below for how writing is reached.
- [supabase/migrations/](supabase/migrations/) — the schema, applied to project `rubukvxtiezyfxzqacsi`.
- [docs/real_stories_community_platform_final_spec.md](docs/real_stories_community_platform_final_spec.md) — the ~2,950-line product & technical specification. Source of truth for scope, except where a decision below supersedes it.
- [docs/screens/](docs/screens/) — the design prototypes. See the design section below; they are binding.

**Mobile is phase 2.** App-store approval is slow, so both apps ship as installable PWAs first; `reader_mobile/` and `author_mobile/` will be Capacitor shells around the same web builds, not separate codebases. Nothing in the web apps should assume a browser-only environment it would have to unlearn.

## Commands

```bash
pnpm install                    # workspace root
pnpm dev:reader                 # reader_web on :5173
pnpm dev:author                 # author_web
pnpm build                      # every package
pnpm typecheck                  # every package — this is the lint gate, there is no ESLint
pnpm test                       # every package

# Within a package
cd packages/core && pnpm test                       # all tests
pnpm vitest run test/story.test.ts                  # one file
pnpm vitest run -t "skips a leading article"        # one test by name
cd reader_web && pnpm build && pnpm preview         # check the real PWA build

# Schema
# Migrations are applied through the Supabase MCP server (mcp__supabase__apply_migration),
# not `supabase db push` — the project is not linked to a local Postgres. Write the file in
# supabase/migrations/ first, then apply the identical SQL; the files are the source of truth.
# After any DDL: run mcp__supabase__get_advisors (security) and fix what it reports, then
# regenerate packages/core/src/database.types.ts with generate_typescript_types.
```

**Blocked on someone else:**

1. **The Facebook auth provider is not configured**, so every reader write path (save, react, read progress, follow a topic, answer, vote, ask) has nowhere to sign in. Needs the App ID and Secret in Dashboard → Authentication → Providers → Facebook, the callback URL copied into the Meta app, `email` added to its Use Cases, and App Review for `public_profile` + `email` before anyone outside the tester list can sign in. Meta also requires a privacy policy URL and a Data Deletion Callback once real names are stored. Reading is unaffected. Anonymous sign-ins stay **off** — they are no longer used.
2. **No payment provider.** `sup_transactions` is the ledger from spec §59, but nothing writes to it: rows must be created server-side by an Edge Function holding mobile money merchant credentials (Airtel Money / MTN MoMo / Zamtel). Until those exist the Support screen's button is deliberately disabled and says why. Readers must never be able to insert their own payment rows — they could write their own amounts — so there is no insert policy on that table by design.
3. **The creator's phone number** is a placeholder (`VITE_CREATOR_PHONE`). Share Your Story dials and WhatsApps it.
4. **Email delivery (SMTP) is not configured.** Nothing depends on it today — studio sign-in is email + password — but password reset, and the stronger one-time-code sign-in worth moving back to, both need it.

**Where these deploy:** the studio at `gracious.javuapps.com`, the reader at `amakefe.javuapps.com`. The reader carries the policy pages Meta requires — `/privacy`, `/terms` and `/data-deletion` ([PolicyScreens.tsx](reader_web/src/screens/PolicyScreens.tsx)) — because it is the only app ordinary people sign in to. Their content is checked against the schema rather than written from a template: what they list as collected is what the tables hold, and what they say deletion removes is what the foreign keys actually do. `VITE_CONTACT_EMAIL` sets the address they print, and it must be a mailbox someone reads.

Deleting an account is [delete-account](supabase/functions/delete-account/index.ts), which removes the `auth.users` row and lets the foreign keys decide the rest: profile, saves, progress, follows, reactions, votes and comments go; Community questions and answers, questions to Amake Fe and support transactions are kept with `user_id` set null, because a conversation other people are part of is not unpicked when one person leaves. It refuses accounts holding a `usr_roles` row — a staff account is a working account, and losing one to a mis-tap in the reader app would take the studio with it.

**Studio accounts** are created by an administrator; there is no sign-up. Add the user in Dashboard → Authentication → Users, then grant a role:

```sql
insert into public.usr_roles (user_id, role)
select id, 'creator' from auth.users where email = 'her@example.com';
```

Roles that open the studio: `creator`, `editor`, `admin`, `super_admin` (`usr_is_editorial()`). `moderator` and `finance` are deliberately excluded from contributor data. One `super_admin` account exists.

## How to write code here

Be objective, creative, idiomatic, and modern. Use each platform's current conventions rather than porting patterns between them — idiomatic modern React (function components, hooks, Suspense-friendly data access), idiomatic TypeScript with `strict` on, and idiomatic Postgres (constraints, RLS, views, generated columns) rather than reimplementing database work in application code.

**Keep it lean.** The project is pre-release with no users to break, so:

- **Clean cuts when features change.** Delete the superseded path — its call sites, flags, types, tests, and migrations — in the same change. No compatibility shims, no `v1` living beside `v2`, no deprecation periods. There is no legacy to preserve.
- **No duplication.** Before adding a helper, widget, component, or query, check whether one already exists and extend it instead.
- **One obvious path.** Prefer a single clear flow over configurable multi-branch logic that anticipates requirements nobody has asked for.
- **No dead code.** Unused exports, commented-out blocks, and unreachable branches get removed, including ones you merely pass through.
- Optimize for readability and maintainability first, then performance. Small, focused modules; names that say what the thing is.

Applies equally to `@amakefe/core`, both PWAs, and the Supabase schema.

## Product

"Mindful Moments with Amake Fe" — a community platform for a Facebook page (200k+ followers) where a creator collects real marriage/family stories by phone call and WhatsApp voice note, writes them herself in English, and publishes them anonymously in multiple parts.

Two rules from the spec that constrain most design decisions:

1. **Do not automate the human part.** The app is *not* a story-submission tool. Contributors still call/WhatsApp the creator. "Share Your Story" is a CTA that opens a call or WhatsApp, not a long-form form. Automate publishing, search, notifications, payments, transcription — never the listening/editorial relationship.
2. **The platform holds no contributor data at all — and no byline either.** A story carries nothing about who it came from: not a real name, and not a stand-in for one. Real names, phone numbers, voice notes and the consent conversation stay where they happen — her phone, WhatsApp, her own notes. The spec (§63) asks for the public and private domains to be separated; not storing the private one is the strongest form of that, and it means there is nothing here to leak. **Do not add contributor capture back without being asked.**

## Architecture (from the spec)

Ecosystem per the spec: Facebook (discovery) → public website (SEO / story archive / registration) → mobile app (reading, community, notifications, support) → creator/publishing platform. **Two of those are being built now** — `reader_web` and `author_web`, both on Supabase. The public SEO website comes later, and mobile is a Capacitor shell in phase 2.

**Decided stack** (this supersedes the spec's §49–58 options where they differ):

- **Backend: Supabase** — Postgres, Auth, Storage, Realtime, and Edge Functions. Project `rubukvxtiezyfxzqacsi`, reachable through the Supabase MCP server. There is no separate Go/ASP.NET service; the spec's Redis + RabbitMQ layer collapses into Postgres, Edge Functions, and scheduled/queued work inside Supabase until something actually needs more.
- **Both front ends: React + Vite, shipped as installable PWAs.** `reader_web` is the community's reading app; `author_web` is the creator/editor tool, not a public SEO site. Mobile follows in phase 2 as Capacitor shells around these same builds, so there is no second UI codebase to keep in step.
- **Shared code lives in `@amakefe/core`.** The Supabase client, generated types, domain models, every query, and the design tokens. An app that reaches past it to query Supabase directly is doing something wrong.

### Identity at submission, anonymity at publication

**Identity is always recorded when someone submits. Anonymity is a property of publication, applied only where it is required.** Two different people are protected by two different mechanisms, and conflating them is the mistake this section exists to prevent.

**Contributors are anonymous, and that is enforced.** The people who phone and WhatsApp their stories are never named: real names live in `cnt_story_parts.body`, that table has no `anon` SELECT policy at all, and `cnt_public_parts` redacts every published field. This is the hard boundary — see "Redaction happens in the database".

**Readers are not anonymous.** They sign in with Facebook, and they publish under their own name and picture, as they would on the Page itself:

| Surface | Published as |
| --- | --- |
| Story comments, Community questions & answers | Real Facebook name and picture |
| Ask Her | **Anonymous** — she publishes personal problems to 200k people |
| Poll votes | Counts only; `com_poll_results` exposes tallies and the vote rows stay unreadable |

**Reading is still never gated**, now for a different reason: every reader arrives from a Facebook post and taps through to a story, and a wall in front of that story is the one place the funnel cannot afford friction. Published content is readable by `anon`; the app opens straight onto Home with no session. Verified: `curl` against `/rest/v1/cnt_story_cards` with only the publishable key returns stories, and `packages/core/test/anonymousRead.test.ts` pins it.

- Sign-in is offered **at the moment of the gesture** — save, react, vote, answer, ask — never at the door. `requireReaderId()` in [packages/core/src/supabase.ts](packages/core/src/supabase.ts) throws `NotSignedInError` rather than redirecting, because signing in leaves the page and a query layer that redirected would tear down the screen mid-gesture.
- The gesture is **remembered and replayed**. `rememberIntent` / `takeIntent` in [reader_web/src/auth.tsx](reader_web/src/auth.tsx) put it in `sessionStorage`, and [IntentReplay](reader_web/src/components/IntentReplay.tsx) performs it once on return. Without that a reader taps ♥, disappears to Facebook, comes back — and nothing happened, which reads as the app ignoring them.
- **The policy on `usr_profiles` is what enforces publication anonymity**, not the UI. It was `using (true)`, harmless while `display_name` was a NULL-by-default pseudonym; holding real names it would have handed the whole reader list to anyone with the publishable key, which ships in the client. It now admits a profile only for its owner or for someone with a *visible* comment, answer or question. `com_ask_questions` is deliberately absent from that list: having asked Amake Fe something must never make you findable. Expressed once in SQL rather than in every screen that might forget.
- `cnt_story_views` stays **identity-free** — a daily counter per part. Not because of what it would reveal now, but because it must keep counting for readers who never sign in. Per-reader history lives openly in `usr_read_progress`.
- Anonymous sign-ins are **not used**, and the project toggle stays off.

### Table naming

Tables carry a 3-letter module prefix (following jobzen's newer tables):

| prefix | module | tables |
| --- | --- | --- |
| `cnt_` | content | `cnt_categories`, `cnt_stories`, `cnt_story_parts`, `cnt_creator_posts`, `cnt_publications`, view `cnt_story_cards` |
| `usr_` | reader identity & state | `usr_profiles`, `usr_roles`, `usr_bookmarks`, `usr_read_progress`, `usr_category_follows` |
| `com_` | community | `com_reactions`, `com_comments`, `com_questions`, `com_answers`, `com_ask_questions`, `com_polls`, `com_poll_options`, `com_poll_votes`, views `com_poll_results`, `com_question_cards` |
| `mod_` | moderation | `mod_reports` |
| `sup_` | support/payments | `sup_transactions`, function `sup_supporter_count()` |
| `ntf_` | notifications | not built yet |

Functions take their module's prefix too (`cnt_search_stories`, `usr_is_staff`).

### Authoring captures nothing about the submission

Stories are collected away from this platform — a phone call, a run of WhatsApp voice notes, a conversation over weeks — and the consent conversation happens there too. The studio therefore records **none** of it: no contributor record, no consent checklist, no log of calls. There was an `editorial` schema holding all three, plus a trigger that refused to publish until consent was ticked; it was removed in `20260921100000` because it was re-entry of something the software never witnessed.

What follows:

- `cnt_create_story` takes only what gets published: title, summary, type, planned parts, category.
- The only thing between a draft and readers is `cnt_publish_part`, which refuses an empty part. **There is no database-level consent gate any more** — that is the creator's own process, outside this system.
- **Do not add contributor capture back without being asked.**

### Story bodies are documents

`cnt_story_parts.body` is a **ProseMirror document** (`jsonb`), written in a TipTap editor in the studio and rendered by `StoryProse` in `@amakefe/ui`. The allowed nodes are deliberately few, because each one is something the reader must render and the privacy scanner must understand: `paragraph`, `heading` (level 2), `blockquote` (a pull quote), `horizontalRule` (a centred asterism, not a rule), `image` (`src`, `alt`, `caption`), and `text` with `italic`/`bold` marks.

**There are no links, by design.** A URL inside an anonymous story is a de-anonymisation vector, so the editor cannot produce one and the renderer does not handle one.

**Image `src` holds a storage path, never a URL** — a URL would pin the document to one environment. The editor resolves paths to public URLs for display through the `StoredImage` extension, and `normaliseDocPaths` converts anything that comes back the other way before it is saved. Without the resolve step every inserted image renders broken in the editor.

**Marks are named `italic` and `bold`, not `em`/`strong`.** TipTap names them that way, and TipTap is what writes every real document — a doc containing `em` fails to parse with "There is no mark type em in this schema" and the editor silently comes up blank. They still render as `<em>`/`<strong>`.

Three generated columns derive from the document so nothing downstream has to understand JSON:

| column | derived from | feeds |
| --- | --- | --- |
| `body_text` | `cnt_doc_plain_text(body)` | the privacy scanner, future embeddings |
| `word_count` | `cnt_word_count(body)` | list screens, which then never fetch bodies |
| `read_minutes` | `cnt_word_count(body)` | `cnt_story_cards`, the reader's "7 min" |
| `search` | `title + body_text` | story search |

`cnt_doc_text` puts one blank line between blocks, and `docText` in [packages/core/src/models/prose.ts](packages/core/src/models/prose.ts) mirrors it exactly. That is not cosmetic: the privacy scanner numbers paragraphs off this text, so if the two diverge it reports "paragraph 6" while pointing at paragraph 5. There is a test for it.

Two traps, both of which bit once:

- `jsonb_path_query_array(doc,'$.**.text')` looks like a one-line text extractor and is IMMUTABLE, but `$.**` matches both a content array and its elements, so every string comes back twice.
- **`btrim(x)` trims spaces, not newlines.** Every block ends with `\n\n`, so a bare `btrim` left trailing newlines, the `\s+` split produced an empty final token, and every part counted one word too many — while TypeScript's `.trim()` did strip them, so the two silently diverged. Use `cnt_doc_plain_text`, never `btrim(cnt_doc_text(...))`.

`packages/core/test/prose.test.ts` pins five cases that both sides must produce identically. When you change one, run the same cases against SQL.

### A story has parts; a single story has exactly one

Every publication is Story → Parts. The **story** carries what it *is*: `story_type` (`single` | `series`), title, slug, summary, category, cover image. The **part** carries what is written and sent: its own title, `thumbnail_path`, `body`, `creator_note` (her closing words), `facebook_teaser` and `published_at`.

`cnt_story_type` is explicit, not inferred from a part count. `cnt_is_series()` in SQL and `isSeries()`/`isSeriesStory()` in TypeScript are the single definitions — never re-derive `plannedPartCount > 1` per screen. The database enforces the rest: a check constraint ties `planned_part_count` to the type (null for `single`, `>= 2` for `series`), a trigger refuses a second part on a `single` story, and another refuses collapsing a multi-part series back to `single`.

Consequences that are easy to get wrong:

- URLs: `/stories/<slug>` for a single story, `/stories/<slug>/part-N` for a series part (§75). `canonicalPath()` decides.
- The editor shows no part tabs for a single story; "Make this a series" is a deliberate action that changes `story_type`.
- Her closing words belong to the **part**, because in a series each part ends somewhere different.

### Stories have no byline

`cnt_stories.author_alias` and `source_type` were removed in `20260921120000`. Readers already know every story here is written by Amake Fe from something someone told her, so "Anonymous Wife" under a title added nothing: it dressed up the absence of a name as if it were a name, and it invited a made-up persona per story. `source_type` existed only to choose between her own alias and a contributor's, so it went with it.

The line under a title is `storyMeta()` — category and length, nothing else. The **"Anonymous story" kicker in `StoryReading` stays**: that states the privacy promise, which is not the same thing as crediting an author. `cnt_stories.search` no longer weights an alias at C; it is title (A) + summary (B).

**Do not reintroduce a byline field.** If a story needs attributing differently, that is a product conversation, not a column.

### Two screens, one story

Deciding what a story *is* and writing one part of it are separate jobs, and the studio keeps them on separate surfaces:

- `/stories` — [StoriesScreen](author_web/src/screens/StoriesScreen.tsx), every story with its parts at a glance.
- `/stories/:storyId` — [StoryDetailScreen](author_web/src/screens/StoryDetailScreen.tsx). Story details (title, address, category, type, summary) and the cover image on the right; on the left, **the parts for a series, the story itself for a single**. A single story has one part and nothing to choose between, so a row that merely opens it is a lid on the thing you came to read — the prose is rendered in place, with **Details** and **Edit** beside the panel title. Edit opens the studio, as does **Add part**; Details goes to the part page.

  **A single story has a part page too**, and needs one: it is still a story with exactly one part, and the part page is where publishing, the part's picture and the Facebook post live. Showing its prose in place without a way through to that page left a one story that could be written and never sent.
- `/stories/:storyId/parts/:partId` — [PartDetailScreen](author_web/src/screens/PartDetailScreen.tsx). What the part says, how it is doing, and what can be done with it, under **Content** / **Comments** tabs. Its sidebar owns everything about *sending*: the publish/schedule/unpublish panel, the part's picture, the Facebook teaser, and the state of the Facebook post. **Reads are per part** (`cnt_story_views` counts them that way); **reactions and comments key on the story**, so they are labelled as the series' rather than passed off as this part's. Editing is still the studio, opened from here.
- A part's row carries its thumbnail — its own image, else the story's cover, else its number, the same falling-back the reader does — and one **Options** menu ([Menu.tsx](author_web/src/components/Menu.tsx)) holding Edit, Publish/Unpublish and Delete. On the *part's own* page that menu keeps only Edit, Open as a reader and Delete — publishing is in the panel beside it, where its state is visible, and repeating it in a menu would be a second way to do the same thing. Clicking the row itself opens the part's page. Not a `<select>`: these are actions, not a value, and a native select cannot disable an option with a reason attached or colour a destructive one. An action that cannot be taken stays visible and says why — "Nothing written yet", "Unpublish it first", "A series keeps at least one part" — rather than vanishing.
- Closing the studio calls `useRefreshStory`. Autosave writes through `savePartBody` rather than a mutation, so nothing invalidates while it is open — fine while the page behind is covered, wrong the moment it is not, or the detail page shows the body from before you started typing.
- The studio itself, [PartStudio](author_web/src/components/write/PartStudio.tsx), is a **full-screen modal, not a route**: the part's title and the editor on the left, and an inspector whose tabs run in the order the work happens — **Thoughts** (her closing words for this part), **Privacy** (the identifier scan) and **Preview** (the phone frame). Nothing story-level is editable in here — that is the page behind it.

  It takes a `mode`. **Creating** a part adds a fourth tab, **Publish** (part image, Facebook teaser, Publish/Schedule), because writing a new part runs straight into sending it and stopping at Preview would leave the job half done. **Editing** an existing one shows only the three: coming back to a part is about the words, and where it goes is decided on the part's page, where it can also be *seen* without opening an editor. Only "Add part" passes `mode="create"`.
- Starting a story is also a full-screen dialog, [NewStoryDialog](author_web/src/components/NewStoryDialog.tsx), openable from the sidebar, the story list or an empty studio.

`PartStudio` is `lazy()`-loaded once in [lazyPartStudio.ts](author_web/src/components/write/lazyPartStudio.ts), shared by the story and part screens — a `lazy()` per screen would give each its own copy of TipTap — so it stays out of both chunks — opening a story to look at its parts must not pull in an editor. Check the build output: `StoryDetailScreen` is ~5KB gzip and `PartStudio` ~135KB.

**`addPart` returns the whole new part, not just its id**, and `useAddPart` writes it into the cached story with `setQueryData`. The studio opens on that part the moment the mutation resolves; an `invalidateQueries` refetch has not landed by then, so the part would be missing from the cache and the modal would close itself on arrival.

### Reads are counted; readers are not

Reactions (`com_reactions` → `cnt_stories.like_count`) and comments (`com_comments`) were always recorded. Reads were not: `usr_read_progress` looks like read tracking but only exists once a reader has signed in — so it counts the engaged and misses everyone who simply read, which is nearly all of them.

`cnt_story_views` is a **daily counter per part with no identity column at all** — `(story_id, part_number, viewed_on, views)`, incremented in place. It stays that way now that readers sign in, for a different reason than the one its migration header gives: **it has to keep counting for readers who never sign in**, which is most of the people arriving from a Facebook link. Per-reader history lives openly in `usr_read_progress` instead.

- Readers write through `cnt_record_view(story_id, part_number)` only, which is SECURITY DEFINER and silently ignores anything not actually published, so the counter cannot be used to probe for drafts. They cannot read the table back.
- The reader counts **once per part per browser session** (a `sessionStorage` guard in `StoryScreen`). Without it, paging back and forth through a series reads as readership.
- `cnt_studio_stories` carries `view_count`, `view_count_7d`, `reaction_count` and `comment_count`, which is what the studio's list, its "Most read" rail and `sort: 'popular'` all run off. `cnt_studio_totals()` gives the numbers above the list.
- The sidebar's "This week" shows reads for the same reason — `weeklyReaders` sat permanently at zero.

### The studio's story index

`/stories` searches, filters and pages **in Postgres**, over `cnt_studio_stories` — a `security_invoker` view, staff-only via `usr_is_staff()`. Filtering in the browser would mean fetching every story to count them, which is the thing paging exists to avoid. `status` is derived there (`draft` / `scheduled` / `publishing` / `published`) rather than stored, for the same reason there is no status column on the story.

Search uses `ilike`, not the tsvector: an editor typing "unfri" expects to find "Unfriendly People", and full-text matches whole lexemes. Filters and the page number live in the URL, so the back button works and a filtered list can be sent to someone.

### Redaction happens in the database, not the browser

A contributor tells her story with real names. The creator writes it that way — that is how the detail survives — and lists the words that must not get out in `cnt_story_parts.anonymise_terms`. Everything published replaces each one with `**********` (ten asterisks regardless of length; a mask that tracked length would tell you the name has six letters).

**This is enforced server-side, and the split matters:**

| | holds | who can read it |
| --- | --- | --- |
| `cnt_story_parts` | the story as it was told, real names and all | editorial roles only — there is no anon SELECT policy |
| `cnt_public_parts` | published parts, redacted | `anon` and `authenticated` |

Redacting only in the client would leave the real names in `body`, one request away for anyone holding the publishable key. `redactText`/`redactDoc` in [prose.ts](packages/core/src/models/prose.ts) exist **only** so the studio preview shows what readers will get; they mirror `cnt_redact_text`/`cnt_redact_doc` exactly and `packages/core/test/prose.test.ts` pins both to the same cases.

Consequences that are easy to get wrong:

- **The reader reads `cnt_public_parts`, never `cnt_story_parts`.** So does `cnt_story_cards`'s lateral, and so does `cnt_search_stories` — the last one matters because the part's `search` vector is built from *redacted* text, so a hidden name cannot be used to find the story.
- **`cnt_public_parts` is a SECURITY DEFINER view and trips the `security_definer_view` advisor at ERROR level. That is deliberate.** It is safe because of what it selects — every text column wrapped in a redaction call, `body` never raw, `facebook_teaser` and `body_text` absent, published parts only — not because of who runs it. Adding `security_invoker = true` breaks the reader, and the obvious follow-up fix publishes every real name.
- Matching is case-insensitive and on word boundaries, so hiding "Mando" takes "Mando's" but leaves "mandolin" and "Mandola Street" alone.
- The Facebook teaser is redacted in the studio before it is copied or frozen into `cnt_publications.payload` — that text never passes through the database's redaction, so it has to be done at the point it leaves.

### Scheduling is publishing, later

There is no scheduler process and nothing runs at the appointed minute. A part with `published_at` in the future is simply invisible, because the RLS policy compares it to `now()` — so the queue cannot drift out of step with what is actually live.

Scheduling is offered in exactly one place: the studio's **Publish** tab, beside "publish now" — the moment you finish writing is the moment you decide when it goes out. The Schedule screen is a calendar you read, not one you edit, because scheduling now opens the Facebook drawer and that decision belongs with the part it promotes.

`cnt_schedule_part(part_id, at)` carries the same emptiness guard as `cnt_publish_part` (a queued empty part would become a blank page on Tuesday) plus one of its own: the time must be in the future. A past time is not a schedule, it is publishing now, and an RPC that quietly did both would make "scheduled" and "live" depend on how long the request took. Clearing a schedule is `cnt_unpublish_part` — it is the same column.

### Publishing is per part, and there is no status

There is no `cnt_stories.status` and no status enum — both were removed in `20260921110000`. A part is on the site exactly while `published_at` is set and has passed; a story is visible exactly while one of its parts is. `partState()` in core turns that into `draft` | `scheduled` | `live`, and the studio offers **Publish** and **Unpublish** and nothing else.

This matters because the older design could disagree with itself: the story said `published` while `cnt_story_parts` RLS still hid every part, so readers got a published story with nothing in it. With one source of truth that state cannot be represented.

- `cnt_publish_part(part_id)` / `cnt_unpublish_part(part_id)` are the only writes; publish refuses an empty part.
- `cnt_story_is_public(story_id)` is SECURITY DEFINER over `cnt_story_parts`, so the policy on `cnt_stories` can consult the parts without RLS recursing back into the story. The policy on `cnt_story_parts` consults nothing at all.
- `cnt_story_cards.published_at` is the earliest published part — the story's debut — and `part_count` counts only published parts.

### Front-end structure

```
packages/core/src/
  supabase.ts        client factory + ensureReaderId
  database.types.ts  generated — do not hand-edit
  models/            domain types and row→model mappers
  queries/           every Supabase call in the system
  tokens.css         design tokens as a Tailwind @theme block
  fonts.css          self-hosted woff2 @font-face rules
packages/core/fonts/ the four woff2 files (99KB total)

reader_web/src/ · author_web/src/
  db.ts              the one client instance, from Vite env
  main.tsx           router + QueryClient + the app shell
  hooks/queries.ts   TanStack Query hooks wrapping @amakefe/core
  components/        shared presentational pieces
  screens/           one file per screen
author_web/src/auth.tsx   session, editorial-role gate, sign-in
reader_web/src/auth.tsx   session, Facebook sign-in, the replayed intent
```

Both apps share the design tokens and query layer but nothing else — they are separate Vite builds with separate service workers. The reader caches story responses for offline reading; **the studio caches no API responses at all**, because it holds unpublished drafts.

Conventions, applied consistently:

- **All Supabase access goes through `@amakefe/core/queries`**, reached from components only via `hooks/queries.ts`. A component that imports `db` is doing something wrong. No query re-checks permissions — RLS already decided.
- **Mappers narrow at the boundary.** Postgres reports view columns as nullable because it cannot prove otherwise through a lateral join; `toStoryCard` and friends narrow once so no screen copes with nulls that never arrive.
- **Both apps' `styles.css` must `@source '../../packages/ui/src'`.** Tailwind auto-detects sources under each app only and skips `node_modules`, where the workspace link to `@amakefe/ui` lives. Without it, a class used *only* in a shared component is silently absent from the build and nothing fails — story prose shipped for a while with no paragraph spacing, no pull-quote rule and no part-progress bar, while classes that happened to also appear in app source survived, which made it look like a rendering quirk rather than missing CSS. If a shared component ever looks unstyled, grep the built CSS for one of its classes before touching the component.
- **No colour, font or radius literal outside [tokens.css](packages/core/src/tokens.css).** Use the Tailwind utilities the tokens generate (`text-ink`, `bg-surface-warm`, `font-display`). A raw hex in a component is a bug, save for a couple of one-off shades noted inline.
- **Drawers come in from the right, not up from the bottom.** A sheet rising from the bottom edge is a phone gesture; this is a desktop tool, and a side panel reads as something arriving beside the page rather than covering it. `.drawer-scrim` and `.drawer-panel` in [tokens.css](packages/core/src/tokens.css) carry the fade and the slide, on a decelerating curve so the panel settles against the edge instead of being thrown at it, and both are dropped under `prefers-reduced-motion`. A drawer is `h-full w-full md:w-1/2` — half the viewport from `md` up, the whole of it on a phone, where half a screen is a sliver rather than a panel. Its contents are laid out for one column, not the two a bottom sheet had room for.

- **One scroll region per screen, with one deliberate exception.** Nested or side-by-side scrollbars look like clutter, so in the studio only `main` (or the part studio's own body) scrolls: the inspector is not sticky and has no overflow, and long textareas use `.auto-grow` (`field-sizing: content`) instead of drawing their own bar — deliberately with no `max-height`, since a cap just moves the scrollbar back into the field.

  The exception is the **device frame in the reader preview**, which keeps a fixed height and scrolls inside itself. It is imitating a phone, and a phone is a fixed window onto a long story; a frame that grew to fit showed the whole story at once, which is the one thing a reader never sees. It uses `.phone-screen` — a narrower, softer thumb that fades in on hover, plus `overscroll-behavior: contain` so reaching the end of the story does not start scrolling the studio behind it. Its height is capped against the viewport so the handset fits on any laptop.

  Scrollbars are styled thin and track-less in [tokens.css](packages/core/src/tokens.css); `.on-ink` lightens the thumb on the dark sidebar. Verify with a computed-style sweep in a real browser, not by reading classes — `overflow-y-auto` only draws a bar when content actually overflows.
- **Loading and error go through `<Async>`** so no screen invents its own. Loading is a quiet skeleton, never a spinner — the design is a printed page.
- **A reader action that needs an account goes through [`useSignInPrompt`](reader_web/src/hooks/useSignInPrompt.tsx)**, passed as the mutation's `onError`. Every one of these used to be a bare `.mutate()` with no error branch, so Save and ♥ did nothing and said nothing — a broken button, not a request to sign in. The hook opens the sheet on `NotSignedInError` with the reason and the intent to replay, and says something plain on anything else. Read progress is the exception: it is not a gesture the reader made, so it fails quietly rather than interrupting them.
- **The Facebook button is a brand asset, not a design decision.** `#1877F2`, the official mark, "Continue with Facebook", unaltered, per Meta's rules — the one control that deliberately ignores the product palette. The blue lives in tokens.css as `--color-facebook` so nobody reaches for it as a general-purpose blue. ("Continue as \<Name\>" is Facebook's own re-auth UI and cannot be rendered here.)
- **Icons are unicode glyphs, not an icon set.** The sidebar's `◧ ❏ ⚑ ♥ ◷` and the story list's `❏` parts, `¶` words, `◎` reads, `♥` reactions, `❝` comments are the whole vocabulary — a pictogram library would be a dependency for a handful of characters, and it would not match a design built on Marcellus and a printed page. They are decoration over the word beside them, so they carry `aria-hidden` rather than being read out as punctuation. At meta-row size they need `text-muted`; anything paler disappears.
- **Going back up a level uses `BackLink`** from [shell.tsx](author_web/src/components/shell.tsx). It was muted 12px text and people reached for the browser's back button instead, so it is button-shaped now, in the same vocabulary as the studio's other secondary actions.
- **Buttons get `cursor: pointer` from [tokens.css](packages/core/src/tokens.css), not from a utility class.** Tailwind v4's preflight dropped v3's `button { cursor: pointer }` for the browser default, so every button in both apps came up with an arrow while every link looked clickable. One base rule covers enabled buttons and `[role="button"]`, with `not-allowed` for disabled ones — don't add `cursor-pointer` per button, because the next button added would not have it either.
- **No native pickers either.** `<input type="datetime-local">` brings the operating system's widget — Chrome's grey calendar on Linux, something else on a Mac, `mm/dd/yyyy` regardless of where you are — in none of the studio's typefaces or colours. [DateTimeField](author_web/src/components/DateTimeField.tsx) is a month grid plus hour and minute columns, in the product's own palette, working in the browser's zone because that is the one the creator thinks in.
- **Never `window.confirm`, `window.alert` or `window.prompt`.** The native dialog is the browser's UI, not the product's: OS typeface and colours, a "localhost:5174 says" header, and it blocks the page. Every question is an in-app modal. Use [`useConfirm()`](author_web/src/components/ConfirmDialog.tsx) — `await confirm({ title, body, confirmLabel, tone })` returns a boolean, so the call site reads like the one-liner it replaces. Anything that collects input gets a purpose-built dialog instead, as [ImageDialog](author_web/src/components/write/ImageDialog.tsx) does for a figure's description.
- **Fonts are self-hosted, not fetched from Google.** The audience is on mobile data; text must not wait on a third-party CDN.
- **The brand mark is `<Mark>`**, drawing on [packages/core/brand/portrait.webp](packages/core/brand/portrait.webp) — the illustrated portrait from the logo sheet, resized to 160px and 9KB. It stands for the creator: the app header, her reflection after a story, her Community posts, the studio sidebar and sign-in. A *reader's* avatar is never this — they get their own Facebook picture, or the initial of their name. Full-size artwork and the one-colour line variants live in [docs/screens/assets/](docs/screens/assets/).
- **Watch the bundle.** Routes are lazy, vendor is split into `supabase` and `react` chunks. App code is ~18-20KB gzip in each app; keep it that way. TipTap (~135KB gzip) lives entirely inside the studio's lazy `PartStudio` chunk — the reader renders documents with a hand-written recursive component costing about 1KB, and must never gain a ProseMirror dependency.
- **A file that exports a component exports nothing else.** Adding a second export breaks React Fast Refresh (`Could not Fast Refresh (new export)`), and Vite then tears down and remounts the component instead of patching it. For most screens that is invisible; for the editor it is not — a remount emits an empty document, and autosave's unmount flush wrote that over a part, losing a story that had just been pasted in. Helpers live in their own module ([pastedHtml.ts](author_web/src/components/write/pastedHtml.ts) is one), and autosave now refuses to blank a part that had words. Both, because the first is the cause and the second is the net.

- **The panels that save on blur say so.** Story details, her closing words and the image panels commit when a field loses focus, in keeping with the studio having no Save buttons — but silence made that read as nothing having happened, and a *failed* save said nothing at all. `SaveHint` in [panels.tsx](author_web/src/components/write/panels.tsx) sits in the Panel's `actions` slot and reports Saving / Saved / the error. Single-line fields also commit on Enter, which is what people press to mean "that's it".

- **Autosave, not a Save button.** [useAutosave](author_web/src/hooks/useAutosave.ts) debounces 1.5s, forces a save every 20s of continuous typing, and flushes on part switch, tab hide and unload. It sends `.eq('updated_at', lastKnown)` so a second editor's work is never silently overwritten. Because it writes constantly, list screens must use `fetchStorySummaries` (no bodies) — `fetchStudioStory` is only for the editor.
- **The studio keeps drafts in IndexedDB.** This is a knowing exception to `author_web/vite.config.ts`'s `runtimeCaching: []`, which exists because the studio holds unpublished work. The buffer is cleared on sign-out; see [draftStore.ts](author_web/src/draftStore.ts).
- **The privacy scan is a pure function** in [packages/core/src/privacy.ts](packages/core/src/privacy.ts), covered by tests including false-positive guards (years and ages must not read as phone numbers). It is advisory for warnings but blocks the publish button on a `danger` finding — a phone number or email left in a story is the worst thing that can go wrong in this product.
- Tailwind v4 CSS-first config only — no `tailwind.config.js`, no shadcn. The design is specific and utility defaults fight it.

### Media and distribution

One storage bucket: **`public_media`**, holding covers and in-story figures — readable by `anon`, written only by editorial roles. Uploads are re-encoded to WebP client-side via `OffscreenCanvas`, which also drops EXIF. A second private `source_media` bucket existed for voice notes; nothing uploads source material any more, so its policy was dropped. The empty bucket itself needs a service-role key to delete and can go from the dashboard.

**`cnt_publications`** is the distribution log. Rows exist only for channels needing an outbound action (`facebook`, `push`, `email`); the app and the website are where a story simply lives, published by RLS the moment `published_at` passes. `payload` is frozen when a post is planned, so editing the teaser later cannot silently change what goes out. The Facebook teaser lives on the **part**, not the story — §76 is one post per release, and the hook for part 4 is not the hook for part 1.

### Posting to Facebook

Facebook is where the audience is, so **the post is a step of publishing, not a separate errand.** The Publish tab carries a *Publish to Facebook* switch, on by default and forced off with a link to `/settings` when no Page is connected. With it on, **Publish** and **Schedule it** open [FacebookDrawer](author_web/src/components/write/FacebookDrawer.tsx) — a half-height sheet where she decides what goes out — instead of acting directly. An immediate publish posts synchronously and waits, so a refusal from Graph appears while she is still there and can act on it; only a *scheduled* part needs the background job.

The order is **publish the part, then post**. The reverse puts a live Facebook post in front of a story readers cannot open. If Facebook then fails, the part stays live, the publication row is `failed` with Facebook's own words on it, and the drawer offers a retry — a failed promotion is not a reason to unpublish a story.

**Sending lives where the decision is made, not where the words are.** [PublishPanel](author_web/src/components/write/PublishPanel.tsx) — publish, schedule, unpublish, and the Facebook state — appears on the part's own page and on the studio's Publish tab *while a part is being created*. Opening an existing part to rework it shows no Publish tab at all: editing is the prose, and a part that already exists is sent from its page. [ScheduleScreen](author_web/src/screens/ScheduleScreen.tsx) is a calendar you read, not one you edit.

**The part's whole relationship with Facebook is one card**, [FacebookPanel](author_web/src/components/write/FacebookPanel.tsx), beside the Publish panel rather than inside it — a part can be live without having been posted, and posted without being the thing you came to change. It shows **Post it to Facebook** when nothing has gone, **Try Facebook again** after a refusal, and once it is out, the reactions/comments/shares/reach inline plus **Posting details**, which opens [FacebookStatsDrawer](author_web/src/components/write/FacebookStatsDrawer.tsx) for the fuller picture. Those numbers are read live from Graph and never stored: they change all day, and a copy in Postgres would only ever be a stale one nobody trusts.

That card replaced a teaser box, an Open Graph card builder and a preview of a link post. The teaser is now written in the drawer and saved back onto the part on confirm — without that, a retry reopens the drawer, prefills from the body and throws away her wording. The OG card went entirely (`20260921210000`): it was written and read by that one panel and by nothing else, and it described a link post's card while these go out as photos. When the SEO site needs Open Graph tags it will render them server-side from the story's cover, which is a different job.

The compose-and-send act itself is [useFacebookShare](author_web/src/components/write/useFacebookShare.tsx), written once and used by both surfaces, so the part page and the create studio cannot drift apart.

What the drawer composes lives in [packages/core/src/facebookPost.ts](packages/core/src/facebookPost.ts), pinned by tests:

- `snippetFrom(doc, terms, share = 0.35)` takes **whole paragraphs** from the start until the cumulative length reaches the share, so a post never stops mid-sentence; always at least one paragraph. The drawer prefills with her own `facebook_teaser` if she wrote one, and this otherwise.
- `composeFacebookPost({ mode, snippet, body, terms, link })` always ends `\n\nRead the full story:\n<link>`. The footer is not editable — a post pointing somewhere other than the story is a post nobody can follow.
- **Both modes redact.** Whole-part mode without `redactDoc` would publish every anonymised name to 200,000 people, which is exactly what the feature exists to prevent.

The post carries the part's own picture (`thumbnail_path ?? cover_image_path`): `POST /{page-id}/photos` with `url` + `caption`, falling back to `/{page-id}/feed` when there is none. A link post would be simpler, but its card is whatever Facebook's crawler scrapes from the link, which is nothing at all until the reader is deployed somewhere the crawler can reach. A photo carries the image regardless. Photo responses answer `{ id, post_id }` — `post_id` is the permalink.

Adapted from twig (`/home/chingenge/DevWork/JavuApps/twig`), whose `oauth-callback` / `oauth-finalize-meta` pair is the same exchange: short-lived user token → long-lived → list Pages → store a Page token. Three things are deliberately different, because the products are not shaped alike:

| | twig | here |
| --- | --- | --- |
| Tenancy | a token per creator, keyed on `creator_id` | **one** connection for the platform — one creator, one Page |
| Who can read the token | the creator can select their own row | **nobody.** `cnt_facebook_connection` has RLS on and *no policy at all* |
| What gets posted | video Reels, a 3-step start/upload/finish | the part's picture captioned with the story, one `POST /{page-id}/photos` |
| Return trip | `twigapp://oauth/callback` | the studio's `/settings` |

**The Page token is the most dangerous secret in this system** — it can post to 200,000 followers — and the studio never needs it. Only the Edge Functions do, holding the service-role key. So the table refuses every client role, and `cnt_facebook_status()` hands the studio the Page's name and health with no token column in its return type at all. The two "RLS enabled, no policy" advisories on `cnt_facebook_connection` and `cnt_facebook_pending` are that design, not an oversight; adding a policy to clear them would hand an editor the token.

Three functions in [supabase/functions/](supabase/functions/):

- **`facebook-oauth`** — the callback. `verify_jwt = false` in [config.toml](supabase/config.toml), because Meta redirects a browser here with no Authorization header; it is not open, it reads the editor's access token out of the OAuth `state` and refuses anyone without an editorial role. **If it is redeployed through the MCP server, that flag resets to true and the connection silently breaks** — check it in the dashboard.
- **`facebook-connect-page`** — finishes the connection when the account runs several Pages. The studio only ever saw their names; the chosen Page's token is read server-side and the pending row is destroyed either way.
- **`facebook-post-stats`** — one post's reactions, comments, shares and reach, read from Graph on demand. Unlike the poster it has no service-role path: a person asks, and that person must be editorial. It exists because the Page token cannot go to the browser, so the studio sends a publication id and gets numbers back.

  It makes **three separate Graph calls on purpose**, because they need different permissions and *Graph refuses an entire request when any one field is not allowed*: the post's own details need `pages_read_engagement`; reactions and comments need `pages_read_user_content`, since those are other people's content on our post; and insights do not exist at all until a post has been seen. Asked for together, a single missing permission returned `(#10)` and the card showed nothing, when the date, the link and the share count were all available. Refused counts come back **null, not zero** — a post with no reactions and a post we may not count are not the same thing, and a zero is a lie the creator might act on.

**An unqualified `DELETE` or `UPDATE` is refused** — Supabase runs the `safeupdate` guard, which answers `21000: DELETE requires a WHERE clause`. `SECURITY DEFINER` is no escape: the guard is set on the session, and the session belongs to whichever role called in. `cnt_facebook_disconnect` was written without one and failed the first time anyone pressed Disconnect (`20260921220000`); `where true` is the honest form. The Edge Functions had already met this and disguised it as `.neq('id', crypto.randomUUID())`.

**A token keeps the permissions it was minted with.** Adding a permission in the Meta dashboard changes nothing for a Page already connected; the scope list in `facebookAuthUrl` is what is actually requested, and the Page must be connected again afterwards. The `scopes` column on the connection is only a record of what was asked for — nothing reads it to decide anything.
- **`facebook-post`** — called with `{ publicationId }` it sends that one and waits (the Publish path); called with no body it drains the queue (the cron path). It answers `{ sent, failed, considered, reasons }`, and `reasons` carries Facebook's own message so the drawer can say "Malformed access token" rather than "it failed". A Graph error code 190 flips the connection inactive, so the studio says "reconnect" instead of failing the same way forever.

**Both browser-invoked functions must answer the CORS preflight.** `db.functions.invoke` from the studio sends an `OPTIONS` first; without a handler and the headers on every response the call fails with "Failed to fetch" before it ever reaches the function, and nothing appears in the logs.

**The scheduled path gates on the part, not on a copied timestamp.** `cnt_facebook_due()` joins `cnt_story_parts` and returns planned Facebook rows whose *part* has gone live, so rescheduling a part cannot desync it from its post. `pg_cron` runs `facebook-due` every minute, calling the function through `pg_net` with the service-role key read from Vault.

Two bugs on that path were found only by exercising it end to end, and both were invisible from the cron's own run history — it reported success every minute while carrying them, because it returns early when nothing is due:

- **`pg_net` lives in schema `net`, not `extensions`.** `extensions.net.http_post(...)` is a *database*.schema.function reference and raises `cross-database references are not implemented`. `create extension ... with schema extensions` had not moved it, because pg_net was already installed and `if not exists` skipped the statement (`20260921200000`).
- **The scheduler is identified by its JWT's role claim, not by string-comparing the bearer token to `SUPABASE_SERVICE_ROLE_KEY`.** That comparison assumed the cron holds a byte-identical copy of whatever the platform injects, and it silently stopped being true: the cron sent a valid `service_role` key from Vault and was answered 401. Reading the claim is safe because `verify_jwt` is on, so the gateway has already checked the signature of anything that reaches the function.

To check that chain without posting anything, call the function through `net.http_post` with a `publicationId` that does not exist: a healthy path answers `200 {"sent":0,"failed":0,"considered":0}`.

A trap this caught: `cnt_publish_part` used `coalesce(published_at, now())`, so publishing an already-*scheduled* part kept the future timestamp — "publish it now instead" silently did nothing and its Facebook post was never due. It now lowers a future time to `now()` and leaves a past one alone (`20260921190000`).

Needs configuring before any of it works: `VITE_META_APP_ID` and `VITE_PUBLIC_SITE_URL` (the **reader**, not the studio — every post carries this link) for the studio; `META_APP_ID`, `META_APP_SECRET`, `STUDIO_URL` as Edge Function secrets; and the service-role key in Vault as `service_role_key`, without which nothing scheduled ever sends.

### Core domain model

The spec's §52 gives `Story` a status enum and hangs `creator_notes` and `published_at` off the story. **The implementation deliberately does not** — see "Publishing is per part" above. Story-level publishing and a part-level RLS gate are two sources of truth that can disagree, and did. What survives from §52 is the shape: `Story` has many `StoryPart`, and multi-part serialized stories are a core feature, not an add-on — feeds, notifications, "continue reading" and retention all key off parts.

Published stories still need version history (corrections, privacy redactions, audit); that is §74 and is not built.

Roles: Member, Creator, Editor, Moderator, Admin, Finance, Super Admin — permissions are role-based. `usr_is_staff()` covers the studio broadly; `usr_is_editorial()` is the narrower set (creator, editor, admin, super_admin) allowed to write and publish.

Full table list in §52 of the spec; MVP subset in §82.

### MVP boundaries

In scope (§82): auth, home, story feed/categories/search, reader, multi-part, continue reading, comments/replies/reactions, save, share, community questions, polls, notifications, topic following, profile, support/donations, call + WhatsApp CTAs; backend for those plus reports, admin roles, audit logs; creator dashboard with story CRUD, part management, scheduling, publishing, moderation, analytics.

Explicitly **out** of MVP (§83): in-app long-form story submission, AI chatbot/counselor, RAG assistant, automated publishing, marketplace, professional directory, course platform, gamification, creator CRM. Don't build these unless asked.

## Design prototypes — the binding UI reference

**[docs/screens/](docs/screens/) is the design spec, and it is to be followed religiously.** Build what the prototypes show: same screens, same layout and ordering, same type scale, same colors, same spacing, same copy tone. Do not substitute a component library's default look, do not "modernize" the styling, and do not invent screens that aren't there. If a screen you need is missing or something in a prototype is ambiguous, ask rather than improvising — and if a deviation is unavoidable, state it explicitly instead of quietly diverging.

Screens in the prototypes:

- **Reader App** (`reader_web`) — `home`, `story` (multi-part reader), `stories`, `community`, `ask` (Ask Her), `share` (Share Your Story, dark full-screen take-over with no tab bar), `support`, `profile`. Bottom tab bar (see `ReaderTabs.dc.html`): Home, Stories, Community, Ask Her, Profile. "Share Your Story" is a prominent CTA, not a tab. All built.

  Stated deviations from the prototype, each for a reason:
  - **No name in the Home greeting.** The prototype greets "Chanda"; the greeting is time-of-day only, because Home is the screen someone lands on from Facebook before they have signed in. Profile does show their name once they have.
  - **The Home reading card falls back to the newest story** when a reader has nothing in progress — the common case for someone arriving from Facebook.
  - **The creator post on Community has no ♥/💬 counters.** Reactions are keyed to stories; wiring them to posts needs a polymorphic target or a second table, which is not worth it for two numbers before comments exist.
  - **Profile shows every category as a toggle chip**, not just followed ones. The prototype's static chips give the follow feature no entry point anywhere in the app.
  - **Profile omits the Notifications / Reading preferences / Privacy settings rows.** They lead nowhere yet, and four dead rows are dead UI.
  - **"Record a voice note here" sends the reader to WhatsApp** rather than recording in-app. Source material is not handled by this platform at all, and spec §14 lists all three channels as links anyway.
  - **Readers sign in with Facebook**, which the prototypes do not show at all — they were drawn when readers were anonymous. The button appears in the sheet that opens on an action, and on Profile.
  - **Story comments are not built.** `com_comments` exists and the MVP checklist lists them, but no prototype screen shows a comment thread, and inventing that UI would be guessing at the design.
  - **Weeks start on Sunday**, in the Schedule calendar and in [DateTimeField](author_web/src/components/DateTimeField.tsx). The prototype's calendar is Monday-first; the creator and her audience read a week from Sunday.
  - **The reader's story page can show a cover image**, which the prototype does not have. Story *tiles* keep the lettered tile, which is the design and works when there is no cover.
  - **The studio's Write screen is not the prototype's.** The prototype shows a static draft; this is a live editor with a formatting toolbar, a phone-width preview, the §40 record and a Facebook panel. The sidebar, header and the other five screens follow the prototype.
- **Creator Dashboard** (React PWA) — `dash`, `write`, `series` (multi-part management), `schedule`, `moderation`, `supporters`. Dark `#2E1F2B` sidebar, 244px wide, on a `#FBF7F0` canvas.

Design tokens to carry into both codebases:

- Fonts: **Marcellus** (display/headings), **Karla** (UI/body), **Lora** (story prose — italic used for pull quotes)
- Palette: ink `#2E1F2B`, muted `#8A7767`, body `#5B4B41`, page cream `#EFE7DB`, card `#FFFDF9`, warm `#F6EDE0`, accent terracotta `#C05E3C` (hover/pressed `#8E3F26`, deep `#A94A2E`), gold `#E0A43B`, green `#2F6B4F`, borders `#EBDFCE` / `#DCCDB8`
- Reader frame is 402×874 (iPhone), so treat that as the mobile design width

### Running the prototypes

Each `.dc.html` is a standalone page driven by the `dc-runtime` in [docs/screens/support.js](docs/screens/support.js) (generated — do not edit), which bootstraps React 18 + Babel from unpkg at load. They use custom elements (`<x-dc>`, `<sc-for>`, `<sc-if>`, `<x-import>`) plus a `class Component extends DCLogic` script block holding the mock data and screen state. [docs/screens/ios-frame.jsx](docs/screens/ios-frame.jsx) is a copied starter iOS device frame — chrome only, not part of the app design.

They need HTTP (not `file://`) because of relative imports and assets:

```bash
python3 -m http.server -d docs/screens 8080   # then open "/Reader App.dc.html"
```

These are design sources, not application code — port them, don't import them.

## Supabase

The Supabase MCP server is enabled in [.claude/settings.local.json](.claude/settings.local.json). Inspect tables before schema changes; the database is empty, so any `list_tables` result showing content means someone has started the schema — read it before assuming the spec's model was followed.
