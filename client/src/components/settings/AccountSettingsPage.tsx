import React, { useEffect, useState } from 'react';
import './AccountSettingsPage.css';
import { fetchUserProfile, type AuthUser, type UserProfile } from '../../services/auth.ts';

interface AccountSettingsPageProps {
  currentUser: AuthUser;
  onNavigate: (route: 'discovery' | 'profile') => void;
  onSignOut: () => void;
}

export const AccountSettingsPage: React.FC<AccountSettingsPageProps> = ({
  currentUser,
  onNavigate,
  onSignOut,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      const res = await fetchUserProfile(controller.signal);
      if (res.ok) {
        setProfile(res.user);
      }
      setLoading(false);
    }

    void load();
    return () => controller.abort();
  }, [currentUser.userId]);

  const primaryRole = profile?.roles?.[0] || currentUser.roles?.[0] || 'VIEWER';
  const subjectDisplay = profile?.googleSubjectMasked || 'Google Subject Verified';

  return (
    <div className="settings-page-stage">
      <div className="settings-page-container">
        {/* Navigation Breadcrumb / Return */}
        <div className="settings-header-nav">
          <button
            type="button"
            className="back-to-discovery-btn"
            onClick={() => onNavigate('discovery')}
            aria-label="Return to Startup Discovery"
          >
            <span className="back-arrow" aria-hidden="true">←</span>
            <span>Back to Startup Discovery</span>
          </button>

          <button
            type="button"
            className="settings-profile-link-btn"
            onClick={() => onNavigate('profile')}
            aria-label="Go to User Profile"
          >
            <span>User Profile</span>
            <span className="fwd-arrow" aria-hidden="true">→</span>
          </button>
        </div>

        {/* Page Title Lockup */}
        <div className="settings-title-lockup">
          <div className="settings-pre-tag">
            <span className="tag-dot" />
            <span>SECURITY & GOVERNANCE</span>
          </div>
          <h1 className="settings-heading">Account Settings</h1>
          <p className="settings-subheading">
            Authentication mechanisms, identity bindings, and session protocols for your Sauda account.
          </p>
        </div>

        {loading ? (
          <div className="settings-loading-panel">
            <span className="settings-spinner" />
            <p>Loading security protocols and identity telemetry...</p>
          </div>
        ) : (
          <div className="settings-sections-list">
            {/* Section 1: Authentication & Identity Binding */}
            <section className="settings-card" aria-labelledby="heading-identity">
              <div className="settings-card-header">
                <div className="card-header-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                    <path
                      d="M10 2L17 5V10C17 14.5 14 18 10 19C6 18 3 14.5 3 10V5L10 2Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M7 10L9 12L13 8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <h2 id="heading-identity" className="settings-card-title">
                    Authentication & Identity Binding
                  </h2>
                  <p className="settings-card-subtitle">
                    Permanent single sign-on link to your verified institutional identity.
                  </p>
                </div>
              </div>

              <div className="settings-grid">
                <div className="settings-field">
                  <span className="field-name">Identity Provider</span>
                  <div className="field-value-row">
                    <span className="provider-badge">
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      Google Identity Services (OAuth 2.0)
                    </span>
                    <span className="verified-chip">✓ Verified</span>
                  </div>
                </div>

                <div className="settings-field">
                  <span className="field-name">Google Subject ID</span>
                  <span className="field-value mono">{subjectDisplay}</span>
                </div>

                <div className="settings-field">
                  <span className="field-name">Primary Email Address</span>
                  <span className="field-value">{profile?.email || currentUser.email}</span>
                </div>

                <div className="settings-field">
                  <span className="field-name">Account Status</span>
                  <span className="field-value status-active">
                    <span className="pulse-dot" />
                    {profile?.accountStatus || 'ACTIVE'}
                  </span>
                </div>
              </div>

              <div className="settings-callout">
                <strong>Anti-Spoofing Security Policy</strong>
                <p>
                  To eliminate identity hijacking risks, Sauda strictly prohibits unverified email
                  auto-linking. New user accounts are provisioned via transactional MySQL routines and
                  permanently bound to their Google Subject Identifier.
                </p>
              </div>
            </section>

            {/* Section 2: Session & Transport Protocol */}
            <section className="settings-card" aria-labelledby="heading-session">
              <div className="settings-card-header">
                <div className="card-header-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                    <rect
                      x="4"
                      y="9"
                      width="12"
                      height="8"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M7 9V6C7 4.34315 8.34315 3 10 3C11.6569 3 13 4.34315 13 6V9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
                <div>
                  <h2 id="heading-session" className="settings-card-title">
                    Session & Transport Protocol
                  </h2>
                  <p className="settings-card-subtitle">
                    Cryptographic signature and browser security attributes.
                  </p>
                </div>
              </div>

              <div className="settings-grid">
                <div className="settings-field">
                  <span className="field-name">Session Token Format</span>
                  <span className="field-value mono">HMAC-SHA256 Cryptographically Signed</span>
                </div>

                <div className="settings-field">
                  <span className="field-name">Storage Mechanism</span>
                  <span className="field-value">HttpOnly, SameSite=Lax Cookie (<code>sauda_session</code>)</span>
                </div>

                <div className="settings-field">
                  <span className="field-name">Client JavaScript Access</span>
                  <span className="field-value text-safe">Restricted (XSS Immune)</span>
                </div>

                <div className="settings-field">
                  <span className="field-name">Session Duration</span>
                  <span className="field-value">7 Days (Rolling Expiration)</span>
                </div>
              </div>
            </section>

            {/* Section 3: Role & Permissions Overview */}
            <section className="settings-card" aria-labelledby="heading-roles">
              <div className="settings-card-header">
                <div className="card-header-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                    <circle cx="10" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <path
                      d="M4 17C4 13.6863 6.68629 11 10 11C13.3137 11 16 13.6863 16 17"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div>
                  <h2 id="heading-roles" className="settings-card-title">
                    Role Permissions & Tier
                  </h2>
                  <p className="settings-card-subtitle">
                    Authoritative permissions governed by MySQL <code>user_role</code> relational models.
                  </p>
                </div>
              </div>

              <div className="role-tier-display">
                <div className="tier-header">
                  <span className="tier-label">CURRENT ASSIGNED TIER</span>
                  <span className="tier-badge">{primaryRole}</span>
                </div>

                <div className="permissions-matrix">
                  <div className="permission-item granted">
                    <span className="perm-icon">✓</span>
                    <div className="perm-text">
                      <strong>Dual-Source Startup Discovery</strong>
                      <span>Search, filter, and inspect verified Shark Tank show pitches and platform listings.</span>
                    </div>
                  </div>

                  <div className="permission-item granted">
                    <span className="perm-icon">✓</span>
                    <div className="perm-text">
                      <strong>Same-Source Venture Comparison</strong>
                      <span>Benchmark ask valuations, requested equity, and financial models across up to 3 ventures.</span>
                    </div>
                  </div>

                  <div className="permission-item locked">
                    <span className="perm-icon">🔒</span>
                    <div className="perm-text">
                      <strong>Venture Registration & Cap-Table Management</strong>
                      <span>Restricted to verified founders with active <code>FOUNDER</code> credentials.</span>
                    </div>
                  </div>

                  <div className="permission-item locked">
                    <span className="perm-icon">🔒</span>
                    <div className="perm-text">
                      <strong>Deal Syndication & Term Sheet Structuring</strong>
                      <span>Restricted to accredited venture funds with active <code>INVESTOR</code> credentials.</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 4: Account Actions */}
            <section className="settings-actions-card">
              <div className="actions-card-content">
                <div>
                  <h3 className="actions-title">Session Management</h3>
                  <p className="actions-desc">
                    Terminate your active session cookie and return to public discovery.
                  </p>
                </div>

                <div className="actions-buttons-row">
                  <button
                    type="button"
                    className="settings-return-btn"
                    onClick={() => onNavigate('discovery')}
                  >
                    Return to Discovery
                  </button>

                  <button
                    type="button"
                    className="settings-signout-btn"
                    onClick={onSignOut}
                  >
                    <span>Sign Out of Sauda</span>
                    <span aria-hidden="true">↗</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountSettingsPage;
