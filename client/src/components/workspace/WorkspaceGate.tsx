import React from 'react';

export type WorkspaceGateKind = 'founder' | 'investor' | 'connections';

interface WorkspaceGateProps {
  kind: WorkspaceGateKind;
  /** True when a server-verified session exists. False renders the sign-in prompt. */
  isSignedIn: boolean;
  onSignIn: () => void;
  onOpenWorkspaces: () => void;
  onReturnToDiscovery: () => void;
}

const GATE_COPY: Record<
  WorkspaceGateKind,
  { eyebrow: string; title: string; body: string; cta: string; signInBody: string }
> = {
  founder: {
    eyebrow: 'FOUNDER WORKSPACE',
    title: 'Founder Access Required',
    body: 'Your account does not yet have Founder workspace permissions. Activate the Founder suite to create and manage your startup listings on Sauda.',
    cta: 'Activate Founder Workspace →',
    signInBody: 'You must be signed in to access the Founder Workspace.',
  },
  investor: {
    eyebrow: 'INVESTOR DEAL ROOM',
    title: 'Investor Access Required',
    body: 'Your account does not yet have Investor workspace permissions. Activate the Investor suite to access the deal room, evaluate ventures, and initiate connections.',
    cta: 'Activate Investor Workspace →',
    signInBody: 'You must be signed in to access the Investor Workspace.',
  },
  connections: {
    eyebrow: 'CONNECTIONS HUB',
    title: 'Workspace Role Required',
    body: 'The Connections Hub is available to Founders and Investors. Activate a workspace role to manage connection requests and conversations.',
    cta: 'Activate a Workspace →',
    signInBody: 'You must be signed in to access the Connections Hub.',
  },
};

/**
 * Access-denied / activation panel shown in place of a workspace when the viewer is
 * signed out or lacks the backend-granted role. Purely presentational: it never grants
 * access. Roles are only ever changed server-side via the activation endpoint.
 */
export const WorkspaceGate: React.FC<WorkspaceGateProps> = ({
  kind,
  isSignedIn,
  onSignIn,
  onOpenWorkspaces,
  onReturnToDiscovery,
}) => {
  const copy = GATE_COPY[kind];

  if (!isSignedIn) {
    return (
      <div className="workspace-gate-page" role="region" aria-label="Sign in required">
        <div className="workspace-gate-inner">
          <div className="gate-eyebrow">
            <span className="gate-dot" />
            {copy.eyebrow}
          </div>
          <h2>Sign In Required</h2>
          <p>{copy.signInBody}</p>
          <button type="button" className="gate-activate-btn" onClick={onSignIn}>
            Sign In →
          </button>
          <button type="button" className="gate-discover-link" onClick={onReturnToDiscovery}>
            ← Continue as guest in Startup Discovery
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-gate-page" role="region" aria-label={copy.title}>
      <div className="workspace-gate-inner">
        <div className="gate-eyebrow">
          <span className="gate-dot" />
          {copy.eyebrow}
        </div>
        <h2>{copy.title}</h2>
        <p>{copy.body}</p>
        <button type="button" className="gate-activate-btn" onClick={onOpenWorkspaces}>
          {copy.cta}
        </button>
        <button type="button" className="gate-discover-link" onClick={onReturnToDiscovery}>
          ← Return to Startup Discovery
        </button>
      </div>
    </div>
  );
};

export default WorkspaceGate;
