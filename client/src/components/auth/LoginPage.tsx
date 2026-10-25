import React, { useCallback, useEffect, useRef, useState } from 'react';
import './LoginPage.css';
import { loginWithGoogle, type AuthUser } from '../../services/auth.ts';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
  onBrowseAsGuest: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number;
            },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onBrowseAsGuest,
}) => {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const isGoogleConfigured = Boolean(
    googleClientId && googleClientId !== 'your-google-client-id.apps.googleusercontent.com',
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [gisLoaded, setGisLoaded] = useState<boolean>(() =>
    typeof window !== 'undefined' && Boolean(window.google?.accounts?.id),
  );

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Handle credential response received from Google Identity Services
  const handleCredentialResponse = useCallback(
    async (response: { credential: string }) => {
      if (!response.credential) {
        setErrorMessage('No credential returned from Google. Please try again.');
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const res = await loginWithGoogle(response.credential);

        if (res.ok) {
          setSuccessMessage(`Welcome back, ${res.user.fullName}! Entering platform...`);
          setTimeout(() => {
            onLoginSuccess(res.user);
          }, 500);
        } else {
          setErrorMessage(res.message);
        }
      } catch {
        setErrorMessage('Authentication request failed. Please check your connection.');
      } finally {
        setIsLoading(false);
      }
    },
    [onLoginSuccess],
  );

  // Dynamically load Google Identity Services SDK script
  useEffect(() => {
    if (!isGoogleConfigured || window.google?.accounts?.id) return;

    const scriptId = 'google-gsi-client';
    const existing = document.getElementById(scriptId);

    if (!existing) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => setGisLoaded(true);
      script.onerror = () => {
        setErrorMessage('Failed to load Google Identity Services library. Please check your connection.');
      };
      document.body.appendChild(script);
    } else {
      existing.addEventListener('load', () => setGisLoaded(true));
    }
  }, [isGoogleConfigured]);

  // Responsive button rendering: dynamically measures container to fit viewport safely
  const renderGoogleButton = useCallback(() => {
    if (!gisLoaded || !isGoogleConfigured || !window.google?.accounts?.id) return;
    const container = googleBtnContainerRef.current;
    if (!container) return;

    try {
      container.innerHTML = '';
      const measured = container.offsetWidth || 300;
      // Google GSI button width bounds: 200px to 400px
      const targetWidth = Math.min(360, Math.max(200, Math.floor(measured)));

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleCredentialResponse,
        auto_select: false,
      });

      window.google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: targetWidth,
      });
    } catch (err) {
      console.error('Failed to initialize Google Sign-In:', err);
    }
  }, [gisLoaded, isGoogleConfigured, googleClientId, handleCredentialResponse]);

  // Render on GIS load and listen to viewport resizes for responsiveness
  useEffect(() => {
    renderGoogleButton();
    window.addEventListener('resize', renderGoogleButton);
    return () => window.removeEventListener('resize', renderGoogleButton);
  }, [renderGoogleButton]);

  return (
    <div className="login-page-container">
      {/* Top Navigation Bar */}
      <header className="login-navbar">
        <div className="login-navbar-brand">
          <div className="login-logo-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none" width="20" height="20">
              <path
                d="M16 2 L28 6 V16 C28 23 22 28 16 30 C10 28 4 23 4 16 V6 L16 2 Z"
                fill="#0A1929"
                stroke="#C3A064"
                strokeWidth="1.5"
              />
              <path
                d="M11 20 C13 20 15 18 16 15 C17 12 18 8 22 7 C20 11 20 15 23 17 C20 18 16 20 11 20 Z"
                fill="#C3A064"
              />
            </svg>
          </div>
          <div className="login-brand-titles">
            <span className="login-brand-name">
              SAUDA<span className="gold-dot">.</span>
            </span>
            <span className="login-brand-sub">THE STARTUP EXCHANGE</span>
          </div>
        </div>

        <div className="login-navbar-actions">
          <button
            type="button"
            className="login-nav-ghost-btn"
            onClick={onBrowseAsGuest}
            aria-label="Browse the public startup discovery platform without signing in"
          >
            <span>Explore as Guest →</span>
          </button>
        </div>
      </header>

      {/* Main Two-Column Stage */}
      <main className="login-main-stage">
        <div className="login-card-wrapper">
          {/* Column 1: Restrained Editorial Brand Panel (Desktop) */}
          <aside className="login-brand-panel" aria-label="Sauda Platform Overview">
            <div className="brand-panel-content">
              <div className="brand-badge">
                <span className="badge-gold-indicator" />
                <span className="badge-text">VENTURE INTELLIGENCE</span>
              </div>

              <h2 className="brand-panel-heading">
                Standardized intelligence for India's next-generation ventures.
              </h2>

              <p className="brand-panel-description">
                Televised Shark Tank pitches and platform listings paired with verified valuations,
                equity metrics, and institutional deal discovery.
              </p>

              <div className="brand-panel-metrics">
                <div className="metric-chip">
                  <span className="metric-val">Dual-Source</span>
                  <span className="metric-lbl">Deal Registry</span>
                </div>
                <div className="metric-chip">
                  <span className="metric-val">MySQL 8.0</span>
                  <span className="metric-lbl">Database</span>
                </div>
                <div className="metric-chip">
                  <span className="metric-val">Server-Verified</span>
                  <span className="metric-lbl">Google Sign-In</span>
                </div>
              </div>

              <div className="brand-panel-footer">
                <span>SHARK TANK INDIA DBMS // AUTHENTICATION</span>
              </div>
            </div>
          </aside>

          {/* Column 2 / Mobile Primary: Authentication Form */}
          <section className="login-form-panel" aria-label="Sign In Form">
            <div className="login-form-content">
              {/* Mobile-only compact brand header */}
              <div className="mobile-card-brand" aria-hidden="true">
                <div className="mobile-logo-mark">
                  <svg viewBox="0 0 32 32" fill="none" width="18" height="18">
                    <path
                      d="M16 2 L28 6 V16 C28 23 22 28 16 30 C10 28 4 23 4 16 V6 L16 2 Z"
                      fill="#0A1929"
                      stroke="#C3A064"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M11 20 C13 20 15 18 16 15 C17 12 18 8 22 7 C20 11 20 15 23 17 C20 18 16 20 11 20 Z"
                      fill="#C3A064"
                    />
                  </svg>
                </div>
                <span className="mobile-brand-title">
                  SAUDA<span className="gold-dot">.</span>
                </span>
              </div>

              <div className="form-header">
                <span className="form-pre-title">SECURE ACCESS</span>
                <h1 className="form-title">Sign in to Sauda</h1>
                <p className="form-subtitle">
                  Access registered startup pitches, founder metrics, and the deal exchange.
                </p>
              </div>

              {/* Status & Error Messages */}
              {errorMessage && (
                <div className="auth-alert alert-error" role="alert">
                  <span className="alert-icon">⚠</span>
                  <div className="alert-body">
                    <strong>Authentication Error</strong>
                    <p>{errorMessage}</p>
                  </div>
                </div>
              )}

              {successMessage && (
                <div className="auth-alert alert-success" role="status">
                  <span className="alert-icon">✓</span>
                  <div className="alert-body">
                    <strong>Access Verified</strong>
                    <p>{successMessage}</p>
                  </div>
                </div>
              )}

              {/* Authentication Actions */}
              <div className="auth-actions-container">
                {isGoogleConfigured ? (
                  <>
                    <div className="google-btn-slot">
                      {/* Container where official Google Identity Services renders */}
                      <div ref={googleBtnContainerRef} className="gis-button-target" />

                      {(!gisLoaded || isLoading) && (
                        <div className="google-loading-overlay">
                          <span className="loading-spinner" />
                          <span>{isLoading ? 'Verifying identity...' : 'Loading Google Identity...'}</span>
                        </div>
                      )}
                    </div>

                    <div className="auth-divider">
                      <span className="divider-line" />
                      <span className="divider-label">OR</span>
                      <span className="divider-line" />
                    </div>

                    <button
                      type="button"
                      className="guest-action-btn"
                      onClick={onBrowseAsGuest}
                      disabled={isLoading}
                    >
                      <span>Explore Published Ventures as Guest</span>
                      <span className="btn-arrow">→</span>
                    </button>
                  </>
                ) : (
                  /* Compact, honest guidance card when Google OAuth is not yet configured */
                  <div className="oauth-setup-notice" role="region" aria-label="OAuth Setup Guidance">
                    <div className="notice-badge">
                      <span className="notice-dot" />
                      <span>GOOGLE OAUTH CONFIGURATION REQUIRED</span>
                    </div>

                    <h3 className="notice-heading">Google Client ID Not Configured</h3>

                    <p className="notice-body">
                      This environment requires Google Identity Services credentials.
                      In compliance with project standards, mock sign-ins are disabled.
                    </p>

                    <div className="notice-steps">
                      <div className="step-row">
                        <span className="step-num">1</span>
                        <div className="step-desc">
                          Create an OAuth 2.0 Web Client ID in <strong>Google Cloud Console</strong>.
                        </div>
                      </div>
                      <div className="step-row">
                        <span className="step-num">2</span>
                        <div className="step-desc">
                          Add <code>http://localhost:5173</code> to <strong>Authorized origins</strong>.
                        </div>
                      </div>
                      <div className="step-row">
                        <span className="step-num">3</span>
                        <div className="step-desc">
                          Set <code>VITE_GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_ID</code> in <code>.env</code>.
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="guest-action-btn primary"
                      onClick={onBrowseAsGuest}
                    >
                      <span>Proceed to Public Discovery Explorer as Guest</span>
                      <span className="btn-arrow">→</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Subdued Academic Disclaimer */}
              <div className="legal-disclaimer-container">
                <p className="legal-disclaimer-text">
                  Academic DBMS prototype based on the Shark Tank India domain.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
