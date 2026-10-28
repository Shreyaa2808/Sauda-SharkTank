/**
 * First-Admin Verification Tool
 * Phase 5: Security, Validation and Operational Reliability
 *
 * Verifies that at least one active Administrator exists in the system
 * without disclosing database passwords, session tokens, or sensitive credentials.
 */

import 'dotenv/config';
import type { RowDataPacket } from 'mysql2';
import { dbPool } from '../src/db.js';

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) return `${name[0] ?? ''}***@${domain}`;
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

async function verifyAdmin(): Promise<void> {
  try {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      `SELECT u.user_id, u.email, u.account_status
       FROM user_role ur
       JOIN app_role r ON r.role_id = ur.role_id
       JOIN app_user u ON u.user_id = ur.user_id
       WHERE r.role_name = 'ADMIN' AND u.account_status = 'ACTIVE'
       ORDER BY u.user_id ASC`,
    );

    const count = rows.length;
    console.log('====================================================');
    console.log('SAUDA ADMINISTRATOR VERIFICATION REPORT');
    console.log('====================================================');

    if (count === 0) {
      console.warn('[WARNING] No active Administrator found.');
      console.log('To bootstrap the first administrator safely:');
      console.log('1. Log in via Google to create a base user account (default VIEWER role).');
      console.log('2. Execute the safe bootstrap SQL query via direct DBA connection:');
      console.log("   INSERT INTO user_role (user_id, role_id)");
      console.log("   SELECT u.user_id, r.role_id FROM app_user u CROSS JOIN app_role r");
      console.log("   WHERE u.email = 'YOUR_ADMIN_EMAIL' AND r.role_name = 'ADMIN'");
      console.log("   ON DUPLICATE KEY UPDATE role_id = role_id;");
      console.log('See PHASE5_MANIFEST.md for full operational documentation.');
      process.exit(1);
    }

    console.log(`[OK] Found ${count} active Administrator account(s):`);
    for (const admin of rows) {
      console.log(` - User ID: ${admin.user_id} | Email: ${maskEmail(String(admin.email))} | Status: ${admin.account_status}`);
    }
    console.log('Verification completed successfully.\n');
    process.exit(0);
  } catch (err: any) {
    console.error('[ERROR] Failed to query administrator records:', err?.message ?? 'Unknown database error');
    process.exit(1);
  } finally {
    await dbPool.end().catch(() => undefined);
  }
}

verifyAdmin();
