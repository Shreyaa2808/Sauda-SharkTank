import React, { useState } from 'react';
import type { InvestorProfile, SectorType } from '../../types/arena';
import { ARENA_INVESTORS } from '../../data/arenaInvestors';
import './InvestorSelector.css';

interface InvestorSelectorProps {
  selectedInvestorA: InvestorProfile | null;
  selectedInvestorB: InvestorProfile | null;
  onSelectA: (inv: InvestorProfile) => void;
  onSelectB: (inv: InvestorProfile) => void;
  onProceed: () => void;
  onBack: () => void;
}

export const InvestorSelector: React.FC<InvestorSelectorProps> = ({
  selectedInvestorA,
  selectedInvestorB,
  onSelectA,
  onSelectB,
  onProceed,
  onBack,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');

  const allSectors = ['ALL', 'FinTech', 'SaaS', 'AI & DeepTech', 'Consumer Products', 'HealthTech', 'ClimateTech', 'EdTech'];

  const filteredInvestors = ARENA_INVESTORS.filter((inv: InvestorProfile) => {
    const matchesSearch =
      inv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.investmentThesis.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.preferredSectors.some((s: SectorType) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSector =
      sectorFilter === 'ALL' || inv.preferredSectors.some((s: SectorType) => s.toLowerCase() === sectorFilter.toLowerCase());

    return matchesSearch && matchesSector;
  });

  const handlePickInvestor = (inv: InvestorProfile) => {
    if (activeSlot === 'A') {
      if (selectedInvestorB?.id === inv.id) {
        return;
      }
      onSelectA(inv);
      if (!selectedInvestorB) {
        setActiveSlot('B');
      }
    } else {
      if (selectedInvestorA?.id === inv.id) {
        return;
      }
      onSelectB(inv);
    }
  };

  const isBothSelected = !!selectedInvestorA && !!selectedInvestorB;

  return (
    <div className="investor-selector-view">
      {/* Top Header */}
      <div className="selector-header">
        <button className="selector-back-btn" onClick={onBack}>
          &larr; BACK
        </button>
        <div className="selector-titles">
          <span className="selector-eyebrow">STAGE 02 / TWO CONTENDERS</span>
          <h2 className="selector-heading">SELECT YOUR OPPOSING INVESTORS</h2>
          <p className="selector-sub">
            Pick exactly two verified venture funds, syndicates, or angels to evaluate head-to-head.
          </p>
        </div>
        <button
          className={`selector-proceed-btn ${isBothSelected ? 'ready' : 'disabled'}`}
          disabled={!isBothSelected}
          onClick={onProceed}
        >
          ENTER PITCH CRITERIA &rarr;
        </button>
      </div>

      {/* Contender Slot Dock (A vs B) */}
      <div className="contender-slots-dock">
        {/* Slot A */}
        <div
          className={`contender-dock-card ${activeSlot === 'A' ? 'active-slot' : ''} ${selectedInvestorA ? 'filled' : 'empty'}`}
          onClick={() => setActiveSlot('A')}
        >
          <div className="dock-card-top">
            <span className="slot-badge badge-a">CONTENDER A</span>
            <span className="slot-instruction">{activeSlot === 'A' ? 'ACTIVE SELECTION' : 'CLICK TO EDIT'}</span>
          </div>

          {selectedInvestorA ? (
            <div className="dock-card-body">
              <div className="dock-logo-box">
                <span>{selectedInvestorA.logoText || selectedInvestorA.name[0]}</span>
              </div>
              <div className="dock-info">
                <h4 className="dock-name">{selectedInvestorA.name}</h4>
                <p className="dock-type">{selectedInvestorA.firmName} • {selectedInvestorA.category.replace('_', ' ')}</p>
                <span className="dock-ticket">
                  Ticket: ₹{(selectedInvestorA.minInvestment / 10000000).toFixed(1)}Cr - ₹{(selectedInvestorA.maxInvestment / 10000000).toFixed(1)}Cr
                </span>
              </div>
            </div>
          ) : (
            <div className="dock-empty-prompt">
              <span className="dock-plus">+</span>
              <span>SELECT CONTENDER A FROM DIRECTORY</span>
            </div>
          )}
        </div>

        {/* Versus Emblem */}
        <div className="versus-emblem">
          <div className="vs-circle">VS</div>
        </div>

        {/* Slot B */}
        <div
          className={`contender-dock-card ${activeSlot === 'B' ? 'active-slot' : ''} ${selectedInvestorB ? 'filled' : 'empty'}`}
          onClick={() => setActiveSlot('B')}
        >
          <div className="dock-card-top">
            <span className="slot-badge badge-b">CONTENDER B</span>
            <span className="slot-instruction">{activeSlot === 'B' ? 'ACTIVE SELECTION' : 'CLICK TO EDIT'}</span>
          </div>

          {selectedInvestorB ? (
            <div className="dock-card-body">
              <div className="dock-logo-box">
                <span>{selectedInvestorB.logoText || selectedInvestorB.name[0]}</span>
              </div>
              <div className="dock-info">
                <h4 className="dock-name">{selectedInvestorB.name}</h4>
                <p className="dock-type">{selectedInvestorB.firmName} • {selectedInvestorB.category.replace('_', ' ')}</p>
                <span className="dock-ticket">
                  Ticket: ₹{(selectedInvestorB.minInvestment / 10000000).toFixed(1)}Cr - ₹{(selectedInvestorB.maxInvestment / 10000000).toFixed(1)}Cr
                </span>
              </div>
            </div>
          ) : (
            <div className="dock-empty-prompt">
              <span className="dock-plus">+</span>
              <span>SELECT CONTENDER B FROM DIRECTORY</span>
            </div>
          )}
        </div>
      </div>

      {/* Directory Search & Filters */}
      <div className="directory-controls">
        <div className="search-input-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" strokeWidth="2" />
          </svg>
          <input
            type="text"
            className="directory-search-input"
            placeholder="Search verified institutional investors, sectors, or criteria..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="sector-filter-pills">
          {allSectors.map((sec) => (
            <button
              key={sec}
              className={`filter-pill ${sectorFilter === sec ? 'active' : ''}`}
              onClick={() => setSectorFilter(sec)}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>

      {/* Investors Directory Grid */}
      <div className="directory-grid">
        {filteredInvestors.map((inv: InvestorProfile) => {
          const isSlotA = selectedInvestorA?.id === inv.id;
          const isSlotB = selectedInvestorB?.id === inv.id;
          const isChosen = isSlotA || isSlotB;

          return (
            <div
              key={inv.id}
              className={`directory-investor-card ${isChosen ? 'is-selected' : ''}`}
              onClick={() => handlePickInvestor(inv)}
            >
              <div className="card-top-row">
                <div className="card-brand">
                  <div className="card-logo">
                    <span>{inv.logoText || inv.name[0]}</span>
                  </div>
                  <div>
                    <h4 className="card-name">{inv.name}</h4>
                    <span className="card-tier">{inv.category.replace('_', ' ')}</span>
                  </div>
                </div>
                {isSlotA && <span className="selection-tag tag-a">ASSIGNED TO A</span>}
                {isSlotB && <span className="selection-tag tag-b">ASSIGNED TO B</span>}
              </div>

              <p className="card-thesis">{inv.investmentThesis}</p>

              <div className="card-meta-chips">
                <div className="card-chip-item">
                  <span className="chip-lbl">TICKET:</span>
                  <span className="chip-val">₹{(inv.minInvestment / 10000000).toFixed(1)}Cr - ₹{(inv.maxInvestment / 10000000).toFixed(1)}Cr</span>
                </div>
                <div className="card-chip-item">
                  <span className="chip-lbl">STAGES:</span>
                  <span className="chip-val">{inv.preferredStages.join(', ')}</span>
                </div>
              </div>

              <div className="card-sectors-list">
                {inv.preferredSectors.map((s: SectorType) => (
                  <span key={s} className="card-sec-chip">{s}</span>
                ))}
              </div>

              <div className="card-footer-action">
                <span className="assign-btn">
                  {isSlotA ? 'Current Contender A' : isSlotB ? 'Current Contender B' : `Assign to Slot ${activeSlot}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
