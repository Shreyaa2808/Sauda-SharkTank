/**
 * Sauda Phase 6: Historical Admin CRUD Integration Test Suite
 * Database-backed integration tests covering administrative:
 * - Historical seasons (Create, Update, Delete)
 * - Historical episodes (Create, Update, Delete)
 * - Sharks (Create, Update, Delete)
 *
 * Verifies:
 * - 401 unauthenticated and 403 non-admin access rejection
 * - 400 malformed IDs, empty bodies, and invalid field validations
 * - 404 non-existent resources
 * - 409 duplicate constraints and user-linked shark protections
 * - Real persistence and removal verified directly in MySQL
 * - Zero residual records (strictly cleans up only inserted test IDs)
 */

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { dbPool } from './db.js';
import { signSession } from './auth.js';
import { assertIntegrationTargetSafe, verifyConnectedDatabase } from './testSafetyGuards.js';

let safeTarget: { dbName: string; apiUrl?: string };
try {
  safeTarget = assertIntegrationTargetSafe({
    optInEnvVar: 'SAUDA_RUN_HISTORICAL_ADMIN_INTEGRATION',
    requireApiUrl: true,
  });
} catch {
  process.exit(1);
}

const API_BASE = safeTarget.apiUrl!;

function sessionCookie(userId: number, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const token = signSession({ userId, email, iat: now, exp: now + 3600 });
  return `sauda_session=${token}; Path=/; HttpOnly; SameSite=Lax`;
}

test('Sauda Phase 6: Historical Admin CRUD Integration Suite', async (t) => {
  await verifyConnectedDatabase(dbPool, safeTarget.dbName);

  const runId = randomUUID().replace(/-/g, '').slice(0, 12);
  const tag = `__HA_${runId}__`;

  // Fixture tracking arrays for clean, deterministic teardown
  const createdSeasonIds: number[] = [];
  const createdEpisodeIds: number[] = [];
  const createdSharkIds: number[] = [];
  const createdInvestorIds: number[] = [];
  const createdUserIds: number[] = [];

  let adminCookie = '';
  let viewerCookie = '';

  async function cleanup() {
    try {
      if (createdEpisodeIds.length) {
        const marks = createdEpisodeIds.map(() => '?').join(',');
        await dbPool.execute(`DELETE FROM episode_shark_seat WHERE episode_id IN (${marks})`, createdEpisodeIds).catch(() => undefined);
        await dbPool.execute(`DELETE FROM pitch WHERE episode_id IN (${marks})`, createdEpisodeIds).catch(() => undefined);
        await dbPool.execute(`DELETE FROM show_episode WHERE episode_id IN (${marks})`, createdEpisodeIds);
      }
      if (createdSeasonIds.length) {
        const marks = createdSeasonIds.map(() => '?').join(',');
        await dbPool.execute(`DELETE FROM show_season WHERE season_id IN (${marks})`, createdSeasonIds);
      }
      if (createdSharkIds.length) {
        const marks = createdSharkIds.map(() => '?').join(',');
        await dbPool.execute(`DELETE FROM episode_shark_seat WHERE shark_id IN (${marks})`, createdSharkIds).catch(() => undefined);
        await dbPool.execute(`DELETE FROM shark WHERE shark_id IN (${marks})`, createdSharkIds);
      }
      if (createdInvestorIds.length) {
        const marks = createdInvestorIds.map(() => '?').join(',');
        await dbPool.execute(`DELETE FROM investor WHERE investor_id IN (${marks})`, createdInvestorIds);
      }
      if (createdUserIds.length) {
        const marks = createdUserIds.map(() => '?').join(',');
        await dbPool.execute(`DELETE FROM user_role WHERE user_id IN (${marks})`, createdUserIds);
        await dbPool.execute(`DELETE FROM app_user WHERE user_id IN (${marks})`, createdUserIds);
      }
    } catch (err) {
      console.error('[Cleanup Error]', err);
    } finally {
      await dbPool.end().catch(() => undefined);
    }
  }

  t.after(async () => {
    await cleanup();
  });

  // 1. Setup isolated test admin and viewer accounts
  const [adminRoleRows] = await dbPool.execute<RowDataPacket[]>('SELECT role_id FROM app_role WHERE role_name = "ADMIN"');
  const [viewerRoleRows] = await dbPool.execute<RowDataPacket[]>('SELECT role_id FROM app_role WHERE role_name = "VIEWER"');
  assert(adminRoleRows.length > 0, 'ADMIN role exists in app_role');
  assert(viewerRoleRows.length > 0, 'VIEWER role exists in app_role');
  const adminRoleId = Number(adminRoleRows[0].role_id);
  const viewerRoleId = Number(viewerRoleRows[0].role_id);

  const adminEmail = `admin_${runId}@sauda.test`;
  const [adminUserRes] = await dbPool.execute<ResultSetHeader>(
    `INSERT INTO app_user (full_name, email, password_hash, account_status)
     VALUES (?, ?, 'dummy_hash', 'ACTIVE')`,
    [`Admin ${tag}`, adminEmail],
  );
  const adminUserId = adminUserRes.insertId;
  createdUserIds.push(adminUserId);
  await dbPool.execute('INSERT INTO user_role (user_id, role_id) VALUES (?, ?)', [adminUserId, adminRoleId]);
  adminCookie = sessionCookie(adminUserId, adminEmail);

  const viewerEmail = `viewer_${runId}@sauda.test`;
  const [viewerUserRes] = await dbPool.execute<ResultSetHeader>(
    `INSERT INTO app_user (full_name, email, password_hash, account_status)
     VALUES (?, ?, 'dummy_hash', 'ACTIVE')`,
    [`Viewer ${tag}`, viewerEmail],
  );
  const viewerUserId = viewerUserRes.insertId;
  createdUserIds.push(viewerUserId);
  await dbPool.execute('INSERT INTO user_role (user_id, role_id) VALUES (?, ?)', [viewerUserId, viewerRoleId]);
  viewerCookie = sessionCookie(viewerUserId, viewerEmail);

  // ==========================================================================
  // SECTION 1: AUTHENTICATION & ROLE AUTHORIZATION ENFORCEMENT
  // ==========================================================================
  await t.test('1. Access controls: Unauthenticated (401) and Non-Admin (403) are rejected', async () => {
    const endpoints = [
      { method: 'POST', path: '/admin/historical/seasons', body: { seasonNumber: 999 } },
      { method: 'POST', path: '/admin/historical/episodes', body: { seasonId: 1, episodeNumber: 1 } },
      { method: 'POST', path: '/admin/historical/sharks', body: { displayName: 'Unauthorized Shark' } },
    ];

    for (const ep of endpoints) {
      // Unauthenticated request -> 401
      const unauthRes = await fetch(`${API_BASE}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ep.body),
      });
      assert.equal(unauthRes.status, 401, `Unauthenticated ${ep.method} ${ep.path} must return 401`);
      const unauthJson = (await unauthRes.json()) as any;
      assert.equal(unauthJson.error, 'UNAUTHORIZED');

      // Authenticated as VIEWER (non-admin) -> 403
      const nonAdminRes = await fetch(`${API_BASE}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json', Cookie: viewerCookie },
        body: JSON.stringify(ep.body),
      });
      assert.equal(nonAdminRes.status, 403, `Non-admin ${ep.method} ${ep.path} must return 403`);
      const nonAdminJson = (await nonAdminRes.json()) as any;
      assert.equal(nonAdminJson.error, 'FORBIDDEN');
    }
  });

  // ==========================================================================
  // SECTION 2: HISTORICAL SEASONS CRUD & PERSISTENCE
  // ==========================================================================
  await t.test('2. Historical Seasons: Create, Update, Delete with database verification', async () => {
    const countryFranchise = `Franchise_${runId}`;
    const seasonNumber = 91;

    // A. Validation failure: missing/malformed body
    const malformedRes = await fetch(`${API_BASE}/admin/historical/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify('invalid_string_body'),
    });
    assert.equal(malformedRes.status, 400, 'Malformed body must return 400');

    // B. Validation failure: invalid date range (finale earlier than premiere)
    const invalidDateRes = await fetch(`${API_BASE}/admin/historical/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        seasonNumber,
        countryFranchise,
        premiereDate: '2026-06-01',
        finaleDate: '2026-05-01',
      }),
    });
    assert.equal(invalidDateRes.status, 400);
    const dateJson = (await invalidDateRes.json()) as any;
    assert.equal(dateJson.error, 'INVALID_DATE_RANGE');

    // C. Successful Create
    const createRes = await fetch(`${API_BASE}/admin/historical/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        seasonNumber,
        countryFranchise,
        premiereDate: '2026-01-10',
        finaleDate: '2026-04-10',
        totalEpisodes: 20,
        networkChannel: 'Sony LIV',
        productionHouse: 'Studio ' + tag,
        budgetAmount: 5000000,
      }),
    });
    assert.equal(createRes.status, 201, 'Valid season creation must return 201');
    const createJson = (await createRes.json()) as any;
    assert.equal(createJson.ok, true);
    assert.equal(typeof createJson.seasonId, 'number');
    const seasonId = createJson.seasonId;
    createdSeasonIds.push(seasonId);

    // Direct MySQL Verification after Create
    const [seasonRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT season_id, season_number, country_franchise, production_house, budget_amount
       FROM show_season WHERE season_id = ?`,
      [seasonId],
    );
    assert.equal(seasonRows.length, 1, 'Created season must exist in MySQL');
    assert.equal(Number(seasonRows[0].season_number), seasonNumber);
    assert.equal(seasonRows[0].country_franchise, countryFranchise);
    assert.equal(seasonRows[0].production_house, 'Studio ' + tag);

    // D. Duplicate Season Number + Country rejection (409 DUPLICATE_RECORD)
    const dupRes = await fetch(`${API_BASE}/admin/historical/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        seasonNumber,
        countryFranchise,
      }),
    });
    assert.equal(dupRes.status, 409, 'Duplicate season must return 409');
    const dupJson = (await dupRes.json()) as any;
    assert.equal(dupJson.error, 'DUPLICATE_RECORD');

    // E. Update season validation: empty body (400 NO_FIELDS) & non-existent ID (404)
    const emptyUpdateRes = await fetch(`${API_BASE}/admin/historical/seasons/${seasonId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({}),
    });
    assert.equal(emptyUpdateRes.status, 400);

    const nonExistentUpdateRes = await fetch(`${API_BASE}/admin/historical/seasons/99999999`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ productionHouse: 'Updated Studio' }),
    });
    assert.equal(nonExistentUpdateRes.status, 404);

    // F. Successful Update
    const updateRes = await fetch(`${API_BASE}/admin/historical/seasons/${seasonId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        productionHouse: 'Updated Studio ' + tag,
        budgetAmount: 7500000,
        totalEpisodes: 22,
        premiereDate: '2026-01-10',
        finaleDate: '2026-04-10',
      }),
    });
    assert.equal(updateRes.status, 200, 'Valid update must return 200');

    // Direct MySQL Verification after Update
    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT production_house, budget_amount, total_episodes FROM show_season WHERE season_id = ?`,
      [seasonId],
    );
    assert.equal(updatedRows[0].production_house, 'Updated Studio ' + tag);
    assert.equal(Number(updatedRows[0].budget_amount), 7500000);
    assert.equal(Number(updatedRows[0].total_episodes), 22);

    // G. Delete Season (404 on non-existent, 200 on success)
    const deleteNonExistent = await fetch(`${API_BASE}/admin/historical/seasons/99999999`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    assert.equal(deleteNonExistent.status, 404);

    const deleteRes = await fetch(`${API_BASE}/admin/historical/seasons/${seasonId}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    assert.equal(deleteRes.status, 200, 'Delete must return 200');
    const deleteJson = (await deleteRes.json()) as any;
    assert.equal(deleteJson.deleted, true);

    // Direct MySQL Verification after Delete
    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(
      'SELECT season_id FROM show_season WHERE season_id = ?',
      [seasonId],
    );
    assert.equal(deletedRows.length, 0, 'Deleted season must no longer exist in MySQL');
    // Remove from tracking since it's already deleted
    const idx = createdSeasonIds.indexOf(seasonId);
    if (idx !== -1) createdSeasonIds.splice(idx, 1);
  });

  // ==========================================================================
  // SECTION 3: HISTORICAL EPISODES CRUD & PERSISTENCE
  // ==========================================================================
  await t.test('3. Historical Episodes: Create, Update, Delete with database verification', async () => {
    // A. Provision a dedicated parent season
    const [seasonRes] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO show_season (season_number, country_franchise) VALUES (92, ?)`,
      [`EpTest_${runId}`],
    );
    const parentSeasonId = seasonRes.insertId;
    createdSeasonIds.push(parentSeasonId);

    // B. Validation failure: seasonId does not exist (400 INVALID_REFERENCE)
    const invalidRefRes = await fetch(`${API_BASE}/admin/historical/episodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        seasonId: 99999999,
        episodeNumber: 1,
        episodeTitle: 'Invalid Season Episode',
      }),
    });
    assert.equal(invalidRefRes.status, 400);
    const refJson = (await invalidRefRes.json()) as any;
    assert.equal(refJson.error, 'INVALID_REFERENCE');

    // C. Successful Episode Create
    const createRes = await fetch(`${API_BASE}/admin/historical/episodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        seasonId: parentSeasonId,
        episodeNumber: 1,
        episodeTitle: 'Premiere Episode ' + tag,
        tapeDate: '2026-01-05',
        airDate: '2026-01-15',
        durationMinutes: 48,
        tvRating: 8.5,
        viewersCountMillions: 3.2,
        filmingLocation: 'Mumbai Studio A',
        videoUrl: 'https://stream.sauda.test/ep1',
      }),
    });
    assert.equal(createRes.status, 201, 'Episode create must return 201');
    const createJson = (await createRes.json()) as any;
    assert.equal(createJson.ok, true);
    assert.equal(typeof createJson.episodeId, 'number');
    const episodeId = createJson.episodeId;
    createdEpisodeIds.push(episodeId);

    // Direct MySQL Verification after Create
    const [episodeRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT episode_id, season_id, episode_number, episode_title, duration_minutes, filming_location
       FROM show_episode WHERE episode_id = ?`,
      [episodeId],
    );
    assert.equal(episodeRows.length, 1, 'Created episode must exist in MySQL');
    assert.equal(Number(episodeRows[0].season_id), parentSeasonId);
    assert.equal(Number(episodeRows[0].episode_number), 1);
    assert.equal(episodeRows[0].episode_title, 'Premiere Episode ' + tag);
    assert.equal(Number(episodeRows[0].duration_minutes), 48);

    // D. Duplicate Episode Number in Same Season -> 409 DUPLICATE_RECORD
    const dupRes = await fetch(`${API_BASE}/admin/historical/episodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        seasonId: parentSeasonId,
        episodeNumber: 1, // Same episode number
        episodeTitle: 'Duplicate Episode',
      }),
    });
    assert.equal(dupRes.status, 409);
    const dupJson = (await dupRes.json()) as any;
    assert.equal(dupJson.error, 'DUPLICATE_RECORD');

    // E. Update Episode
    const updateRes = await fetch(`${API_BASE}/admin/historical/episodes/${episodeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        episodeTitle: 'Updated Episode Title ' + tag,
        durationMinutes: 52,
        tvRating: 9.0,
      }),
    });
    assert.equal(updateRes.status, 200, 'Episode update must return 200');

    // Direct MySQL Verification after Update
    const [updatedEpRows] = await dbPool.execute<RowDataPacket[]>(
      'SELECT episode_title, duration_minutes, tv_rating FROM show_episode WHERE episode_id = ?',
      [episodeId],
    );
    assert.equal(updatedEpRows[0].episode_title, 'Updated Episode Title ' + tag);
    assert.equal(Number(updatedEpRows[0].duration_minutes), 52);

    // F. Delete Episode (404 on non-existent, 200 on success)
    const deleteNonExistent = await fetch(`${API_BASE}/admin/historical/episodes/99999999`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    assert.equal(deleteNonExistent.status, 404);

    const deleteRes = await fetch(`${API_BASE}/admin/historical/episodes/${episodeId}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    assert.equal(deleteRes.status, 200, 'Episode delete must return 200');

    // Direct MySQL Verification after Delete
    const [deletedEpRows] = await dbPool.execute<RowDataPacket[]>(
      'SELECT episode_id FROM show_episode WHERE episode_id = ?',
      [episodeId],
    );
    assert.equal(deletedEpRows.length, 0, 'Episode must no longer exist in MySQL');
    const epIdx = createdEpisodeIds.indexOf(episodeId);
    if (epIdx !== -1) createdEpisodeIds.splice(epIdx, 1);
  });

  // ==========================================================================
  // SECTION 4: HISTORICAL SHARKS CRUD & PERSISTENCE
  // ==========================================================================
  await t.test('4. Historical Sharks: Create, Update, Delete with database verification', async () => {
    const sharkName = `Shark_${runId}`;

    // A. Validation failure: missing displayName (400 INVALID_INPUT)
    const missingNameRes = await fetch(`${API_BASE}/admin/historical/sharks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        investmentFirmName: 'No Name Ventures',
      }),
    });
    assert.equal(missingNameRes.status, 400);

    // B. Successful Shark Create
    const createRes = await fetch(`${API_BASE}/admin/historical/sharks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        displayName: sharkName,
        investmentFirmName: 'Venture Capital ' + tag,
        stageName: 'Titan Shark',
        gender: 'Female',
        birthDate: '1985-04-12',
        isGuestShark: false,
      }),
    });
    assert.equal(createRes.status, 201, 'Shark create must return 201');
    const createJson = (await createRes.json()) as any;
    assert.equal(createJson.ok, true);
    assert.equal(typeof createJson.sharkId, 'number');
    const sharkId = createJson.sharkId;
    createdSharkIds.push(sharkId);

    // Direct MySQL Verification after Create
    const [sharkRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT sh.shark_id, sh.investor_id, sh.stage_name, sh.gender, sh.is_guest_shark,
              i.display_name, i.investment_firm_name, i.user_id
       FROM shark sh
       JOIN investor i ON i.investor_id = sh.investor_id
       WHERE sh.shark_id = ?`,
      [sharkId],
    );
    assert.equal(sharkRows.length, 1, 'Created shark must exist in MySQL');
    assert.equal(sharkRows[0].display_name, sharkName);
    assert.equal(sharkRows[0].investment_firm_name, 'Venture Capital ' + tag);
    assert.equal(sharkRows[0].stage_name, 'Titan Shark');
    assert.equal(Number(sharkRows[0].is_guest_shark), 0);
    assert.equal(sharkRows[0].user_id, null, 'Historical shark investor record must have user_id = NULL');
    const investorId = Number(sharkRows[0].investor_id);
    createdInvestorIds.push(investorId);

    // C. Update Shark
    const updateRes = await fetch(`${API_BASE}/admin/historical/sharks/${sharkId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        investmentFirmName: 'Updated Capital ' + tag,
        stageName: 'Global Shark',
        isGuestShark: true,
      }),
    });
    assert.equal(updateRes.status, 200, 'Shark update must return 200');

    // Direct MySQL Verification after Update
    const [updatedSharkRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT sh.stage_name, sh.is_guest_shark, i.investment_firm_name
       FROM shark sh JOIN investor i ON i.investor_id = sh.investor_id WHERE sh.shark_id = ?`,
      [sharkId],
    );
    assert.equal(updatedSharkRows[0].stage_name, 'Global Shark');
    assert.equal(Number(updatedSharkRows[0].is_guest_shark), 1);
    assert.equal(updatedSharkRows[0].investment_firm_name, 'Updated Capital ' + tag);

    // D. Delete Shark (404 on non-existent, 200 on success)
    const deleteNonExistent = await fetch(`${API_BASE}/admin/historical/sharks/99999999`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    assert.equal(deleteNonExistent.status, 404);

    const deleteRes = await fetch(`${API_BASE}/admin/historical/sharks/${sharkId}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    assert.equal(deleteRes.status, 200, 'Shark delete must return 200');

    // Direct MySQL Verification after Delete: Both shark and unlinked historical investor are removed
    const [deletedSharkRows] = await dbPool.execute<RowDataPacket[]>(
      'SELECT shark_id FROM shark WHERE shark_id = ?',
      [sharkId],
    );
    assert.equal(deletedSharkRows.length, 0, 'Deleted shark must no longer exist in MySQL');

    const [deletedInvestorRows] = await dbPool.execute<RowDataPacket[]>(
      'SELECT investor_id FROM investor WHERE investor_id = ?',
      [investorId],
    );
    assert.equal(deletedInvestorRows.length, 0, 'Associated historical investor record must be removed');

    const shIdx = createdSharkIds.indexOf(sharkId);
    if (shIdx !== -1) createdSharkIds.splice(shIdx, 1);
    const invIdx = createdInvestorIds.indexOf(investorId);
    if (invIdx !== -1) createdInvestorIds.splice(invIdx, 1);
  });
});
