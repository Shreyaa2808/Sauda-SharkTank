# Shark Tank India — Phase B, Step 4
## Non-Functional Requirements

*This document defines quality requirements for the independent academic Shark Tank India DBMS prototype. It complements the problem statement and scope in Phase B, Step 1, the roles and permissions in Step 2, and the functional requirements in Step 3. It does not introduce additional product features or implementation code. This is not an official Shark Tank India service.*

---

## 1. Purpose

Functional requirements describe what the system must do. Non-functional requirements define the quality, constraints and operating conditions under which those functions must work. The requirements below are tailored to a student DBMS prototype using React, TypeScript and Vite for the frontend, Node.js and Express with TypeScript for the backend, and MySQL as the planned relational database.

Unless stated otherwise, performance targets apply to a local demonstration environment with the selected 1–2 seasons of reliably sourced data, a normal development Mac, and one active demonstration user. These are prototype targets, not claims of production-scale capacity.

## 2. Non-Functional Requirements

Each requirement has a stable ID, priority and an observable verification method.

### 2.1 Security and access control

| ID | Requirement | Priority | Acceptance / verification |
|---|---|---|---|
| NFR-SEC-01 | The system shall enforce authorization in the backend for every protected read or write operation; hiding a control in the frontend alone shall not count as access control. | Must | Directly call a protected endpoint as an unauthorized or wrongly privileged user; the request is rejected and no protected data is changed or disclosed. |
| NFR-SEC-02 | The system shall enforce the agreed role and ownership rules: only administrators manage historical records; a founder edits only their own startup listings; only permitted parties manage connection requests and messages. | Must | Run role-based tests for Viewer, Founder, Investor and Administrator, including a founder attempting to edit another founder's listing. Each action is permitted or rejected according to Step 2. |
| NFR-SEC-03 | The system shall use parameterized database queries or equivalent safe query APIs for user-supplied values. | Must | Code review confirms parameterized query usage for dynamic SQL values; search inputs containing SQL syntax do not alter query structure or bypass authorization. |
| NFR-SEC-04 | The system shall validate and constrain inputs received from forms, APIs and import files before using them in business logic or database writes. | Must | Submit missing, malformed, oversized or invalid values in defined test cases; the system rejects or safely handles them without an unhandled server error or invalid database write. |
| NFR-SEC-05 | Secrets such as Google OAuth credentials, database passwords and session/token-signing secrets shall be supplied through environment configuration and shall not be committed to the repository. | Must | Inspect tracked files and the Git diff for secrets; confirm secret-bearing environment files are ignored and only a non-secret example configuration may be committed. |
| NFR-SEC-06 | The system shall return only information that the requesting role and user are permitted to access. In particular, public responses shall not expose email addresses or private contact fields, and administrators shall not receive private message contents. | Must | Inspect public profile responses and administrator responses; private contact values and message contents are absent. Test access to another user's private message is rejected. |

### 2.2 Authentication and privacy

| ID | Requirement | Priority | Acceptance / verification |
|---|---|---|---|
| NFR-PRV-01 | The system shall treat Google Sign-In as account authentication only, not as verification of startup ownership or investor legitimacy. | Must | Review account and profile behaviour; no role or verified-business claim is granted merely because Google Sign-In succeeds. |
| NFR-PRV-02 | The system shall keep account and role permissions separate from historical Shark records, even if a registered user may refer to the same person. | Must | Test records for a historical Shark and a platform investor account; investor permissions do not permit editing the historical record or imply a verified identity match. |
| NFR-PRV-03 | Only the two participants in a connection shall be able to read its messages. While active, they may send and read messages; after the connection ends, existing messages remain readable in read-only mode and sending is disabled. | Must | Test with both participants, an unrelated user and an administrator before and after ending a connection. Only the participants can read the thread; no new message is accepted after the connection ends. |
| NFR-PRV-04 | Ending a connection or deleting a startup listing shall not physically delete existing messages as a side effect. | Must | End a connection and delete a listing in separate test cases; confirm messages remain available to the participants in read-only mode. |
| NFR-PRV-05 | The system shall collect and display only profile information needed for the agreed core scope and shall clearly treat founder and investor profile claims as self-reported. | Should | Review profile forms and public profile pages; no mandatory identity/business-verification fields or unsupported verified badges are present. |

### 2.3 Performance and responsiveness

| ID | Requirement | Priority | Acceptance / verification |
|---|---|---|---|
| NFR-PER-01 | Under the local prototype test conditions described in Section 1, common read operations—opening a season, listing startups, and running ordinary search/filter queries—should complete within 2 seconds for at least 95% of measured requests. | Should | Run at least 20 representative requests against the documented demo dataset and record response times. Report the test machine, dataset size and results; do not claim the target was met unless measurements support it. |
| NFR-PER-02 | Database-backed lists and search results shall be limited or paginated when a result set could become unwieldy, rather than returning an unbounded collection by default. | Should | Seed enough records to exceed one result page; confirm the response is bounded and additional results can be requested. |
| NFR-PER-03 | The system shall calculate displayed statistics from stored data and avoid unnecessary repeated database work for the same page load. | Should | Compare displayed statistics with independent SQL results and inspect query behaviour for the tested page; figures must be correct. |

### 2.4 Reliability and data integrity

| ID | Requirement | Priority | Acceptance / verification |
|---|---|---|---|
| NFR-REL-01 | The system shall preserve relational integrity through appropriate primary keys, foreign keys, uniqueness rules, nullability and other constraints established during database design. | Must | Database tests demonstrate that valid related records can be stored and invalid references or duplicate constrained values are rejected. Exact constraints will be documented in the database-design phase. |
| NFR-REL-02 | Historical deal outcomes and post-show facts that are unknown or unavailable shall not be displayed as confirmed facts. | Must | Use sample records with unknown outcomes or missing post-show values; the interface indicates unknown/unavailable values without inventing a closed deal or performance result. |
| NFR-REL-03 | CSV/file import shall validate rows before insertion, insert valid rows, reject invalid rows with row-level reasons, and report both successful and failed rows. | Must | Import a test file containing valid and invalid rows; valid rows are stored, invalid rows are absent, and the report identifies each row and failure reason. |
| NFR-REL-04 | A failed request or import shall produce a controlled error result and shall not leave partially written, inconsistent data beyond the documented partial-import behaviour. | Must | Trigger validation and database errors; the interface/API shows a useful failure result, valid database constraints remain intact, and import results follow NFR-REL-03. |
| NFR-REL-05 | Successful data changes made through the application shall persist after the backend and frontend are restarted. | Must | Create or update a permitted record, restart the services, and verify the change remains in MySQL and is shown when retrieved again. |
| NFR-REL-06 | The project shall maintain a documented way to recreate its schema and load the minimum demonstration data in a fresh local database. | Must | From the documented setup instructions, create a fresh database and run the supplied schema/seed scripts successfully. The actual scripts will be delivered in the relevant database implementation phase. |

### 2.5 Usability and accessibility

| ID | Requirement | Priority | Acceptance / verification |
|---|---|---|---|
| NFR-USA-01 | The interface shall use consistent labels and navigation for historical browsing, profiles, connection requests and messaging. | Should | A reviewer completes the defined basic user journeys without needing undocumented navigation steps. |
| NFR-USA-02 | Forms shall identify required fields, show field-level validation where applicable, and provide a readable success or error message after submission. | Must | Test empty, invalid and valid submissions; users can identify the affected field or understand the operation result. |
| NFR-USA-03 | Tables, forms and primary actions shall remain usable at typical laptop screen sizes and narrow mobile-sized viewports. | Should | Review the core pages at a desktop/laptop width and a narrow viewport; content and primary actions do not become inaccessible through unintended clipping or horizontal overflow. |
| NFR-USA-04 | Status and permissions shall be communicated clearly—for example, whether a connection is Pending, Accepted, Declined, Withdrawn or Ended, and whether a conversation is read-only. | Must | In each lifecycle state, the displayed status matches the stored state and unavailable actions are disabled or return a clear explanation. |

### 2.6 Maintainability and testability

| ID | Requirement | Priority | Acceptance / verification |
|---|---|---|---|
| NFR-MNT-01 | Frontend, backend, database scripts and documentation shall remain separated in the existing `client/`, `server/`, `database/` and `docs/` directories. | Must | Review the repository structure; application code and SQL scripts are stored in the appropriate directories. |
| NFR-MNT-02 | The project shall use TypeScript checks and production builds for the frontend and backend, and these checks shall pass before a checkpoint is marked complete. | Must | Run the documented type-check/build commands for both applications and record successful results. |
| NFR-MNT-03 | Core business rules such as ownership checks, request transitions, import validation and message access shall be implemented in testable backend/service logic rather than only in presentation code. | Must | Code review and focused tests show the rules are enforced by the backend even when requests bypass the UI. |
| NFR-MNT-04 | Important setup, environment variables, database preparation, run commands and verification steps shall be documented for another team member. | Must | A teammate follows the repository documentation on a prepared development machine and can start the frontend and backend and connect to the configured database without undocumented steps. |

### 2.7 Compatibility and operating environment

| ID | Requirement | Priority | Acceptance / verification |
|---|---|---|---|
| NFR-COMP-01 | The prototype shall run in the agreed local development environment using a supported Node.js runtime, the React/Vite frontend, Express backend and MySQL. | Must | On the documented environment, install dependencies, configure environment variables, start all services and complete the core demonstration flow. Exact versions are recorded in project configuration and setup documentation. |
| NFR-COMP-02 | The core interface shall be tested in a current desktop version of at least one mainstream browser used for the demonstration. | Must | Record the browser/version used and verify the principal viewer, founder, investor and administrator journeys. Testing additional browsers is desirable but not a prerequisite for the local prototype. |
| NFR-COMP-03 | Online deployment shall not be required for acceptance of the core prototype; local operation is sufficient. | Must | Demonstrate the application locally with the configured MySQL database. Any online deployment is assessed only as an optional extension. |

---

## 3. Global Quality and Acceptance Conditions

The following conditions apply across the requirements above:

1. **Measurable evidence:** Performance or reliability targets are reported only after a test has been run. The report states the test environment and sample dataset size where relevant.
2. **No invented historical facts:** Unknown deal outcomes and unavailable post-show data remain explicitly unknown or unavailable.
3. **Server-side enforcement:** Role, ownership and messaging restrictions remain effective when API endpoints are called directly, without using the frontend.
4. **No secret leakage:** Environment credentials are excluded from version control and are not returned to clients or included in logs.
5. **Consistent lifecycle:** Connection, listing-deletion and message-retention behaviour follows the rules in `phase-b-step-3-functional-requirements.md` and `phase-b-step-2-user-roles.md`.
6. **Local-first acceptance:** The core prototype is tested locally first. Online deployment, advanced scalability and production availability guarantees are outside the core acceptance target.

## 4. Priorities Summary

- **Must:** Security and role enforcement, private-data protection, relational integrity, validated imports, persistence, reproducible local setup, clear validation outcomes, testable business rules, documented operation and a working local environment.
- **Should:** The 2-second performance target under the defined prototype test conditions, bounded/paginated result lists, efficient statistics rendering, polished navigation, responsive narrow-screen layouts and reduced profile-data collection.
- **Could / optional extensions:** Broader performance/load testing, online deployment hardening and production-grade operational monitoring. These are not required for the core college demonstration.

A `Must` requirement is part of core acceptance. A `Should` requirement is desirable and can be deferred if time is limited. Optional extensions do not become core requirements unless the team explicitly revises the approved scope.

## 5. Constraints and Explicit Exclusions

The following are not quality targets for this academic prototype:

- Production-level availability guarantees or a service-level agreement.
- Large-scale concurrent-user capacity or formal load certification.
- Real-time chat, message attachments or video calls.
- Identity or business verification of founders and investors.
- Administrative access to private message contents.
- Automatic deletion of messages when a connection ends or a listing is deleted.
- Mandatory online deployment.

The project shall still use reasonable security, input validation, data integrity and privacy safeguards suitable for a local prototype. Excluding production-grade guarantees is not permission to ignore the `Must` requirements above.

---

## 6. Traceability to Previous Documents

| Requirement area | Related Step 1 objective/scope | Related Step 2/Step 3 rules |
|---|---|---|
| Security and role enforcement | Maintain consistency and reliable access; User accounts and roles; Administration | Step 2 permission matrix and ownership rules; FR-04, FR-08, FR-22, FR-38, FR-44 |
| Authentication and privacy | Support profiles and discovery; User accounts and roles | Step 2 Authentication and Accounts; BR-01 to BR-03, BR-09, BR-14 |
| Performance | Search and filters; Historical explorer; Basic statistics | FR-17, FR-18, FR-41 to FR-43 |
| Integrity and validated imports | Structure the historical data; Administration | FR-11 to FR-16; BR-02, BR-11 |
| Connection and message privacy | Investor discovery and interest | Step 2 messaging restrictions; FR-25 to FR-40; BR-04 to BR-10 |
| Usability and lifecycle clarity | Deliver a working web interface | FR-01 to FR-45 as applicable |
| Maintainability and local setup | Deliver a working web interface; Physical implementation and working prototype/report requirements | Existing project structure and local-first decision from Step 1 |

---

## 7. Remaining Decisions

No new product-scope decisions are introduced by this document. The specific numerical performance target in NFR-PER-01 is a **prototype acceptance target** to be measured and reported, not a guarantee of performance on all hardware or dataset sizes. If the observed result misses the target, document the measurements and bottleneck rather than claiming compliance.
