// ═══════════════════════════════════════════════════════════════
// config.js — Supabase client + app constants
// Paste your Supabase credentials below (anon key is safe to expose)
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL      = 'https://wwtjhzwzzkwvzjtybygg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3dGpoend6emt3dnpqdHlieWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTQwMzcsImV4cCI6MjA4Njk3MDAzN30.Qy7c5CUil7hSzJv3MVPHghYoeFdDBG_nULqaccFSj5Q'; // ← paste your anon key

// Init Supabase client immediately
const { createClient } = supabase;
// Use let so it can be initialized or overwritten if needed
let db = null; 

try {
    db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
    console.error("Supabase init failed", e);
}
const SECTIONS = [
  { id: 'motivation', title: '🧠 Motivation & Ownership' },
  { id: 'ops', title: '🍽️ Food & Ops Readiness' },
  { id: 'finance', title: '💰 Financial Readiness' },
  { id: 'mindset', title: '⚡ Business Mindset' }
];

const RED_FLAGS = [
  'I applied because someone told me to try',
  'Wants income but no daily involvement', 
  'Wants machine without loan process',
  'Fixed expectations, resistant to training'
];

// config.js — fix getStatus
function getStatus(total, flagCount) {
  if (flagCount > 0) return { key: 'auto-reject', label: '🚫 Auto Reject', color: '#dc2626' };
  if (total >= 17)   return { key: 'fast-track',  label: '✅ Fast Track',  color: '#16a34a' };
  if (total >= 12)   return { key: 'nurture',      label: '⏳ Nurture',     color: '#d97706' };
  if (total > 0)     return { key: 'not-suitable', label: '❌ Not Suitable', color: '#dc2626' };
  return               { key: 'Open',          label: 'Open',           color: '#9ca3af' };
}

function calcTotal(scores) {
  const total = SECTIONS.reduce((sum, sec) => sum + (scores[sec.id] || 0), 0);
  console.log('🧮 calcTotal:', scores, '→', total); // DEBUG
  return total;
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