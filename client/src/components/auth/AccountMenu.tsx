import React, { useEffect, useRef, useState } from 'react';
import './AccountMenu.css';
import type { AuthUser } from '../../services/auth.ts';

interface AccountMenuProps {
  user: AuthUser;
  onNavigate: (route: 'profile' | 'settings' | 'founder' | 'investor' | 'connections' | 'discovery') => void;
  onOpenWorkspaces: () => void;
  onLogout: () => void;
}

export const AccountMenu: React.FC<AccountMenuProps> = ({
  user,
  onNavigate,
  onOpenWorkspaces,
  onLogout,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation & accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
        if (!items || items.length === 0) return;

        const activeIndex = Array.from(items).indexOf(document.activeElement as HTMLButtonElement);
        let nextIndex = 0;

        if (e.key === 'ArrowDown') {
          nextIndex = activeIndex < items.length - 1 ? activeIndex + 1 : 0;
        } else {
          nextIndex = activeIndex > 0 ? activeIndex - 1 : items.length - 1;
        }

        items[nextIndex]?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelectRoute = (
    route: 'profile' | 'settings' | 'founder' | 'investor' | 'connections' | 'discovery',
  ) => {
    setIsOpen(false);
    onNavigate(route);
  };

  const handleSignOutClick = () => {
    setIsOpen(false);
    onLogout();
  };

  const initial = user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U';
  const primaryRole = user.roles && user.roles.length > 0 ? user.roles[0] : 'VIEWER';
  const roleLabel = user.roles && user.roles.length > 0 ? user.roles.join(' · ') : 'VIEWER';
  const hasFounder = user.roles && user.roles.includes('FOUNDER');
  const hasInvestor = user.roles && user.roles.includes('INVESTOR');

  return (
    <div ref={menuRef} className="account-menu-container">
      {/* Account Menu Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id="account-menu-trigger-btn"
        className={`account-menu-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="account-menu-dropdown"
        aria-label={`Account menu for ${user.fullName}`}
      >
        <span className="account-trigger-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="account-trigger-name">{user.fullName}</span>
        <span className="account-trigger-role">{primaryRole}</span>
        <svg
          className={`account-trigger-chevron ${isOpen ? 'rotate' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
          width="10"
          height="10"
          aria-hidden="true"
        >
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div
          id="account-menu-dropdown"
          className="account-menu-dropdown"
          role="menu"
          aria-labelledby="account-menu-trigger-btn"
        >
          {/* User Identity Header Card */}
          <div className="account-dropdown-header">
            <div className="dropdown-user-avatar" aria-hidden="true">
              {initial}
            </div>
            <div className="dropdown-user-info">
              <span className="dropdown-user-name">{user.fullName}</span>
              <span className="dropdown-user-email">{user.email}</span>
              <div className="dropdown-role-pill">
                <span className="role-dot" />
                <span>{roleLabel}</span>
              </div>
            </div>
          </div>

          <div className="account-dropdown-divider" role="separator" />

          {/* Navigation Actions */}
          <div className="account-dropdown-items">
            {/* Workspace Chooser Trigger */}
            <button
              type="button"
              role="menuitem"
              className="account-menu-item"
              onClick={() => {
                setIsOpen(false);
                onOpenWorkspaces();
              }}
            >
              <div className="menu-item-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                  <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                  <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                  <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                  <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </div>
              <div className="menu-item-labels">
                <span className="menu-item-title">Workspaces</span>
                <span className="menu-item-sub">Switch or activate suites</span>
              </div>
            </button>

            {/* Direct Suite Shortcuts when authorized */}
            {hasFounder && (
              <button
                type="button"
                role="menuitem"
                className="account-menu-item"
                onClick={() => handleSelectRoute('founder')}
              >
                <div className="menu-item-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                    <path d="M2 14H14M8 2L13 8H3L8 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="menu-item-labels">
                  <span className="menu-item-title">Founder Suite</span>
                  <span className="menu-item-sub">Manage your venture listings</span>
                </div>
              </button>
            )}

            {hasInvestor && (
              <button
                type="button"
                role="menuitem"
                className="account-menu-item"
                onClick={() => handleSelectRoute('investor')}
              >
                <div className="menu-item-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                    <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M4.5 9.5L7 7L9 9L11.5 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="menu-item-labels">
                  <span className="menu-item-title">Deal Room</span>
                  <span className="menu-item-sub">Investor deal room & watchlist</span>
                </div>
              </button>
            )}

            {(hasFounder || hasInvestor) && (
              <button
                type="button"
                role="menuitem"
                className="account-menu-item"
                onClick={() => handleSelectRoute('connections')}
              >
                <div className="menu-item-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                    <path d="M2.5 3.5C2.5 2.67 3.17 2 4 2H12C12.83 2 13.5 2.67 13.5 3.5V10.5C13.5 11.33 12.83 12 12 12H9L6 14.5V12H4C3.17 12 2.5 11.33 2.5 10.5V3.5Z" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                </div>
                <div className="menu-item-labels">
                  <span className="menu-item-title">Connections Hub</span>
                  <span className="menu-item-sub">Messages & direct inquiries</span>
                </div>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              className="account-menu-item"
              onClick={() => handleSelectRoute('profile')}
            >
              <div className="menu-item-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                  <path
                    d="M8 8C9.65685 8 11 6.65685 11 5C11 3.34315 9.65685 2 8 2C6.34315 2 5 3.34315 5 5C5 6.65685 6.34315 8 8 8Z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                  <path
                    d="M2.5 13.5C2.5 11 5 10 8 10C11 10 13.5 11 13.5 13.5"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="menu-item-labels">
                <span className="menu-item-title">Profile</span>
                <span className="menu-item-sub">View & update account details</span>
              </div>
            </button>

            <button
              type="button"
              role="menuitem"
              className="account-menu-item"
              onClick={() => handleSelectRoute('settings')}
            >
              <div className="menu-item-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                  <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
                  <path
                    d="M8 1.5V3M8 13V14.5M14.5 8H13M3 8H1.5M12.6 3.4L11.5 4.5M4.5 11.5L3.4 12.6M12.6 12.6L11.5 11.5M4.5 4.5L3.4 3.4"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="menu-item-labels">
                <span className="menu-item-title">Account Settings</span>
                <span className="menu-item-sub">Security & session protocols</span>
              </div>
            </button>
          </div>

          <div className="account-dropdown-divider" role="separator" />

          {/* Sign Out Action */}
          <div className="account-dropdown-footer">
            <button
              type="button"
              role="menuitem"
              className="account-menu-item signout"
              onClick={handleSignOutClick}
            >
              <div className="menu-item-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                  <path
                    d="M6 2H3C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H6"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M10.5 11L13.5 8L10.5 5"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M13.5 8H6"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="menu-item-labels">
                <span className="menu-item-title">Sign Out</span>
                <span className="menu-item-sub">End current active session</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
