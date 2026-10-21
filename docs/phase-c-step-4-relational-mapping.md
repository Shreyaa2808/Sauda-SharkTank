# Shark Tank India DBMS — Phase C, Step 4
## Mapping the ER Model to the Relational Model

**Purpose:** convert the conceptual ER model from Phase C Step 3 into a logical relational design. This document defines relation names, candidate attributes, primary keys, foreign keys, alternate keys and important logical constraints. It does **not** contain executable SQL or physical MySQL choices; those belong to Phase D.

**Rules:** the Phase B requirements and Phase C Steps 1–3 are authoritative. This is a logical proposal to review, not a claim that tables already exist.

---

## 1. Mapping conventions

- `PK` = primary key; `FK` = foreign key; `AK` = alternate/unique key.
- `NULL allowed` means source information may legitimately be unavailable. This is not a substitute for validation of values that are required.
- Relations and attributes are expressed with logical names. Exact SQL data types, lengths, defaults and index syntax are deferred to Phase D.
- Core relations are listed first. Optional-extension relations are separated in Section 5.
- Stable internal identifiers are preferred over names as keys. A person's or startup's name is not assumed unique.
- `SECTOR` is a controlled lookup used by both historical startups and platform listings.

## 2. Historical show relations — Core

### 2.1 `SEASON`

`SEASON(season_id PK, season_number AK, display_title NULL, start_year NULL, end_year NULL)`

- `season_id` identifies a season.
- `season_number` is unique when populated and used as the programme's season number.
- Display/year details are populated only when supported by reliable sources.

### 2.2 `EPISODE`

`EPISODE(episode_id PK, season_id FK → SEASON.season_id, episode_number, episode_title NULL, air_date NULL)`

- AK: `(season_id, episode_number)`.
- Each episode references exactly one season.
- Episode number is interpreted within its season, not as a global episode number.

### 2.3 `HISTORICAL_SHARK`

`HISTORICAL_SHARK(shark_id PK, display_name, biography NULL)`

- Names need not be unique.
- This relation contains historical programme records only, not Google accounts or platform investor profiles.

### 2.4 `EPISODE_SHARK_PARTICIPATION`

`EPISODE_SHARK_PARTICIPATION(episode_id FK → EPISODE.episode_id, shark_id FK → HISTORICAL_SHARK.shark_id, participation_note NULL)`

- PK: `(episode_id, shark_id)`.
- The composite key prevents duplicate records of the same Shark's participation in one episode.

### 2.5 `SECTOR`

`SECTOR(sector_id PK, sector_name AK)`

- `sector_name` is a normalized category label and is unique after consistent case/space handling.
- Use one controlled value for search/filter consistency.

### 2.6 `HISTORICAL_STARTUP`

`HISTORICAL_STARTUP(historical_startup_id PK, display_name, sector_id FK → SECTOR.sector_id NULL, description NULL, location NULL)`

- Sector may be unknown and therefore absent.
- It does not contain a foreign key to a platform startup listing.

### 2.7 `HISTORICAL_PERSON`

`HISTORICAL_PERSON(historical_person_id PK, display_name, short_biography NULL)`

- Represents a historical founder or presenter mentioned in show data.
- It is not automatically associated with a platform account.

### 2.8 `HISTORICAL_STARTUP_FOUNDER`

`HISTORICAL_STARTUP_FOUNDER(historical_startup_id FK → HISTORICAL_STARTUP.historical_startup_id, historical_person_id FK → HISTORICAL_PERSON.historical_person_id, sourced_role NULL, display_order NULL)`

- PK: `(historical_startup_id, historical_person_id)`.
- `sourced_role` and display order are included only if the information is available and useful.

### 2.9 `PITCH`

`PITCH(pitch_id PK, episode_id FK → EPISODE.episode_id, historical_startup_id FK → HISTORICAL_STARTUP.historical_startup_id, ask_amount NULL, ask_equity_percent NULL, pitch_summary NULL)`

- Each pitch belongs to one episode and concerns one historical startup.
- A historical startup may be associated with more than one pitch if records support it.
- Unknown ask amounts/equity are left unknown rather than treated as zero.

### 2.10 `OFFER`

`OFFER(offer_id PK, pitch_id FK → PITCH.pitch_id, offered_amount NULL, offered_equity_percent NULL, terms_summary NULL, on_air_status NULL)`

- Each offer belongs to one pitch.
- `on_air_status` describes the recorded show event only; it does not claim that the deal later closed.

### 2.11 `OFFER_SHARK_PARTICIPATION`

`OFFER_SHARK_PARTICIPATION(offer_id FK → OFFER.offer_id, shark_id FK → HISTORICAL_SHARK.shark_id, participation_note NULL)`

- PK: `(offer_id, shark_id)`.
- Supports joint offers without storing a comma-separated Shark list.

### 2.12 `DEAL_OUTCOME`

`DEAL_OUTCOME(deal_outcome_id PK, offer_id FK → OFFER.offer_id AK, outcome_status, outcome_date NULL, outcome_notes NULL)`

- `offer_id` is unique in this relation, allowing at most one current recorded outcome per offer.
- `outcome_status` must distinguish `Closed`, `Not closed`, and `Unknown/Not available` or an equivalent approved controlled domain.
- An on-air accepted offer does not automatically create a `Closed` outcome.

---

## 3. Platform account and listing relations — Core

### 3.1 `PLATFORM_ACCOUNT`

`PLATFORM_ACCOUNT(account_id PK, google_subject AK, private_email NULL, account_status, created_at, updated_at)`

- `google_subject` is the stable provider identity key and is unique.
- `private_email` is not exposed in public queries. Do not use the email address as the only account identifier.
- Core account lifecycle does not include account deletion; account status can support administrative disabling if approved within the existing account-management scope.

### 3.2 `ACCOUNT_ROLE`

`ACCOUNT_ROLE(account_id FK → PLATFORM_ACCOUNT.account_id, role_code, assigned_at, granted_by_account_id FK → PLATFORM_ACCOUNT.account_id NULL)`

- PK: `(account_id, role_code)`.
- `role_code` is restricted to `VIEWER`, `FOUNDER`, `INVESTOR`, `ADMINISTRATOR`.
- New account receives Viewer by default; Founder and Investor may both be assigned.
- `granted_by_account_id` is populated for an Administrator grant and must identify an existing administrator. Exact enforcement is finalized in Phase D.

### 3.3 `FOUNDER_PROFILE`

`FOUNDER_PROFILE(account_id PK/FK → PLATFORM_ACCOUNT.account_id, public_display_name, public_bio NULL, public_region NULL, public_website NULL, created_at, updated_at)`

- One profile per account.
- A row requires Founder role.
- Only the owner's permitted public fields are shown to other users.

### 3.4 `INVESTOR_PROFILE`

`INVESTOR_PROFILE(account_id PK/FK → PLATFORM_ACCOUNT.account_id, public_display_name, public_bio NULL, investment_focus_description NULL, public_website NULL, created_at, updated_at)`

- One profile per account.
- A row requires Investor role.
- All details are self-reported. Google Sign-In does not verify investment legitimacy.

### 3.5 `PLATFORM_STARTUP_LISTING`

`PLATFORM_STARTUP_LISTING(listing_id PK, owner_account_id FK → PLATFORM_ACCOUNT.account_id, sector_id FK → SECTOR.sector_id NULL, listing_name, description, product_details NULL, public_website NULL, listing_status, created_at, updated_at, deleted_at NULL)`

- AK: `(listing_id, owner_account_id)` to support the composite reference from Connection Request.
- `owner_account_id` must hold Founder role.
- `listing_status` distinguishes at least `ACTIVE` and `DELETED`.
- Deletion is logical/soft deletion in the model: a deleted listing is not publicly discoverable, but request/conversation/message history is retained.
- Email and private contact data are not attributes of the public listing.

### 3.6 `LISTING_COFUNDER`

`LISTING_COFUNDER(cofounder_entry_id PK, listing_id FK → PLATFORM_STARTUP_LISTING.listing_id, display_name, displayed_role NULL, display_order NULL)`

- A co-founder entry is descriptive text, not a platform account or permission grant.
- Editing rights remain with the listing's primary owner and administrators for moderation/correction.

---

## 4. Connection, conversation and messaging relations — Core

### 4.1 `CONNECTION_REQUEST`

`CONNECTION_REQUEST(request_id PK, investor_account_id FK → PLATFORM_ACCOUNT.account_id, founder_account_id FK → PLATFORM_ACCOUNT.account_id, listing_id, status, created_at, updated_at, responded_at NULL, ended_at NULL, closure_reason NULL, closure_actor_type NULL, closure_actor_account_id FK → PLATFORM_ACCOUNT.account_id NULL)`

- FK: `(listing_id, founder_account_id)` references `PLATFORM_STARTUP_LISTING(listing_id, owner_account_id)`.
- `investor_account_id` must hold Investor role; `founder_account_id` must hold Founder role.
- Status domain: `Pending`, `Accepted`, `Declined`, `Withdrawn`, `Ended`.
- At most one `Pending` or `Accepted` request exists per investor–founder pair at a time, regardless of listing.
- A re-request is allowed after `Declined`, `Withdrawn` or `Ended`.
- `closure_reason` records `listing deleted` for system-driven status changes. If the actor is the system, `closure_actor_type` is `SYSTEM` and the account reference remains null.
- A user cannot request a connection to their own listing if the same account has Investor and Founder roles.

**Conditional uniqueness:** because the rule applies only while a request is Pending or Accepted, Phase D must choose a MySQL-compatible enforcement method, such as a generated nullable active-pair key or transactional/trigger logic, and test race conditions. A simple unique key over investor and founder alone is not sufficient because it would prevent valid later requests.

### 4.2 `CONVERSATION`

`CONVERSATION(conversation_id PK, request_id FK → CONNECTION_REQUEST.request_id AK, created_at)`

- `request_id` is unique, so each accepted request has at most one conversation.
- A conversation is created only when its request is accepted.
- A subsequent accepted request creates a separate conversation. Earlier conversations are never reopened.
- Read-only access after connection end is derived from the associated request status; do not duplicate the status in this relation unless a later justified design requires it.

### 4.3 `MESSAGE`

`MESSAGE(message_id PK, conversation_id FK → CONVERSATION.conversation_id, sender_account_id FK → PLATFORM_ACCOUNT.account_id, message_body, sent_at)`

- Messages are text-only in core scope.
- Messages are immutable in core scope; there is no edit/delete feature.
- `sender_account_id` must be one of the two participants in the request associated with the conversation.
- A message can be inserted only while the associated connection is Accepted and active.
- After the connection ends, both participants can read the existing conversation in read-only mode; sending is disabled.
- Administrators cannot read private message contents.

The sender-participant and active-connection rules cross table boundaries. They must be checked in server-side transactional logic and, where appropriate, reinforced by database constraints/triggers in Phase D.

---

## 5. Administrative import relations — Core

### 5.1 `IMPORT_BATCH`

`IMPORT_BATCH(import_batch_id PK, administrator_account_id FK → PLATFORM_ACCOUNT.account_id, source_file_name, entity_type, batch_status, started_at, completed_at NULL)`

- Each batch is initiated by one administrator and processes one entity type/template.
- Only administrators can start or reopen an import report.
- Aggregate counts should be calculated from row results rather than duplicated as independent editable facts.

### 5.2 `IMPORT_ROW_RESULT`

`IMPORT_ROW_RESULT(import_batch_id FK → IMPORT_BATCH.import_batch_id, row_number, result_status, result_identifier NULL, error_code NULL, error_message NULL)`

- PK: `(import_batch_id, row_number)`.
- `result_status` is `SUCCEEDED` or `FAILED`.
- Failed rows require a non-empty human-readable `error_message`; a successful row must not be treated as a rejected row.
- A batch retains one result per processed source row, so its report can be reopened.
- `result_identifier` is a report value identifying the created target record, not a polymorphic foreign key. The batch's entity type specifies its target relation.

---

## 6. Optional-extension relations

These relations are excluded from the core schema and should only be added if the relevant extension is approved and time permits.

### 6.1 `POST_SHOW_OBSERVATION`

`POST_SHOW_OBSERVATION(observation_id PK, historical_startup_id FK → HISTORICAL_STARTUP.historical_startup_id, observation_type, observation_value, observed_on NULL, source_reference NULL, notes NULL)`

Stores sourced performance observations over time. Do not treat missing observations as zero performance. `source_reference` must identify the source used by the team; a fully structured citation model remains a separate design decision.

### 6.2 `BOOKMARK_PLATFORM_LISTING`

`BOOKMARK_PLATFORM_LISTING(account_id FK → PLATFORM_ACCOUNT.account_id, listing_id FK → PLATFORM_STARTUP_LISTING.listing_id, created_at)`

- PK: `(account_id, listing_id)`.
- Prevents duplicate bookmarks of the same listing by an account.

### 6.3 `BOOKMARK_HISTORICAL_STARTUP`

`BOOKMARK_HISTORICAL_STARTUP(account_id FK → PLATFORM_ACCOUNT.account_id, historical_startup_id FK → HISTORICAL_STARTUP.historical_startup_id, created_at)`

- PK: `(account_id, historical_startup_id)`.
- Keeps historical and platform listing bookmarks distinct.

### 6.4 `INVESTOR_SECTOR_PREFERENCE`

`INVESTOR_SECTOR_PREFERENCE(account_id FK → PLATFORM_ACCOUNT.account_id, sector_id FK → SECTOR.sector_id)`

- PK: `(account_id, sector_id)`.
- Only needed if structured investor preference matching is approved. General text describing investment focus remains in Investor Profile for core scope.

### 6.5 Structured source citations

The core model does not include generic `record_type`/`record_id` citations because that pattern cannot be protected by a conventional foreign key to the referenced entity. If record-level provenance is required as a structured application feature, define valid target relationships explicitly in a future approved extension.

---

## 7. Mapping decisions and constraints

| Conceptual design issue | Relational mapping decision | Reason |
|---|---|---|
| One-to-many relationships | Place FK in the many-side relation | Standard mapping preserves each parent-child association. |
| Many-to-many relationships | Use dedicated associative relations | Avoids multi-valued/comma-separated attributes and supports relationship-specific attributes. |
| One-to-one optional profiles | Use account ID as both PK and FK | Prevents more than one Founder/Investor profile per account. |
| Historical vs platform startups | Use separate relations and identifiers | Equal or similar names do not establish identity, and no core link is permitted. |
| Multi-role accounts | Use `ACCOUNT_ROLE` with composite PK | Supports Founder + Investor on one account while preventing duplicate role assignments. |
| Conditional active request uniqueness | Enforce only for Pending/Accepted states in Phase D | Allows repeated terminal request history while prohibiting simultaneous active requests for one pair. |
| Conversation lifecycle | Unique FK from Conversation to Connection Request | Creates a separate conversation for each accepted request and preserves prior conversations. |
| Import report | Store one row result per source row | Makes partial success and rejection reasons reproducible. |
| Listing deletion | Logical deletion/status change | Removes a listing from discovery while retaining requests and message history. |
| Aggregates | Calculate statistics and import counts from base rows | Avoids inconsistent duplicate count values. |

## 8. Relationship and referential-integrity checklist

Before implementation, verify that:

- [ ] Every FK has a valid referenced key.
- [ ] Every many-to-many relationship uses an associative relation.
- [ ] All required parent references are non-null conceptually.
- [ ] Optional historical details can remain unknown without inventing values.
- [ ] The request's listing and founder references are consistent.
- [ ] Profile existence is consistent with role assignment.
- [ ] A Conversation belongs to one accepted request and a Message belongs to one Conversation.
- [ ] Only participants may access messages; only an active connection permits sending.
- [ ] Logical listing deletion does not cascade-delete historical conversation/message records.
- [ ] Optional features remain isolated from the core relations.

**Deliverable status:** proposed relational mapping. Phase D will translate this logical design into MySQL DDL, data types, concrete constraints, indexes and scripts. No SQL code is created here.
