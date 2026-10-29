import React, { useState } from 'react';
import type {
  FounderStartupProfile,
  InvestmentBlueprint,
  StartupStage,
  SectorType,
  BusinessModelType,
  FundingInstrument,
} from '../../types/arena';
import { calculateFinancialMetrics } from '../../services/arenaFinancials';
import './StartupPitchForm.css';

interface StartupPitchFormProps {
  initialProfile?: Partial<FounderStartupProfile>;
  initialBlueprint?: Partial<InvestmentBlueprint>;
  onSubmit: (profile: FounderStartupProfile, blueprint: InvestmentBlueprint) => void;
  onBack: () => void;
}

export const StartupPitchForm: React.FC<StartupPitchFormProps> = ({
  initialProfile,
  initialBlueprint,
  onSubmit,
  onBack,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Step 1: Startup Profile
  const [name, setName] = useState(initialProfile?.name || 'SODA Pitching Platform');
  const [tagline, setTagline] = useState(initialProfile?.tagline || 'Next-gen algorithmic dealflow platform for fast-growth ventures.');
  const [description, setDescription] = useState(initialProfile?.description || 'Algorithmic matchmaking engine connecting early-stage startups with institutional venture capital.');
  const [sector, setSector] = useState<SectorType>(initialProfile?.sector || 'FinTech');
  const subsector = initialProfile?.subsector || 'Venture Infrastructure';
  const [stage, setStage] = useState<StartupStage>(initialProfile?.stage || 'EARLY_REVENUE');
  const [businessModel, setBusinessModel] = useState<BusinessModelType>(initialProfile?.businessModel || 'Enterprise SaaS');
  const [city, setCity] = useState(initialProfile?.locationCity || 'Bengaluru');

  // Form Step 2: Financial Performance
  const [arrLakhs, setArrLakhs] = useState<number>(initialProfile?.arr ? initialProfile.arr / 100000 : 120);
  const [monthlyRevenueLakhs, setMonthlyRevenueLakhs] = useState<number>(initialProfile?.mrr ? initialProfile.mrr / 100000 : 12);
  const [monthlyBurnLakhs, setMonthlyBurnLakhs] = useState<number>(initialProfile?.monthlyBurn ? initialProfile.monthlyBurn / 100000 : 4);
  const [cashBalanceLakhs, setCashBalanceLakhs] = useState<number>(initialProfile?.availableCash ? initialProfile.availableCash / 100000 : 45);
  const [grossMarginPct, setGrossMarginPct] = useState<number>(initialProfile?.grossMarginPct || 78);
  const [cacInr, setCacInr] = useState<number>(initialProfile?.cac || 2400);
  const [ltvInr, setLtvInr] = useState<number>(initialProfile?.ltv || 14000);
  const [growthRateMOM, setGrowthRateMOM] = useState<number>(initialProfile?.revenueGrowthMoM || 18);

  // Form Step 3: Investment Blueprint
  const [targetRaiseLakhs, setTargetRaiseLakhs] = useState<number>(initialBlueprint?.fundingAsk ? initialBlueprint.fundingAsk / 100000 : 250);
  const [offeredEquityPct, setOfferedEquityPct] = useState<number>(initialBlueprint?.equityOfferedPct || 10);
  const [instrument, setInstrument] = useState<FundingInstrument>(initialBlueprint?.preferredInstrument || 'Equity');
  
  // Allocations (Must sum to 100%)
  const [allocRnd, setAllocRnd] = useState(initialBlueprint?.fundAllocation?.productDevelopment || 40);
  const [allocGtm, setAllocGtm] = useState(initialBlueprint?.fundAllocation?.marketing || 35);
  const [allocTalent, setAllocTalent] = useState(initialBlueprint?.fundAllocation?.hiring || 15);
  const [allocOps, setAllocOps] = useState(initialBlueprint?.fundAllocation?.operations || 10);

  const allocationTotal = allocRnd + allocGtm + allocTalent + allocOps;
  const isAllocationValid = Math.abs(allocationTotal - 100) < 0.1;

  // Build live mock for calculation
  const currentStartupDraft: FounderStartupProfile = {
    name,
    tagline,
    sector,
    subsector,
    stage,
    businessModel,
    locationCity: city,
    locationCountry: 'India',
    website: 'https://sauda.exchange',
    description,
    problem: 'Founders lack institutional transparency on investor matching.',
    solution: 'Deterministic multi-metric compatibility analytics.',
    competitiveAdvantage: 'Direct institutional data mapping.',
    targetMarket: 'Seed to Series A founders across APAC.',
    mrr: monthlyRevenueLakhs * 100000,
    arr: arrLakhs * 100000,
    revenueGrowthMoM: growthRateMOM,
    previousQuarterRevenue: null,
    currentQuarterRevenue: null,
    grossMarginPct,
    monthlyBurn: monthlyBurnLakhs * 100000,
    cashRunwayMonths: null,
    availableCash: cashBalanceLakhs * 100000,
    activeCustomers: 45,
    cac: cacInr,
    ltv: ltvInr,
    priorFundingRaised: 0,
    isPreRevenue: false,
    hasCacLtvCalculated: true,
  };

  const currentBlueprintDraft: InvestmentBlueprint = {
    fundingAsk: targetRaiseLakhs * 100000,
    equityOfferedPct: offeredEquityPct,
    minAcceptableInvestment: (targetRaiseLakhs * 100000) * 0.8,
    preferredInstrument: instrument,
    primaryObjective: 'Scale operations and enterprise go-to-market.',
    strategicPriorities: ['Enterprise Sales & B2B Leads', 'International Expansion', 'Technical & AI Architecture'],
    fundAllocation: {
      productDevelopment: allocRnd,
      marketing: allocGtm,
      hiring: allocTalent,
      operations: allocOps,
      researchAndPatents: 0,
      expansion: 0,
      other: 0,
    },
  };

  const liveCalcs = calculateFinancialMetrics(currentStartupDraft, currentBlueprintDraft);

  const preMoneyCr = liveCalcs.impliedPreMoneyValuation
    ? (liveCalcs.impliedPreMoneyValuation / 10000000).toFixed(2)
    : '0.00';

  const handleFinalSubmit = () => {
    onSubmit(currentStartupDraft, currentBlueprintDraft);
  };

  return (
    <div className="pitch-form-container">
      {/* Top Wizard Steps Bar */}
      <div className="wizard-stepper">
        <button className="stepper-back-btn" onClick={onBack}>
          &larr; BACK
        </button>

        <div className="steps-list">
          <div className={`step-item ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`} onClick={() => setStep(1)}>
            <span className="step-num">01</span>
            <span className="step-lbl">PROFILE</span>
          </div>
          <div className="step-sep" />
          <div className={`step-item ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`} onClick={() => setStep(2)}>
            <span className="step-num">02</span>
            <span className="step-lbl">FINANCIALS</span>
          </div>
          <div className="step-sep" />
          <div className={`step-item ${step === 3 ? 'active' : step > 3 ? 'done' : ''}`} onClick={() => setStep(3)}>
            <span className="step-num">03</span>
            <span className="step-lbl">CAPITAL & ASKS</span>
          </div>
          <div className="step-sep" />
          <div className={`step-item ${step === 4 ? 'active' : ''}`} onClick={() => isAllocationValid && setStep(4)}>
            <span className="step-num">04</span>
            <span className="step-lbl">REVIEW & LAUNCH</span>
          </div>
        </div>

        <div className="valuation-badge">
          <span className="val-lbl">IMPLIED PRE-MONEY</span>
          <span className="val-num">₹{preMoneyCr} CR</span>
        </div>
      </div>

      {/* Main Form Body */}
      <div className="pitch-form-body">
        {/* STEP 1: STARTUP PROFILE */}
        {step === 1 && (
          <div className="step-card">
            <div className="step-heading-group">
              <span className="step-tag">STAGE 01</span>
              <h3 className="step-title">STARTUP IDENTITY & SECTOR</h3>
              <p className="step-desc">Provide verified venture metadata to evaluate against investor thesis.</p>
            </div>

            <div className="form-fields-grid">
              <div className="form-group col-2">
                <label>Company / Brand Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Soda Pitching Platform"
                />
              </div>

              <div className="form-group col-2">
                <label>Tagline / One-Liner</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Algorithmic Dealflow Platform"
                />
              </div>

              <div className="form-group col-4">
                <label>Elevator Pitch / Summary</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A concise, high-impact summary of what your company does"
                />
              </div>

              <div className="form-group col-2">
                <label>Primary Sector</label>
                <select value={sector} onChange={(e) => setSector(e.target.value as SectorType)}>
                  <option value="FinTech">FinTech</option>
                  <option value="SaaS">SaaS</option>
                  <option value="AI & DeepTech">AI & DeepTech</option>
                  <option value="Consumer Products">Consumer Products</option>
                  <option value="HealthTech">HealthTech</option>
                  <option value="ClimateTech">ClimateTech</option>
                  <option value="EdTech">EdTech</option>
                  <option value="E-commerce">E-commerce</option>
                </select>
              </div>

              <div className="form-group col-2">
                <label>Development Stage</label>
                <select value={stage} onChange={(e) => setStage(e.target.value as StartupStage)}>
                  <option value="IDEA">Idea Stage</option>
                  <option value="MVP">MVP (Working Product)</option>
                  <option value="EARLY_REVENUE">Early Revenue (Traction)</option>
                  <option value="GROWTH">Growth (Scaling)</option>
                  <option value="SCALING">Scaling (Market Expansion)</option>
                </select>
              </div>

              <div className="form-group col-2">
                <label>Business Model</label>
                <select value={businessModel} onChange={(e) => setBusinessModel(e.target.value as BusinessModelType)}>
                  <option value="Enterprise SaaS">Enterprise SaaS</option>
                  <option value="B2B">B2B (Direct Sales)</option>
                  <option value="B2C">B2C (Consumer Retail)</option>
                  <option value="B2B2C">B2B2C</option>
                  <option value="D2C">D2C</option>
                  <option value="Marketplace">Marketplace</option>
                </select>
              </div>

              <div className="form-group col-2">
                <label>Headquarters City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bengaluru, Mumbai, Delhi"
                />
              </div>
            </div>

            <div className="form-nav-row">
              <span />
              <button className="wizard-next-btn" onClick={() => setStep(2)}>
                PROCEED TO FINANCIALS &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: FINANCIAL METRICS */}
        {step === 2 && (
          <div className="step-card">
            <div className="step-heading-group">
              <span className="step-tag">STAGE 02</span>
              <h3 className="step-title">FINANCIAL PERFORMANCE & UNIT ECONOMICS</h3>
              <p className="step-desc">All metrics directly feed the deterministic compatibility formulas.</p>
            </div>

            <div className="form-fields-grid">
              <div className="form-group col-2">
                <label>Annual Recurring Revenue (₹ Lakhs)</label>
                <input
                  type="number"
                  value={arrLakhs}
                  onChange={(e) => setArrLakhs(Number(e.target.value))}
                />
                <span className="field-hint">₹{(arrLakhs / 100).toFixed(2)} Cr ARR</span>
              </div>

              <div className="form-group col-2">
                <label>Current Monthly Revenue (₹ Lakhs)</label>
                <input
                  type="number"
                  value={monthlyRevenueLakhs}
                  onChange={(e) => setMonthlyRevenueLakhs(Number(e.target.value))}
                />
              </div>

              <div className="form-group col-2">
                <label>Monthly Net Cash Burn (₹ Lakhs)</label>
                <input
                  type="number"
                  value={monthlyBurnLakhs}
                  onChange={(e) => setMonthlyBurnLakhs(Number(e.target.value))}
                />
              </div>

              <div className="form-group col-2">
                <label>Current Cash in Bank (₹ Lakhs)</label>
                <input
                  type="number"
                  value={cashBalanceLakhs}
                  onChange={(e) => setCashBalanceLakhs(Number(e.target.value))}
                />
                <span className="field-hint">Runway: {liveCalcs.estimatedMonthsRunway ?? 18} months</span>
              </div>

              <div className="form-group col-2">
                <label>Gross Margin (%)</label>
                <input
                  type="number"
                  max="100"
                  min="0"
                  value={grossMarginPct}
                  onChange={(e) => setGrossMarginPct(Number(e.target.value))}
                />
              </div>

              <div className="form-group col-2">
                <label>Month-on-Month Growth (%)</label>
                <input
                  type="number"
                  value={growthRateMOM}
                  onChange={(e) => setGrowthRateMOM(Number(e.target.value))}
                />
              </div>

              <div className="form-group col-2">
                <label>Customer Acquisition Cost (CAC in ₹)</label>
                <input
                  type="number"
                  value={cacInr}
                  onChange={(e) => setCacInr(Number(e.target.value))}
                />
              </div>

              <div className="form-group col-2">
                <label>Customer Lifetime Value (LTV in ₹)</label>
                <input
                  type="number"
                  value={ltvInr}
                  onChange={(e) => setLtvInr(Number(e.target.value))}
                />
                <span className="field-hint">LTV : CAC ratio = {(ltvInr / Math.max(1, cacInr)).toFixed(1)}x</span>
              </div>
            </div>

            <div className="form-nav-row">
              <button className="wizard-back-btn" onClick={() => setStep(1)}>
                &larr; BACK
              </button>
              <button className="wizard-next-btn" onClick={() => setStep(3)}>
                PROCEED TO CAPITAL ASKS &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CAPITAL REQUIREMENTS & ALLOCATION */}
        {step === 3 && (
          <div className="step-card">
            <div className="step-heading-group">
              <span className="step-tag">STAGE 03</span>
              <h3 className="step-title">CAPITAL ASK & USE OF FUNDS</h3>
              <p className="step-desc">Allocation must equal 100% to ensure financial compliance.</p>
            </div>

            <div className="form-fields-grid">
              <div className="form-group col-2">
                <label>Target Funding Ask (₹ Lakhs)</label>
                <input
                  type="number"
                  value={targetRaiseLakhs}
                  onChange={(e) => setTargetRaiseLakhs(Number(e.target.value))}
                />
                <span className="field-hint">₹{(targetRaiseLakhs / 100).toFixed(2)} Cr</span>
              </div>

              <div className="form-group col-2">
                <label>Offered Equity (%)</label>
                <input
                  type="number"
                  step="0.5"
                  max="100"
                  min="0.5"
                  value={offeredEquityPct}
                  onChange={(e) => setOfferedEquityPct(Number(e.target.value))}
                />
              </div>

              <div className="form-group col-4">
                <label>Funding Structure</label>
                <div className="instrument-selector">
                  {(['Equity', 'SAFE', 'Convertible Note', 'Debt'] as const).map((inst) => (
                    <button
                      key={inst}
                      type="button"
                      className={`inst-btn ${instrument === inst ? 'active' : ''}`}
                      onClick={() => setInstrument(inst as FundingInstrument)}
                    >
                      {inst}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Allocation Sliders (Total must sum to 100%) */}
            <div className="allocation-box">
              <div className="allocation-header">
                <span>USE OF FUNDS BREAKDOWN</span>
                <span className={`alloc-badge ${isAllocationValid ? 'valid' : 'invalid'}`}>
                  TOTAL: {allocationTotal}% {isAllocationValid ? '✓ BALANCED' : '⚠ MUST EQUAL 100%'}
                </span>
              </div>

              <div className="alloc-grid">
                <div className="alloc-item">
                  <div className="alloc-lbl-row">
                    <span>Product & R&D</span>
                    <span>{allocRnd}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={allocRnd}
                    onChange={(e) => setAllocRnd(Number(e.target.value))}
                  />
                </div>

                <div className="alloc-item">
                  <div className="alloc-lbl-row">
                    <span>Sales & Marketing</span>
                    <span>{allocGtm}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={allocGtm}
                    onChange={(e) => setAllocGtm(Number(e.target.value))}
                  />
                </div>

                <div className="alloc-item">
                  <div className="alloc-lbl-row">
                    <span>Talent & Team</span>
                    <span>{allocTalent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={allocTalent}
                    onChange={(e) => setAllocTalent(Number(e.target.value))}
                  />
                </div>

                <div className="alloc-item">
                  <div className="alloc-lbl-row">
                    <span>Working Capital / Operations</span>
                    <span>{allocOps}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={allocOps}
                    onChange={(e) => setAllocOps(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="form-nav-row">
              <button className="wizard-back-btn" onClick={() => setStep(2)}>
                &larr; BACK
              </button>
              <button
                className={`wizard-next-btn ${isAllocationValid ? '' : 'disabled'}`}
                disabled={!isAllocationValid}
                onClick={() => setStep(4)}
              >
                REVIEW STARTUP DOSSIER &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW & LAUNCH ARENA */}
        {step === 4 && (
          <div className="step-card">
            <div className="step-heading-group">
              <span className="step-tag">STAGE 04 / DOSSIER AUDIT</span>
              <h3 className="step-title">VERIFY CRITERIA & ENTER ARENA</h3>
              <p className="step-desc">Confirm your investment parameters before initiating head-to-head calculations.</p>
            </div>

            <div className="review-summary-grid">
              <div className="review-block">
                <span className="review-block-title">COMPANY IDENTITY</span>
                <div className="r-item">
                  <span className="r-k">Name:</span>
                  <span className="r-v">{name}</span>
                </div>
                <div className="r-item">
                  <span className="r-k">Sector:</span>
                  <span className="r-v">{sector} ({subsector})</span>
                </div>
                <div className="r-item">
                  <span className="r-k">Stage:</span>
                  <span className="r-v">{stage}</span>
                </div>
                <div className="r-item">
                  <span className="r-k">HQ:</span>
                  <span className="r-v">{city}</span>
                </div>
              </div>

              <div className="review-block">
                <span className="review-block-title">FINANCIAL TRACTION</span>
                <div className="r-item">
                  <span className="r-k">ARR:</span>
                  <span className="r-v">₹{(arrLakhs / 100).toFixed(2)} Cr</span>
                </div>
                <div className="r-item">
                  <span className="r-k">Monthly Revenue:</span>
                  <span className="r-v">₹{monthlyRevenueLakhs} L</span>
                </div>
                <div className="r-item">
                  <span className="r-k">Gross Margin:</span>
                  <span className="r-v">{grossMarginPct}%</span>
                </div>
                <div className="r-item">
                  <span className="r-k">Runway:</span>
                  <span className="r-v">{liveCalcs.estimatedMonthsRunway ?? 18} Months</span>
                </div>
              </div>

              <div className="review-block">
                <span className="review-block-title">ROUND PARAMETERS</span>
                <div className="r-item">
                  <span className="r-k">Capital Asked:</span>
                  <span className="r-v text-cyan">₹{(targetRaiseLakhs / 100).toFixed(2)} Cr</span>
                </div>
                <div className="r-item">
                  <span className="r-k">Equity Offered:</span>
                  <span className="r-v">{offeredEquityPct}%</span>
                </div>
                <div className="r-item">
                  <span className="r-k">Implied Valuation:</span>
                  <span className="r-v">₹{preMoneyCr} Cr Pre-money</span>
                </div>
                <div className="r-item">
                  <span className="r-k">Instrument:</span>
                  <span className="r-v">{instrument}</span>
                </div>
              </div>
            </div>

            <div className="form-nav-row">
              <button className="wizard-back-btn" onClick={() => setStep(3)}>
                &larr; BACK
              </button>
              <button className="launch-arena-btn" onClick={handleFinalSubmit}>
                ENTER CINEMATIC BATTLE ARENA &rarr;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
