# Shark Tank India DBMS — Phase C, Step 5
## Normalization, Design Rationale and Logical Model Validation

**Purpose:** review the proposed relations from Phase C Step 4 for normalization, data anomalies, functional dependencies and conformity with the approved requirements. This document is the Phase C logical-design review; physical SQL implementation is deferred to Phase D.

---

## 1. Normalization target

The core design aims to satisfy **Third Normal Form (3NF)** for the stored relations, assuming the candidate keys and functional dependencies in this document hold. Association relations with composite keys are designed so their non-key attributes depend on the full key. The project will not denormalize aggregate statistics or duplicate parent facts merely for convenience.

If implementation testing later demonstrates a material performance need, any denormalization must be explicit, justified, and accompanied by a reliable consistency strategy. It is not assumed in this conceptual/logical phase.

## 2. First Normal Form (1NF)

A relation is in 1NF when each field stores one atomic value for the selected domain and each row has a key.

### Design choices supporting 1NF

- One Episode Shark Participation row stores one episode/Shark association; an episode does not keep a comma-separated list of Sharks.
- One Historical Startup Founder row stores one startup/person association; a startup does not store several founders in a single delimited text field.
- One Offer Shark Participation row stores one offer/Shark association; joint offers do not store multiple Shark IDs in one attribute.
- Each Message row stores one message. Conversations do not keep a changing array of messages in one field.
- Each Import Row Result row records one input row's success or failure; a batch report does not store all row outcomes as one JSON/text blob in the relational model.
- A startup listing's additional named co-founders are separate Listing Co-founder Entry rows.
- If bookmarks are added, each user/bookmarked-record pair is one row in the appropriate bookmark relation.

### 1NF acceptance check

Inspect each relation and confirm that multi-valued facts have been decomposed into child/associative rows rather than comma-separated lists, embedded record collections or repeated numbered columns.

## 3. Second Normal Form (2NF)

2NF requires 1NF and that each non-key attribute depend on the *whole* candidate key, not just part of a composite key.

The following core association relations use composite keys and therefore require special review:

| Relation | Composite key | Non-key attributes and dependency |
|---|---|---|
| `EPISODE_SHARK_PARTICIPATION` | `(episode_id, shark_id)` | `participation_note` describes that exact Shark's participation in that exact episode. |
| `HISTORICAL_STARTUP_FOUNDER` | `(historical_startup_id, historical_person_id)` | `sourced_role`, `display_order` describe that exact startup/person association. |
| `OFFER_SHARK_PARTICIPATION` | `(offer_id, shark_id)` | `participation_note` describes that Shark's role in that offer. |
| `ACCOUNT_ROLE` | `(account_id, role_code)` | `assigned_at`, `granted_by_account_id` describe assignment of that specific role to that account. |
| `IMPORT_ROW_RESULT` | `(import_batch_id, row_number)` | Result status, target identifier and error information depend on the specific row within the specific import batch. |
| `BOOKMARK_PLATFORM_LISTING` *(optional)* | `(account_id, listing_id)` | `created_at` describes the save of that listing by that user. |
| `BOOKMARK_HISTORICAL_STARTUP` *(optional)* | `(account_id, historical_startup_id)` | `created_at` describes the save of that historical startup by that user. |
| `INVESTOR_SECTOR_PREFERENCE` *(optional)* | `(account_id, sector_id)` | Any assignment-specific field describes that investor/sector pair. |

Do not store `shark_name` in `EPISODE_SHARK_PARTICIPATION`, `season_title` in `EPISODE`, `startup_name` in `PITCH`, or `investor_email` in `CONNECTION_REQUEST`. Those attributes depend on a referenced entity's key, not the entire child/association key.

## 4. Third Normal Form (3NF)

3NF requires 2NF and no non-key attribute to depend transitively on a candidate key through another non-key attribute.

### 4.1 Main functional dependencies

These are the proposed functional dependencies; they must be checked against the finalized keys during DDL preparation.

| Relation | Principal functional dependency | Design implication |
|---|---|---|
| `SEASON` | `season_id → season_number, display_title, start_year, end_year` | Season facts are stored once. `season_number` is an alternate unique key where present. |
| `EPISODE` | `episode_id → season_id, episode_number, episode_title, air_date` | Season title/year range is not copied into every Episode row. `(season_id, episode_number)` is an alternate key. |
| `HISTORICAL_SHARK` | `shark_id → display_name, biography` | Shark descriptions are not copied into episode or offer participation records. |
| `HISTORICAL_STARTUP` | `historical_startup_id → display_name, sector_id, description, location` | Sector text is not repeated as an uncontrolled label in every historical record. |
| `HISTORICAL_PERSON` | `historical_person_id → display_name, short_biography` | Person facts are separate from the associations that name the person as a founder/presenter. |
| `PITCH` | `pitch_id → episode_id, historical_startup_id, ask_amount, ask_equity_percent, pitch_summary` | Episode and historical startup facts are referenced, not copied into each pitch. |
| `OFFER` | `offer_id → pitch_id, offered_amount, offered_equity_percent, terms_summary, on_air_status` | Pitch details are not copied into each Offer row. |
| `DEAL_OUTCOME` | `deal_outcome_id → offer_id, outcome_status, outcome_date, outcome_notes`; unique `offer_id` identifies at most one current outcome | Offer details are not duplicated in the outcome relation. |
| `PLATFORM_ACCOUNT` | `account_id → google_subject, private_email, account_status, created_at, updated_at`; `google_subject → account_id` | Account identity/private data is stored once and not copied into profile, listing or message rows. |
| `ACCOUNT_ROLE` | `(account_id, role_code) → assigned_at, granted_by_account_id` | Assignment facts belong to the account/role pair. |
| `FOUNDER_PROFILE` | `account_id → public profile attributes` | Founder-specific public data is separate from account authentication data. |
| `INVESTOR_PROFILE` | `account_id → public profile attributes` | Investor-specific public data is separate from account authentication data. |
| `PLATFORM_STARTUP_LISTING` | `listing_id → owner_account_id, sector_id, listing_name, description, product_details, public_website, listing_status, timestamps` | Owner and sector facts are referenced; account email is not copied into a listing. |
| `LISTING_COFUNDER` | `cofounder_entry_id → listing_id, display_name, displayed_role, display_order` | Co-founder display data belongs to its entry. |
| `CONNECTION_REQUEST` | `request_id → investor_account_id, founder_account_id, listing_id, status, lifecycle timestamps, closure data` | Participant/profile details are referenced rather than copied into every request. |
| `CONVERSATION` | `conversation_id → request_id, created_at`; `request_id` is unique | One request identifies at most one conversation; each accepted re-request has its own conversation. |
| `MESSAGE` | `message_id → conversation_id, sender_account_id, message_body, sent_at` | A message row stores only message-specific facts and references the conversation/sender. |
| `IMPORT_BATCH` | `import_batch_id → administrator_account_id, source_file_name, entity_type, batch_status, timestamps` | Import metadata is stored once per batch. Counts are derived from row results. |
| `IMPORT_ROW_RESULT` | `(import_batch_id, row_number) → result_status, result_identifier, error_code, error_message` | Each row's result is stored once per batch/row. |
| `SECTOR` | `sector_id → sector_name`; `sector_name → sector_id` | Normalized sector names are maintained centrally. |

### 4.2 Why 3NF is appropriate

- If names, biographies, season data, account emails or sector labels were copied into child relations, updates would need to be repeated and could become inconsistent.
- Profile relations separate role-specific facts from Google authentication/account facts.
- Historical show records are separate from platform user/listing records, so a similar name does not create a transitive dependency or implied identity match.
- Deal Outcome is separate from Offer so the original televised offer is not confused with evidence of an eventual closure.
- Conversation is separate from Connection Request so a later accepted request can open a separate conversation while preserving an earlier read-only history.
- Import Row Result is separate from Import Batch so row-level outcomes and rejection reasons can be retained without repeating batch metadata in each result.
- Sector is a lookup so that changing a sector label is done once and filters use a consistent category.

## 5. Update, insertion and deletion anomaly review

| Potential anomaly | Risk if model is poorly designed | Protection in proposed model |
|---|---|---|
| Shark appears in several episodes | Changing a biography would require updating many episode rows. | Shark facts stored once in `HISTORICAL_SHARK`; appearances stored in `EPISODE_SHARK_PARTICIPATION`. |
| Startup has multiple historical founders | A delimited founder list becomes hard to query or validate. | `HISTORICAL_STARTUP_FOUNDER` stores one startup/person pair per row. |
| Offer has multiple Sharks | Repeated Shark columns or a comma-separated list. | `OFFER_SHARK_PARTICIPATION` stores one offer/Shark pair. |
| Unknown deal outcome | Null/zero/accepted-on-air incorrectly treated as closed. | Separate `DEAL_OUTCOME` with an explicit unknown/unavailable status and optional absence of a row. |
| One user holds two roles | Duplicated account credentials for Founder and Investor. | One `PLATFORM_ACCOUNT` with multiple `ACCOUNT_ROLE` rows and one profile per selected role. |
| Founder changes public profile | Profile copied across listings/messages becomes stale. | Profile facts are stored in profile relations; listing stores only listing-specific attributes and owner reference. |
| Connection ends | Deleting the connection could lose conversation/message history. | Retain request, conversation and messages; state transition controls read/write access. |
| Listing deleted | Cascading deletion would erase relationship history. | Soft-delete the listing, close associated requests/connections, retain messages. |
| Import results reopened | Only aggregate counts exist; row-level failures cannot be explained. | Store one `IMPORT_ROW_RESULT` per input row and derive counts. |
| Statistics cached incorrectly | Stored totals disagree with base records. | Compute aggregates from base relations in core scope. |

## 6. Derived information and intentional redundancy

The following values should be derived rather than stored as duplicate facts in the logical core model:

- Number of episodes per season.
- Number of pitches or offers per season/Shark/sector.
- Basic statistics and sector distributions.
- Import successful/rejected row counts, derived from `IMPORT_ROW_RESULT`.
- Message read-only state, derived from the associated connection's lifecycle state.
- Whether a listing is publicly discoverable, derived from listing status.

The requirement to show a Connection Request's investor, founder and target listing is not permission to copy names/emails into the request. Store identifiers and join to the relevant relations when viewing the request.

The rule that `CONNECTION_REQUEST(founder_account_id, listing_id)` must match the primary owner of the listing uses a composite foreign key/unique referenced key in the relational proposal. This is intentional to enforce a cross-column business invariant rather than duplicate unprotected display attributes.

## 7. Constraints that normalization does not replace

Normalization improves structure; it does not by itself enforce all business rules. Phase D must implement and test:

1. Foreign keys for all required relationships.
2. Unique episode number within each season.
3. Unique role assignment per account/role pair.
4. One Founder Profile and one Investor Profile per account, conditional on having the relevant role.
5. Listing owner must have Founder role.
6. Request's `founder_account_id` must equal the target listing's primary owner.
7. At most one Pending or Accepted connection per investor/founder pair at a time, while allowing later requests after Declined, Withdrawn or Ended.
8. Valid request state transitions and closure reason/actor rules.
9. One Conversation per accepted request; sender must be one of the two participants.
10. Messaging only while the connection is Accepted and active; after end, read-only access to existing messages remains for participants.
11. Soft deletion of listings and no cascade deletion of message history.
12. Valid import-row results; failed rows require a reason; invalid source rows are never inserted.
13. Numeric domains and sensible bounds for amounts and percentages, while allowing unknown values.
14. Role- and ownership-aware access controls at the backend, including private email and message-content restrictions.

A check constraint or foreign key may be insufficient for a cross-row or state-transition invariant. Phase D should document whether that rule is implemented via a unique/generated key, transaction, trigger or server-side logic and provide tests. Do not assume a rule is enforced merely because it appears in this document.

## 8. Logical-design review checklist

- [ ] Every relation has a candidate primary key.
- [ ] Non-key attributes depend on the key, the whole key and nothing but the key (3NF review).
- [ ] Many-to-many relationships are represented by associative relations.
- [ ] Repeated and derived facts are not stored as uncontrolled duplicates.
- [ ] Domain values permit unknown/unavailable information when source data is missing.
- [ ] Public and private account fields are separated.
- [ ] Historical records and platform records remain distinct.
- [ ] Connection, conversation and message retention rules are preserved.
- [ ] Import results are auditable at the row level.
- [ ] All business rules that require special MySQL/application enforcement are listed for Phase D.

**Deliverable status:** normalization and logical-design review complete as a proposal. No SQL DDL, indexes, seeds or application code are produced here.
