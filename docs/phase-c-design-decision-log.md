# Shark Tank India DBMS — Phase C
## Conceptual and Logical Design Decision Log

This log consolidates the major design choices made across Phase C Steps 1–5. It is a supporting document for the conceptual ER model and logical relational mapping. It does not replace the step documents, and it does not authorize physical implementation by itself.

## 1. Core concepts kept separate

| Concepts | Decision | Reason |
|---|---|---|
| Historical Shark vs platform Investor | Separate entities. | A show appearance is historical data; platform registration gives no permission over the historical record. |
| Historical Startup vs Platform Startup Listing | Separate entities and identifiers. | A similar name is not proof that two records represent the same object. Linking is an optional extension requiring administrator approval. |
| Historical Founder/Presenter vs registered Founder | Separate concepts. | Mention in a televised pitch does not imply the person has registered or owns a platform listing. |
| Connection Request vs Conversation | Separate relations. | Requests have a lifecycle; accepted requests create conversations; later accepted requests create new conversations. |
| Offer vs Deal Outcome | Separate relations. | An offer on air does not prove that a deal later closed. |
| Account vs role-specific profile | Separate account identity from Founder/Investor profile data. | One account can hold both roles while keeping authentication details separate from public profile fields. |

## 2. Normalization-driven refinements

- Added `SECTOR` as a controlled lookup so historical startups and platform listings use consistent sector categories.
- Used associative relations for episode/Shark participation, startup/founder relationships, and offer/Shark participation.
- Used `ACCOUNT_ROLE` for role assignments rather than repeating role columns on the account.
- Used one `LISTING_COFUNDER` row per named co-founder; entries confer no editing rights.
- Used `IMPORT_ROW_RESULT` to retain a row-by-row import report. Counts are derived from row results.
- Keep computed statistics, per-season counts and message writeability as derived values rather than duplicated facts.

## 3. Lifecycle and retention choices

- A Connection Request targets a specific public platform listing and its primary owner/founder.
- At most one Pending or Accepted connection can exist between the same investor/founder pair at a time, regardless of which listing is targeted.
- A new request is allowed after Declined, Withdrawn or Ended. If accepted, it creates a new conversation.
- A connection can be ended by either participant. Existing messages remain readable by both participants in read-only mode after ending; neither can send new messages. Administrators cannot read private message contents.
- Listing deletion is logical/soft deletion to preserve history. The listing leaves public discovery; pending requests targeting it become Withdrawn with reason `listing deleted` and actor `system`; accepted connections become Ended with the same reason; existing messages are retained read-only.
- Account deletion is outside core scope.

## 4. Core vs optional relations

**Core:** Season, Episode, Historical Shark, Episode Shark Participation, Sector, Historical Startup, Historical Person, Historical Startup Founder, Pitch, Offer, Offer Shark Participation, Deal Outcome, Platform Account, Account Role, Founder Profile, Investor Profile, Platform Startup Listing, Listing Co-founder, Connection Request, Conversation, Message, Import Batch, Import Row Result.

**Optional extensions only:** Post-show Observation, bookmarks for platform listings/historical startups, structured investor sector preferences, richer structured data-source/citation tracking. These do not become required core tables unless the team explicitly changes the approved scope.

## 5. Important enforcement items for Phase D

The logical model identifies the following constraints as needing concrete implementation choices and tests:

1. At most one Pending/Accepted connection for an investor/founder pair while permitting later requests after a terminal state.
2. Listing-owner and request-founder match through the target listing's owner.
3. Role-dependent profile existence and role authorization.
4. Message sender must be a participant in the conversation.
5. A message may be created only while its connection is accepted and active, while retained messages remain readable after end.
6. Listing deletion cascades into lifecycle changes, not physical deletion of conversations/messages.
7. Partial import results must correspond to actual successful insertions and rejected source rows.
8. Deal outcome status and numeric constraints must preserve unknown/unavailable data accurately.

Do not assume a business rule is enforced only because it appears in a design document. Phase D must name the enforcement method (constraint, unique key, transaction, trigger or server-side authorization) and provide tests.

## 6. Phase C completion checklist

- [ ] Entity inventory reviewed.
- [ ] Attribute and relationship/cardinality refinement reviewed.
- [ ] ER diagram and conceptual constraints reviewed.
- [ ] Relational mapping and all PK/FK/AKs reviewed.
- [ ] 1NF/2NF/3NF rationale and anomaly analysis reviewed.
- [ ] Optional extension entities clearly separated from the core model.
- [ ] Any remaining open decisions recorded before Phase D begins.

**Boundary:** Phase C is design only. MySQL DDL, indexes, insertion/deletion scripts, physical optimizations and implementation/testing of constraints belong to Phase D.
