# Shark Tank India — Phase B, Step 1
## Problem Statement, Project Objectives, and Initial Scope

---

## 1. Problem Statement

*Shark Tank India* is a televised programme in which founders pitch their startups to a panel of investors (the Sharks). Information about each pitch, such as the startup, its founders, the amount sought, the equity offered, the offers received and the outcome, is generated every season. This information is, however, distributed across episodes and seasons and is not naturally available as a single organised, queryable collection. A person who wishes to answer even a simple question, for example "which startups in a given sector received offers from a particular Shark?", must assemble the answer manually from many separate sources.

Two kinds of users are affected differently by this limitation. Viewers and students interested in the show have no convenient way to search, filter, compare or summarise its pitches and deals. Founders and investors, who are the people the show is about, have no common place in which startups can be showcased and investor interest can be expressed in a structured manner.

This project proposes a web-based platform, **Shark Tank India**, that addresses both needs on a single relational foundation. It will (a) store historical show information as structured, interrelated data; and (b) allow founders to present startups and investors to discover them. Combining the two is useful because the historical record provides context (past pitches, valuations, sectors, Shark participation) that can inform discovery, while the discovery features give the historical data a practical purpose beyond browsing.

From a database perspective, the problem is well suited to a relational system. The domain contains clearly related entities (seasons, episodes, Sharks, startups, founders, pitches, offers, deals, users) with many-to-many and one-to-many relationships, and requires consistent storage, searching, filtering, aggregation and controlled updates.

The project does not claim that existing platforms are inadequate. It sets out to demonstrate, within the scope of a college DBMS project, how a well-designed relational database and a web interface can make this information organised, consistent and easy to explore. This is an independent academic prototype developed for a college DBMS project; it is not an official Shark Tank India service.

---

## 2. Project Objectives

| # | Objective |
|---|-----------|
| O1 | **Structure the historical data.** Organise Shark Tank India information (seasons, episodes, Sharks, startups, founders, pitches, offers, deals and, where available, post-show data) into related, non-redundant data held in a relational database. |
| O2 | **Enable search, filtering and retrieval.** Allow users to find startups, Sharks, pitches and deals by criteria such as name, season, sector, Shark and deal status. |
| O3 | **Support comparison.** Allow two or more startups (or pitches) to be compared side by side on stored attributes. |
| O4 | **Support profiles and discovery.** Provide founder, investor and startup profiles, and let investors discover startups and send connection requests to founders. |
| O5 | **Provide summaries and statistics.** Generate useful summaries from stored data (for example, deals per season, sector distribution, activity per Shark) using database queries. |
| O6 | **Maintain consistency and reliable access.** Use primary and foreign keys, constraints, validated data loading and role-based access so that data remains consistent and is changed only by authorised users. |
| O7 | **Deliver a working web interface.** Provide a React/TypeScript front end, served by the Express/TypeScript backend, that reads from and writes to the MySQL database, demonstrated as a local prototype. |

---

## 3. Initial Project Scope

### 3.1 Core scope (essential for a coherent, demonstrable project)

1. **Historical explorer:** browse seasons, episodes, Sharks, startups and pitches, with the offers and deal outcomes that are recorded for them. Coverage begins with one to two reliably sourced seasons and is expanded only if time permits.
2. **Historical data loading:** historical data is entered through a combination of manual entry and CSV/file imports. All data is validated before it is inserted into the database.
3. **Search and filters:** keyword search and a small set of filters (for example season, sector, Shark, deal outcome) over startups and pitches.
4. **Profiles:** startup, founder and investor profile pages. Historical Shark records (people who appeared on the show) and platform investor accounts (registered users) are treated as distinct concepts; a Shark may additionally hold an investor account, but the two are not assumed to be the same record.
5. **Accounts and roles:** Google Sign-In with basic profiles, and four roles with distinct permissions: viewer, founder, investor and administrator. Google authentication establishes only that the user controls a Google account; it does not verify identity or business credentials, and no formal founder or investor verification is included in the core scope.
6. **Founder startup management:** a founder can create and edit their own startup listing.
7. **Investor discovery and connection requests:** both historical Sharks and other investors can register as investors. An investor can browse or filter startups and send a connection request to a founder; the founder can accept or decline it.
8. **Basic messaging:** persistent text messaging between an investor and a founder, available only after the founder has accepted the connection request. Attachments, video calls and advanced real-time chat are excluded from the core scope.
9. **Startup comparison:** side-by-side comparison of a small number of startups.
10. **Basic statistics:** a limited set of aggregate summaries computed from the database.
11. **Administration:** an administrator can add, edit and remove historical records, review imports and manage users.
12. **Local prototype:** the system is completed and tested as a local prototype first.

### 3.2 Optional extensions

**Prioritised if time permits**
- Richer statistics and charts.
- Bookmarks and watch-lists for users.
- Post-show performance data, included only when reliable sources and time permit.

**Stretch goals (not expected)**
- Exportable reports.
- Detailed post-show data enhancements.
- Advanced bulk-import tooling.
- Identity or business verification workflows for founders and investors.
- Online deployment.

These extensions are optional and are **not** requirements of this step.

---

## 4. Boundaries and Assumptions

### 4.1 Confirmed project context (from the project brief)

- The platform is web-based and is called Shark Tank India.
- It combines a historical information explorer, a startup–investor platform, and discovery and analysis features.
- Intended roles are viewers, founders, investors and administrators.
- Technology: React, TypeScript, Vite (front end); Node.js, Express, TypeScript (back end); MySQL (database).
- The repository, front-end starter, back-end starter and health-check API already exist.
- The report requires requirements analysis, conceptual and logical design, physical implementation, a working prototype, testing and a presentation.

### 4.2 What the project will and will not cover

**Will cover**
- Storing and presenting historical information about the show, for the seasons that can be reliably sourced.
- Startup and investor profiles, discovery, connection requests and basic messaging after acceptance.
- Search, filtering, comparison and statistics over the stored data.

**Will not cover**
- Real financial transactions, payments, legal agreements or actual investment execution.
- Verification of the identity, credentials or claims of founders or investors. Google Sign-In does not imply such verification.
- Attachments, video calls or advanced real-time chat.
- Live or automated synchronisation with the television broadcast or any external service.
- Investment advice or prediction of startup success.
- Advanced security, scalability or deployment concerns beyond what a local prototype needs.

### 4.3 Information that may be unavailable or incomplete

- **Deal outcomes:** a deal agreed on air is not necessarily completed afterwards. The system must not assume every televised deal closed, and should be able to represent an outcome as unknown or not available.
- **Post-show performance:** data such as later revenue, funding or operating status may be missing, partial or unreliable. It is optional and is stored only when reliable sources and time permit.
- **Source availability:** not every detail of every pitch may be publicly available. Some attributes may be absent for some records, and the database must tolerate missing values.
- **Dataset size:** the volume of data that will be collected has not been determined and is not assumed here.

### 4.4 Assumptions

- Historical data is collected from publicly available sources and loaded by the team through manual entry and CSV/file imports, validated before insertion.
- A single database serves both historical data and platform data.
- Historical Shark records and platform investor accounts are separate concepts.
- Registered users are not identity-verified; their profiles are self-reported.
- The project is demonstrated as a local prototype.

---

## 5. Success Criteria

| # | Criterion | How it can be checked |
|---|-----------|-----------------------|
| S1 | Historical data for the chosen seasons is stored in related tables with enforced keys and constraints. | Inspect the schema and run integrity checks; attempts to insert orphan or invalid records are rejected. |
| S2 | Manually entered and imported data is validated before insertion; invalid rows are rejected or reported. | Import a file containing deliberately invalid rows and confirm they are not stored. |
| S3 | A user can browse seasons, episodes, Sharks, startups and pitches and view the recorded offers and deal outcomes. | Demonstrate navigation from a season to a pitch and its offers. |
| S4 | Search and filters return correct results for several defined test queries. | Compare interface results with direct database query results. |
| S5 | Records with unknown or missing deal outcomes or post-show data are displayed without being presented as confirmed. | Demonstrate a record with missing data. |
| S6 | A user can sign in with Google and maintain a basic profile; a historical Shark record and an investor account are separately represented. | Sign in with test accounts; show a Shark record with and without a linked investor account. |
| S7 | A founder can create and edit a startup; an investor can send a connection request; the founder can accept or decline it. | End-to-end demonstration with two accounts. |
| S8 | Text messaging is possible only after a connection is accepted, and messages persist across sessions. | Attempt to message before and after acceptance; sign out, sign in and view the messages. |
| S9 | At least two startups can be compared side by side on stored attributes. | Demonstrate the comparison view. |
| S10 | The statistics shown match values computed independently from the data. | Verify displayed figures against manual queries. |
| S11 | Role permissions are enforced: a viewer cannot modify data, a founder cannot edit another founder's startup, and only an administrator can manage historical records. | Attempt restricted actions under each role. |
| S12 | The local prototype reads from and writes to MySQL, and changes persist after a restart. | Add a record, restart the services and confirm it remains. |

---

## 6. Finalized Scope Decisions

| # | Area | Decision |
|---|------|----------|
| 1 | Historical coverage | Start with one to two reliably sourced seasons; expand if time permits. |
| 2 | Data collection | Mixed manual entry and CSV/file imports, with validation before database insertion. |
| 3 | Investor registration | Historical Sharks and other investors may both register. Historical Shark records and platform investor accounts are distinct concepts. |
| 4 | Accounts | Google Sign-In with basic profiles. No formal founder or investor identity verification in core scope; Google authentication does not imply identity or business verification. |
| 5 | Connections and messaging | Investors send connection requests; founders accept or decline. Basic persistent text messaging is available only after acceptance. No attachments, video calls or advanced real-time chat in core scope. |
| 6 | Post-show performance data | Optional; included only when reliable sources and time permit. |
| 7 | Roles | Viewer, founder, investor and administrator, each with distinct permissions. |
| 8 | Deployment | Complete and test the local prototype first; online deployment remains optional. |
| 9 | Optional extensions | Prioritise richer statistics/charts and bookmarks/watch-lists if time permits. Exportable reports, detailed post-show data enhancements, advanced bulk-import tooling, verification workflows and online deployment are stretch goals. |
