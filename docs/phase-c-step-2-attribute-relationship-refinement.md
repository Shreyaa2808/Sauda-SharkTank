# Shark Tank India DBMS — Phase C, Step 2
## Attribute Refinement, Relationship Inventory and Cardinalities

**Purpose:** refine the candidate entities from Phase C, Step 1 into a consistent conceptual model. This document establishes candidate identifiers, attributes, cardinalities, participation constraints and business constraints. It does not create SQL tables or implement the database.

**Scope baseline:** use the finalized Phase B requirements and `docs/phase-c-step-1-entity-inventory.md`. The project is an independent academic prototype, initially covering 1–2 reliably sourced seasons. Historical Sharks remain historical data records, not platform roles. Platform startup listings remain separate from historical startups/pitches in core scope.

---

## 1. Modelling conventions

- **Core** means required by the agreed prototype scope.
- **Optional** means a prioritized extension or a candidate requiring approval before implementation.
- A primary identifier shown here is a **conceptual candidate**. Its physical SQL type and exact constraints are decided in Phase D.
- A relationship is **mandatory** when an occurrence cannot validly exist without its parent. Optional participation is allowed when a value or event can be absent.
- A `NULL`-capable attribute represents information that may be unavailable or not yet sourced. It must not be interpreted as a negative fact.
- Names are not assumed unique unless explicitly stated. Distinct people or startups may share similar names.
- `SECTOR` is introduced as a small controlled lookup to standardize the sector values used by historical records, platform listings and filters. This is a data-quality refinement, not a new user-facing feature.

## 2. Refined candidate entities and minimum identifying attributes

### 2.1 Historical show data — Core

| Entity | Candidate identifier | Minimum useful attributes | Required relationships / notes |
|---|---|---|---|
| **Season** | `season_id` | `season_number`, optional title/year range | `season_number` is unique when known. A season may temporarily have no loaded episodes. |
| **Episode** | `episode_id` | `season_id`, `episode_number`; optional title and air date | Each episode belongs to exactly one season. `(season_id, episode_number)` is unique. |
| **Historical Shark** | `shark_id` | display name; optional biography | Name is not assumed unique. Separate from platform account and investor profile. |
| **Episode Shark Participation** | composite `(episode_id, shark_id)` | episode, Shark; optional sourced participation note | Resolves the many-to-many relationship between episodes and Sharks. Seat/panel details are not required unless reliably sourced. |
| **Historical Startup** | `historical_startup_id` | name; optional sector, description, location | A historical startup may appear in one or more pitches; it is not the same entity as a platform listing. |
| **Historical Person** (founder/presenter) | `historical_person_id` | display name; optional short biography | Used for people named as founders or presenters in historical data; not automatically a registered Founder. |
| **Historical Startup Founder** | composite `(historical_startup_id, historical_person_id)` | references to startup and person; optional sourced role/order | Resolves many-to-many startup/person associations. |
| **Pitch** | `pitch_id` | `episode_id`, `historical_startup_id`; optional ask amount, ask equity percentage, summary | Each pitch concerns one historical startup and belongs to one episode. Do not assume asks are known. |
| **Offer** | `offer_id` | `pitch_id`; optional offered amount, equity percentage, terms, on-air status | Each offer belongs to one pitch. An on-air offer is not proof of a completed deal. |
| **Offer Shark Participation** | composite `(offer_id, shark_id)` | offer, Shark; optional participation description | Resolves joint offers involving one or more Sharks. |
| **Deal Outcome** | `deal_outcome_id` | `offer_id`, outcome status; optional evidence date/notes | Zero or one current recorded outcome per offer in core scope. Unknown/unavailable must remain distinct from closed or not closed. |
| **Sector** | `sector_id` | unique normalized `sector_name` | Used by historical startups and platform listings. Unknown/unmapped sector may be absent. |

### 2.2 Platform identity, profiles and listings — Core

| Entity | Candidate identifier | Minimum useful attributes | Required relationships / notes |
|---|---|---|---|
| **Platform Account** | `account_id` | unique Google identity subject, private email, account status, created/updated timestamps | Google Sign-In authenticates the account but does not verify business ownership or investor legitimacy. Email is private. |
| **Account Role Assignment** | composite `(account_id, role_code)` | account, role, assigned timestamp, optional granting administrator | Viewer is the default role. Founder and Investor may both be assigned. Administrator can only be granted by an existing administrator. |
| **Founder Profile** | `account_id` (also FK) | public display name; optional bio, public region and public website | At most one profile per account. Exists only when the account holds Founder role. |
| **Investor Profile** | `account_id` (also FK) | public display name; optional bio, public focus description and public website | At most one profile per account. Exists only when the account holds Investor role. |
| **Platform Startup Listing** | `listing_id` | `owner_account_id`, name, sector (if known), description, status and timestamps | Exactly one primary account owner in core scope. Owner must hold Founder role. Public listing fields must not include private account/contact data. Use logical deletion/soft deletion to preserve request and message history. |
| **Listing Co-founder Entry** | `cofounder_entry_id` | listing, display name; optional display role/order | Other co-founders are named for information only and do not get editing rights in core scope. |

### 2.3 Connections and messaging — Core

| Entity | Candidate identifier | Minimum useful attributes | Required relationships / notes |
|---|---|---|---|
| **Connection Request / Connection Lifecycle** | `request_id` | investor account, founder account, target listing, status, created/updated timestamps; optional response/end time and closure reason/actor | A request targets one specific platform listing owned by the stated founder. Statuses: `Pending`, `Accepted`, `Declined`, `Withdrawn`, `Ended`. |
| **Conversation** | `conversation_id` | accepted request reference, created timestamp | Zero or one conversation per request; one is created when the request is accepted. A later accepted request creates a new conversation. |
| **Message** | `message_id` | conversation, sender account, text body, sent timestamp | Sender must be one of the two participants. Text only. Messages remain readable in read-only mode after connection end or listing deletion. |

### 2.4 Import support — Core

| Entity | Candidate identifier | Minimum useful attributes | Required relationships / notes |
|---|---|---|---|
| **Import Batch** | `import_batch_id` | administrator account, source file name, entity type, start/completion timestamps, batch status | A batch describes one supported file/import run, normally for one record type. Only administrators may run or review imports. |
| **Import Row Result** | composite `(import_batch_id, row_number)` | status (`Succeeded`/`Failed`), optional created-record identifier, error code/message when failed | Stores one result per source row so the report can be reopened. Counts are calculated from these rows, not maintained redundantly. |

### 2.5 Optional extensions — Not part of the core ER model

| Entity | Candidate identifier | Purpose / limit |
|---|---|---|
| **Post-show Observation** | `observation_id` | Later performance information for a historical startup, only when reliable sources are available. |
| **Platform Listing Bookmark** | composite `(account_id, listing_id)` | Optional saved platform listing. |
| **Historical Startup Bookmark** | composite `(account_id, historical_startup_id)` | Optional saved historical startup. |
| **Investor Sector Preference** | composite `(account_id, sector_id)` | Candidate only if structured investor preference matching is added later. |
| **Data Source/Citation** | `source_id` | Candidate for structured record-level provenance. Core work must still use reliable sources, but a full source-citation subsystem is deferred. |

---

## 3. Relationship and cardinality inventory

Notation in the table: `1` = exactly one; `0..1` = zero or one; `0..N` = zero or many; `1..N` = one or many from the conceptual viewpoint. Constraints such as “only if the role exists” are business rules in addition to cardinality.

| Relationship | Cardinality | Participation / constraint |
|---|---|---|
| Season — Episode | Season `0..N` Episodes; each Episode `1` Season | Episode number is unique within a season. |
| Episode — Historical Shark | many-to-many via Episode Shark Participation | One participation row per episode/Shark pair. A loaded episode may have incomplete Shark attendance data. |
| Historical Startup — Historical Person | many-to-many via Historical Startup Founder | One association row per startup/person pair; role/order details are optional. |
| Episode — Pitch | Episode `0..N` Pitches; each Pitch `1` Episode | A pitch cannot exist without its episode. |
| Historical Startup — Pitch | Historical Startup `0..N` Pitches; each Pitch `1` Historical Startup | Multiple pitches/appearances are possible if supported by the data. |
| Pitch — Offer | Pitch `0..N` Offers; each Offer `1` Pitch | A pitch can have no offers. |
| Offer — Historical Shark | many-to-many via Offer Shark Participation | Joint offers are represented by multiple participation rows, not repeated Shark columns. |
| Offer — Deal Outcome | Offer `0..1` current Deal Outcome; each outcome `1` Offer | Outcome may be unknown/not available; do not infer closure from the on-air event. |
| Sector — Historical Startup | Sector `0..N` startups; startup `0..1` sector | Sector may be missing if not reliably known. |
| Sector — Platform Startup Listing | Sector `0..N` listings; listing `0..1` sector | Keep categories standardized using the lookup. |
| Platform Account — Account Role Assignment | Account `1..N` role rows; each role row `1` account | A new account starts as Viewer. Founder/Investor roles may coexist. |
| Platform Account — Founder Profile | Account `0..1` Founder Profile; profile `1` account | Profile requires the Founder role. |
| Platform Account — Investor Profile | Account `0..1` Investor Profile; profile `1` account | Profile requires the Investor role. |
| Platform Account — Platform Startup Listing | Account `0..N` owned listings; each listing `1` primary owner | Owner must hold Founder role. One listing has one primary owner in core scope. |
| Platform Startup Listing — Listing Co-founder Entry | Listing `0..N` named entries; entry `1` listing | Entries do not grant account privileges or editing rights. |
| Investor Account — Connection Request | Investor `0..N` requests; each request `1` investor | Investor role required. Cannot target own listing where account also has Founder role. |
| Founder Account — Connection Request | Founder `0..N` incoming requests; each request `1` founder | The founder must own the target listing named in the request. |
| Platform Startup Listing — Connection Request | Listing `0..N` requests; each request `1` listing | Request records the specific listing and its primary founder. Deleted listings are not discoverable. |
| Connection Request — Conversation | Request `0..1` Conversation; Conversation `1` accepted request | Conversation is created only when accepted. Later accepted re-request creates another conversation. |
| Conversation — Message | Conversation `0..N` messages; each Message `1` conversation | Text messages only. After connection end, existing messages remain readable but not writable. |
| Platform Account — Message | Account `0..N` messages sent; each Message `1` sender | Sender must be one of the two conversation participants. |
| Administrator Account — Import Batch | Administrator `0..N` batches; each batch `1` administrator | Only administrators initiate/review imports. |
| Import Batch — Import Row Result | Batch `0..N` row results; each result `1` batch | One result per source row; failed rows must include a clear reason. |

---

## 4. Key participation and integrity constraints

1. Candidate primary identifiers must be stable and must not rely solely on names.
2. `season_number` is unique where populated; `(season_id, episode_number)` is unique.
3. `(episode_id, shark_id)`, `(historical_startup_id, historical_person_id)` and `(offer_id, shark_id)` uniquely identify their association rows.
4. A `PITCH` references exactly one Episode and one Historical Startup. An `OFFER` references exactly one Pitch.
5. Each `DEAL_OUTCOME` references one Offer, and there is at most one current recorded outcome per Offer in core scope.
6. Each Platform Startup Listing has one primary owner. The owner must hold Founder role. A listing's owner/identity is not derived from a historical Founder/Presenter record.
7. The `founder_account_id` recorded on a Connection Request must equal the primary owner of the referenced listing.
8. At most one `Pending` or `Accepted` request may exist for a given investor–founder pair, irrespective of the target listing. A new request is allowed after the earlier request becomes `Declined`, `Withdrawn` or `Ended`.
9. When a listing is logically deleted, it must be excluded from public discovery. Pending requests targeting it become `Withdrawn` with reason `listing deleted`; accepted connections become `Ended` with the same reason. Existing messages remain read-only for participants.
10. For a deleted listing, retained request/conversation/message history must not depend on a physically existing public listing row. A soft-delete/status approach is preferred in the logical model.
11. A connection can have a Conversation only after acceptance. Each accepted connection has its own Conversation. The sender of each Message must be one of the two participants.
12. Administrators cannot read private message contents. Public profiles must not expose account email or private contact details.
13. An import batch has one row result for every processed input row. Failed results must store a non-empty reason; invalid source rows are never inserted into historical data.
14. Derived quantities, such as season episode counts, displayed statistics and import success/failure totals, should be calculated from stored base records/row results unless a later performance decision justifies caching them.
15. Unknown/unavailable ask values, offer values, deal outcomes or post-show observations remain distinguishable from confirmed zeros or negative outcomes.

---

## 5. Conceptual design rationale

- **Associative entities:** Episode Shark Participation, Historical Startup Founder and Offer Shark Participation turn many-to-many relationships into explicit, identifiable associations and avoid comma-separated lists.
- **Separate historical and platform concepts:** Historical Startup, Historical Person and Historical Shark describe the show dataset. Platform Account, Founder Profile, Investor Profile and Platform Startup Listing describe application users and listings. A matching name is not sufficient to merge records.
- **One source of ownership:** each platform listing has one primary account owner in core scope; named co-founders are informational entries only.
- **Request lifecycle plus separate conversation:** the Connection Request holds the request/connection state; Conversation is created upon acceptance and retains its own history after the connection ends. Re-requesting creates a new conversation instead of reopening an old one.
- **Retained history:** listing deletion and connection ending are modeled with status/lifecycle changes, so related requests, messages and import evidence are not lost through cascading deletion.
- **Controlled sector values:** a Sector lookup promotes consistent filters and reduces spelling variants.
- **Optional entities separated:** post-show observations, bookmarks, preferences and structured source citations stay outside the core model until those extensions are approved.

---

## 6. Readiness for the ER model

Step 2 establishes the relationship/cardinality baseline for Step 3, the formal ER model and diagram. When drawing the ER model:

- Show all core entities and associative entities listed in Section 2.
- Show minimum/maximum cardinalities and optional participation.
- Annotate business rules that a basic ER notation cannot express, especially conditional uniqueness of active connections, role-dependent profile existence, request/listing ownership equality, and message permissions.
- Keep optional extensions visually distinct from the core ER model.
- Do not introduce physical SQL data types or create DDL in this step.

**Deliverable status:** relationship and attribute refinement completed as a conceptual-design proposal. The next planned step is the formal ER model and diagram; relational mapping follows after the ER model is reviewed.
