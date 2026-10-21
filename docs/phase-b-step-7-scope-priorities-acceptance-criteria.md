# Shark Tank India — Phase B, Step 7
## Final Scope, Priorities and Acceptance Criteria

*This document consolidates the agreed scope and completion criteria for the independent academic Shark Tank India DBMS prototype. It does not replace the detailed requirements in Steps 1–6 and does not introduce new product features. This is not an official Shark Tank India service.*

---

## 1. Purpose and Relationship to Earlier Documents

Phase B has established the problem statement, user roles and permissions, functional requirements, non-functional requirements, use cases and high-level architecture. This final step provides one concise baseline for deciding what must be demonstrated, what may be added if time permits, and how completion will be evaluated.

Use this document together with:

- `phase-b-step-1-problem-statement.md` — problem, objectives and approved scope decisions.
- `phase-b-step-2-user-roles.md` — roles, permissions, ownership, privacy and connection rules.
- `phase-b-step-3-functional-requirements.md` — detailed functional requirements `FR-01` to `FR-45`, business rules and lifecycle rules.
- `phase-b-step-4-non-functional-requirements.md` — quality requirements and verification methods.
- `phase-b-step-5-use-cases-and-user-journeys.md` — end-to-end use cases and expected outcomes.
- `phase-b-step-6-system-architecture.md` — frontend, backend, database and data-flow boundaries.

This document is the project-level acceptance baseline. If an item below summarizes a requirement, the detailed rule and acceptance condition in the corresponding earlier document still apply.

## 2. Final Core Scope — Must Have

The core prototype is considered complete only when the following capabilities work together through the web interface and MySQL-backed backend.

| ID | Core capability | Final scope | Primary reference | High-level acceptance condition |
|---|---|---|---|---|
| CORE-01 | Authentication and platform roles | Google Sign-In; Viewer is the default role; a signed-in user may select Founder, Investor or both; only an existing administrator may grant Administrator access. Google Sign-In is not business or investor verification. | FR-01–FR-08; Step 2 Sections 1 and 4 | A new account receives the default role, role selection works, and an ordinary user cannot grant Administrator access or edit another user's private profile. |
| CORE-02 | Historical explorer | Browse the selected 1–2 reliably sourced seasons, episodes, historical Sharks, startups, pitches, recorded offers and known deal outcomes. Historical Shark records remain separate from platform investor accounts. | FR-07, FR-09–FR-10; Step 1 | A visitor can navigate from a season to episode and pitch records and see recorded offer/outcome information without signing in. |
| CORE-03 | Search and filtering | Search and filter stored startup and pitch data using the agreed criteria, including season, sector, Shark and deal outcome where relevant. | FR-17–FR-19 | Results match the applied criteria and correspond to stored data; deleted platform listings do not appear in discovery. |
| CORE-04 | Historical data management | Administrators can create, edit and delete historical records manually. Invalid data is rejected with an explanation. | FR-11–FR-12, FR-44 | Administrator actions succeed; equivalent attempts by other roles are rejected; invalid values or references are not inserted. |
| CORE-05 | Validated file import | Administrators can import supported CSV/file data. Valid rows are inserted; invalid rows are rejected; a report identifies successful and failed rows and provides a reason for each failure. | FR-13–FR-16; NFR-REL-03 | A mixed-validity test file yields the expected successful/failed counts, and no invalid row is inserted. |
| CORE-06 | Profiles and startup listings | Founders and investors maintain their own self-reported profiles. Founders can create and manage their own startup listings. Each listing has one primary account owner; named co-founders do not get editing rights. Listings are public immediately after creation, but private account/contact details are not public. | FR-05–FR-06, FR-20–FR-24 | Visitors can view public listing fields; owner edits succeed; non-owner edits fail; private email/contact details are absent from public responses. |
| CORE-07 | Investor discovery and requests | Investors can discover public platform listings and send a request targeting a specific listing and its primary founder. The founder can accept or decline. Investors can withdraw their own pending requests. | FR-25–FR-33 | Request permissions and status transitions work; unauthorized actions are rejected; request and connection views do not expose private contact details. |
| CORE-08 | Connection uniqueness and re-requesting | No duplicate Pending request or Accepted connection can exist for the same investor–founder pair, regardless of which listing is selected. A new request is allowed after a prior request is Declined, Withdrawn or Ended, if no Pending or Accepted connection remains. | FR-27–FR-28; BR-05–BR-06 | A duplicate is rejected; an eligible later request is accepted and, when accepted, begins a separate conversation. |
| CORE-09 | Messaging and connection lifecycle | Participants may send persistent text messages only while a connection is Accepted and active. After it ends, both participants can read existing messages in read-only mode; neither can send new messages. Administrators cannot read private message contents. Attachments, video calls and advanced real-time chat are excluded. | FR-34–FR-40; NFR-PRV-03–NFR-PRV-04 | Active participants can send/read; non-participants and administrators cannot read; after ending, participants can read history but new sends fail. Earlier conversations are never reopened for sending. |
| CORE-10 | Startup listing deletion effects | When an owner or administrator deletes a platform startup listing, it is removed from public discovery; Pending requests targeting it become Withdrawn with reason `listing deleted` and the system as actor; Accepted connections associated with it become Ended with reason `listing deleted`; messages are retained and remain read-only for the participants. | FR-19, FR-24; BR-10 | No deleted listing remains discoverable; no affected request remains Pending or connection remains Accepted; old messages remain stored and readable only by participants. |
| CORE-11 | Startup comparison | Compare two or three startups side by side. A comparison must contain only historical startup records or only platform startup listings. Pitches are not comparison subjects in core scope. Mixed-source comparisons and a fourth startup are rejected. | FR-41–FR-42; UC-03 | Two- and three-item same-source comparisons show stored values accurately; one item, a fourth item, or mixed sources are rejected according to the defined UI/API rules. |
| CORE-12 | Basic statistics | Display the agreed basic aggregate statistics computed from stored data, such as deals per season, sector distribution and activity per Shark, without treating unknown outcomes as confirmed. | FR-10, FR-43; NFR-PER-03 | Displayed figures agree with independently checked database query results for the selected dataset. |
| CORE-13 | Server-side access control and privacy | The backend enforces role, ownership, connection and visibility rules. Browser code never connects directly to MySQL. Public responses hide email/private contact data; administrators cannot read private message contents. | FR-08, FR-37–FR-38; NFR-SEC-01–NFR-SEC-06 | Direct unauthorized requests are rejected even if a frontend control is bypassed; protected data is not disclosed or changed. |
| CORE-14 | Data integrity and persistence | Data is validated, relational integrity is enforced by the eventual MySQL schema, missing historical facts remain unknown, and successful permitted changes persist after service restart. | NFR-REL-01–NFR-REL-06; FR-10, FR-45 | Integrity tests reject invalid references; unknown outcomes are not shown as confirmed; saved records remain after restart. |
| CORE-15 | Local working prototype and documentation | The frontend, backend and MySQL database work together locally. Setup and database recreation instructions, test evidence, the DBMS report and demonstration materials are prepared for the college project. | FR-45; Step 4 NFR-REL-06; Step 6 | A fresh local setup can follow the documented instructions; the main core journeys can be demonstrated against stored data. |

### Core implementation boundary

- Historical coverage begins with **1–2 seasons** for which the team can reliably source data. Coverage may expand only if time and data quality permit.
- Historical data is collected through a **mixed approach**: manual entry plus validated CSV/file imports when suitable files are available.
- Platform startup listings remain separate from historical pitches. Linking a listing to a historical pitch is not part of core scope.
- Account deletion, formal founder/investor identity verification, payments, legal agreements, investment execution and investment advice are not core features.
- The local prototype must be built and tested first. Online deployment is not a core acceptance condition.

## 3. Priority Baseline

The priority labels below preserve the decisions established in Steps 1 and 3.

| Priority | Meaning for this project | Included work | Effect on core completion |
|---|---|---|---|
| **Must** | Required for a coherent, demonstrable DBMS prototype. The detailed acceptance conditions must pass. | All capabilities in Section 2 and applicable Must functional/non-functional requirements. | Any failed Must acceptance condition means the core prototype is not yet complete. |
| **Should** | Prioritized optional work to attempt after the core scope works. | Richer statistics/charts; bookmarks and watchlists; limited post-show performance information when reliable sources and time permit. | May be deferred without failing the core-scope gate; report what was completed. |
| **Could** | Stretch goals, only after the Must scope and chosen Should items are stable. | Exportable reports; detailed post-show data enhancements; advanced bulk-import tooling; founder/investor verification workflow; online deployment. | Not required for acceptance of the local core prototype. |

The priority of a detailed requirement remains governed by Step 3 and Step 4. In particular, any **Must** non-functional requirement (such as access control, privacy, data integrity and persistence) remains part of the core completion gate. A performance target assigned **Should** is measured and reported, but is not silently reclassified as a Must requirement.

## 4. Explicit Exclusions and Limits

The following are excluded from the core prototype and must not be accidentally treated as guaranteed deliverables:

- Account deletion.
- Formal identity, business ownership or investor legitimacy verification. Google Sign-In only authenticates control of a Google account.
- Editing historical records by founders or investors.
- Linking platform startup listings to historical pitches. If later attempted as an optional extension, administrator approval is required.
- Shared editing of a listing by multiple co-founders.
- Connections or messaging initiated by viewers or administrators acting in those roles.
- Sending messages before a request is accepted, or after an accepted connection has ended.
- Reading private message contents by administrators or any non-participant.
- Attachments, video calls and advanced real-time chat.
- Comparing pitches, comparing more than three startups, or mixing historical startups with platform listings in the same comparison.
- Treating an on-air deal as confirmed closed when the closing status is unknown.
- Treating missing post-show information as a known value or claim.
- Payments, legal agreements, actual investment execution, investment advice or startup-success prediction.
- Live synchronization with a broadcast or external service.
- Online deployment as a guaranteed deliverable.

## 5. Consolidated Acceptance Checklist

Use this checklist for implementation testing and the final college demonstration. Evidence may include test results, screenshots, query outputs, import reports, and a demonstrated user journey. Mark an item complete only after testing it against the relevant detailed requirements.

| ID | Acceptance criterion | Verification evidence | Related requirements/use cases |
|---|---|---|---|
| AC-01 | Google Sign-In creates or identifies a platform account; new accounts default to Viewer; the account may choose Founder, Investor or both; only an existing administrator can grant Administrator access. | Authentication tests and role/permission test results. | FR-01–FR-05; UC-04 |
| AC-02 | Historical information for the selected season set can be browsed through seasons, episodes, Sharks, startups and pitches with recorded offers and outcomes. Missing outcomes are represented as unknown/not available. | Demonstration using sourced records, including at least one missing/unknown-value case if available in the test data. | FR-09–FR-10; UC-01 |
| AC-03 | Search and filters return the expected records and deleted platform listings are no longer discoverable. | Test queries compared with direct MySQL results; listing-deletion test. | FR-17–FR-19; UC-02 |
| AC-04 | Administrators can maintain historical records; other roles cannot write historical data. Invalid manual entries are rejected with an understandable reason. | Role-based create/update/delete tests and invalid-entry test. | FR-11–FR-12; UC-13 |
| AC-05 | A mixed-validity import inserts valid rows only, rejects invalid rows, and produces correct success/failure counts with row-level reasons. | CSV test file, database check and saved import report. | FR-13–FR-16; UC-12 |
| AC-06 | Public startup listings are visible without sign-in, but public views do not expose private email/contact data. Only the primary owner or an administrator can edit a listing. | Signed-out browse test, response inspection and owner/non-owner edit tests. | FR-06, FR-20–FR-24; UC-05–UC-06 |
| AC-07 | Connection requests target a specific listing and its founder; invalid/self requests and duplicate Pending/Accepted investor–founder connections are rejected. Legal status transitions and later re-requests work. | Request-state transition tests including Pending, Accepted, Declined, Withdrawn and Ended. | FR-25–FR-33; UC-07–UC-09 |
| AC-08 | Messaging is enabled only for active Accepted connections, is restricted to the two participants, persists across sign-out/sign-in, and is inaccessible to administrators. | Participant, non-participant and administrator tests while active. | FR-34–FR-39; UC-10 |
| AC-09 | After a connection ends, both participants can read prior messages in read-only mode, neither can send, and any later accepted request uses a new conversation. | End-connection and re-request scenario; attempt to send in the earlier conversation. | FR-36, FR-40; UC-11 |
| AC-10 | Listing deletion removes the listing from discovery; pending requests are marked Withdrawn with reason `listing deleted`; accepted connections end; message history is retained and read-only. | Listing deletion test inspecting discovery, request/connection states and retained messages. | FR-19, FR-24; UC-05, UC-07, UC-11 |
| AC-11 | Two or three same-source startups can be compared accurately; mixed-source comparisons and a fourth selection are rejected. | Historical-only and platform-only comparison tests plus rejection tests. | FR-41–FR-42; UC-03 |
| AC-12 | Basic statistics agree with independent SQL aggregation results. | Query outputs and corresponding displayed statistics. | FR-43; UC-14 |
| AC-13 | Backend authorization protects role- and ownership-restricted actions, and SQL access uses safe parameterization. Secrets are not committed. | Direct endpoint authorization tests, code review and Git/tracked-file scan. | FR-08; NFR-SEC-01–NFR-SEC-06 |
| AC-14 | Valid writes persist after service restart, and invalid relationships are rejected by the completed relational schema. | Persistence and database constraint test results. | FR-45; NFR-REL-01, NFR-REL-05–NFR-REL-06 |
| AC-15 | The key user journeys can be demonstrated using the local system, and supporting project documentation/test evidence is available. | Run-through of selected Step 5 journeys and review of the report/demo materials. | UC-01–UC-14; Step 4; Step 6 |
| AC-16 | Performance and usability targets assigned Should are measured and reported honestly, including the test environment and data size; unverified results are not claimed as passed. | Test notes for applicable Should NFRs, including NFR-PER-01 where measured. | Step 4 NFR-PER-01–NFR-PER-03 and usability requirements |

### Acceptance result

- **Core accepted:** all Must requirements relevant to the agreed scope pass, including access-control, privacy, data-integrity and persistence checks.
- **Core not yet accepted:** any Must criterion fails, or the team cannot demonstrate a required core journey with stored data.
- **Optional extensions:** record each as `Completed`, `Deferred` or `Not attempted`. Their absence does not invalidate a passing core prototype.
- **Evidence integrity:** only report a test as passing when it has actually been run and its result recorded. If a data source or feature cannot be demonstrated, state the limitation instead of implying success.

## 6. Traceability Summary

| Area | Step 1 objective/scope | Functional references | Non-functional references | Use-case references |
|---|---|---|---|---|
| Accounts, roles and profiles | Support profiles and discovery; user accounts and roles | FR-01–FR-08, FR-44 | NFR-SEC-01–NFR-SEC-06; NFR-PRV-01–NFR-PRV-02 | UC-04, UC-13 |
| Historical explorer and unknown data | Structure the historical data; historical explorer | FR-09–FR-12 | NFR-REL-01–NFR-REL-02 | UC-01, UC-13 |
| Import and validation | Structure the historical data; validated data loading; administration | FR-13–FR-16 | NFR-REL-03–NFR-REL-04 | UC-12–UC-13 |
| Search and filters | Enable search, filtering and retrieval | FR-17–FR-19 | NFR-PER-01–NFR-PER-02; applicable usability NFRs | UC-02 |
| Listings, ownership and discovery | Support profiles and discovery; founder startup management; investor discovery | FR-05–FR-06, FR-20–FR-33 | NFR-SEC-01–NFR-SEC-06; NFR-PRV-05 | UC-05–UC-09 |
| Connections and messaging | Support profiles and discovery; agreed connection/messaging rules | FR-25–FR-40 | NFR-PRV-03–NFR-PRV-04 | UC-07–UC-11 |
| Comparison and statistics | Support comparison; provide summaries and statistics | FR-41–FR-43 | NFR-PER-03 | UC-03, UC-14 |
| Local prototype, integrity and persistence | Deliver a working web interface; maintain consistency and reliable access | FR-45 | NFR-REL-01, NFR-REL-05–NFR-REL-06; maintainability and testability NFRs | All core journeys as applicable |

## 7. Final Scope Sign-Off

The project is ready to proceed from requirements and architecture into conceptual database design when the team agrees that:

- [ ] The core Must scope in Section 2 is the implementation baseline.
- [ ] The Should and Could features in Section 3 are optional and cannot displace unfinished Must work.
- [ ] The exclusions and limits in Section 4 are understood by the team.
- [ ] The acceptance criteria in Section 5 will be used to plan tests and the final demonstration.
- [ ] The existing role, ownership, privacy, connection and messaging rules from Steps 2–3 will be preserved during database design and implementation.
- [ ] Historical data will start with 1–2 reliably sourced seasons, and unavailable data will remain unknown rather than invented.

**Outcome of Phase B:** the project has a documented problem and scope, roles and permissions, functional and non-functional requirements, use cases, architecture, and a consolidated set of priorities and acceptance criteria. The next planned phase is Phase C — Conceptual ER Model and Logical Relational Design. Phase C is not started by this document.
