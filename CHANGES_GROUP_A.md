# Group A (Person 2 - Founder backend) - changed files

server/src/founder.ts            NEW   founder logic moved out of workspaces.ts (A10) + all fixes
server/src/workspaces.ts         EDIT  founder section removed (investor/connection code untouched)
server/src/index.ts              EDIT  imports from founder.js; fieldErrors passed through; 2 new routes
server/src/test_workspaces_security.ts  EDIT  created pitch now sets a valid stageId (needed by A4)
server/scripts/dev_publish_pitch.sql    NEW   dev-only publish/reject script (A9)
database/migrations/002_founder_pitch_review_fields_DRAFT.sql  NEW  draft only, NOT executed (A8)

New/changed API
  GET  /api/founder/pitches/:id          owner-only read (404/403)
  POST /api/founder/pitches/:id/archive  owner-only soft archive + cascade (409 if already archived)
  Error bodies may now include fieldErrors: { field: message }
  New error codes: VALIDATION_FAILED, SUBMISSION_INCOMPLETE, PITCH_UNDER_REVIEW,
                   PITCH_PUBLISHED_LOCKED, PITCH_ARCHIVED_LOCKED, ALREADY_ARCHIVED, INVALID_BODY
  Dashboard metrics gain archivedCount; archived pitches no longer in list/total.
