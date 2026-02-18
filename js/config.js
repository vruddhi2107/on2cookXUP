// ═══════════════════════════════════════════════════════════════
// config.js — Supabase client + app constants
// Paste your Supabase credentials below (anon key is safe to expose)
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL      = 'https://wwtjhzwzzkwvzjtybygg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3dGpoend6emt3dnpqdHlieWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTQwMzcsImV4cCI6MjA4Njk3MDAzN30.Qy7c5CUil7hSzJv3MVPHghYoeFdDBG_nULqaccFSj5Q'; // ← paste your anon key

// Init Supabase client immediately
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


const SECTIONS = [
  {
    id: 'motivation',
    part: 'Part 1', title: 'Motivation & Intent', duration: '4 min',
    questions: [
      'What made you apply for this program?',
      'Currently working / studying / planning full-time self-employment?',
      'Who will run the business — you or family?'
    ],
    high: 'Clear intent, self-driven, ready to own operations',
    mid:  'Interested but dependent on family decision',
    low:  'Just exploring, no ownership mindset',
    redFlag: '"I applied because someone told me to try"'
  },
  {
    id: 'operations',
    part: 'Part 2', title: 'Food & Operations Readiness', duration: '4 min',
    questions: [
      'Any experience in cooking or food handling?',
      'Where do you plan to operate from? (Home / Shop / Cloud kitchen / TBD)',
      'Comfortable working early mornings / evenings?'
    ],
    high: 'Location clarity + operational comfort',
    mid:  'Open but needs guidance',
    low:  'Avoids operational responsibility',
    redFlag: '"I want income but don\'t want daily involvement"'
  },
  {
    id: 'financial',
    part: 'Part 3', title: 'Financial & Bank Readiness', duration: '5 min',
    questions: [
      'Comfortable applying for bank loan under CM Yuva?',
      'Documents ready — Aadhaar, PAN, address proof?',
      'Can arrange margin money if bank asks (5–10%)?'
    ],
    high: 'Document-ready, bank-open mindset',
    mid:  'Needs family discussion',
    low:  'Loan-averse, expects full grant',
    redFlag: '"I want the machine without the loan process"'
  },
  {
    id: 'mindset',
    part: 'Part 4', title: 'Business Mindset & Scale', duration: '4 min',
    questions: [
      'Income target in the first year?',
      'Open to learning recipes, hygiene, costing, customer handling?',
      'Would grow to catering / multiple outlets if successful?'
    ],
    high: 'Growth-oriented, learning mindset',
    mid:  'Income-focused only',
    low:  'Fixed expectations, resistant to training',
    redFlag: 'Refuses training / unrealistic Month-1 income expectations'
  },
  {
    id: 'fit',
    part: 'Part 5', title: 'Overall Program Fit', duration: '3 min',
    questions: [
      'Does the On2Cook offering match what they are looking for?',
      'Is the decision-maker involved in this call?',
      "Candidate's enthusiasm and engagement level?"
    ],
    high: 'Strong alignment, decision-maker present',
    mid:  'Interested but needs more clarity',
    low:  'Mismatch in expectations',
    redFlag: 'No decision-maker involvement / passive income only'
  }
];

const RED_FLAGS = [
  'Wants passive income only',
  'Refuses training',
  'Avoids bank process entirely',
  'No decision-maker involvement',
  'Unrealistic income expectations in Month 1'
];

function getStatus(total, flagCount) {
  if (flagCount > 0) return { label: 'AUTO-REJECT',  key: 'auto-reject',  color: '#dc2626' };
  if (total >= 20)   return { label: 'FAST-TRACK',   key: 'fast-track',   color: '#16a34a' };
  if (total >= 14)   return { label: 'NURTURE',       key: 'nurture',      color: '#d97706' };
  return               { label: 'NOT SUITABLE', key: 'not-suitable', color: '#dc2626' };
}

function calcTotal(scores) {
  return Object.values(scores).reduce((a, b) => a + Number(b || 0), 0);
}

// ── SUPABASE INIT ────────────────────────────────────────────────
// `db` is declared globally so config.js, db.js, portal.js all share it

// `dbReady` is a Promise — portal.js awaits it before touching db
const dbReady = (async () => {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error(`/api/config returned HTTP ${res.status}`);

    const { supabaseUrl, supabaseAnonKey } = await res.json();
    if (!supabaseUrl || !supabaseAnonKey) throw new Error('Missing keys in /api/config response');

    // `supabase` global comes from the CDN <script> tag in portal.html
    db = supabase.createClient(supabaseUrl, supabaseAnonKey);
    console.log('[config]  Supabase ready');
  } catch (err) {
    console.error('[config]  Supabase init failed:', err.message);
    // db stays null — portal.js bootstrap will catch this and show an error
  }
})();