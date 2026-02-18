// ═══════════════════════════════════════════════════════════════
// server.js — Node.js / Express backend
//
// Responsibilities:
//   • Serves static frontend files (index.html, portal.html, css/, js/)
//   • /api/config → sends Supabase public keys to frontend (from .env)
//   • /api/leads  → fetches Google Sheet CSV, returns clean JSON
//   • /api/health → health check
//
// Setup:
//   1. npm install
//   2. Copy .env.example to .env and fill in all three values
//   3. node server.js          (then open http://localhost:3000)
//
// ⚠ DO NOT open files with VS Code Live Server — that bypasses
//   this backend. Always use: node server.js
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const fetch   = require('node-fetch');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── CSV PARSER ──────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h =>
    h.trim().replace(/^"|"$/g, '').trim()
  );

  return lines.slice(1).map(line => {
    const fields = [];
    let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    fields.push(cur.trim());

    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (fields[i] || '').replace(/^"|"$/g, '').trim();
    });
    return obj;
  }).filter(r => r.full_name || r.phone_number || r.id);
}

// ── ROW NORMALISER ──────────────────────────────────────────────
function normaliseRow(row) {
  const get = (...keys) => {
    for (const k of keys) if (row[k]) return row[k];
    return '';
  };

  let age = get('Age', 'age');
  if (!age && get('date_of_birth')) {
    try {
      const dob = new Date(get('date_of_birth'));
      age = Math.floor((Date.now() - dob) / (365.25 * 24 * 3600 * 1000)).toString();
    } catch {}
  }

  return {
    id:         get('id') || `row-${Math.random().toString(36).slice(2)}`,
    date:       get('Date', 'Formatted Date', 'date'),
    ad_name:    get('ad_name', 'Ad Name', 'adset_name'),
    platform:   get('platform', 'Platform') || 'fb',
    intent:     get('आप_किसके_लिए_जानकारी_ले_रहे_हैं?', 'intent'),
    time_ready: get('क्या_आप_अपने_फूड_बिज़नेस_को_समय_देने_के_लिए_तैयार_हैं?', 'time_ready'),
    full_name:  get('full_name', 'Full Name', 'name'),
    phone:      get('phone_number', 'Phone', 'phone'),
    city:       get('city', 'City', 'Target City'),
    email:      get('email', 'Email'),
    gender:     get('gender', 'Gender'),
    age,
    education:  get('education_level', 'Education', 'education'),
    allocation: get('Lead Allocation', 'lead_allocation', 'allocation') || '—',
  };
}

// ── URL RESOLVER ────────────────────────────────────────────────
function resolveCSVUrl(rawUrl) {
  let url = rawUrl.trim();
  if (!url.includes('docs.google.com/spreadsheets')) return url;
  if (url.includes('/pub?')) {
    url = url.replace(/output=[^&]+/, 'output=csv');
    if (!url.includes('output=csv')) url += '&output=csv';
  } else if (url.includes('/edit')) {
    const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (m) url = `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv`;
  } else if (!url.includes('output=csv') && !url.includes('format=csv')) {
    url += (url.includes('?') ? '&' : '?') + 'output=csv';
  }
  return url;
}

// ── ROUTES ──────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status:   'ok',
    sheet:    !!process.env.GOOGLE_SHEET_URL,
    supabase: !!process.env.SUPABASE_URL,
    time:     new Date().toISOString()
  });
});

// Config — sends Supabase PUBLIC keys to frontend
// The anon key is safe to expose (Supabase designed it this way)
// Google Sheet URL is NOT sent here — it stays server-side only
app.get('/api/config', (req, res) => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || url.includes('REPLACE') || !key || key.includes('REPLACE')) {
    return res.status(503).json({
      error: 'Supabase credentials missing in .env',
      hint:  'Set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file'
    });
  }

  res.json({ supabaseUrl: url, supabaseAnonKey: key });
});

// Leads — fetches Google Sheet CSV server-side, returns JSON
app.get('/api/leads', async (req, res) => {
  const rawUrl = process.env.GOOGLE_SHEET_URL;

  if (!rawUrl || rawUrl.includes('REPLACE')) {
    return res.status(503).json({
      error: 'GOOGLE_SHEET_URL not configured in .env',
      leads: []
    });
  }

  try {
    const csvUrl  = resolveCSVUrl(rawUrl);
    const response = await fetch(csvUrl, {
      headers: { Accept: 'text/csv,text/plain,*/*' },
      timeout: 12000
    });

    if (!response.ok) throw new Error(`Google Sheets returned HTTP ${response.status}`);

    const text  = await response.text();
    const rows  = parseCSV(text);
    const leads = rows.map(normaliseRow).filter(l => l.full_name);

    res.json({ leads, total: leads.length, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[/api/leads]', err.message);
    res.status(500).json({
      error: err.message,
      leads: [],
      hint:  'Make sure your sheet is published: File → Share → Publish to web → CSV'
    });
  }
});

// Catch-all → SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── START ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n  ██████╗███╗   ███╗    ██╗   ██╗██╗   ██╗██╗   ██╗ █████╗ ');
  console.log('  CM Yuva × On2Cook — Lead Qualification Portal');
  console.log(`\n  ✅  Running at  →  http://localhost:${PORT}`);
  console.log(`  📋  Google Sheet →  ${process.env.GOOGLE_SHEET_URL ? '✓ configured' : '✗ MISSING — add GOOGLE_SHEET_URL to .env'}`);
  console.log(`  🗄   Supabase     →  ${process.env.SUPABASE_URL    ? '✓ configured' : '✗ MISSING — add SUPABASE_URL to .env'}`);
  console.log('\n  ⚠  Open http://localhost:3000 — NOT VS Code Live Server\n');
});