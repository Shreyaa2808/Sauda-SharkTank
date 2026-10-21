# Shark Tank India — Phase B, Step 2
## User Roles, Responsibilities and Permissions

*Shark Tank India is an independent academic prototype developed for a college DBMS project; it is not an official Shark Tank India service. This document builds on the scope fixed in Phase B, Step 1 and introduces no new features.*

---

## 1. Role Definitions

The platform has four roles. Historical Sharks (people who appeared on the show) are **data records**, not a role. A person who is a historical Shark may additionally register as an investor, but the historical record and the platform account remain separate concepts.

### 1.1 Viewer

- **Purpose:** to explore the historical information and public startup information.
- **Responsibilities:** none beyond using the platform in accordance with its terms.
- **Capabilities:** browse seasons, episodes, historical Shark records, startups and pitches; search and filter; compare startups; view basic statistics.
- **Limitations:** cannot create or modify any data and cannot use connection requests or messaging.

Viewer is the default role. A viewer may be an unauthenticated visitor or a signed-in user who has not yet chosen the Founder or Investor role.

### 1.2 Founder

- **Purpose:** to present their own startup to investors and respond to investor interest.
- **Responsibilities:** keeping their founder profile and startup listing accurate; responding to connection requests; conducting messaging appropriately.
- **Capabilities:** everything a viewer can do; create and edit their own founder profile and startup listing(s); view connection requests addressed to them; accept or decline those requests; end an accepted connection; exchange messages with investors whose requests they have accepted.
- **Limitations:** cannot edit other founders' listings, cannot send connection requests in this role, and cannot modify historical records.

### 1.3 Investor

- **Purpose:** to discover startups and initiate contact with founders.
- **Responsibilities:** keeping their investor profile accurate; sending relevant connection requests; conducting messaging appropriately.
- **Capabilities:** everything a viewer can do; create and edit their own investor profile; send connection requests to founders; withdraw their own pending requests; view the status of their own requests; end an accepted connection; exchange messages with founders who have accepted their requests.
- **Limitations:** cannot accept or decline requests, cannot edit any startup listing, cannot modify historical records, and cannot message a founder before acceptance.

Both historical Sharks and other investors may hold this role. Holding the role gives no rights over the historical Shark record of the same person, which remains administrator-managed.

### 1.4 Administrator

- **Purpose:** to maintain the quality and integrity of the platform and its historical data.
- **Responsibilities:** entering, importing, validating and correcting historical records; managing user accounts and roles; handling data-quality problems.
- **Capabilities:** everything a viewer can do; create, edit and delete historical records (manually or via validated import); view and manage user accounts and roles for administrative purposes; grant Administrator access to other accounts; remove inappropriate startup listings or profiles.
- **Limitations:** cannot read the contents of private messages in the core scope. Administrators do not act as founders or investors through their administrator role.

### 1.5 Holding more than one role

A single account may hold both the Founder and Investor roles. Each role has its own role-specific profile, and the permissions of each role apply only to actions performed in that role. For example, an account holding both roles cannot send a connection request to its own startup listing. Administrator access is granted separately (Section 4).

---

## 2. Permission Matrix

**Key:** C = create, R = read/view, U = update/edit, D = delete. "—" = no access. "Own" = only records belonging to that user. "Parties" = only the two users in the connection.

| Information | Viewer | Founder | Investor | Administrator |
|-------------|--------|---------|----------|---------------|
| Historical records (seasons, episodes, historical Sharks, pitches, offers, deals) | R | R | R | C, R, U, D |
| Imported data (staging and validation results) | — | — | — | C, R, U, D |
| Startup listing (platform), public fields | R | R | R | R |
| Startup listing (platform), management | — | C, U, D — Own | — | U, D |
| Founder profile | R (public fields) | C, R, U — Own; R others (public fields) | R (public fields) | R, U, D |
| Investor profile | R (public fields) | R (public fields) | C, R, U — Own; R others (public fields) | R, U, D |
| Own account details (including email) | — | R, U — Own | R, U — Own | R, U — Own |
| Other users' account details and roles | — | — | — | R, U |
| Granting Administrator access | — | — | — | U |
| Connection request: send | — | — | C | — |
| Connection request: view | — | R — addressed to them | R — Own | R |
| Connection request: accept or decline | — | U — addressed to them | — | — |
| Connection request: withdraw (pending only) | — | — | U — Own | — |
| Accepted connection: end | — | U — Parties | U — Parties | — |
| Messages | — | C, R — Parties, while connection is active; R — Parties, read-only after it ends | C, R — Parties, while connection is active; R — Parties, read-only after it ends | — |
| Search, filter, comparison, statistics | R | R | R | R |
| Administrative data (users, roles, import logs) | — | — | — | C, R, U, D |

Notes:
- "Public fields" means basic self-reported profile and listing information. Email addresses and private contact details are not public fields.
- Account deletion is outside the core scope; the matrix therefore grants no account-deletion permission to any role.
- Messages are not editable or deletable by users in the core scope. After a connection is ended, existing messages are retained and remain readable by the two participants in read-only mode; neither participant can send new messages. See Finalized Decision 7.
- Administrators have no read access to message contents. Abuse reporting and moderation access are optional future work.

---

## 3. Ownership and Restrictions

### 3.1 Startup listings

A startup listing belongs to the primary account owner who created it. Only that account (and the administrator, for moderation or correction) may edit or delete it. Other co-founders may be named on the listing as information, but shared editing is deferred beyond the core scope. A founder cannot modify another founder's listing under any circumstance.

Startup listings become public immediately after creation and can be discovered by visitors without signing in. Only the public fields are visible; private account and contact information remains hidden.

### 3.2 Investor access to startup information and connection requests

- Investors may view startup listings and use search, filtering and comparison on the same basis as other visitors.
- An investor may send a connection request to a founder. A request is visible only to its sender, its recipient and the administrator.
- Only the receiving founder may accept or decline the request. An investor cannot accept, decline or otherwise alter the founder's decision. The sending investor may withdraw the request while it is pending.
- A connection request does not expose a founder's private contact information.

### 3.3 Private messages

- A message may be read only by the two parties to the connection.
- No other founder, investor or viewer may read, list or search another user's messages.
- Administrators cannot read private message contents in the core scope.

### 3.4 Historical records

Only administrators may create, edit or delete historical records, including data entered manually and data loaded through CSV/file imports. Founders and investors may view historical records but not change them. A person's registration as an investor does not grant any right to alter their own historical Shark record.

Platform startup listings are kept separate from historical pitches in the core scope. Linking a listing to a historical pitch is an optional extension; if implemented, it requires administrator approval.

### 3.5 Historical Shark vs. platform investor

A historical Shark record describes a person's appearance and activity on the show and is part of the historical data. A platform investor account represents a registered user and their investor profile. The two are separate, even where they refer to the same person. No platform permission is derived from the existence of a historical Shark record, and registering as an investor does not imply that the registered user is the historical Shark.

### 3.6 Contact information

Public profiles show basic self-reported information only. Email addresses and private contact details are not public. Accepted connections communicate through in-platform messaging; acceptance does not automatically expose either party's contact details.

---

## 4. Authentication and Accounts

- **Authentication:** users sign in with Google Sign-In. This establishes that the user controls a particular Google account.
- **No verification:** Google Sign-In does not verify that a founder owns or represents the startup they list, or that an investor is a legitimate investor. No identity or business verification is included in the core scope, and none is introduced here (verification workflows remain a stretch goal in Step 1).
- **Basic profile:** after signing in, a user maintains basic profiles. Profile content is self-reported and should be presented as such.
- **Default role and role selection:** a newly signed-in user is a Viewer. The user may then choose the Founder role, the Investor role, or both, each with its own role-specific profile. Choosing a role is a self-selection and carries no verification.
- **Administrator access:** it is not available through ordinary registration or role selection. Only an existing administrator can grant it.
- **Access without an account:** any visitor may act as a viewer without signing in, limited to public information.
- **Account lifecycle:** account deletion is outside the core scope.

---

## 5. Connection and Messaging Permissions

| Action | Who may perform it | Condition |
|--------|--------------------|-----------|
| Initiate a connection request | Investor | Directed to a founder |
| View a connection request | Sender, recipient, administrator | — |
| Accept a request | Receiving founder only | Request is pending |
| Decline a request | Receiving founder only | Request is pending |
| Withdraw a request | Sending investor only | Request is pending |
| End a connection | Either party | Request has been accepted |
| Send a message | Either party to the connection | Connection is accepted and not ended |
| Read messages | Either party to the connection | Connection is accepted; after it ends, existing messages remain readable in read-only mode |

Rules:
1. Viewers and administrators (acting through their administrator role) do not initiate connection requests.
2. A founder cannot initiate a request to an investor; the core flow is investor to founder.
3. Sending messages is unavailable while a request is pending, after it is declined or withdrawn, and after an accepted connection is ended. When a connection ends, both participants can still read existing messages in read-only mode; no new messages can be sent.
4. Messages are persistent text only. Attachments, video calls and advanced real-time chat are outside the core scope.

---

## 6. Access-Control Principles

- **Public versus authenticated information:** historical information, public startup listings, search, comparison and basic statistics are available to all visitors without signing in. Creating or changing data, connection requests and messages require a signed-in user. Administrative data requires the administrator role.
- **Least privilege:** each role receives only the permissions needed for its purpose. Founders and investors have no write access to historical records; viewers have no write access at all; administrators cannot read private messages.
- **Resource ownership:** a user may modify only the profiles and listings that they own. Connection requests and messages are accessible only to the parties involved.
- **Server-side authorization:** permission checks are performed by the back end for every request to read or change protected data, based on the signed-in user's role and ownership. Hiding an option in the user interface is not regarded as access control.
- **Separation of concepts:** permissions attach to platform accounts and roles, never to historical records.

---

## 7. Finalized Decisions

| # | Area | Decision |
|---|------|----------|
| 1 | Role assignment | Users choose Founder or Investor after Google Sign-In. Viewer is the default role. Only an existing administrator can grant Administrator access. |
| 2 | Multiple roles | One account may hold both Founder and Investor roles, with separate role-specific profiles. |
| 3 | Co-founders | One primary account owner can edit a startup listing in core scope. Other co-founders may be listed, but shared editing is deferred. |
| 4 | Listing visibility | Startup listings become public immediately after creation. Private account and contact information remains hidden. Visitors can discover public startups without signing in. |
| 5 | Historical pitch linking | Platform startup listings remain separate from historical pitches in core scope. Linking them is an optional extension and, if implemented, requires administrator approval. |
| 6 | Administrator access to messages | Administrators cannot read private message contents in core scope. Abuse-reporting and moderation access are optional future work. |
| 7 | Account and connection lifecycle | Account deletion is outside core scope. Investors may withdraw pending requests. Either party may end an accepted connection; no new messages can then be sent. Existing messages are retained and remain readable by both participants in read-only mode. |
| 8 | Contact information | Public profiles show basic self-reported information. Email addresses and private contact details are not public. Accepted connections use in-platform messaging without automatically exposing contact details. |
