
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { RowDataPacket } from 'mysql2';
import { dbPool } from './db.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(helmet());
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'sharktankdbms-api',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health/db', async (_req, res) => {
  try {
    await dbPool.query('SELECT 1 AS ok');

    res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({
      status: 'error',
      database: 'disconnected'
    });
  }
});

app.get('/api/startups', async (req, res) => {
  let limit = 20;
  const requestedLimit = req.query.limit;

  if (requestedLimit !== undefined) {
    if (
      typeof requestedLimit !== 'string' ||
      !/^\d+$/.test(requestedLimit)
    ) {
      res.status(400).json({
        error: 'limit must be an integer between 1 and 100'
      });
      return;
    }

    limit = Number(requestedLimit);

    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      res.status(400).json({
        error: 'limit must be an integer between 1 and 100'
      });
      return;
    }
  }

  try {
    const [rows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT
         p.pitch_id AS pitchId,
         p.pitch_type AS pitchType,
         p.original_ask_amount AS originalAskAmount,
         p.original_ask_equity_pct AS originalAskEquityPct,
         p.pitch_hook AS pitchHook,
         p.submitted_at AS submittedAt,
         c.company_id AS companyId,
         c.brand_name AS brandName,
         c.legal_business_name AS legalBusinessName,
         c.business_model AS businessModel,
         c.website_url AS websiteUrl,
         c.founded_year AS foundedYear,
         c.headquarters_city AS headquartersCity,
         c.headquarters_state AS headquartersState,
         c.headquarters_country AS headquartersCountry,
         i.industry_name AS industry,
         s.stage_name AS startupStage
       FROM pitch AS p
       INNER JOIN company AS c
         ON c.company_id = p.company_id
       LEFT JOIN industry AS i
         ON i.industry_id = c.industry_id
       LEFT JOIN startup_stage AS s
         ON s.stage_id = c.stage_id
       WHERE p.pitch_status = 'PUBLISHED'
       ORDER BY p.submitted_at DESC, p.pitch_id DESC
       LIMIT ?`,
      [limit]
    );

    res.status(200).json({
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Failed to fetch startups:', error);
    res.status(500).json({
      error: 'Unable to fetch startups'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Shark Tank DBMS API running at http://localhost:${PORT}`);
});
