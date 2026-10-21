# Shark Tank India — Phase B, Step 5
## Use Cases and User Journeys

This document translates the finalized scope, roles, functional requirements, and non-functional requirements from Phase B Steps 1–4 into representative user journeys and use cases. It is an independent academic prototype for a college DBMS project, not an official Shark Tank India service.

## 1. Purpose and Scope

The use cases describe how visitors, viewers, founders, investors, and administrators interact with the system. They focus on core functionality. Richer charts/statistics and bookmarks/watchlists are prioritized optional extensions; online deployment, account deletion, formal identity/business verification, pitch linking, advanced chat, and other stretch features are not core requirements.

The requirements already settled in Steps 1–4 remain authoritative. This document does not define database tables, ER relationships, API routes, UI designs, or implementation code.

## 2. Actors

| Actor | Description | Main capabilities |
|---|---|---|
| Visitor / Viewer | An unauthenticated visitor or a signed-in account using the default Viewer role | Browse public historical information and public startup listings; search, filter, compare eligible startups, and view basic statistics |
| Founder | A signed-in user who selects the Founder role | Maintain their own founder profile and startup listing; respond to connection requests addressed to them; message investors through an accepted, active connection |
| Investor | A signed-in user who selects the Investor role; may also be a historical Shark | Maintain their own investor profile; discover public startups; send connection requests; withdraw pending requests; message through accepted, active connections |
| Administrator | A user whose Administrator access was granted by an existing administrator | Manage historical records, validated data imports, user accounts/roles, and administrative data; cannot read private message contents |
| System | The application enforcing rules and state changes | Validate input, enforce permissions, record request/connection transitions, and apply listing-deletion effects |

A single platform account may hold both Founder and Investor roles, with separate role-specific profiles. Historical Shark records are historical data, not platform roles. Registering as an investor does not grant permission to modify a historical Shark record.

## 3. Core Use Cases

### UC-01 — Browse historical information

- **Primary actor:** Visitor / Viewer
- **Goal:** Explore the selected historical seasons and their recorded information.
- **Preconditions:** Historical data is available; no sign-in is required for public records.
- **Main flow:**
  1. The actor opens the historical explorer.
  2. The system displays available seasons.
  3. The actor selects a season and then an episode, startup, historical Shark, pitch, offer, or recorded deal.
  4. The system displays available details and indicates unknown or unavailable values without presenting them as confirmed.
- **Alternative / exception:** If an attribute was not reliably sourced, the system displays it as unknown or unavailable. If no matching record exists, the system shows an empty result rather than inventing data.
- **Postcondition:** No data is changed.
- **Acceptance check:** A visitor can navigate from a season to an episode and a related pitch and view the recorded offers/deal outcome, including missing-data indicators.

### UC-02 — Search and filter information

- **Primary actor:** Visitor / Viewer
- **Goal:** Find historical records or public startup listings using supported criteria.
- **Preconditions:** Searchable data exists.
- **Main flow:**
  1. The actor enters a keyword or selects supported filters.
  2. The system validates the filter values and searches the selected data source.
  3. The system returns only matching records and allows the actor to open a result.
- **Alternative / exception:** Invalid filter values are rejected or reset with a clear explanation; no matches produce an empty state.
- **Postcondition:** No data is changed.
- **Acceptance check:** Results match the applied criteria and agree with the corresponding stored data.

### UC-03 — Compare startups

- **Primary actor:** Visitor / Viewer
- **Goal:** Compare startup attributes side by side.
- **Preconditions:** At least two eligible startup records are available.
- **Main flow:**
  1. The actor selects two or three startups from the same source type: historical startups or platform listings.
  2. The system checks the selection count and source type.
  3. The system displays comparable stored attributes side by side.
- **Alternative / exception:** One startup, more than three startups, or a mixed-source selection is rejected with a clear explanation. Pitches are not comparison subjects in core scope.
- **Postcondition:** No data is changed.
- **Acceptance check:** Two or three same-source startups can be compared; the system prevents a fourth selection and mixed-source comparison.

### UC-04 — Sign in and choose platform roles

- **Primary actor:** Visitor
- **Goal:** Sign in and access account features.
- **Preconditions:** The user has a Google account.
- **Main flow:**
  1. The visitor chooses Google Sign-In.
  2. The system completes the Google authentication flow and identifies the platform account.
  3. The account receives the default Viewer role.
  4. The user may choose Founder, Investor, or both, and completes each chosen role's profile.
  5. The system grants only the permissions associated with those roles.
- **Alternative / exception:** If authentication fails or is cancelled, protected account actions remain unavailable. Choosing Founder or Investor does not trigger formal identity or business verification.
- **Postcondition:** The user is signed in with the permitted roles and profile information.
- **Acceptance check:** A new account defaults to Viewer; Founder and/or Investor can be chosen; an ordinary user cannot grant themselves Administrator access. Google Sign-In is not treated as proof of business ownership or investor legitimacy.

### UC-05 — Create or update a startup listing

- **Primary actor:** Founder
- **Goal:** Publish or maintain a startup listing.
- **Preconditions:** The user is signed in and has the Founder role.
- **Main flow:**
  1. The founder creates a startup listing with the required fields.
  2. The system validates the submitted values and associates the listing with the founder's account as primary owner.
  3. The system publishes the listing's public fields immediately after successful creation.
  4. The primary owner may later update or delete the listing.
- **Alternative / exception:** Invalid input is rejected with a clear explanation. A founder attempting to edit another founder's listing is denied. Co-founders may be named but do not receive editing rights in core scope.
- **Postcondition:** The listing is created or updated; public fields are discoverable without sign-in and private account/contact details remain hidden.
- **Acceptance check:** The owner can create/edit their listing; another founder cannot edit it; a visitor can discover its public fields after creation.

### UC-06 — Discover a startup

- **Primary actor:** Investor
- **Goal:** Find a startup that may be relevant to the investor.
- **Preconditions:** The investor is signed in and has an Investor role.
- **Main flow:**
  1. The investor browses public startup listings.
  2. The investor searches or applies supported filters.
  3. The system displays matching public information.
  4. The investor opens a listing and decides whether to send a connection request.
- **Alternative / exception:** No matching records are found; the system indicates that no results match the criteria.
- **Postcondition:** No data changes unless the investor proceeds to UC-07.
- **Acceptance check:** An investor can discover public listings without gaining access to private email or contact details.

### UC-07 — Send a connection request

- **Primary actor:** Investor
- **Goal:** Request a connection with a founder regarding a specific platform startup listing.
- **Preconditions:** The investor is signed in; the target listing is public and active; the investor is not the primary owner of the listing.
- **Main flow:**
  1. The investor selects a listing and requests a connection with its founder.
  2. The system validates that no pending or accepted connection already exists between that investor and founder.
  3. The system records a Pending request tied to the specific listing and notifies/makes it visible to the founder.
- **Alternative / exception:** A request to the investor's own listing is rejected. A duplicate pending or accepted connection is rejected. A new request is permitted after a previous request was declined, withdrawn, or its connection ended. If the listing is deleted before response, a pending request is marked Withdrawn by the system with reason `listing deleted`.
- **Postcondition:** A valid request is recorded as Pending, or the attempted request is rejected without creating a duplicate.
- **Acceptance check:** A request identifies the listing and its founder; duplicate pending/accepted investor–founder connections and self-requests are rejected; a later request may be made after a prior request is no longer pending/accepted.

### UC-08 — Accept or decline a connection request

- **Primary actor:** Founder
- **Goal:** Decide whether to connect with an investor.
- **Preconditions:** The founder is the recipient of a Pending request and the listing remains active.
- **Main flow:**
  1. The founder views the pending request and the related public startup listing.
  2. The founder chooses Accept or Decline.
  3. The system records the decision and the associated state transition.
  4. If accepted, the connection becomes active and a new conversation is available.
- **Alternative / exception:** Users other than the recipient cannot accept or decline the request. A request for a deleted listing is no longer actionable.
- **Postcondition:** The request is Accepted or Declined. Messaging is available only for an accepted, active connection.
- **Acceptance check:** Only the addressed founder can accept/decline; an accepted request enables messaging between its two participants.

### UC-09 — Withdraw a pending request

- **Primary actor:** Investor
- **Goal:** Withdraw the investor's own request before the founder responds.
- **Preconditions:** The investor sent the request and its status is Pending.
- **Main flow:**
  1. The investor opens their pending request.
  2. The investor chooses Withdraw.
  3. The system changes the request status to Withdrawn.
- **Alternative / exception:** A different investor cannot withdraw the request. Accepted, declined, already withdrawn, or system-closed-by-listing-deletion requests cannot be withdrawn again.
- **Postcondition:** The request remains in history with Withdrawn status.
- **Acceptance check:** The sender can withdraw their own pending request; unauthorized or invalid withdrawal attempts are rejected.

### UC-10 — Exchange messages in an active connection

- **Primary actor:** Founder or Investor
- **Goal:** Communicate through persistent text messages.
- **Preconditions:** The user is one of the two parties to an accepted, active connection.
- **Main flow:**
  1. The participant opens the conversation associated with the active connection.
  2. The participant reads existing messages or sends a text message.
  3. The system verifies participation and active-connection status, stores the message and makes it available to the two participants.
- **Alternative / exception:** Messaging is denied for Pending, Declined, Withdrawn, or ended connections. Viewers and unrelated users cannot read the conversation. Administrators cannot read private message contents.
- **Postcondition:** A valid message is stored and readable by the two participants.
- **Acceptance check:** Only the connection's participants can read/send while active; attempts by non-participants or after connection end are denied for sending.

### UC-11 — End a connection and retain read-only history

- **Primary actor:** Founder or Investor who is a party to the active connection
- **Goal:** End further contact while retaining the conversation history.
- **Preconditions:** The connection is accepted and active.
- **Main flow:**
  1. Either participant chooses to end the connection.
  2. The system records that the connection has ended.
  3. The conversation becomes read-only for both participants: existing messages remain readable, but neither participant can send new messages.
- **Alternative / exception:** A non-participant cannot end the connection. If a new request is accepted later, it creates a new conversation; the previous conversation remains read-only.
- **Postcondition:** The connection is ended, prior messages are retained, and no new messages can be added to that conversation.
- **Acceptance check:** Both participants can read old messages but cannot send after ending; a later accepted request creates a separate conversation.

### UC-12 — Import and validate historical data

- **Primary actor:** Administrator
- **Goal:** Add historical records through validated manual entry or file import.
- **Preconditions:** The user has Administrator access and a supported input file or record is available.
- **Main flow:**
  1. The administrator selects a supported file or begins manual entry.
  2. The system validates structure, required values, allowed formats, references and applicable constraints before inserting each record.
  3. Valid rows are inserted; invalid rows are rejected.
  4. The system reports successful and failed rows, with a reason for each failed row.
- **Alternative / exception:** Malformed files are rejected with an explanation. Invalid rows are never inserted; the system does not silently treat an unverified deal as completed.
- **Postcondition:** Valid records are stored, failures are reported, and the historical dataset preserves referential and value integrity.
- **Acceptance check:** A mixed-validity file imports valid rows only and reports every rejected row with a reason; the administrator can identify import results.

### UC-13 — Manage historical records and platform administration

- **Primary actor:** Administrator
- **Goal:** Maintain historical data and administer user records and roles.
- **Preconditions:** The user has Administrator access.
- **Main flow:**
  1. The administrator opens a historical record or administrative user record.
  2. The administrator adds, corrects or removes an authorized historical record, or manages account roles as permitted.
  3. The system validates changes and records the result.
- **Alternative / exception:** Non-administrators cannot modify historical records or grant Administrator access. Even an administrator cannot view private message contents in core scope.
- **Postcondition:** Authorized updates are stored and invalid changes are rejected.
- **Acceptance check:** Historical record changes and administrator-role grants are restricted to administrators; message contents remain inaccessible to administrators.

### UC-14 — View basic statistics

- **Primary actor:** Visitor / Viewer
- **Goal:** Understand high-level summaries of the stored historical dataset.
- **Preconditions:** Enough relevant data exists to calculate the requested summary.
- **Main flow:**
  1. The actor opens the basic statistics area.
  2. The system calculates summaries from stored records.
  3. The system displays the result and avoids treating unknown/missing values as confirmed values.
- **Alternative / exception:** If the data is insufficient, the system indicates that a reliable statistic cannot be calculated.
- **Postcondition:** No data is changed.
- **Acceptance check:** Displayed figures match independently checked database queries for the selected dataset.

## 4. Optional Extension Use Cases

These are not core acceptance obligations and are attempted only if time permits.

| ID | Extension | Summary | Suggested priority |
|---|---|---|---|
| EXT-01 | Richer charts/statistics | Display trends and additional aggregate analysis from reliably stored data | Should |
| EXT-02 | Bookmarks/watchlists | A signed-in user saves and revisits startup listings | Should |
| EXT-03 | Link listing to historical pitch | An optional administrator-approved relationship between a platform listing and a historical pitch | Could |
| EXT-04 | Online deployment | Publish the completed local prototype online | Could |

Detailed post-show data enhancements, exportable reports, advanced bulk-import tooling, verification workflows, attachments, video calls, advanced real-time chat, and account deletion remain outside core scope or stretch goals as defined in Steps 1–3.

## 5. Representative User Journeys

### Journey A — Viewer researches a historical startup

1. A visitor opens the historical explorer without signing in.
2. They browse seasons and episodes.
3. They search/filter by a supported criterion such as sector, Shark or deal outcome.
4. They open a startup/pitch and inspect the available offer and outcome information.
5. If information is missing or unknown, it is identified as such rather than assumed.
6. They compare two or three historical startups if desired.

**Successful outcome:** The visitor can retrieve and compare sourced historical information without altering records or signing in.

### Journey B — Founder publishes a startup

1. A user signs in with Google and chooses the Founder role.
2. They complete their founder profile and create a startup listing.
3. The system validates the required fields and assigns the account as primary owner.
4. The listing's public fields become discoverable; private contact details remain hidden.
5. The founder can update their own listing, but another founder cannot edit it.

**Successful outcome:** A validated public listing exists with a clear owner and appropriate field visibility.

### Journey C — Investor connects and messages

1. An investor signs in and completes an Investor profile.
2. They discover a platform startup listing and send a request for that listing.
3. The system rejects duplicate pending/accepted investor–founder connections and self-requests.
4. The founder accepts or declines. If accepted, a new conversation becomes available.
5. The participants send and read text messages while the connection is active.
6. Either participant may end the connection. The old conversation remains readable in read-only mode.
7. If they connect again later, the new accepted request has a separate conversation.

**Successful outcome:** Connection status and messaging permissions follow the agreed lifecycle, and other users cannot read the conversation.

### Journey D — Administrator imports historical records

1. The administrator prepares a file or enters records manually.
2. The system validates row structure, required fields, allowed values and references.
3. Valid rows are inserted; invalid rows are rejected with reasons.
4. The administrator reviews the import report and corrects failures for a later import.
5. The imported records appear in the historical explorer without exposing private platform data.

**Successful outcome:** Historical records are loaded transparently while invalid records and broken references are prevented.

## 6. Cross-Use-Case Business Rules

1. Public historical information and public startup listing fields can be browsed without sign-in. Creation or modification of protected data, connection requests and messaging require authentication and server-side authorization.
2. A newly authenticated account defaults to Viewer. Users may choose Founder, Investor, or both. Only an existing administrator may grant Administrator access.
3. Google Sign-In authenticates control of a Google account; it does not verify business ownership or investor legitimacy.
4. Historical Shark records remain separate from platform investor profiles. Registering as an investor grants no permission to change historical records.
5. A startup listing has one primary account owner in core scope. Co-founders may be listed but cannot edit the listing.
6. Startup listings become public immediately after creation, but private account/contact fields are not public.
7. Connection requests identify a specific platform listing and its founder. A new request is blocked when a pending or accepted connection already exists for that investor–founder pair. Re-requests are allowed after the previous request is declined, withdrawn or ended.
8. The founder receiving a pending request may accept or decline it. The sending investor may withdraw it while pending. Either party may end an accepted connection.
9. Messages are available only to the two participants. While active, they can read and send. After the connection ends, prior messages remain readable in read-only mode and cannot receive new messages. Administrators cannot read message contents.
10. Deleting a platform startup listing removes it from public discovery, marks its pending requests Withdrawn with reason `listing deleted` and system attribution, ends active connections, and preserves prior messages as read-only history. Existing messages are not deleted as a side effect.
11. Historical startup comparison and platform-listing comparison are separate. Core comparison accepts two or three records from the same source type, not pitches or mixed-source selections.
12. Historical data can be incomplete. Unknown deal outcomes and unavailable post-show information must remain unknown/unavailable, not be silently inferred.
13. CSV/file imports use validation. Valid rows may be inserted; invalid rows are rejected with an explanation and never inserted.

## 7. Traceability to Earlier Steps

| Use case / group | Relevant actors | Step 1 objective / scope | Acceptance evidence |
|---|---|---|---|
| UC-01 to UC-02: historical browsing and search | Visitor, Viewer | O1 Structure historical data; O2 Search/filter/retrieve; historical explorer and search scope | Demonstrate navigation and query results against stored records |
| UC-03: startup comparison | Visitor, Viewer | O3 Support comparison; startup comparison scope | Two or three same-source startups compare; fourth/mixed-source selection is rejected |
| UC-04: authentication and roles | Visitor, Founder, Investor, Administrator | O4 Profiles/discovery; O6 Consistency/reliable access; account and role scope | Default Viewer, role selection, protected admin assignment |
| UC-05 to UC-06: listing and discovery | Founder, Investor, Visitor | O4 Profiles/discovery; founder startup management and investor discovery scope | Owner can manage own listing; public fields are discoverable; private fields remain hidden |
| UC-07 to UC-11: connection and messaging | Investor, Founder | O4 Profiles/discovery; connection-request and messaging rules | Test request state transitions, duplicate prevention, active messaging and read-only history |
| UC-12 to UC-13: import and administration | Administrator | O1 Structure historical data; O6 Data integrity; data-entry/import and administration scope | Mixed-validity import report and role-protected historical changes |
| UC-14: basic statistics | Visitor, Viewer | O5 Summaries/statistics; basic statistics scope | Displayed values match verified database queries |
| EXT-01 to EXT-04 | Relevant signed-in users or visitors | Step 1 prioritized optional extensions and stretch goals | Test only if the extension is implemented; not a core completion gate |

## 8. Out of Scope

The following are not core use cases: account deletion; formal identity or business verification; direct messaging before connection acceptance; attachments; video calls; advanced real-time chat; administrator access to private message contents; co-founder shared editing; mixed-source startup comparison; pitch comparison; linking platform listings to historical pitches (optional extension only, with administrator approval); detailed post-show performance tracking; exportable reports; advanced bulk-import tooling; and online deployment. Prioritized extensions such as richer charts/statistics and bookmarks/watchlists may be attempted only after core scope is working.

## 9. Completion Check for This Step

This use-case deliverable is ready to guide later architecture and design when:

- Core roles and permissions agree with Steps 1–3.
- Each core use case has actors, preconditions, a normal flow, relevant alternatives, a postcondition and an observable acceptance check.
- Connection requests, deletion effects, re-requests and conversation history use consistent lifecycle rules.
- Optional extensions are clearly separated from core scope.
- Traceability points to the actual Step 1 objectives and scope without changing previously approved decisions.
