import React, { useEffect, useState } from 'react';
import './ProfilePage.css';
import {
  fetchUserProfile,
  updateUserProfile,
  type AuthUser,
  type UserProfile,
} from '../../services/auth.ts';

interface ProfilePageProps {
  currentUser: AuthUser;
  onNavigate: (route: 'discovery' | 'settings') => void;
  onProfileUpdated?: (updated: UserProfile) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  currentUser,
  onNavigate,
  onProfileUpdated,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form edit states
  const [fullName, setFullName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Submission states
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load authoritative profile data on mount
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setLoadError(null);
      const res = await fetchUserProfile(controller.signal);

      if (res.ok) {
        setProfile(res.user);
        setFullName(res.user.fullName || '');
        setPhoneNumber(res.user.phoneNumber || '');
      } else {
        setLoadError(res.message);
      }
      setLoading(false);
    }

    void load();
    return () => controller.abort();
  }, [currentUser.userId]);

  // Validate inputs
  const validateForm = (): boolean => {
    let isValid = true;
    setNameError(null);
    setPhoneError(null);

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setNameError('Full name is required.');
      isValid = false;
    } else if (trimmedName.length > 100) {
      setNameError('Full name must be 100 characters or fewer.');
      isValid = false;
    }

    const trimmedPhone = phoneNumber.trim();
    if (trimmedPhone.length > 0) {
      const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{5,20}$/;
      if (!phoneRegex.test(trimmedPhone) || trimmedPhone.length > 25) {
        setPhoneError('Please enter a valid telephone format (e.g., +91 98765 43210).');
        isValid = false;
      }
    }

    return isValid;
  };

  const hasChanges = Boolean(
    profile &&
      (fullName.trim() !== (profile.fullName || '') ||
        phoneNumber.trim() !== (profile.phoneNumber || '')),
  );

  const handleReset = () => {
    if (!profile) return;
    setFullName(profile.fullName || '');
    setPhoneNumber(profile.phoneNumber || '');
    setNameError(null);
    setPhoneError(null);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(null);
    setSaveError(null);

    if (!validateForm()) return;

    setIsSaving(true);

    try {
      const res = await updateUserProfile({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim() || null,
      });

      if (res.ok) {
        setProfile(res.user);
        setFullName(res.user.fullName);
        setPhoneNumber(res.user.phoneNumber || '');
        setSaveSuccess('Your profile has been updated successfully.');
        if (onProfileUpdated) {
          onProfileUpdated(res.user);
        }
      } else {
        setSaveError(res.message);
      }
    } catch {
      setSaveError('Failed to save profile. Please check your network connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const initial = (fullName || currentUser.fullName || 'U').charAt(0).toUpperCase();
  const primaryRole = profile?.roles?.[0] || currentUser.roles?.[0] || 'VIEWER';

  const formattedDate = profile?.createdAt
    ? new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(profile.createdAt))
    : 'Platform Launch';

  return (
    <div className="profile-page-stage">
      <div className="profile-page-container">
        {/* Navigation Breadcrumb / Return */}
        <div className="profile-header-nav">
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
            className="profile-settings-link-btn"
            onClick={() => onNavigate('settings')}
            aria-label="Go to Account Settings"
          >
            <span>Account Settings</span>
            <span className="fwd-arrow" aria-hidden="true">→</span>
          </button>
        </div>

        {/* Page Title Lockup */}
        <div className="profile-title-lockup">
          <div className="profile-pre-tag">
            <span className="tag-dot" />
            <span>ACCOUNT & IDENTITY</span>
          </div>
          <h1 className="profile-heading">User Profile</h1>
          <p className="profile-subheading">
            Manage your display name, contact information, and verified institutional identity.
          </p>
        </div>

        {loading ? (
          <div className="profile-loading-panel">
            <span className="profile-spinner" />
            <p>Retrieving authenticated account profile...</p>
          </div>
        ) : loadError ? (
          <div className="profile-alert alert-error" role="alert">
            <span className="alert-icon">⚠</span>
            <div className="alert-body">
              <strong>Error Loading Profile</strong>
              <p>{loadError}</p>
            </div>
          </div>
        ) : (
          <div className="profile-content-grid">
            {/* Left Card: Account Identity Card */}
            <aside className="profile-summary-card">
              <div className="summary-avatar-ring">
                <div className="summary-avatar">{initial}</div>
              </div>
              <h2 className="summary-name">{profile?.fullName || currentUser.fullName}</h2>
              <span className="summary-email">{profile?.email || currentUser.email}</span>

              <div className="summary-role-pill">
                <span className="role-indicator" />
                <span>{primaryRole}</span>
              </div>

              <div className="summary-meta-list">
                <div className="summary-meta-item">
                  <span className="meta-label">Account Status</span>
                  <span className="meta-value status-active">
                    <span className="pulse-dot" />
                    {profile?.accountStatus || 'ACTIVE'}
                  </span>
                </div>

                <div className="summary-meta-item">
                  <span className="meta-label">Member Since</span>
                  <span className="meta-value">{formattedDate}</span>
                </div>

                <div className="summary-meta-item">
                  <span className="meta-label">Auth Provider</span>
                  <span className="meta-value">Google Identity Services</span>
                </div>
              </div>

              <div className="summary-footer-note">
                <span>IDENTITY VERIFIED // SHA-256 SESSION</span>
              </div>
            </aside>

            {/* Right Card: Editable Form */}
            <main className="profile-form-card">
              <div className="form-card-header">
                <h2 className="form-card-title">Profile Information</h2>
                <p className="form-card-desc">
                  Update your display name and contact phone number. Read-only fields are locked to
                  preserve institutional governance.
                </p>
              </div>

              {saveSuccess && (
                <div className="profile-alert alert-success" role="status">
                  <span className="alert-icon">✓</span>
                  <div className="alert-body">
                    <strong>Changes Saved</strong>
                    <p>{saveSuccess}</p>
                  </div>
                </div>
              )}

              {saveError && (
                <div className="profile-alert alert-error" role="alert">
                  <span className="alert-icon">⚠</span>
                  <div className="alert-body">
                    <strong>Update Failed</strong>
                    <p>{saveError}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="profile-edit-form">
                {/* 1. Full Name (Editable) */}
                <div className="form-field-group">
                  <label htmlFor="field-full-name" className="field-label">
                    Full Name <span className="required-star">*</span>
                  </label>
                  <input
                    id="field-full-name"
                    type="text"
                    className={`profile-input ${nameError ? 'input-error' : ''}`}
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                    placeholder="Enter your full name"
                    maxLength={100}
                    disabled={isSaving}
                  />
                  {nameError ? (
                    <span className="field-hint error">{nameError}</span>
                  ) : (
                    <span className="field-hint">
                      Your display name as shown across registered deals and venture discoveries.
                    </span>
                  )}
                </div>

                {/* 2. Email Address (Read-Only) */}
                <div className="form-field-group">
                  <div className="field-label-row">
                    <label htmlFor="field-email" className="field-label">
                      Email Address
                    </label>
                    <span className="read-only-badge">🔒 Read-Only</span>
                  </div>
                  <input
                    id="field-email"
                    type="email"
                    className="profile-input read-only"
                    value={profile?.email || currentUser.email}
                    readOnly
                    tabIndex={-1}
                  />
                  <span className="field-hint">
                    Associated with your verified Google account. Cannot be modified.
                  </span>
                </div>

                {/* 3. Phone Number (Editable) */}
                <div className="form-field-group">
                  <label htmlFor="field-phone" className="field-label">
                    Phone Number <span className="optional-tag">(Optional)</span>
                  </label>
                  <input
                    id="field-phone"
                    type="tel"
                    className={`profile-input ${phoneError ? 'input-error' : ''}`}
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      if (phoneError) setPhoneError(null);
                    }}
                    placeholder="+91 98765 43210"
                    maxLength={25}
                    disabled={isSaving}
                  />
                  {phoneError ? (
                    <span className="field-hint error">{phoneError}</span>
                  ) : (
                    <span className="field-hint">
                      Contact number for institutional pitch alerts and direct founder inquiries.
                    </span>
                  )}
                </div>

                {/* 4. Assigned Role (Read-Only) */}
                <div className="form-field-group">
                  <div className="field-label-row">
                    <label className="field-label">Assigned Role</label>
                    <span className="read-only-badge">🔒 System Managed</span>
                  </div>
                  <div className="read-only-box">
                    <span className="box-role-badge">{primaryRole}</span>
                    <span className="box-role-desc">
                      Default discovery role. Elevated roles (FOUNDER, INVESTOR, ADMIN) are
                      assigned via database governance.
                    </span>
                  </div>
                </div>

                {/* 5. Account Status & Creation (Read-Only Grid) */}
                <div className="form-two-col">
                  <div className="form-field-group">
                    <div className="field-label-row">
                      <label className="field-label">Account Status</label>
                      <span className="read-only-badge">🔒 System</span>
                    </div>
                    <div className="read-only-box compact">
                      <span className="status-pill-green">
                        <span className="pulse-dot" />
                        {profile?.accountStatus || 'ACTIVE'}
                      </span>
                    </div>
                  </div>

                  <div className="form-field-group">
                    <div className="field-label-row">
                      <label className="field-label">Registered On</label>
                      <span className="read-only-badge">🔒 System</span>
                    </div>
                    <div className="read-only-box compact">
                      <span className="registered-date">{formattedDate}</span>
                    </div>
                  </div>
                </div>

                {/* Form Action Controls */}
                <div className="form-actions-bar">
                  <button
                    type="button"
                    className="profile-btn-secondary"
                    onClick={handleReset}
                    disabled={!hasChanges || isSaving}
                  >
                    Reset Changes
                  </button>

                  <button
                    type="submit"
                    className="profile-btn-primary"
                    disabled={!hasChanges || isSaving}
                  >
                    {isSaving ? (
                      <>
                        <span className="btn-spinner" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </main>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
