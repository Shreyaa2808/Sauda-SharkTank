# Shark Tank India — Phase B, Step 1
## Problem Statement, Project Objectives, and Initial Scope

---

## 1. Problem Statement

*Shark Tank India* is a televised programme in which founders pitch their startups to a panel of investors (the Sharks). Information about each pitch, such as the startup, its founders, the amount sought, the equity offered, the offers received and the outcome, is generated every season. This information is, however, distributed across episodes and seasons and is not naturally available as a single organised, queryable collection. A person who wishes to answer even a simple question, for example "which startups in a given sector received offers from a particular Shark?", must assemble the answer manually from many separate sources.

Two kinds of users are affected differently by this limitation. Viewers and students interested in the show have no convenient way to search, filter, compare or summarise its pitches and deals. Founders and investors, who are the people the show is about, have no common place in which startups can be showcased and investor interest can be expressed in a structured manner.

This project proposes a web-based platform, **Shark Tank India**, that addresses both needs on a single relational foundation. It will (a) store historical show information as structured, interrelated data; and (b) allow founders to present startups and investors to discover them. Combining the two is useful because the historical record provides context (past pitches, valuations, sectors, Shark participation) that can inform discovery, while the discovery features give the historical data a practical purpose beyond browsing.

From a database perspective, the problem is well suited to a relational system. The domain contains clearly related entities (seasons, episodes, Sharks, startups, founders, pitches, offers, deals, users) with many-to-many and one-to-many relationships, and requires consistent storage, searching, filtering, aggregation and controlled updates.

The project does not claim that existing platforms are inadequate. It sets out to demonstrate, within the scope of a college DBMS project, how a well-designed relational database and a web interface can make this information organised, consistent and easy to explore.

---

## 2. Project Objectives

| # | Objective |
|---|-----------|
| O1 | **Structure the historical data.** Organise Shark Tank India information (seasons, episodes, Sharks, startups, founders, pitches, offers, deals and available post-show data) into related, non-redundant data held in a relational database. |
| O2 | **Enable search, filtering and retrieval.** Allow users to find startups, Sharks, pitches and deals by criteria such as name, season, sector, Shark and deal status. |
| O3 | **Support comparison.** Allow two or more startups (or pitches) to be compared side by side on stored attributes. |
| O4 | **Support profiles and discovery.** Provide founder, investor and startup profiles, and let investors discover startups and let users record interest in a connection. |
| O5 | **Provide summaries and statistics.** Generate useful summaries from stored data (for example, deals per season, sector distribution, activity per Shark) using database queries. |
| O6 | **Maintain consistency and reliable access.** Use primary and foreign keys, constraints and role-based access so that data remains consistent and is changed only by authorised users. |
| O7 | **Deliver a working web interface.** Provide a React/TypeScript front end, served by the Express/TypeScript backend, that reads from and writes to the MySQL database. |

---

## 3. Initial Project Scope

### 3.1 Core scope (essential for a coherent, demonstrable project)

1. **Historical explorer:** browse seasons, episodes, Sharks, startups and pitches, with the offers and deal outcomes that are recorded for them.
2. **Search and filters:** keyword search and a small set of filters (for example season, sector, Shark, deal outcome) over startups and pitches.
3. **Profiles:** Startup and founder profiles, historical profiles for Sharks appearing on the show, and separate profiles for investors registered on our platform. A person may be both a historical Shark and a registered platform investor, but these roles must be recorded separately.
4. **User accounts and roles:** viewer, founder, investor and administrator, with permissions appropriate to each role.
5. **Founder startup management:** a founder can create and edit their own startup listing.
6. **Investor discovery and interest:** an investor can browse or filter startups and express interest in one; the founder can see this interest.
7. **Startup comparison:** side-by-side comparison of a small number of startups.
8. **Basic statistics:** a limited set of aggregate summaries computed from the database.
9. **Administration:** an administrator can add, edit and remove historical records and manage users.

### 3.2 Proposed extensions (only if time permits)

- Richer statistics, such as trends across seasons and charts.
- A messaging or connection-request workflow beyond simple expression of interest.
- Bookmarking or watch-lists for users.
- Verification workflow for founder and investor accounts.
- Bulk import of historical data from files.
- Post-show performance information, where reliable data can be obtained.
- Additional comparison dimensions and exportable reports.

These extensions are optional and are **not** requirements of this step.

---

## 4. Boundaries and Assumptions

### 4.1 Confirmed project context (from the project brief)

- The platform is web-based and is called Shark Tank India.
- It combines a historical information explorer, a startup–investor platform, and discovery and analysis features.
- Intended roles are viewers, founders, investors and administrators.
- Technology: React, TypeScript, Vite (front end); Node.js, Express, TypeScript (back end); MySQL (planned database).
- The repository, front-end starter, back-end starter and health-check API already exist.
- The report requires requirements analysis, conceptual and logical design, physical implementation, a working prototype, testing and a presentation.

### 4.2 What the project will and will not cover

**Will cover**
- Storing and presenting historical information about the show to the extent it can be sourced.
- Startup and investor profiles, discovery and expression of interest on the platform.
- Search, filtering, comparison and statistics over the stored data.

**Will not cover**
- Real financial transactions, payments, legal agreements or actual investment execution.
- Verification of the claims made by founders or investors on the platform.
- Live or automated synchronisation with the television broadcast or any external service.
- Providing investment advice or predicting startup success.
- Advanced security, scalability or deployment concerns beyond what a prototype needs.

### 4.3 Information that may be unavailable or incomplete

- **Deal outcomes:** a deal agreed on air is not necessarily completed afterwards. The system must not assume every televised deal closed, and should be able to represent an outcome as unknown or not available.
- **Post-show performance:** data such as later revenue, funding or operating status may be missing, partial or unreliable, and will be stored only when available.
- **Source availability:** not every detail of every pitch may be publicly available. Some attributes may be absent for some records, and the database must tolerate missing values.
- **Dataset size:** the volume of data that will be collected has not been determined and is not assumed here.

### 4.4 Reasonable assumptions requiring confirmation

- Historical data will be collected from publicly available sources and entered or imported by the team.
- A single database will serve both historical and platform data.
- Founder and investor accounts are self-registered, with no formal verification in the core scope.
- Registered investors on the platform may include people other than the Sharks.
- The project is a prototype and will be demonstrated on a local or simple deployment.
- The data will cover only as many seasons as the team can reliably source.

### 4.5 Features still to be finalised

- Final priority ordering of the features listed above (to be established in a later step).
- The exact filters, comparison attributes and statistics.
- The specific form of "expressing interest".
- The level of administrative functionality.
- Which extensions, if any, will be attempted.

---

## 5. Success Criteria

| # | Criterion | How it can be checked |
|---|-----------|-----------------------|
| S1 | Historical data for the chosen seasons is stored in related tables with enforced keys and constraints. | Inspect the schema and run integrity checks; attempts to insert orphan or invalid records are rejected. |
| S2 | A user can browse seasons, episodes, Sharks, startups and pitches and view the recorded offers and deal outcomes. | Demonstrate navigation from a season to a pitch and its offers. |
| S3 | Search and filters return correct results for several defined test queries. | Compare interface results with direct database query results. |
| S4 | Records with unknown or missing deal outcomes or post-show data are displayed without being presented as confirmed. | Demonstrate a record with missing data. |
| S5 | A founder can create and edit a startup; an investor can discover it and express interest; the founder can see that interest. | End-to-end demonstration with two accounts. |
| S6 | At least two startups can be compared side by side on stored attributes. | Demonstrate the comparison view. |
| S7 | The system presents a defined set of statistics that match values computed independently from the data. | Verify displayed figures against manual queries. |
| S8 | Role permissions are enforced: a viewer cannot modify data, a founder cannot edit another founder's startup, and only an administrator can manage historical records. | Attempt restricted actions under each role. |
| S9 | The web interface reads from and writes to the MySQL database, and changes persist after a restart. | Add a record, restart the services and confirm it remains. |
| S10 | The project is demonstrated with a working prototype, test evidence and complete documentation. | Review against the report requirements. |

---

## 6. Decisions to Confirm Before Finalising This Step

1. **Season coverage:** which seasons will be included, and which sources will be used?
2. **Data collection method:** manual entry, file import, or a mix?
3. **Investors:** are platform investors only the Sharks, or can other investors register?
4. **Account verification:** is it acceptable to leave verification out of the core scope?
5. **Expression of interest:** is a simple recorded interest sufficient, or is messaging required?
6. **Post-show data:** should it be in the core scope, or remain an extension?
7. **Roles:** are the four roles (viewer, founder, investor, administrator) all in the core scope?
8. **Deployment:** is a local prototype sufficient for the demonstration?
9. **Extensions:** which proposed extensions, if any, does the team want to commit to?
