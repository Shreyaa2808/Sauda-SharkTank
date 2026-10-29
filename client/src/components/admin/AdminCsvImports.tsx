import React, { useEffect, useState, useRef } from 'react';
import {
  importPitchesCsv,
  fetchImportReports,
  fetchImportReportDetail,
  type ImportReportSummary,
  type ImportReportDetail,
} from '../../services/admin.ts';
import './AdminCsvImports.css';

const SAMPLE_CSV = `season_number,episode_number,pitch_sequence_order,brand_name,industry_name,country_franchise,episode_title,air_date,legal_business_name,stage_name,business_model,website_url,headquarters_city,headquarters_state,pitch_hook,original_ask_amount,original_ask_equity_pct
1,1,1,BluePine Foods,Food & Beverages,India,Episode 1,2021-12-20,BluePine Foods Pvt Ltd,Seed,B2C,https://bluepinefoods.com,Faridabad,Haryana,Authentic Himalayan momos crafted with natural ingredients,7500000,4
1,1,2,Heart Up My Sleeves,Fashion & Apparel,India,Episode 1,2021-12-20,Heart Up My Sleeves India,Early Stage,D2C,https://heartupmysleeves.com,New Delhi,Delhi,Detachable reusable fashion statement sleeves,2500000,10
1,1,3,TagZ Foods,Food & Beverages,India,Episode 1,2021-12-20,TagZ Foods Private Limited,Growth,B2B2C,https://tagzfoods.com,Bengaluru,Karnataka,Popped potato chips with 50 percent less fat,7000000,1`;

export const AdminCsvImports: React.FC = () => {
  const [reports, setReports] = useState<ImportReportSummary[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);

  // File selection state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [previewLines, setPreviewLines] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Current import result state
  const [importResult, setImportResult] = useState<ImportReportDetail['report'] | null>(null);

  // Audit detail modal state
  const [selectedAuditId, setSelectedAuditId] = useState<number | null>(null);
  const [auditDetail, setAuditDetail] = useState<ImportReportDetail | null>(null);
  const [loadingAuditDetail, setLoadingAuditDetail] = useState(false);
  const [auditDetailError, setAuditDetailError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load past reports on mount
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoadingReports(true);
      setReportsError(null);
      try {
        const data = await fetchImportReports(20, 0, controller.signal);
        setReports(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        setReportsError(err instanceof Error ? err.message : 'Unable to load past import reports.');
      } finally {
        if (!controller.signal.aborted) setLoadingReports(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  // Handle file reading
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setImportResult(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadError('Only .csv files are supported.');
      return;
    }

    if (file.size > 80000) {
      setUploadError('File is too large. Maximum CSV size is 80,000 characters (approx. 80 KB).');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || '');
      setCsvContent(text);
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      setPreviewLines(lines.slice(0, 5));
    };
    reader.onerror = () => {
      setUploadError('Failed to read the selected file.');
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sauda_historical_pitches_sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExecuteImport = async () => {
    if (!csvContent.trim()) {
      setUploadError('Please select a non-empty CSV file first.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setImportResult(null);

    try {
      const res = await importPitchesCsv(csvContent);
      setImportResult(res.report);
      // Refresh reports list
      const updatedReports = await fetchImportReports(20, 0);
      setReports(updatedReports);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Import failed. Verify CSV headers and data types.');
    } finally {
      setUploading(false);
    }
  };

  const handleOpenAuditDetail = async (importId: number) => {
    setSelectedAuditId(importId);
    setAuditDetail(null);
    setAuditDetailError(null);
    setLoadingAuditDetail(true);

    try {
      const data = await fetchImportReportDetail(importId);
      setAuditDetail(data);
    } catch (err) {
      setAuditDetailError(err instanceof Error ? err.message : 'Unable to load report audit.');
    } finally {
      setLoadingAuditDetail(false);
    }
  };

  return (
    <div className="admin-imports-container">
      {/* Top Split: Importer Dropzone + Template Reference */}
      <div className="imports-top-grid">
        {/* Upload Card */}
        <section className="import-action-card" aria-labelledby="upload-card-title">
          <div className="card-topline">
            <span className="import-badge">CSV BATCH INGESTION</span>
          </div>

          <h2 id="upload-card-title">Import Historical Pitches</h2>
          <p className="card-desc">
            Upload CSV files containing verified Shark Tank episodes, startups, ask valuations,
            and equity figures. Rows are validated and inserted into MySQL in transaction blocks.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <div
            className={`dropzone-box ${selectedFile ? 'has-file' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="dropzone-icon">📥</div>
            {selectedFile ? (
              <div className="file-info-view">
                <strong>{selectedFile.name}</strong>
                <span>{(selectedFile.size / 1024).toFixed(1)} KB · {previewLines.length}+ lines detected</span>
                <span className="change-file-hint">Click to change file</span>
              </div>
            ) : (
              <div className="dropzone-empty-view">
                <strong>Choose a CSV file or click to browse</strong>
                <span>Max 80,000 characters · Up to 500 pitches per batch</span>
              </div>
            )}
          </div>

          {/* Upload Status / Alerts */}
          {uploadError && (
            <div className="import-alert error" role="alert">
              <span>⚠</span>
              <span>{uploadError}</span>
            </div>
          )}

          {selectedFile && !importResult && (
            <div className="file-preview-strip">
              <span className="preview-label">HEADER PREVIEW:</span>
              <code>{previewLines[0] || 'No content'}</code>
            </div>
          )}

          <div className="import-btn-row">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              disabled={!selectedFile || uploading}
              onClick={handleExecuteImport}
            >
              {uploading ? 'Processing & Validating CSV…' : 'Execute Import →'}
            </button>

            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={handleDownloadSample}
            >
              Download Sample CSV
            </button>
          </div>
        </section>

        {/* Schema & Headers Reference Card */}
        <section className="import-schema-card" aria-labelledby="schema-card-title">
          <div className="card-topline">
            <span className="schema-badge">SPECIFICATION</span>
          </div>

          <h3 id="schema-card-title">Supported Header Schema</h3>
          <p className="schema-desc">
            Your CSV must contain the required columns exactly as named below.
          </p>

          <div className="schema-cols-table">
            <div className="schema-col-group">
              <span className="group-title required">MANDATORY COLUMNS (5)</span>
              <ul className="schema-list">
                <li><code>season_number</code> <small>(integer &gt;= 1)</small></li>
                <li><code>episode_number</code> <small>(integer &gt;= 1)</small></li>
                <li><code>pitch_sequence_order</code> <small>(integer &gt;= 1)</small></li>
                <li><code>brand_name</code> <small>(string, max 150)</small></li>
                <li><code>industry_name</code> <small>(string, e.g. Food & Beverages)</small></li>
              </ul>
            </div>

            <div className="schema-col-group">
              <span className="group-title optional">OPTIONAL METRICS & METADATA (13)</span>
              <ul className="schema-list">
                <li><code>country_franchise</code> <small>(default: India)</small></li>
                <li><code>episode_title</code>, <code>air_date</code> <small>(YYYY-MM-DD)</small></li>
                <li><code>legal_business_name</code>, <code>stage_name</code></li>
                <li><code>business_model</code>, <code>website_url</code></li>
                <li><code>headquarters_city</code>, <code>headquarters_state</code></li>
                <li><code>pitch_hook</code> <small>(hook description)</small></li>
                <li><code>original_ask_amount</code> <small>(INR number)</small></li>
                <li><code>original_ask_equity_pct</code> <small>(percentage)</small></li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* Immediate Import Result Banner & Table */}
      {importResult && (
        <section className="import-results-panel" aria-labelledby="results-title">
          <div className="results-header">
            <div>
              <h3 id="results-title">Batch Import Summary</h3>
              <p className="results-subtitle">
                Parsed {importResult.totalRows} data rows from uploaded CSV.
              </p>
            </div>

            <div className="results-chips">
              <span className="res-chip emerald">✓ {importResult.importedRows} Imported</span>
              {importResult.failedRows > 0 && (
                <span className="res-chip crimson">⚠ {importResult.failedRows} Failed</span>
              )}
            </div>
          </div>

          {importResult.rows && importResult.rows.length > 0 && (
            <div className="res-table-wrap">
              <table className="res-data-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Venture Brand</th>
                    <th>Status</th>
                    <th>Result / Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {importResult.rows.map((r, i) => (
                    <tr key={i} className={r.status === 'IMPORTED' ? 'row-imported' : 'row-failed'}>
                      <td><strong>#{r.row}</strong></td>
                      <td>{r.brandName || '—'}</td>
                      <td>
                        <span className={`status-pill ${r.status.toLowerCase()}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>{r.status === 'IMPORTED' ? `Stored (Pitch ID #${r.pitchId})` : (r.reason || 'Validation error')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Past Import Reports Log */}
      <section className="import-history-panel" aria-labelledby="history-title">
        <div className="history-header">
          <div>
            <h3 id="history-title">Import Audit Trail</h3>
            <p className="history-subtitle">
              Audit log of all historical CSV imports recorded in <code>application_audit_log</code>.
            </p>
          </div>
        </div>

        {loadingReports ? (
          <div className="hist-state-box">Loading audit history from MySQL…</div>
        ) : reportsError ? (
          <div className="hist-alert error" role="alert">{reportsError}</div>
        ) : reports.length === 0 ? (
          <div className="hist-state-box">No CSV imports have been logged yet.</div>
        ) : (
          <div className="hist-table-scroll">
            <table className="hist-data-table">
              <thead>
                <tr>
                  <th>Audit ID</th>
                  <th>Timestamp</th>
                  <th>Actor User</th>
                  <th>Total Rows</th>
                  <th>Imported</th>
                  <th>Failed</th>
                  <th className="th-actions">Details</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((rep) => (
                  <tr key={rep.importId}>
                    <td><strong className="hist-num-badge">#IMP-{rep.importId}</strong></td>
                    <td>{new Date(rep.importedAt).toLocaleString()}</td>
                    <td>{rep.actorUserId ? `User #${rep.actorUserId}` : 'System Admin'}</td>
                    <td>{rep.totalRows}</td>
                    <td><span className="import-stat-pill emerald">✓ {rep.importedRows}</span></td>
                    <td>
                      {rep.failedRows > 0 ? (
                        <span className="import-stat-pill crimson">⚠ {rep.failedRows}</span>
                      ) : (
                        <span style={{ color: '#64748B' }}>0</span>
                      )}
                    </td>
                    <td className="td-actions">
                      <button
                        type="button"
                        className="table-action-btn edit"
                        onClick={() => handleOpenAuditDetail(rep.importId)}
                      >
                        Inspect Audit →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Audit Detail Modal */}
      {selectedAuditId !== null && (
        <div className="hist-modal-overlay" onClick={() => setSelectedAuditId(null)}>
          <div className="hist-modal" onClick={(e) => e.stopPropagation()} style={{ width: '680px' }}>
            <div className="hist-modal-header">
              <h3>Import Audit #IMP-{selectedAuditId}</h3>
              <button type="button" className="hist-modal-close" onClick={() => setSelectedAuditId(null)}>×</button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {loadingAuditDetail ? (
                <div className="hist-state-box">Loading report details…</div>
              ) : auditDetailError ? (
                <div className="hist-alert error">{auditDetailError}</div>
              ) : auditDetail ? (
                <div className="audit-detail-content">
                  <div className="audit-summary-row">
                    <div>
                      <span className="kpi-label">Import Date</span>
                      <strong>{new Date(auditDetail.importedAt).toLocaleString()}</strong>
                    </div>
                    <div>
                      <span className="kpi-label">Imported Rows</span>
                      <strong style={{ color: '#10B981' }}>{auditDetail.report.importedRows}</strong>
                    </div>
                    <div>
                      <span className="kpi-label">Failed Rows</span>
                      <strong style={{ color: auditDetail.report.failedRows > 0 ? '#EF4444' : '#94A3B8' }}>
                        {auditDetail.report.failedRows}
                      </strong>
                    </div>
                  </div>

                  {auditDetail.report.rows && auditDetail.report.rows.length > 0 ? (
                    <div className="audit-rows-scroll">
                      <table className="res-data-table">
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Brand</th>
                            <th>Status</th>
                            <th>Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditDetail.report.rows.map((r, i) => (
                            <tr key={i}>
                              <td>#{r.row}</td>
                              <td>{r.brandName || '—'}</td>
                              <td>
                                <span className={`status-pill ${r.status.toLowerCase()}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td>{r.reason || `Stored (Pitch #${r.pitchId})`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ color: '#94A3B8', fontSize: '0.85rem' }}>
                      Row-level logs were not recorded for this historical run.
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="hist-modal-actions" style={{ padding: '16px 24px', margin: 0 }}>
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => setSelectedAuditId(null)}
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCsvImports;
