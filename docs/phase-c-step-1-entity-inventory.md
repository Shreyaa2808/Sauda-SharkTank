# Shark Tank India DBMS — Phase C, Step 1
## Entity Identification and Conceptual Data Inventory

**Status:** Draft conceptual inventory. This document identifies candidate entities and their purpose; it does not finalize the ER diagram, keys, cardinalities, relational schema, or SQL tables.

## 1. Purpose

Identify the main real-world objects and relationships the database may need to represent, using the approved requirements in Phase B. This inventory will be the starting point for refining entity attributes and relationships in the next conceptual-design step.

The project is an independent academic prototype, not an official Shark Tank India service. Initial historical coverage is limited to 1–2 reliably sourced seasons, expandable if time permits. Historical data may be entered manually or loaded from files, with validation before accepted records are stored.

## 2. Conceptual rules carried forward

- Historical Sharks who appeared on the show are historical data records, not a platform role.
- A person who is a historical Shark may separately register as a platform investor; the historical record and platform account must remain distinct.
- A platform account may hold both Founder and Investor roles, with separate role-specific profiles. Viewer is the default role; only an existing administrator can grant Administrator access.
- A platform startup listing is distinct from a historical startup/pitch record. Linking them is an optional extension and requires administrator approval if implemented.
- Each platform startup listing has one primary account owner. Other co-founders may be listed but do not have editing rights in core scope.
- Public listings and public profile fields are distinct from private account data, email addresses, and private contact information.
- Investors send connection requests to founders for a specific platform startup listing. Founders accept or decline; investors may withdraw pending requests. Either party may end an accepted connection.
- Each accepted connection has its own conversation. When a connection ends, prior messages remain readable by the two participants in read-only mode; neither can send more messages. Administrators cannot read private message contents.
- Historical deal outcomes and post-show data may be unknown or unavailable. The model must not assume every televised deal was completed.
- Richer charts/statistics and bookmarks/watchlists are prioritized extensions. Detailed post-show data and online deployment remain optional.

## 3. Candidate entity inventory

The entities below are candidates, not a final table list. Some could later become associative entities, subtypes, attributes, or be combined during ER modelling.

### A. Historical show data

| Candidate entity | Purpose | Candidate information (illustrative, not finalized) |
|---|---|---|
| **Season** | Represents a season of the programme. | Season identifier/number, title or year range where sourced |
| **Episode** | Represents an episode within a season. | Episode identifier/number, season reference, air date if reliably available |
| **Historical Shark** | Represents a person recorded as appearing as a Shark on the programme. | Shark identifier, name, short biography or professional description when sourced |
| **Episode Shark Participation** | Records which historical Sharks appeared in an episode, including possible seat/panel details if collected. | Episode reference, historical Shark reference, any sourced participation details |
| **Historical Startup** | Represents a startup/business presented in the historical show dataset. | Historical startup identifier, name, sector, short description, known location/product details |
| **Historical Founder/Presenter** | Represents a founder or presenter associated with a historical pitch. | Person identifier, name and sourced biographical details |
| **Historical Startup Founder** | Represents the association between a historical startup and one or more founders/presenters. | Startup reference, person reference, sourced role/ordering if needed |
| **Pitch** | Records a startup's pitch in a particular show episode. | Pitch identifier, episode reference, historical startup reference, ask amount/equity where sourced, summary |
| **Offer** | Records an offer made during a pitch. | Offer identifier, pitch reference, amount/equity/conditions if sourced, status or outcome as known |
| **Offer Shark Participation** | Records which Shark(s) participated in a particular offer, including joint offers. | Offer reference, historical Shark reference, role/participation details if sourced |
| **Deal Outcome / Closed Deal Record** | Represents the recorded outcome of an on-air offer/deal after the pitch, where evidence exists. | Related offer/pitch reference, outcome category, status date/source/notes where available |
| **Post-show Performance Observation** *(optional)* | Stores later performance information only when reliable information is available. | Historical startup reference, observation type/value, observation date, source and notes |

### B. Platform accounts and profiles

| Candidate entity | Purpose | Candidate information (illustrative, not finalized) |
|---|---|---|
| **Platform User / Account** | Represents a person authenticated to the platform. | Internal account identifier, Google identity subject, display name, email and account status; email/private fields are not public |
| **User Role Assignment** | Represents the role or roles held by an account. | Account reference, role, assignment date/assigning administrator when applicable |
| **Founder Profile** | Stores founder-specific public/profile information. | Account reference, public biography and relevant self-reported founder details |
| **Investor Profile** | Stores investor-specific public/profile information. | Account reference, investment interests, sectors or preferences and self-reported information |
| **Platform Startup Listing** | Represents a startup listing created and managed by a platform founder; separate from the historical startup record. | Listing identifier, name, description, sector, product details, public fields, primary owner, visibility/status and timestamps |
| **Listing Co-founder Entry** | Allows other co-founders to be named on a platform listing without granting them editing rights in core scope. | Listing reference, co-founder name and optional displayed role/details |
| **Investor Preference** *(candidate; may be attributes of Investor Profile)* | Represents criteria an investor uses to discover startups. | Investor reference, sectors/stages/geographies or other agreed criteria |
| **Bookmark / Watchlist Entry** *(extension)* | Records a user's saved platform startup listing or historical startup. | Account reference, saved record reference/type, creation date |

### C. Connections and messaging

| Candidate entity | Purpose | Candidate information (illustrative, not finalized) |
|---|---|---|
| **Connection Request** | Records an investor's request to connect with a founder about a specific platform startup listing. | Request identifier, investor account, founder account, target listing, status, created/updated dates, closure reason |
| **Accepted Connection** | Represents the active relationship created when a request is accepted. It may be a state/lifecycle of a request rather than a separate entity. | Request reference, participant accounts, accepted/ended timestamps, current status |
| **Conversation** | Provides a separate conversation for an accepted connection. A re-request accepted later starts a new conversation. | Conversation identifier, accepted connection reference, creation date, read-only/closed state derived or recorded from connection lifecycle |
| **Message** | Stores a text message in a conversation. | Message identifier, conversation reference, sender account, text body, sent timestamp |

### D. Administration and import support

| Candidate entity | Purpose | Candidate information (illustrative, not finalized) |
|---|---|---|
| **Import Batch / Import Run** *(supporting candidate)* | Tracks an administrator's CSV/file import and validation result. | Import identifier, file/source name, started/completed time, counts of accepted/rejected rows, status and administrator reference |
| **Import Row Error** *(supporting candidate)* | Records why an imported row was rejected. | Import reference, row number, error code/message and safe row identifier/details |
| **Data Source / Citation** *(candidate, if source tracking is included)* | Records provenance for historical facts or observations. | Source identifier, source name/reference/URL, access date and related record/fact |

## 4. Important distinctions to preserve

1. **Historical Startup vs Platform Startup Listing:** they represent different concepts and must not be merged just because their names match.
2. **Historical Shark vs Platform User/Investor:** a person can appear in both areas, but registering never grants permission to edit historical records. A direct identity match should not be assumed without an approved linking feature.
3. **Historical Founder/Presenter vs Registered Founder:** a person named in historical data is not automatically a registered account holder or the owner of a platform listing.
4. **Connection Request vs Conversation:** requests may be pending, accepted, declined, or withdrawn. An accepted request permits a conversation; after the connection ends, its conversation is read-only. A later accepted request creates a new conversation.
5. **Offer vs Deal Outcome:** an offer made on air is not evidence that a deal later closed. Store unknown or unavailable outcomes distinctly from confirmed outcomes.
6. **Public profile fields vs account/authentication details:** account email and private contact details are not public fields.

## 5. Initial relationship candidates

These are conceptual relationship hypotheses to validate in the ER modelling step; cardinalities and optionality are intentionally not finalized here.

- A Season contains Episodes; an Episode belongs to a Season.
- Historical Sharks participate in Episodes through Episode Shark Participation.
- A historical Startup may be associated with one or more Historical Founders/Presenters through Historical Startup Founder.
- A Pitch is presented in an Episode and concerns a Historical Startup.
- A Pitch may have zero or more Offers; each Offer belongs to a Pitch.
- An Offer may involve one or more Historical Sharks through Offer Shark Participation.
- An Offer/Pitch may have a Deal Outcome record when post-pitch evidence is available.
- A Historical Startup may have zero or more Post-show Performance Observations.
- A Platform User may hold one or both of the Founder and Investor roles; Administrator is assigned separately.
- A Founder account owns one or more Platform Startup Listings; each listing has one primary account owner in core scope.
- A Platform Startup Listing may name multiple co-founders through Listing Co-founder Entry, without granting them edit rights.
- An Investor account sends Connection Requests to Founders for specific Platform Startup Listings.
- A request may be accepted, declined or withdrawn; an accepted connection may later be ended by either participant.
- An accepted connection has one Conversation; each Conversation contains Messages sent by its two participants.
- An Account may have zero or more bookmarks/watchlist entries if that extension is implemented.
- An Administrator may initiate Import Batches, each of which can have validation errors recorded as Import Row Errors.
- Historical records and sourced observations may reference Data Source/Citation records if provenance tracking is included.

## 6. Candidate data constraints to carry into modelling

- Do not assume all candidate attributes are required or reliably available. Decide requiredness during attribute refinement.
- Amounts, equity percentages, dates and outcome fields need appropriate validation in later design, while preserving unknown/unreported values where information is absent.
- A connection request must identify the target platform listing and both relevant platform accounts.
- Duplicate pending requests between the same investor and founder must be prevented; an additional request is allowed after a previous one is declined, withdrawn or ended, subject to the finalized lifecycle rules.
- A user cannot send a connection request to their own listing when the account holds both Founder and Investor roles.
- After listing deletion, remove the listing from public discovery, mark pending requests withdrawn with reason `listing deleted`, end active connections, and retain existing messages as read-only history for the participants.
- Invalid CSV rows must not be inserted. Valid rows may be imported while rejected rows are reported with a reason.
- Administrators cannot read private message contents in core scope.
- The historical dataset begins with 1–2 reliably sourced seasons; model choices should not assume a fixed total dataset size.

## 7. Deferred decisions and exclusions

The following are not finalized by this inventory and must not be treated as implemented schema decisions:

- Final attributes, primary keys, alternate keys, foreign keys, uniqueness rules and nullability.
- Final cardinalities and participation constraints for each ER relationship.
- Whether Accepted Connection is represented as an independent entity or as a state of Connection Request.
- Whether Investor Preference is a separate entity or attributes of Investor Profile.
- Whether import tracking and Data Source/Citation are required in the core schema or kept minimal.
- The exact representation of deal outcome/status and historical offer conditions based on the available sources.
- The optional ability to link a platform startup listing to a historical startup/pitch (requires administrator approval if implemented).
- Detailed post-show performance, charts and watchlists remain optional extensions; account deletion, formal identity/business verification, advanced messaging, attachments, video calling and online deployment are outside core scope unless later explicitly approved.

## 8. Next step

Review this inventory against the Step 1 scope, Step 2 permission model and Step 3 functional requirements. In the next conceptual-design step, refine candidate entities and attributes, decide which candidates should be separate entities or attributes, and document keys and cardinalities before creating the formal ER diagram. No SQL schema or application code is produced by this document.
