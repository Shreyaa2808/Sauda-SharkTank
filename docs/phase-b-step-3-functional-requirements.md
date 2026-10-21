# Shark Tank India — Phase B, Step 3
## Functional Requirements

*Shark Tank India is an independent academic prototype developed for a college DBMS project; it is not an official Shark Tank India service. This document builds on Phase B Step 1 (scope) and Step 2 (roles and permissions), preserves their finalized decisions, and introduces no new features.*

---

## 1. Conventions

- **Actors:** Visitor (unauthenticated viewer), Viewer, Founder, Investor, Administrator, System (back end). Roles are as defined in Step 2.
- **Priority:** Step 1 defines core scope (essential), prioritised optional extensions, and stretch goals. Every requirement below belongs to Step 1 core scope and is therefore **Must**. Prioritised extensions (**Should**) and stretch goals (**Could**) are listed in Section 7 and are not requirements of this step.
- **Traceability:** each requirement is mapped to a Step 1 core-scope item and objective by its **exact feature name** (not by number) in Section 6.
- **Acceptance condition:** each requirement states an observable result that can be tested.
- **Connection states:** Pending, Accepted, Declined, Withdrawn and Ended. Each request identifies the specific platform startup listing and its primary founder. At most one Pending or Accepted connection may exist between the same investor and founder. If the target listing is deleted, a Pending request is set to Withdrawn by the system with reason "listing deleted"; an Accepted connection is set to Ended with the same reason. Existing messages remain readable by both participants in read-only mode.

---

## 2. Functional Requirements

### 2.1 Accounts, roles and profiles

| ID | Requirement | Actor | Priority | Acceptance condition |
|----|-------------|-------|----------|----------------------|
| FR-01 | The system shall allow sign-in with Google Sign-In and create a basic account on first sign-in. | Visitor | Must | A test Google account can sign in; an account record exists afterwards; no other login method is offered. |
| FR-02 | A newly signed-in user shall hold the Viewer role by default. Any visitor may use public information without signing in. | System | Must | A new account shows Viewer only; an unauthenticated visitor can open public pages but cannot reach create/modify, connection or message actions. |
| FR-03 | A signed-in user shall be able to choose the Founder role, the Investor role, or both, each with its own role-specific profile. | Viewer | Must | After selecting each role, a separate profile exists per role; permissions of each role apply only to actions performed in that role. |
| FR-04 | Administrator access shall be grantable only by an existing administrator and never through registration or role selection. | Administrator | Must | A non-administrator cannot obtain or grant Administrator access (request rejected); an administrator can grant it. |
| FR-05 | Founders and Investors shall be able to create and edit their own role-specific profile with self-reported information; profiles shall be presented as self-reported and not verified. | Founder, Investor | Must | Edits to own profile persist; editing another user's profile is rejected; no verification status is shown or implied. |
| FR-06 | Public profile views shall show public fields only; email addresses and private contact details shall not be exposed to other users. | System | Must | Another user's profile response contains no email or private contact data. |
| FR-07 | Historical Shark records and platform investor accounts shall be stored and displayed as separate concepts; no permission shall derive from a Shark record. | System | Must | A Shark record can exist with and without a linked investor account; registering as an investor does not change or grant edit rights to a Shark record. |
| FR-08 | The back end shall check role and ownership on every request that reads or changes protected data. | System | Must | Calling protected endpoints directly with a wrong role or non-owner account returns an authorization failure regardless of UI state. |

### 2.2 Historical explorer, data entry and import

| ID | Requirement | Actor | Priority | Acceptance condition |
|----|-------------|-------|----------|----------------------|
| FR-09 | The system shall let all users browse seasons, episodes, historical Shark records, startups and pitches, with recorded offers and deal outcomes. | Visitor, all roles | Must | Navigation from a season to an episode, a pitch and its offers works without signing in. |
| FR-10 | Unknown or missing deal outcomes and optional data shall be displayed as unknown/not available and not as confirmed. | System | Must | A record with a missing outcome displays "unknown/not available" and no confirmed-deal indicator. |
| FR-11 | Administrators shall be able to create, edit and delete historical records manually. | Administrator | Must | Each action succeeds for an administrator and is rejected for Viewer, Founder and Investor. |
| FR-12 | Manually entered historical data shall be validated before insertion; invalid data shall be rejected with an explanation. | Administrator | Must | Submitting a record with an orphan reference or invalid value stores nothing and shows the reason. |
| FR-13 | Administrators shall be able to import historical data from CSV/file; validation shall run on every row before any insertion. | Administrator | Must | Uploading a file triggers row-by-row validation; only administrators can access the import function. |
| FR-14 | **Partial imports:** the import shall insert all valid rows and reject all invalid rows. An invalid row shall never be inserted. | Administrator, System | Must | Importing a file with N valid and M invalid rows results in exactly N new records; the M invalid rows are absent from the database. |
| FR-15 | **Import report:** after each import the system shall report which rows succeeded and which failed, and for each failed row give its row number and a clear explanation of the problem (for example missing required value, invalid format, unknown reference, duplicate). | Administrator, System | Must | The report lists succeeded and failed row numbers; every failed row has a non-empty human-readable reason; counts in the report equal the actual inserted and rejected totals. |
| FR-16 | Administrators shall be able to review import results and validation outcomes. | Administrator | Must | A completed import's report can be reopened by an administrator and is not visible to other roles. |

### 2.3 Search and filters

| ID | Requirement | Actor | Priority | Acceptance condition |
|----|-------------|-------|----------|----------------------|
| FR-17 | The system shall provide keyword search over startups and pitches. | All users | Must | Defined test keywords return the same results as direct database queries. |
| FR-18 | The system shall provide filters by season, sector, Shark and deal outcome over startups and pitches, usable with search. | All users | Must | Each filter and a combination return results matching direct database queries. |
| FR-19 | Platform startup listings that have been deleted shall not appear in search, filters, browsing or comparison. | System | Must | After deletion (FR-24) the listing is absent from every public list and search result and its public page is not available. |

### 2.4 Startup listings

| ID | Requirement | Actor | Priority | Acceptance condition |
|----|-------------|-------|----------|----------------------|
| FR-20 | A Founder shall be able to create a startup listing; the creator becomes its primary account owner. Other co-founders may be named as information only. | Founder | Must | Listing is created and owned by the creating account; co-founder names appear but grant no edit rights. |
| FR-21 | A listing shall be visible publicly (public fields only) immediately after creation, including to visitors who are not signed in. | System | Must | A signed-out visitor sees the new listing's public fields and no private contact data. |
| FR-22 | Only the owning Founder (and an Administrator for moderation or correction) shall be able to edit a listing. | Founder, Administrator | Must | Edit by the owner succeeds; edit by another Founder, an Investor or a Viewer is rejected. |
| FR-23 | Platform startup listings shall remain separate from historical pitches; the system shall not link them in core scope. If the optional linking extension is implemented later, the link shall require Administrator approval. | System | Must | No listing-to-pitch link exists in core scope; if the optional extension is later implemented, an unapproved link is rejected and an approved link is recorded. |
| FR-24 | **Listing deletion:** when a listing is deleted by its owner or removed by an Administrator, the system shall (a) remove it from public discovery; (b) set every Pending request targeting that listing to Withdrawn, with reason "listing deleted" and system as the actor; (c) set every Accepted connection associated with that listing to Ended, with reason "listing deleted"; and (d) retain existing messages for those connections, readable by both participants in read-only mode. Historical messages shall not be physically deleted as a side effect. | Founder, Administrator, System | Must | After deletion: the listing is not discoverable; no request targeting it remains Pending; no connection associated with it remains Accepted; the messages remain stored and can be read by the two participants, but neither can send new messages. |

### 2.5 Connection requests

| ID | Requirement | Actor | Priority | Acceptance condition |
|----|-------------|-------|----------|----------------------|
| FR-25 | An Investor shall be able to send a connection request to a specific public platform startup listing and its primary Founder. The request shall record the target listing and founder. | Investor | Must | A request records the selected listing and its primary founder, enters Pending state, and is visible to the sender, the recipient and the Administrator. |
| FR-26 | A founder shall not be able to initiate a request to an investor, and an account shall not be able to send a request to its own listing. Viewers and Administrators cannot send requests. | System | Must | Each attempt is rejected. |
| FR-27 | **No duplicate pending or accepted connection:** the system shall reject a new request while a Pending request or Accepted connection between the same Investor and Founder already exists, regardless of which of that founder’s listings is selected. Each request must still record its specific target listing. | System | Must | A second request while one is Pending is rejected with an explanation; only one Pending request exists for the investor-founder pair, and an accepted connection also prevents another request for that pair. |
| FR-28 | **Re-requesting:** an Investor shall be able to send a new request to a Founder after the previous request was Declined, Withdrawn or Ended, provided no Pending or Accepted connection exists between that pair. The new request identifies the specific target listing. | Investor | Must | After each of the Declined, Withdrawn and Ended outcomes a new Pending request to a listing owned by that Founder is accepted; while a request is Pending or a connection is Accepted, another request for the pair is rejected. |
| FR-29 | The receiving founder only shall be able to accept or decline a Pending request. | Founder | Must | Accept/decline succeeds for the recipient on a Pending request; it is rejected for the investor, other users and for non-Pending requests. |
| FR-30 | The sending investor shall be able to withdraw their own Pending request. | Investor | Must | Withdraw succeeds only for the sender on a Pending request and sets state to Withdrawn. |
| FR-31 | Investors shall be able to view the status of their own requests and founders the requests addressed to them; Administrators may view requests. | Investor, Founder, Administrator | Must | Each role sees only the permitted requests; other users cannot list or read them. |
| FR-32 | Either party shall be able to end an Accepted connection. | Founder, Investor | Must | End succeeds for either party on an Accepted connection, sets state to Ended, and is rejected for non-parties or non-Accepted connections. |
| FR-33 | A connection request or acceptance shall not expose either party's private contact information. | System | Must | Request and connection views contain no email or private contact data. |

### 2.6 Messaging

| ID | Requirement | Actor | Priority | Acceptance condition |
|----|-------------|-------|----------|----------------------|
| FR-34 | Either party shall be able to send persistent text messages only while the connection is Accepted and not Ended. | Founder, Investor | Must | Sending succeeds in Accepted state; messages persist after sign-out and sign-in. |
| FR-35 | Sending shall be rejected while a request is Pending and after it is Declined, Withdrawn or Ended (including closure by listing deletion). | System | Must | Each attempt is rejected and no message row is created. |
| FR-36 | **Read-only after end:** after a connection ends, both participants shall still be able to read existing messages in read-only mode; neither can send new messages. | Founder, Investor | Must | After ending, both parties can open the thread and see all earlier messages; the send action is rejected for both. |
| FR-37 | A message shall be readable only by the two parties to its connection. Other founders, investors and viewers shall not read, list or search it. | System | Must | A non-party account receives an authorization failure when requesting the thread. |
| FR-38 | Administrators shall not be able to read private message contents. | System | Must | No administrator screen or endpoint returns message text; an administrator request for a thread is rejected. |
| FR-39 | Messages shall be text only, and users shall not be able to edit or delete messages. Attachments, video calls and advanced real-time chat are not provided. | System | Must | No attachment, call or edit/delete function exists for messages. |
| FR-40 | A new request after a previous one ended (FR-28) that is later accepted shall start a new connection; messages of earlier connections remain read-only and are not reopened for sending. | System | Must | After re-request and acceptance, new messages belong to the new connection; the earlier thread remains read-only. |

### 2.7 Comparison, statistics and administration

| ID | Requirement | Actor | Priority | Acceptance condition |
|----|-------------|-------|----------|----------------------|
| FR-41 | **Startup comparison:** the system shall display two or three startups side by side using stored attributes. A comparison shall use either historical startup records only or platform startup listings only; mixed-source comparisons are not allowed. Core comparison is for startups, not pitches. | All users | Must | Selecting two or three historical startups, or two or three platform listings, shows a side-by-side view with values matching stored data; a mixed-source selection is rejected. |
| FR-42 | The system shall prevent selecting a fourth startup for comparison and reject comparisons that mix historical startup records with platform startup listings. | System | Must | A fourth selection is blocked server-side and in the interface with an explanatory message; a comparison request containing four or more startups or mixed source types is rejected. |
| FR-43 | The system shall display basic aggregate statistics (for example deals per season, sector distribution, activity per Shark) computed from the database. | All users | Must | Displayed figures equal independently computed query results. |
| FR-44 | Administrators shall be able to view and manage user accounts and roles, and remove inappropriate startup listings or profiles. Account deletion is not provided. | Administrator | Must | Actions succeed for an administrator and are rejected for others; no account-deletion function exists. |
| FR-45 | The system shall run as a local prototype that reads from and writes to MySQL, with changes persisting after a restart. | System | Must | A record added through the interface remains after the services are restarted. |

---

## 3. Business Rules

| ID | Rule | Related requirements |
|----|------|----------------------|
| BR-01 | Roles are Viewer, Founder, Investor and Administrator; Historical Sharks are data records, not a role. | FR-02, FR-03, FR-07 |
| BR-02 | Google Sign-In establishes control of a Google account only; no identity or business verification exists in core scope. | FR-01, FR-05 |
| BR-03 | A listing has one primary owner; only the owner or an Administrator may edit or delete it. | FR-20, FR-22, FR-24 |
| BR-04 | Connection requests flow from an Investor to a specific public platform startup listing and its primary Founder; every request records both the listing and the founder. | FR-25, FR-26 |
| BR-05 | At most one Pending or Accepted connection may exist between the same Investor and Founder at a time, regardless of which listing is targeted. Every request records its specific target listing. | FR-27, FR-28 |
| BR-06 | A new request is allowed after a previous request was Declined, Withdrawn or Ended, but not while one is Pending or an Accepted connection exists between the same Investor and Founder. A new request creates a separate conversation if accepted. | FR-28, FR-40 |
| BR-07 | Messages may be sent only while a connection is Accepted and not Ended. | FR-34, FR-35 |
| BR-08 | After a connection ends, both participants may read existing messages in read-only mode; neither may send. Messages are retained and never physically deleted as a side effect of ending a connection or deleting a listing. | FR-24, FR-36 |
| BR-09 | Administrators cannot read private message contents. | FR-38 |
| BR-10 | Deleting a listing removes it from discovery; Pending requests targeting it become Withdrawn by the system with reason "listing deleted"; Accepted connections associated with it become Ended with the same reason. Existing messages remain readable by both participants in read-only mode and are not physically deleted. | FR-19, FR-24 |
| BR-11 | Imports are partial: valid rows are inserted, invalid rows are never inserted, and every failed row is reported with a reason. | FR-14, FR-15 |
| BR-12 | A comparison contains two or three startups from the same source type only: historical startup records or platform startup listings. Pitches are not comparison subjects in core scope. | FR-41, FR-42 |
| BR-13 | Platform listings are separate from historical pitches in core scope. | FR-23 |
| BR-14 | Public views never expose email addresses or private contact details. | FR-06, FR-33 |

---

## 4. Permission References

Permissions follow the Step 2 matrix and are unchanged. Key references:

| Requirement area | Step 2 permission-matrix row |
|------------------|------------------------------|
| FR-09, FR-11 | Historical records |
| FR-13, FR-14, FR-15, FR-16 | Imported data (staging and validation results) — Administrator only |
| FR-19–FR-24 | Startup listing (platform), public fields; Startup listing (platform), management |
| FR-05, FR-06 | Founder profile; Investor profile; Own account details |
| FR-04, FR-44 | Other users' account details and roles; Granting Administrator access |
| FR-25–FR-33 | Connection request: send / view / accept or decline / withdraw; Accepted connection: end |
| FR-34–FR-39 | Messages (parties only; read-only after the connection ends; Administrator has no access) |
| FR-17, FR-18, FR-41–FR-43 | Search, filter, comparison, statistics |

---

## 5. Connection Lifecycle Summary

| From state | Event | To state | Actor |
|------------|-------|----------|-------|
| (none, Declined, Withdrawn or Ended) | Send request, no Pending or Accepted request for the pair | Pending | Investor |
| Pending | Accept | Accepted | Founder |
| Pending | Decline | Declined | Founder |
| Pending | Withdraw | Withdrawn | Investor |
| Pending | Target listing deleted | Withdrawn (reason "listing deleted") | System |
| Accepted | End | Ended | Founder or Investor |
| Accepted | Associated listing deleted | Ended (reason "listing deleted") | System |

Messaging: send is allowed only while Accepted; both participants can read existing messages while Accepted and after Ended (read-only). Ending a connection does not reopen an earlier conversation. A later accepted re-request creates a separate connection and conversation.

---

## 6. Traceability to Step 1

Mappings use exact Step 1 names: core-scope features and objectives.

| Requirements | Step 1 core-scope feature | Step 1 objective |
|--------------|---------------------------|------------------|
| FR-09, FR-10 | Historical explorer | Structure the historical data |
| FR-11, FR-12, FR-13, FR-14, FR-15, FR-16 | Historical explorer; Administration | Structure the historical data; Maintain consistency and reliable access |
| FR-17, FR-18, FR-19 | Search and filters | Enable search, filtering and retrieval |
| FR-05, FR-06, FR-07 | Profiles | Support profiles and discovery |
| FR-01, FR-02, FR-03, FR-04, FR-08 | User accounts and roles | Maintain consistency and reliable access |
| FR-20, FR-21, FR-22, FR-23, FR-24 | Founder startup management | Support profiles and discovery |
| FR-25, FR-26, FR-27, FR-28, FR-29, FR-30, FR-31, FR-32, FR-33 | Investor discovery and interest | Support profiles and discovery |
| FR-34, FR-35, FR-36, FR-37, FR-38, FR-39, FR-40 | Investor discovery and interest; User accounts and roles | Support profiles and discovery; Maintain consistency and reliable access |
| FR-41, FR-42 | Startup comparison | Support comparison |
| FR-43 | Basic statistics | Provide summaries and statistics |
| FR-44 | Administration | Maintain consistency and reliable access |
| FR-45 | Local prototype | Deliver a working web interface |

Success-criteria cross-check (Step 1 names): "Validated data loading" is covered by FR-12 to FR-15; "Role permissions enforced" by FR-04, FR-08, FR-22, FR-29 and FR-38; "Messaging only after acceptance" by FR-34 to FR-36; "Compare at least two startups" by FR-41.

---

## 7. Out of Scope and Optional Extensions

**Excluded from core scope (not requirements):**
- **Linking platform startup listings to historical pitches.** Excluded from core scope. It may be added as an optional extension; if implemented, it requires administrator approval (Step 2, Finalized Decision on historical pitch linking). No requirement above depends on it.
- Attachments, video calls and advanced real-time chat.
- Administrator access to private message contents; abuse reporting and moderation access (optional future work).
- Account deletion.
- Identity or business verification of founders and investors.
- Payments, legal agreements, investment execution, investment advice and success prediction.
- Live synchronisation with the broadcast or external services.
- Shared editing of a listing by co-founders.
- Comparing more than three startups at once, comparing pitches, or mixing historical startup records with platform startup listings in a single comparison.

**Prioritised optional extensions (Should, if time permits):** richer statistics and charts; bookmarks and watch-lists; post-show performance data when reliable sources exist.

**Stretch goals (Could, not expected):** exportable reports; detailed post-show data enhancements; advanced bulk-import tooling; verification workflows; online deployment.

These extensions are not requirements of this step, and Step 4 is not started here.
