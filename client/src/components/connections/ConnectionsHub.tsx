import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  ConnectionRequestItem,
  ConversationDetail,
} from '../../types/workspace.ts';
import {
  fetchConnections,
  respondToConnectionRequest,
  endConnection,
  fetchConversation,
  sendChatMessage,
} from '../../services/workspace.ts';
import type { AuthUser } from '../../services/auth.ts';
import './ConnectionsHub.css';

export interface ConnectionsHubProps {
  currentUser: AuthUser | null;
  onNavigateToDiscovery?: () => void;
}

export const ConnectionsHub: React.FC<ConnectionsHubProps> = ({ currentUser, onNavigateToDiscovery }) => {
  const [incoming, setIncoming] = useState<ConnectionRequestItem[]>([]);
  const [sent, setSent] = useState<ConnectionRequestItem[]>([]);
  const [active, setActive] = useState<ConnectionRequestItem[]>([]);
  const [ended, setEnded] = useState<ConnectionRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Tab: 'active' | 'incoming' | 'sent' | 'ended'
  const [currentTab, setCurrentTab] = useState<'active' | 'incoming' | 'sent' | 'ended'>('active');

  // Selected Connection or Conversation
  const [selectedRequest, setSelectedRequest] = useState<ConnectionRequestItem | null>(null);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [convLoading, setConvLoading] = useState<boolean>(false);
  const [convError, setConvError] = useState<string | null>(null);

  // Message Sending
  const [messageInput, setMessageInput] = useState<string>('');
  const [sendSubmitting, setSendSubmitting] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Ending Connection Modal / Confirmation
  const [isEndModalOpen, setIsEndModalOpen] = useState<boolean>(false);
  const [endSubmitting, setEndSubmitting] = useState<boolean>(false);

  // Ref to chat feed for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadConnections = useCallback(async (selectFirstActive: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConnections();
      setIncoming(data.incoming);
      setSent(data.sent);
      setActive(data.active);
      setEnded(data.ended);

      // Auto-select first active or incoming item if none selected
      if (selectFirstActive) {
        if (data.active.length > 0) {
          setCurrentTab('active');
          setSelectedRequest(data.active[0]);
        } else if (data.incoming.length > 0) {
          setCurrentTab('incoming');
          setSelectedRequest(data.incoming[0]);
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

  // Load conversation when selectedRequest has a conversationId
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

    const targetId: number = conversationId;
    let ignore = false;

    async function fetchThread(id: number) {
      try {
        const convData = await fetchConversation(id);
        if (!ignore) {
          setConversation(convData);
          setConvError(null);
        }
      } catch (err: any) {
        if (!ignore) {
          setConvError(err.message || 'Failed to load conversation thread.');
        }
      } finally {
        if (!ignore) {
          setConvLoading(false);
        }
      }
    }

    void fetchThread(targetId);

    return () => {
      ignore = true;
    };
  }, [selectedRequest?.conversationId]);

  // Auto-scroll chat feed to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  const handleSelectRequest = (req: ConnectionRequestItem) => {
    setSelectedRequest(req);
    setSendError(null);
    if (!req.conversationId) {
      setConversation(null);
    }
  };

  const handleRespond = async (action: 'ACCEPT' | 'DECLINE') => {
    if (!selectedRequest) return;
    const res = await respondToConnectionRequest(selectedRequest.requestId, action);
    if (res.ok) {
      await loadConnections(false);
      if (action === 'ACCEPT') {
        setSelectedRequest(res.request);
        setCurrentTab('active');
      } else {
        setSelectedRequest(null);
        setConversation(null);
      }
    } else {
      alert(`Error: ${res.message}`);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversation || !messageInput.trim()) return;

    setSendSubmitting(true);
    setSendError(null);

    const res = await sendChatMessage(conversation.conversationId, messageInput.trim());
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
    if (!selectedRequest) return;

    setEndSubmitting(true);
    const res = await endConnection(selectedRequest.requestId);
    setEndSubmitting(false);
    setIsEndModalOpen(false);

    if (res.ok) {
      setSelectedRequest(res.request);
      if (selectedRequest.conversationId) {
        await loadConversationData(selectedRequest.conversationId);
      }
      await loadConnections(false);
    } else {
      alert(`Failed to end connection: ${res.message}`);
    }
  };

  const getListForCurrentTab = (): ConnectionRequestItem[] => {
    switch (currentTab) {
      case 'active':
        return active;
      case 'incoming':
        return incoming;
      case 'sent':
        return sent;
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

      {/* Two Pane Layout */}
      <div className="connections-stage-grid">
        {/* Left Pane: Requests & Connections List */}
        <div className="connections-sidebar">
          {/* Tabs */}
          <div className="conn-tabs-nav">
            <button
              type="button"
              className={`conn-tab ${currentTab === 'active' ? 'active' : ''}`}
              onClick={() => setCurrentTab('active')}
            >
              Active ({active.length})
            </button>
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
              className={`conn-tab ${currentTab === 'ended' ? 'active' : ''}`}
              onClick={() => setCurrentTab('ended')}
            >
              Archived ({ended.length})
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
                <p>No {currentTab} connections found.</p>
                {currentTab === 'sent' && onNavigateToDiscovery && (
                  <button type="button" className="conn-discover-btn" onClick={onNavigateToDiscovery}>
                    Explore Deals to Connect →
                  </button>
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
                    onClick={() => handleRespond('DECLINE')}
                  >
                    Decline Request
                  </button>
                  <button
                    type="button"
                    className="btn-accept-req"
                    onClick={() => handleRespond('ACCEPT')}
                  >
                    Accept Connection & Open Chat →
                  </button>
                </div>
              ) : (
                <div className="pending-awaiting-bar">
                  ⏳ Awaiting response from {selectedRequest.founderName}. You will be notified once the founder accepts.
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
              {conversation?.conversationStatus === 'READ_ONLY' && (
                <div className="read-only-banner" role="status">
                  🔒 This connection has ended. Message history is preserved in read-only mode.
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
                    <p>No messages yet. Send a greeting to initiate discussion.</p>
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
              {conversation?.conversationStatus === 'OPEN' ? (
                <form onSubmit={handleSendMessage} className="conv-input-form">
                  {sendError && <div className="send-err-msg">⚠️ {sendError}</div>}
                  <div className="input-group">
                    <input
                      type="text"
                      placeholder="Type your message... (Press Enter to send)"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      disabled={sendSubmitting}
                      maxLength={2000}
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
                  Messaging is closed for this connection.
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
