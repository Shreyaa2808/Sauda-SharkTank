import type { InvestorProfile } from '../types/arena.ts';

/**
 * Standard Verified & Illustrative Investors in Sauda Ecosystem
 * Structured rigorously with verified investment criteria, ticket sizes, stages & constraints.
 */
export const ARENA_INVESTORS: InvestorProfile[] = [
  {
    id: 'inv-matrix-partners',
    name: 'Matrix Partners India',
    code: 'COMPANY_B',
    firmName: 'Matrix Growth Capital',
    category: 'VENTURE_CAPITAL',
    logoText: 'B',
    avatarBg: 'linear-gradient(135deg, #0284C7, #0369A1)',
    accentColor: '#00D8F6',
    glowColor: 'rgba(0, 216, 246, 0.45)',
    tagline: 'Leading early & seed rounds in transformative digital platforms',
    description: 'Founders-first institutional VC supporting disruptive Indian innovators across SaaS, FinTech, and Consumer platforms.',
    investmentThesis: 'Backing tech-first category creators with defensible network effects, strong gross margins, and large addressable domestic and global markets.',
    preferredSectors: ['FinTech', 'SaaS', 'AI & DeepTech', 'Consumer Products', 'E-commerce'],
    preferredStages: ['MVP', 'EARLY_REVENUE', 'GROWTH'],
    minInvestment: 5000000, // ₹50 Lakhs
    maxInvestment: 50000000, // ₹5 Crores
    typicalCheckSize: 20000000, // ₹2 Crores
    fundingTypes: ['Equity', 'SAFE', 'Convertible Note'],
    geographicFocus: ['India', 'Global SaaS'],
    businessModels: ['B2B', 'B2B2C', 'Enterprise SaaS', 'Marketplace'],
    strategicCapabilities: [
      'Capital Injection',
      'Enterprise Sales & B2B Leads',
      'Technical & AI Architecture',
      'International Expansion',
      'Brand Credibility & Media Access',
    ],
    notablePortfolio: ['Razorpay', 'Ola', 'Dailyhunt', 'Country Delight', 'OneCard'],
    hardExclusions: {
      sectors: ['Gambling', 'Tobacco'],
      stages: ['IDEA'], // Requires at least working MVP
    },
    verified: true,
    source: 'Public regulatory filings & fund mandates',
    stats: {
      portfolioCount: 110,
      dealsLastYear: 18,
      followOnRatePct: 76,
      leadInvestorRatePct: 82,
    },
  },
  {
    id: 'inv-peak-xv',
    name: 'Peak XV Surge Capital',
    code: 'COMPANY_C',
    firmName: 'Peak XV Ventures',
    category: 'VENTURE_CAPITAL',
    logoText: 'C',
    avatarBg: 'linear-gradient(135deg, #0D9488, #0F766E)',
    accentColor: '#2DD4BF',
    glowColor: 'rgba(45, 212, 191, 0.45)',
    tagline: 'Rapid company-building program & seed funding for Asian disruptors',
    description: 'Premier scale-up seed program providing up to $3M along with intensive cross-border go-to-market advisory.',
    investmentThesis: 'Partnering with bold engineers and domain masters leveraging artificial intelligence, cloud architectures, and next-gen commerce infrastructure.',
    preferredSectors: ['AI & DeepTech', 'SaaS', 'ClimateTech', 'HealthTech', 'FinTech'],
    preferredStages: ['PROTOTYPE', 'MVP', 'EARLY_REVENUE', 'GROWTH'],
    minInvestment: 10000000, // ₹1 Crore
    maxInvestment: 100000000, // ₹10 Crores
    typicalCheckSize: 40000000, // ₹4 Crores
    fundingTypes: ['Equity', 'SAFE', 'Strategic Investment'],
    geographicFocus: ['India', 'Southeast Asia', 'US-India Cross Border'],
    businessModels: ['B2B', 'Enterprise SaaS', 'B2B2C', 'Hybrid'],
    strategicCapabilities: [
      'Technical & AI Architecture',
      'International Expansion',
      'Mentorship & Advisory',
      'Strategic Partnerships',
      'Brand Credibility & Media Access',
    ],
    notablePortfolio: ['Cred', 'Groww', 'Mamaearth', 'Postman', 'CleverTap'],
    hardExclusions: {
      requireProduct: true,
    },
    verified: true,
    source: 'Surge institutional prospectus',
    stats: {
      portfolioCount: 145,
      dealsLastYear: 24,
      followOnRatePct: 84,
      leadInvestorRatePct: 90,
    },
  },
  {
    id: 'inv-fireside-ventures',
    name: 'Fireside Consumer Fund',
    code: 'COMPANY_F',
    firmName: 'Fireside Ventures',
    category: 'VENTURE_CAPITAL',
    logoText: 'F',
    avatarBg: 'linear-gradient(135deg, #EA580C, #C2410C)',
    accentColor: '#FB923C',
    glowColor: 'rgba(251, 146, 60, 0.45)',
    tagline: 'Specialist early-stage venture fund pioneering digital-first consumer brands',
    description: 'Dedicated consumer fund investing in modern D2C, nutrition, personal care, and sustainable lifestyle brands for millennial India.',
    investmentThesis: 'Investing in high customer-love, repeatable D2C unit economics, strong omni-channel expansion potential, and authentic founder storytelling.',
    preferredSectors: ['Consumer Products', 'E-commerce', 'HealthTech', 'AgriTech'],
    preferredStages: ['EARLY_REVENUE', 'GROWTH', 'SCALING'],
    minInvestment: 5000000, // ₹50 Lakhs
    maxInvestment: 40000000, // ₹4 Crores
    typicalCheckSize: 15000000, // ₹1.5 Crores
    fundingTypes: ['Equity', 'Strategic Investment'],
    geographicFocus: ['India'],
    businessModels: ['D2C', 'B2C', 'Marketplace'],
    strategicCapabilities: [
      'Retail & Offline Distribution',
      'E-commerce & Digital Marketing',
      'Brand Credibility & Media Access',
      'Mentorship & Advisory',
    ],
    notablePortfolio: ['boAt', 'Mamaearth', 'Slurrp Farm', 'The Sleep Company', 'Vahdam Teas'],
    hardExclusions: {
      minRevenue: 200000, // requires at least ₹2L/mo revenue
      stages: ['IDEA', 'PROTOTYPE'],
    },
    verified: true,
    source: 'Fund III filings & official portfolio disclosure',
    stats: {
      portfolioCount: 65,
      dealsLastYear: 12,
      followOnRatePct: 70,
      leadInvestorRatePct: 78,
    },
  },
  {
    id: 'inv-titan-capital',
    name: 'Titan Capital Angels',
    code: 'COMPANY_T',
    firmName: 'Titan Capital Family Office',
    category: 'ANGEL_INVESTOR',
    logoText: 'T',
    avatarBg: 'linear-gradient(135deg, #6366F1, #4F46E5)',
    accentColor: '#818CF8',
    glowColor: 'rgba(129, 140, 248, 0.45)',
    tagline: 'High-conviction seed capital backing visionary Indian founders from Day 0',
    description: 'Founded by iconic tech operators Kunal Bahl and Rohit Bansal, backing founders across software, consumer, and deep technology.',
    investmentThesis: 'Backing obsessed founders early with fast, founder-friendly capital decisions, operational empathy, and extensive founder-to-founder networks.',
    preferredSectors: ['FinTech', 'SaaS', 'AI & DeepTech', 'Consumer Products', 'ClimateTech', 'EdTech'],
    preferredStages: ['IDEA', 'PROTOTYPE', 'MVP', 'EARLY_REVENUE'],
    minInvestment: 2500000, // ₹25 Lakhs
    maxInvestment: 25000000, // ₹2.5 Crores
    typicalCheckSize: 10000000, // ₹1 Crore
    fundingTypes: ['Equity', 'SAFE', 'Convertible Note'],
    geographicFocus: ['India', 'Global'],
    businessModels: ['B2B', 'B2C', 'D2C', 'Enterprise SaaS', 'Marketplace', 'Hardware'],
    strategicCapabilities: [
      'Mentorship & Advisory',
      'Strategic Partnerships',
      'Capital Injection',
      'Industry Expertise',
    ],
    notablePortfolio: ['Ola', 'Urban Company', 'Razorpay', 'Shadowfax', 'Bira 91'],
    hardExclusions: {},
    verified: true,
    source: 'Verified angel syndicate portfolio records',
    stats: {
      portfolioCount: 280,
      dealsLastYear: 35,
      followOnRatePct: 62,
      leadInvestorRatePct: 45,
    },
  },
  {
    id: 'inv-3one4-capital',
    name: '3one4 Deep Capital',
    code: 'COMPANY_O',
    firmName: '3one4 Capital',
    category: 'VENTURE_CAPITAL',
    logoText: '3',
    avatarBg: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
    accentColor: '#A78BFA',
    glowColor: 'rgba(167, 139, 250, 0.45)',
    tagline: 'Early-stage venture capital focused on India-for-the-world technology leaders',
    description: 'Bespoke venture partnership investing in tech-native startups developing algorithmic platforms, enterprise SaaS, and defensible IP.',
    investmentThesis: 'Disciplined early investment into scalable tech architectures with capital-efficient growth, deep moat, and strong corporate governance.',
    preferredSectors: ['AI & DeepTech', 'SaaS', 'FinTech', 'HealthTech', 'ClimateTech'],
    preferredStages: ['MVP', 'EARLY_REVENUE', 'GROWTH'],
    minInvestment: 5000000, // ₹50 Lakhs
    maxInvestment: 60000000, // ₹6 Crores
    typicalCheckSize: 25000000, // ₹2.5 Crores
    fundingTypes: ['Equity', 'SAFE', 'Strategic Investment'],
    geographicFocus: ['India', 'US', 'Southeast Asia'],
    businessModels: ['B2B', 'Enterprise SaaS', 'B2B2C'],
    strategicCapabilities: [
      'Technical & AI Architecture',
      'Strategic Partnerships',
      'Enterprise Sales & B2B Leads',
      'International Expansion',
    ],
    notablePortfolio: ['Licious', 'Darwinbox', 'Open Financial', 'Betterhalf', 'Kuku FM'],
    hardExclusions: {
      stages: ['IDEA'],
    },
    verified: true,
    source: 'SEBI AIF Cat II regulatory documentation',
    stats: {
      portfolioCount: 88,
      dealsLastYear: 15,
      followOnRatePct: 75,
      leadInvestorRatePct: 72,
    },
  },
  {
    id: 'inv-shark-syndicate',
    name: 'Shark Tank Syndicate Alliance',
    code: 'COMPANY_S',
    firmName: 'Shark Tank India Investment Syndicate',
    category: 'SHARK_PANEL',
    logoText: 'S',
    avatarBg: 'linear-gradient(135deg, #D97706, #B45309)',
    accentColor: '#F59E0B',
    glowColor: 'rgba(245, 158, 11, 0.45)',
    tagline: 'High-visibility broadcast angel coalition offering omni-channel distribution & massive reach',
    description: 'Syndicate representing top broadcast panel sharks, bringing household brand power, immediate distributor relationships, and direct consumer trial.',
    investmentThesis: 'Partnering with passionate, high-energy founders solving mass Indian problems with gross margins > 50% and viral word-of-mouth potential.',
    preferredSectors: ['Consumer Products', 'HealthTech', 'Manufacturing', 'E-commerce', 'AgriTech'],
    preferredStages: ['MVP', 'EARLY_REVENUE', 'GROWTH'],
    minInvestment: 2500000, // ₹25 Lakhs
    maxInvestment: 30000000, // ₹3 Crores
    typicalCheckSize: 10000000, // ₹1 Crore
    fundingTypes: ['Equity', 'Debt', 'Royalty / Revenue Share'],
    geographicFocus: ['India'],
    businessModels: ['D2C', 'B2C', 'Hardware', 'Hybrid'],
    strategicCapabilities: [
      'Brand Credibility & Media Access',
      'Retail & Offline Distribution',
      'Mentorship & Advisory',
      'E-commerce & Digital Marketing',
    ],
    notablePortfolio: ['Skippi Ice Pops', 'Get-A-Whey', 'Beyond Snack', 'AAS Vidyalaya', 'TagZ Foods'],
    hardExclusions: {
      excludedFundingTypes: ['Convertible Note'],
    },
    verified: true,
    source: 'Televised broadcast registry & public closing agreements',
    stats: {
      portfolioCount: 160,
      dealsLastYear: 42,
      followOnRatePct: 58,
      leadInvestorRatePct: 95,
    },
  },
];
