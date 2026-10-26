import React from 'react';
import './NotFoundPage.css';

interface NotFoundPageProps {
  /** The unrecognised path the visitor asked for (displayed as plain text). */
  requestedPath: string;
  isSignedIn: boolean;
  /** True only when the visitor reached this page by in-app navigation, so Back cannot leave the site. */
  canGoBack: boolean;
  onGoHome: () => void;
  onGoBack: () => void;
  onSignIn: () => void;
}

/**
 * Genuine not-found view. Renders no account, profile or workspace data; it only knows
 * whether a session exists so it can offer Sign In to guests.
 */
export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  requestedPath,
  isSignedIn,
  canGoBack,
  onGoHome,
  onGoBack,
  onSignIn,
}) => {
  const shownPath = requestedPath.length > 80 ? `${requestedPath.slice(0, 77)}…` : requestedPath;

  return (
    <section className="nf-page" aria-labelledby="nf-title">
      <div className="nf-grid-bg" aria-hidden="true" />
      <div className="nf-inner">
        <div className="nf-visual" aria-hidden="true">
          <svg viewBox="0 0 320 320" fill="none" focusable="false">
            <circle cx="160" cy="160" r="150" stroke="#FFFFFF" strokeOpacity="0.07" />
            <circle cx="160" cy="160" r="118" stroke="#168DA4" strokeOpacity="0.35" />
            <circle cx="160" cy="160" r="84" stroke="#C3A064" strokeOpacity="0.4" strokeDasharray="3 7" />
            <circle className="nf-sonar nf-sonar-a" cx="160" cy="160" r="40" stroke="#C3A064" />
            <circle className="nf-sonar nf-sonar-b" cx="160" cy="160" r="40" stroke="#168DA4" />
            <g className="nf-orbit">
              <circle cx="160" cy="42" r="5" fill="#0A1929" stroke="#C3A064" strokeWidth="1.5" />
              <circle cx="262" cy="219" r="4" fill="#0A1929" stroke="#168DA4" strokeWidth="1.5" />
            </g>
            <text x="160" y="176" textAnchor="middle" className="nf-code">404</text>
          </svg>
        </div>

        <div className="nf-copy">
          <p className="nf-eyebrow">
            <span className="nf-eyebrow-rule" aria-hidden="true" />
            Error 404 · Page not found
          </p>
          <h1 id="nf-title" className="nf-title">This venture is off the map.</h1>
          <p className="nf-lede">
            We couldn&rsquo;t find a page at this address. It may have moved, or the link may be mistyped.
          </p>
          <p className="nf-path">
            <span className="nf-path-label">Requested</span>
            <code>{shownPath}</code>
          </p>

          <div className="nf-actions">
            <button type="button" className="nf-btn nf-btn-primary" onClick={onGoHome}>
              Return to Startup Discovery
            </button>
            {canGoBack && (
              <button type="button" className="nf-btn nf-btn-ghost" onClick={onGoBack}>
                Go back
              </button>
            )}
            {!isSignedIn && (
              <button type="button" className="nf-btn nf-btn-ghost" onClick={onSignIn}>
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default NotFoundPage;
