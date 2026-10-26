import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  ConnectionRequestItem,
  ConversationDetail,
} from '../../types/workspace.ts';
import {
  fetchConnections,
  respondToConnectionRequest,
  withdrawConnectionRequest,
  endConnection,
  fetchConversation,
  sendChatMessage,
} from '../../services/workspace.ts';
import type { AuthUser } from '../../services/auth.ts';
import { checkSession } from '../../services/auth.ts';
import './ConnectionsHub.css';

export interface ConnectionsHubProps {
  currentUser: AuthUser | null;
  onNavigateToDiscovery?: () => void;
}

export const ConnectionsHub: React.FC<ConnectionsHubProps> = ({
  currentUser: initialUser,
  onNavigateToDiscovery,
}) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(initialUser);
  const [incoming, setIncoming] = useState<ConnectionRequestItem[]>([]);
  const [sent, setSent] = useState<ConnectionRequestItem[]>([]);
  const [active, setActive] = useState<ConnectionRequestItem[]>([]);
  const [ended, setEnded] = useState<ConnectionRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Tab: 'incoming' | 'sent' | 'active' | 'ended'
  const [currentTab, setCurrentTab] = useState<'incoming' | 'sent' | 'active' | 'ended'>('active');

  // Selected Connection or Conversation
  const [selectedRequest, setSelectedRequest] = useState<ConnectionRequestItem | null>(null);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [convLoading, setConvLoading] = useState<boolean>(false);
  const [convError, setConvError] = useState<string | null>(null);

  // In-flight action states
  const [respondSubmitting, setRespondSubmitting] = useState<boolean>(false);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState<boolean>(false);
  const [messageInput, setMessageInput] = useState<string>('');
  const [sendSubmitting, setSendSubmitting] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Ending Connection Modal / Confirmation
  const [isEndModalOpen, setIsEndModalOpen] = useState<boolean>(false);
  const [endSubmitting, setEndSubmitting] = useState<boolean>(false);

  // Ref to chat feed for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Ensure current user is resolved if not passed down directly
  useEffect(() => {
    if (!currentUser) {
      let isMounted = true;
      void checkSession().then((session) => {
        if (isMounted && session.user) {
          setCurrentUser(session.user);
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [currentUser]);

  const loadConnections = useCallback(async (selectFirstItem: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConnections();
      setIncoming(data.incoming);
      setSent(data.sent);
      setActive(data.active);
      setEnded(data.ended);

      if (selectFirstItem) {
        if (data.active.length > 0) {
          setCurrentTab('active');
          setSelectedRequest(data.active[0]);
        } else if (data.incoming.length > 0) {
          setCurrentTab('incoming');
          setSelectedRequest(data.incoming[0]);
        } else if (data.sent.length > 0) {
          setCurrentTab('sent');
          setSelectedRequest(data.sent[0]);
        } else if (data.ended.length > 0) {
          setCurrentTab('ended');
          setSelectedRequest(data.ended[0]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Sauda connections service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function init() {
      try {
        const data = await fetchConnections();
        if (!ignore) {
          setIncoming(data.incoming);
          setSent(data.sent);
          setActive(data.active);
          setEnded(data.ended);

          if (data.active.length > 0) {
            setCurrentTab('active');
            setSelectedRequest(data.active[0]);
          } else if (data.incoming.length > 0) {
            setCurrentTab('incoming');
            setSelectedRequest(data.incoming[0]);
          } else if (data.sent.length > 0) {
            setCurrentTab('sent');
            setSelectedRequest(data.sent[0]);
          } else if (data.ended.length > 0) {
            setCurrentTab('ended');
            setSelectedRequest(data.ended[0]);
          }
        }
      } catch (err: any) {
        if (!ignore) {
          setError(err.message || 'Failed to connect to Sauda connections service.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void init();

    return () => {
      ignore = true;
    };
  }, []);

  const loadConversationData = useCallback(async (conversationId: number) => {
    setConvLoading(true);
    setConvError(null);
    try {
      const convData = await fetchConversation(conversationId);
      setConversation(convData);
    } catch (err: any) {
      setConvError(err.message || 'Failed to load conversation thread.');
    } finally {
      setConvLoading(false);
    }
  }, []);

  useEffect(() => {
    const conversationId = selectedRequest?.conversationId;
    if (typeof conversationId !== 'number') {
      return;
    }

    const timer = setTimeout(() => {
      void loadConversationData(conversationId);
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedRequest?.conversationId, loadConversationData]);

  // Auto-scroll chat feed to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  const handleSelectRequest = (req: ConnectionRequestItem) => {
    setSelectedRequest(req);
    setSendError(null);
    setActionError(null);
    if (!req.conversationId) {
      setConversation(null);
    }
  };

  const handleRespond = async (action: 'ACCEPT' | 'DECLINE') => {
    if (!selectedRequest || respondSubmitting) return;

    setRespondSubmitting(true);
    setActionError(null);
    const res = await respondToConnectionRequest(selectedRequest.requestId, action);
    setRespondSubmitting(false);

    if (res.ok) {
      await loadConnections(false);
      setSelectedRequest(res.request);
      if (action === 'ACCEPT') {
        setCurrentTab('active');
      }
    } else {
      setActionError(res.message);
    }
  };

  const handleWithdraw = async () => {
    if (!selectedRequest || withdrawSubmitting) return;

    setWithdrawSubmitting(true);
    setActionError(null);
    const res = await withdrawConnectionRequest(selectedRequest.requestId);
    setWithdrawSubmitting(false);

    if (res.ok) {
      await loadConnections(false);
      setSelectedRequest(res.request);
      setCurrentTab('ended');
    } else {
      setActionError(res.message);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = messageInput.trim();
    if (!conversation || !trimmed || sendSubmitting) return;

    setSendSubmitting(true);
    setSendError(null);

    const res = await sendChatMessage(conversation.conversationId, trimmed);
    setSendSubmitting(false);

    if (res.ok) {
      setMessageInput('');
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, res.message],
            }
          : null,
      );
    } else {
      setSendError(res.message);
    }
  };

  const handleEndConnection = async () => {
    if (!selectedRequest || endSubmitting) return;

    setEndSubmitting(true);
    setActionError(null);
    const res = await endConnection(selectedRequest.requestId);
    setEndSubmitting(false);
    setIsEndModalOpen(false);

    if (res.ok) {
      setSelectedRequest(res.request);
      if (res.request.conversationId) {
        await loadConversationData(res.request.conversationId);
      }
      await loadConnections(false);
      setCurrentTab('ended');
    } else {
      setActionError(`Failed to end connection: ${res.message}`);
    }
  };

  const getListForCurrentTab = (): ConnectionRequestItem[] => {
    switch (currentTab) {
      case 'incoming':
        return incoming;
      case 'sent':
        return sent;
      case 'active':
        return active;
      case 'ended':
        return ended;
    }
  };

  const currentList = getListForCurrentTab();

  return (
    <div className="connections-hub-container">
      {onNavigateToDiscovery && (
        <div className="workspace-return-nav" style={{ marginBottom: '16px' }}>
          <button
            type="button"
            className="back-to-discovery-btn"
            onClick={onNavigateToDiscovery}
            aria-label="Return to Startup Discovery"
          >
            <span className="back-arrow" aria-hidden="true">←</span>
            <span>Back to Startup Discovery</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="connections-header">
        <div>
          <div className="connections-crest-label">
            <span className="connections-crest-dot" /> VERIFIED VENTURE CONNECTIONS
          </div>
          <h1 className="connections-title">Connections & Conversations.</h1>
          <p className="connections-subtitle">
            Direct communication hub between verified founders and accredited investors.
          </p>
        </div>
        <button
          type="button"
          className="connections-refresh-btn"
          onClick={() => loadConnections(false)}
          title="Refresh connections"
        >
          ⟳ Refresh
        </button>
      </div>

      {actionError && (
        <div className="connections-alert-banner" role="alert">
          ⚠️ {actionError}
          <button type="button" className="close-alert-btn" onClick={() => setActionError(null)}>
            ✕
          </button>
        </div>
      )}

      {/* Two Pane Layout */}
      <div className="connections-stage-grid">
        {/* Left Pane: Requests & Connections List */}
        <div className="connections-sidebar">
          {/* Tabs */}
          <div className="conn-tabs-nav">
            <button
              type="button"
              className={`conn-tab ${currentTab === 'incoming' ? 'active' : ''}`}
              onClick={() => setCurrentTab('incoming')}
            >
              Incoming ({incoming.length})
            </button>
            <button
              type="button"
              className={`conn-tab ${currentTab === 'sent' ? 'active' : ''}`}
              onClick={() => setCurrentTab('sent')}
            >
              Sent ({sent.length})
            </button>
            <button
              type="button"
              className={`conn-tab ${currentTab === 'active' ? 'active' : ''}`}
              onClick={() => setCurrentTab('active')}
            >
              Accepted ({active.length})
            </button>
            <button
              type="button"
              className={`conn-tab ${currentTab === 'ended' ? 'active' : ''}`}
              onClick={() => setCurrentTab('ended')}
            >
              Ended ({ended.length})
            </button>
          </div>

          {/* List Content */}
          <div className="conn-items-list">
            {loading ? (
              <div className="conn-side-loading">
                <div className="conn-spinner-small" />
                <span>Loading connections...</span>
              </div>
            ) : error ? (
              <div className="conn-side-error">
                <p>⚠️ {error}</p>
                <button type="button" onClick={() => loadConnections(false)}>Retry</button>
              </div>
            ) : currentList.length === 0 ? (
              <div className="conn-side-empty">
                {currentTab === 'incoming' && (
                  <>
                    <p>No incoming connection requests.</p>
                    <span className="empty-sub">When investors propose connections for your ventures, they will appear here.</span>
                  </>
                )}
                {currentTab === 'sent' && (
                  <>
                    <p>No pending sent requests.</p>
                    {onNavigateToDiscovery && (
                      <button type="button" className="conn-discover-btn" onClick={onNavigateToDiscovery}>
                        Explore Deals to Connect →
                      </button>
                    )}
                  </>
                )}
                {currentTab === 'active' && (
                  <>
                    <p>No active connections yet.</p>
                    <span className="empty-sub">Accepted proposals will appear here with private message threads.</span>
                  </>
                )}
                {currentTab === 'ended' && (
                  <>
                    <p>No ended or archived connections.</p>
                    <span className="empty-sub">Completed or declined relationships will be retained here for historical review.</span>
                  </>
                )}
              </div>
            ) : (
              currentList.map((item) => {
                const isSelected = selectedRequest?.requestId === item.requestId;
                const isUserInvestor = currentUser?.userId === item.investorUserId;
                const counterpart = isUserInvestor
                  ? { name: item.founderName, role: 'FOUNDER' }
                  : { name: item.investorName, role: 'INVESTOR' };

                return (
                  <div
                    key={item.requestId}
                    className={`conn-list-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectRequest(item)}
                  >
                    <div className="item-top-row">
                      <span className="item-venture-name">{item.brandName}</span>
                      <span className={`item-status-tag ${item.requestStatus.toLowerCase()}`}>
                        {item.requestStatus}
                      </span>
                    </div>
                    <div className="item-counterpart">
                      <span className="cp-role-chip">{counterpart.role}</span>
                      <span className="cp-name">{counterpart.name}</span>
                    </div>
                    {item.initialMessage && (
                      <p className="item-snippet">{item.initialMessage}</p>
                    )}
                    <span className="item-date">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Conversation or Request Detail */}
        <div className="connections-detail-pane">
          {!selectedRequest ? (
            <div className="pane-unselected-state">
              <div className="unselected-icon">💬</div>
              <h3>Select a connection or request to view.</h3>
              <p>Choose an item from the list on the left to read messages or respond to introduction requests.</p>
            </div>
          ) : selectedRequest.requestStatus === 'PENDING' ? (
            /* PENDING REQUEST VIEW */
            <div className="pending-request-view">
              <div className="pending-req-header">
                <span className="pending-badge">PENDING INTRODUCTION REQUEST</span>
                <h2>{selectedRequest.brandName}</h2>
                <p className="req-sub">
                  Category: {selectedRequest.industryName || 'Venture'} · Initiated on{' '}
                  {new Date(selectedRequest.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="parties-card">
                <div className="party-block">
                  <span className="party-role">Investor Requester</span>
                  <span className="party-name">{selectedRequest.investorName}</span>
                  <span className="party-email">{selectedRequest.investorEmail}</span>
                  {selectedRequest.investorFirmName && (
                    <span className="party-firm">Firm: {selectedRequest.investorFirmName}</span>
                  )}
                </div>
                <div className="party-arrow">→</div>
                <div className="party-block">
                  <span className="party-role">Recipient Founder</span>
                  <span className="party-name">{selectedRequest.founderName}</span>
                  <span className="party-email">{selectedRequest.founderEmail}</span>
                </div>
              </div>

              {selectedRequest.initialMessage && (
                <div className="initial-message-box">
                  <h4>Investor Introduction Proposal</h4>
                  <p>{selectedRequest.initialMessage}</p>
                </div>
              )}

              {/* Action Buttons: Only the recipient founder can accept/decline */}
              {currentUser?.userId === selectedRequest.founderUserId ? (
                <div className="pending-action-bar">
                  <button
                    type="button"
                    className="btn-decline-req"
                    disabled={respondSubmitting}
                    onClick={() => handleRespond('DECLINE')}
                  >
                    {respondSubmitting ? 'Processing...' : 'Decline Request'}
                  </button>
                  <button
                    type="button"
                    className="btn-accept-req"
                    disabled={respondSubmitting}
                    onClick={() => handleRespond('ACCEPT')}
                  >
                    {respondSubmitting ? 'Accepting...' : 'Accept Connection & Open Chat →'}
                  </button>
                </div>
              ) : (
                <div className="pending-awaiting-bar">
                  <div className="awaiting-text">
                    ⏳ <strong>Awaiting Response:</strong> Your proposal was delivered to {selectedRequest.founderName}. You will be notified once the founder accepts or declines.
                  </div>
                  <button
                    type="button"
                    className="btn-withdraw-req"
                    disabled={withdrawSubmitting}
                    onClick={handleWithdraw}
                    title="Withdraw this pending request"
                  >
                    {withdrawSubmitting ? 'Withdrawing...' : 'Withdraw Request'}
                  </button>
                </div>
              )}
            </div>
          ) : selectedRequest.requestStatus === 'DECLINED' && !selectedRequest.conversationId ? (
            /* DECLINED REQUEST VIEW (No Conversation) */
            <div className="archived-request-view">
              <div className="archived-req-header declined">
                <span className="archived-badge declined">REQUEST DECLINED</span>
                <h2>{selectedRequest.brandName}</h2>
                <p className="req-sub">
                  Responded on {selectedRequest.respondedAt ? new Date(selectedRequest.respondedAt).toLocaleDateString() : '—'}
                </p>
              </div>

              <div className="parties-card">
                <div className="party-block">
                  <span className="party-role">Investor Requester</span>
                  <span className="party-name">{selectedRequest.investorName}</span>
                </div>
                <div className="party-arrow">→</div>
                <div className="party-block">
                  <span className="party-role">Founder Recipient</span>
                  <span className="party-name">{selectedRequest.founderName}</span>
                </div>
              </div>

              {selectedRequest.initialMessage && (
                <div className="initial-message-box">
                  <h4>Original Proposal</h4>
                  <p>{selectedRequest.initialMessage}</p>
                </div>
              )}

              {selectedRequest.statusReason && (
                <div className="declined-reason-box">
                  <h4>Reason Provided</h4>
                  <p>{selectedRequest.statusReason}</p>
                </div>
              )}
            </div>
          ) : selectedRequest.requestStatus === 'WITHDRAWN' && !selectedRequest.conversationId ? (
            /* WITHDRAWN REQUEST VIEW (No Conversation) */
            <div className="archived-request-view">
              <div className="archived-req-header withdrawn">
                <span className="archived-badge withdrawn">REQUEST WITHDRAWN</span>
                <h2>{selectedRequest.brandName}</h2>
                <p className="req-sub">
                  Withdrawn on {selectedRequest.createdAt ? new Date(selectedRequest.createdAt).toLocaleDateString() : '—'}
                </p>
              </div>

              <div className="parties-card">
                <div className="party-block">
                  <span className="party-role">Investor Requester</span>
                  <span className="party-name">{selectedRequest.investorName}</span>
                </div>
                <div className="party-arrow">→</div>
                <div className="party-block">
                  <span className="party-role">Founder Recipient</span>
                  <span className="party-name">{selectedRequest.founderName}</span>
                </div>
              </div>

              {selectedRequest.initialMessage && (
                <div className="initial-message-box">
                  <h4>Original Proposal</h4>
                  <p>{selectedRequest.initialMessage}</p>
                </div>
              )}
            </div>
          ) : (
            /* CONVERSATION THREAD VIEW */
            <div className="conversation-thread-view">
              {/* Conversation Topbar */}
              <div className="conv-topbar">
                <div className="conv-headline">
                  <h3>{selectedRequest.brandName}</h3>
                  <span className="conv-counterpart-label">
                    Speaking with{' '}
                    <strong>
                      {currentUser?.userId === selectedRequest.investorUserId
                        ? `${selectedRequest.founderName} (Founder)`
                        : `${selectedRequest.investorName} (Investor)`}
                    </strong>
                  </span>
                </div>

                <div className="conv-topbar-actions">
                  <button
                    type="button"
                    className="conv-refresh-btn"
                    onClick={() => selectedRequest.conversationId && loadConversationData(selectedRequest.conversationId)}
                  >
                    Refresh Chat
                  </button>
                  {selectedRequest.requestStatus === 'ACCEPTED' && (
                    <button
                      type="button"
                      className="conv-end-btn"
                      onClick={() => setIsEndModalOpen(true)}
                    >
                      End Connection
                    </button>
                  )}
                </div>
              </div>

              {/* Closed Connection Banner */}
              {(conversation?.conversationStatus === 'READ_ONLY' || selectedRequest.requestStatus === 'ENDED') && (
                <div className="read-only-banner" role="status">
                  🔒 This connection has ended. Conversation history is read-only.
                </div>
              )}

              {/* Message Feed */}
              <div className="conv-messages-feed">
                {convLoading && !conversation ? (
                  <div className="feed-loading">
                    <div className="conn-spinner-small" />
                    <span>Loading conversation history...</span>
                  </div>
                ) : convError ? (
                  <div className="feed-error">⚠️ {convError}</div>
                ) : conversation?.messages.length === 0 ? (
                  <div className="feed-empty">
                    <div className="feed-empty-icon">🤝</div>
                    <h4>Connection accepted!</h4>
                    <p>Send the first message to start the conversation.</p>
                  </div>
                ) : (
                  conversation?.messages.map((msg) => {
                    const isCurrentUser = msg.senderUserId === currentUser?.userId;
                    return (
                      <div
                        key={msg.messageId}
                        className={`chat-bubble-row ${isCurrentUser ? 'outgoing' : 'incoming'}`}
                      >
                        <div className="chat-bubble">
                          <div className="bubble-sender-meta">
                            <span className="bubble-sender-name">{msg.senderName}</span>
                            <span className="bubble-role-tag">{msg.senderRole}</span>
                          </div>
                          <p className="bubble-text">{msg.messageBody}</p>
                          <span className="bubble-time">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              {conversation?.conversationStatus === 'OPEN' && selectedRequest.requestStatus === 'ACCEPTED' ? (
                <form onSubmit={handleSendMessage} className="conv-input-form">
                  {sendError && <div className="send-err-msg">⚠️ {sendError}</div>}
                  <div className="input-group">
                    <input
                      type="text"
                      placeholder="Type your message... (Press Enter to send)"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      disabled={sendSubmitting}
                      maxLength={5000}
                    />
                    <button
                      type="submit"
                      disabled={sendSubmitting || !messageInput.trim()}
                      className="send-msg-btn"
                    >
                      {sendSubmitting ? '...' : 'Send →'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="conv-input-disabled">
                  🔒 This connection has ended. Conversation history is read-only.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* End Connection Confirmation Modal */}
      {isEndModalOpen && (
        <div className="modal-overlay-danger" onClick={() => !endSubmitting && setIsEndModalOpen(false)}>
          <div className="modal-panel-danger" onClick={(e) => e.stopPropagation()}>
            <h3>End Connection?</h3>
            <p>
              Ending this connection will set the conversation to <strong>read-only</strong>. Both parties will continue to have access to the full message history, but no new messages can be sent.
            </p>
            <div className="modal-danger-actions">
              <button
                type="button"
                className="btn-cancel"
                disabled={endSubmitting}
                onClick={() => setIsEndModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-confirm-end"
                disabled={endSubmitting}
                onClick={handleEndConnection}
              >
                {endSubmitting ? 'Ending...' : 'Yes, End Connection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
