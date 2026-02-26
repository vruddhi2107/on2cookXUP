// ═══════════════════════════════════════════════════════════════
// portal.js — Main portal logic (self-contained Supabase init)
// Depends on: config.js for SECTIONS, RED_FLAGS, getStatus, calcTotal
// ═══════════════════════════════════════════════════════════════

// ── STATE ──────────────────────────────────────────────────────
const State = {
  leads:              [],
  scoredMap:          {},
  currentLeadId:      null,
  currentScores:      {},
  currentFlags:       {},
  currentNotes:       '',
  currentDisposition: null,
  activeTab:          'leads',
};

// ── SUPABASE INIT ──────────────────────────────────────────────
let _db = null;

async function getDB() {
  if (_db) return _db;
  if (typeof db !== 'undefined' && db !== null) { _db = db; return _db; }
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error(`/api/config → HTTP ${res.status}`);
    const { supabaseUrl, supabaseAnonKey } = await res.json();
    _db = supabase.createClient(supabaseUrl, supabaseAnonKey);
    return _db;
  } catch (err) {
    console.error('[portal] DB init failed:', err.message);
    return null;
  }
}

// ── BOOTSTRAP ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setSyncStatus('Connecting...');
  _db = await getDB();

  if (!_db) {
    setSyncStatus('⚠ Connection failed');
    document.getElementById('content-panel').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠</div>
        <div class="empty-title">Could not connect to database</div>
        <div class="empty-sub">
          Ensure <b>SUPABASE_URL</b> and <b>SUPABASE_ANON_KEY</b><br/>
          are set in your Vercel environment variables.
        </div>
      </div>`;
    return;
  }

  setSyncStatus('Loading...');
  await loadScoredFromDB();
  await loadLeads();
  renderLeadGrid();
});

// ── SUPABASE SCORES ────────────────────────────────────────────
async function loadScoredFromDB() {
  const { data, error } = await _db.from('scored_leads').select('*');
  if (error) { console.error('loadScoredFromDB error:', error); return; }
  State.scoredMap = data.reduce((acc, row) => {
    acc[row.lead_id] = row;
    return acc;
  }, {});
}

// ── LEADS (paginated) ──────────────────────────────────────────
async function loadLeads() {
  setSyncStatus('Fetching leads...');
  try {
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;

    while (true) {
      const { data, error } = await _db
        .from('scored_leads')
        .select('*')
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      allData = allData.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    State.leads = allData.map(row => ({ ...row, id: row.lead_id }));
    setSyncStatus(`Synced · ${State.leads.length} leads`);
    populateFilters();

    if (State.activeTab === 'leads') renderLeadGrid();
    else if (State.activeTab === 'dashboard') renderDashboard();
  } catch (err) {
    console.error('loadLeads error:', err);
    setSyncStatus('Error loading leads');
  }
}

// ── FILTERS ────────────────────────────────────────────────────
function populateFilters() {
  const getUnique = (key) =>
    [...new Set(State.leads.map(l => l[key]).filter(Boolean))].sort();

  const citySel   = document.getElementById('filter-city');
  const allocSel  = document.getElementById('filter-alloc');
  const platSel   = document.getElementById('filter-platform');
  const statusSel = document.getElementById('filter-status');

  if (citySel)  citySel.innerHTML  = '<option value="">All Target Cities</option>'
    + getUnique('target_city').map(c => `<option value="${c}">${c}</option>`).join('');
  if (allocSel) allocSel.innerHTML = '<option value="">All Team Members</option>'
    + getUnique('lead_alloc').map(o => `<option value="${o}">${o}</option>`).join('');
  if (platSel)  platSel.innerHTML  = '<option value="">All Platforms</option>'
    + getUnique('platform').map(p => `<option value="${p}">${p}</option>`).join('');

  if (statusSel) {
    const statusOptions = [
      'Open', 'fast-track', 'nurture', 'auto-reject',
      'not-suitable', 'rejected', 'drop', 'info-requested', 'callback','age-disqualified'
    ];
    statusSel.innerHTML = '<option value="">All Status</option>' +
      statusOptions.map(s => `<option value="${s}">${formatStatusLabel(s)}</option>`).join('');
  }
}

function formatStatusLabel(s) {
  const map = {
    'Open':           'Open',
    'fast-track':     'Fast Track',
    'nurture':        'Nurture',
    'auto-reject':    'Auto Reject',
    "age-disqualified": 'Age Disqualified',
    'not-suitable':   'Not Suitable',
    'rejected':       'Rejected',
    'drop':           'Dropped',
    'info-requested': 'Info Requested',
    'callback':       'Call Back',
  };
  return map[s] || s;
}

// ── LEAD GRID ──────────────────────────────────────────────────
function renderLeadGrid() {
  const panel = document.getElementById('content-panel');
  if (!panel || State.activeTab === 'dashboard') return;

  const search  = (document.getElementById('search-input')?.value || '').toLowerCase();
  const cityF   = document.getElementById('filter-city')?.value    || '';
  const allocF  = document.getElementById('filter-alloc')?.value   || '';
  const platF   = document.getElementById('filter-platform')?.value || '';
  const statusF = document.getElementById('filter-status')?.value  || '';

  const filtered = State.leads.filter(l => {
    const matchSearch = !search ||
      (l.full_name    || '').toLowerCase().includes(search) ||
      (l.phone_number || '').includes(search);
    const matchCity   = !cityF  || l.target_city === cityF;
    const matchAlloc  = !allocF || l.lead_alloc  === allocF;
    const matchPlat   = !platF  || l.platform    === platF;
    const leadStatus = (l.status && l.status.trim()) ? l.status.trim() : 'Open';
    const matchStatus = !statusF || leadStatus === statusF;
    return matchSearch && matchCity && matchAlloc && matchPlat && matchStatus;
  });

  const meta = document.getElementById('leads-meta');
  if (meta) meta.textContent = `${filtered.length} leads`;

  panel.innerHTML = `
    <div class="grid-container">
      <table class="portal-table">
        <thead>
          <tr>
            <th>Lead Name</th>
            <th>Target City</th>
            <th>Team Member</th>
            <th>Platform</th>
            <th>Status</th>
            <th>Score</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(l => {
            const leadStatus = l.status || 'Open';
            const total      = l.total  || null;
            const st         = getStatusBadge(leadStatus);
            return `
              <tr>
                <td>
                  <div class="td-name">${l.full_name || '—'}</div>
                  <div class="td-sub">${l.phone_number || '—'}</div>
                </td>
                <td>${l.target_city || '—'}</td>
                <td style="color:var(--red);font-weight:600;">${l.lead_alloc || 'Unassigned'}</td>
                <td><span class="plat-tag">${l.platform || 'FB'}</span></td>
                <td><span class="badge" style="color:${st.color};border-color:${st.color}">${st.label}</span></td>
                <td><b style="font-size:14px;color:${st.color}">${total ?? '—'}</b></td>
                <td><button class="icon-btn" onclick="selectLead('${l.id}')">Open Profile</button></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function getStatusBadge(status) {
  const map = {
    'fast-track':     { label: 'Fast Track',     color: '#16a34a' },
    'nurture':        { label: 'Nurture',         color: '#d97706' },
    'auto-reject':    { label: 'Auto Reject',     color: '#dc2626' },
    'age-disqualified':    { label: 'Age Disqualified',     color: '#e2168a' },
    'not-suitable':   { label: 'Not Suitable',    color: '#dc2626' },
    'rejected':       { label: 'Rejected',        color: '#dc2626' },
    'drop':           { label: 'Dropped',         color: '#6b7280' },
    'info-requested': { label: 'Info Requested',  color: '#7c3aed' },
    'callback':       { label: 'Call Back',       color: '#0ea5e9' },
  };
  return map[status] || { label: 'Open', color: 'var(--text-faint)' };
}

// ── TABS ───────────────────────────────────────────────────────
function switchTab(tab) {
  State.activeTab = tab;
  document.getElementById('tab-leads')?.classList.toggle('active', tab === 'leads');
  document.getElementById('tab-dashboard')?.classList.toggle('active', tab === 'dashboard');
  const filterBar = document.querySelector('.grid-controls');
  if (filterBar) filterBar.style.display = tab === 'dashboard' ? 'none' : 'flex';

  if (tab === 'dashboard') {
    renderDashboard();
  } else {
    if (State.currentLeadId) {
      const lead = State.leads.find(l => l.id === State.currentLeadId);
      const panel = document.getElementById('content-panel');
      panel.innerHTML = buildScoreFormHTML(lead);
      restoreFormState();
      updateSummary();
    } else {
      renderLeadGrid();
    }
  }
}

// ── REFRESH ────────────────────────────────────────────────────
async function refreshAll() {
  await loadScoredFromDB();
  await loadLeads();
}

// ── SELECT LEAD ────────────────────────────────────────────────
function selectLead(id) {
  State.currentLeadId      = id;
  State.currentDisposition = null;
  const lead = State.leads.find(l => l.id === id);
  if (!lead) return;

  const sc = State.scoredMap[id]
          || State.scoredMap[String(id).trim()]
          || State.scoredMap[lead.lead_id];

  State.currentScores = sc ? { ...sc.scores } : {};
  State.currentFlags  = sc ? { ...sc.flags  } : {};
  State.currentNotes  = (sc?.notes) || (lead?.notes) || '';

  if (sc && ['drop','info-requested','callback'].includes(sc.status)) {
    State.currentDisposition = sc.status;
  }

  const panel = document.getElementById('content-panel');
  panel.innerHTML = buildScoreFormHTML(lead);
  restoreFormState();
  updateSummary();
}

// ── SCORE FORM ─────────────────────────────────────────────────
function buildScoreFormHTML(lead) {
  const scripts = {
    motivation: {
      title: '🧠 PART 1: Motivation & Ownership',
      ask:   ['What made you apply?', 'Working, studying, or full-time?', 'Who will run this business? You or Someone else?'],
      flag:  'I applied because someone told me to try'
    },
    ops: {
      title: '🍽️ PART 2: Food & Ops Readiness',
      ask:   ['Experience in cooking/handling?', 'Where will you operate? (house/rental space/owned space)','Past experience of running any business'],
      flag:  'Wants income but no daily involvement'
    },
    finance: {
      title: '💰 PART 3: Financial & Bank Readiness',
      ask:   ['Comfortable with Interest free CM Yuva loan?', 'Aadhaar/PAN ready?', 'Can arrange 5–10% margin?'],
      flag:  'Wants machine without loan process'
    },
    mindset: {
      title: '⚡ PART 4: Business and Learning Mindset',
      ask:   ['Will come for training to the skilling centre', 'Ready to do the paper work with CM Yuva Support', 'Income aim for Year 1?', 'Open to learning hygiene/costing?', 'Interested in scaling up?'],
      flag:  'Fixed expectations, resistant to training'
    }
  };

  const dispConfig = {
    'drop':           { label: '🗑️ Drop',              color: '#6b7280', border: '#374151' },
    'info-requested': { label: '📋 Info Requested',    color: '#7c3aed', border: '#4c1d95' },
    'callback':       { label: '📞 Call Back',         color: '#0ea5e9', border: '#0369a1' },
  };

  const activeDisp = State.currentDisposition;

  return `
  <div class="lead-detail-view">
    <div class="detail-header">
      <div class="header-left">
        <button class="back-btn" onclick="renderLeadGrid()">← Back to Grid</button>
        <h1 class="detail-name">${lead.full_name || '—'} | ${lead.age} | ${lead.gender} | ${lead.education_level}</h1>
        <div class="detail-meta">
          <span>📞 ${lead.phone_number || '—'}</span> |
          <span>📧 ${lead.email || '—'}</span> |
          <span>📍 ${lead.target_city || '—'}</span> |
          <span>👥 ${lead.lead_alloc || 'Unassigned'}</span> |
          <span> Who is this for? ${lead.intent_purpose || 'Unassigned'}</span> |
          <span> Ready to run a food business? ${lead.time_commitment || 'Unassigned'}</span>
        </div>
      </div>
      <div id="score-summary" class="summary-badge" style="display:none;">
        <div id="sum-num">0</div>
        <div id="sum-status">Open</div>
      </div>
    </div>

    <div class="disposition-bar">
      <span class="disp-label">Quick Disposition:</span>
      ${Object.entries(dispConfig).map(([key, cfg]) => `
        <button
          class="disp-btn ${activeDisp === key ? 'active' : ''}"
          id="disp-btn-${key}"
          style="--disp-color:${cfg.color};--disp-border:${cfg.border}"
          onclick="selectDisposition('${key}')">
          ${cfg.label}
        </button>
      `).join('')}
      ${activeDisp ? `<button class="disp-btn disp-clear" onclick="clearDisposition()">✕ Clear</button>` : ''}
    </div>

    <div id="disp-panel" class="disp-panel" style="display:${activeDisp ? 'block' : 'none'}">
      <div class="disp-panel-inner" id="disp-panel-inner"
           style="border-color:${activeDisp ? dispConfig[activeDisp]?.color : '#333'}">
        <div class="disp-panel-title" id="disp-panel-title"
             style="color:${activeDisp ? dispConfig[activeDisp]?.color : '#fff'}">
          ${activeDisp ? dispConfig[activeDisp]?.label : ''} — Add Notes
        </div>
        <textarea
          id="disp-notes"
          class="disp-notes-area"
          placeholder="Notes are required before saving this disposition..."
          oninput="updateDispositionSaveBtn()"
        >${State.currentNotes || ''}</textarea>
        <div id="disp-notes-error" class="disp-notes-error" style="display:none">
          ⚠ Notes are mandatory. Please describe the reason before saving.
        </div>
        <button id="disp-save-btn" class="disp-save-btn" onclick="saveDisposition()">
          Save Disposition →
        </button>
      </div>
    </div>

    <div class="scoring-container">
      <div class="script-column">
        <div class="info-card">
          <h3>🧾 The "Must-Have" Check</h3>
          <p>Residence: Resident of UP (Kanpur, Lucknow, Noida, Ghaziabad, Gorakhpur, Ayodhya, Varanasi)?<br/>
          Age: 21–40 years?<br/>
          Education: 8th pass or above<br/>
          Loan: willingness to take an interest-free bank loan?</p>
        </div>
        ${Object.entries(scripts).map(([, s]) => `
          <div class="script-section">
            <h4>${s.title}</h4>
            <ul>${s.ask.map(q => `<li>${q}</li>`).join('')}</ul>
            <div class="script-flag">🚩 ${s.flag}</div>
          </div>
        `).join('')}
      </div>

      <div class="input-column">
        <div class="scoring-board">
          ${SECTIONS.map(sec => `
            <div class="score-card">
              <div class="card-head">
                <span class="sec-title">${sec.title}</span>
                <span class="sec-val" id="val-${sec.id}">—</span>
              </div>
              <div class="radio-group">
                <label class="radio-face">
                  <input type="radio" name="sec-${sec.id}" value="5" onclick="onScoreChange('${sec.id}', 5)">
                  5 — Strong
                </label>
                <label class="radio-face">
                  <input type="radio" name="sec-${sec.id}" value="3" onclick="onScoreChange('${sec.id}', 3)">
                  3 — Average
                </label>
                <label class="radio-face">
                  <input type="radio" name="sec-${sec.id}" value="1" onclick="onScoreChange('${sec.id}', 1)">
                  1 — Weak
                </label>
              </div>
            </div>
          `).join('')}

          <div class="flags-card">
            <h4>🚩 Mandatory Red Flags (any 1 = auto-reject)</h4>
            <div class="flag-list">
              ${RED_FLAGS.map((f, i) => `
                <label class="flag-pill" id="flag-label-${i}">
                  <input type="checkbox" onchange="onFlagChange(${i}, this.checked)"> ${f}
                </label>
              `).join('')}
            </div>
          </div>

          <div class="notes-card">
            <textarea id="caller-notes" placeholder="Internal notes..." oninput="updateSummary()">${State.currentNotes || ''}</textarea>
          </div>

          <button id="save-btn" class="save-btn disabled" onclick="saveLead()">
            Score all sections to save (0 / ${SECTIONS.length} done)
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

// ── DISPOSITION LOGIC ──────────────────────────────────────────
function selectDisposition(key) {
  State.currentDisposition = key;

  const dispConfig = {
    'drop':           { label: '🗑️ Drop',           color: '#6b7280' },
    'info-requested': { label: '📋 Info Requested', color: '#7c3aed' },
    'callback':       { label: '📞 Call Back',      color: '#0ea5e9' },
  };
  const cfg = dispConfig[key];

  ['drop','info-requested','callback'].forEach(k => {
    document.getElementById(`disp-btn-${k}`)?.classList.toggle('active', k === key);
  });

  if (!document.querySelector('.disp-clear')) {
    const bar = document.querySelector('.disposition-bar');
    const clearBtn = document.createElement('button');
    clearBtn.className = 'disp-btn disp-clear';
    clearBtn.textContent = '✕ Clear';
    clearBtn.onclick = clearDisposition;
    bar.appendChild(clearBtn);
  }

  if (key === 'info-requested') {
    const dispPanel = document.getElementById('disp-panel');
    if (dispPanel) dispPanel.style.display = 'none';

    const existing = document.getElementById('info-req-banner');
    if (!existing) {
      const board = document.querySelector('.scoring-board');
      if (board) {
        const banner = document.createElement('div');
        banner.id = 'info-req-banner';
        banner.className = 'info-req-banner';
        banner.innerHTML = `
          <span style="color:#7c3aed;font-size:13px;">📋</span>
          <span><b style="color:#7c3aed">Info Requested</b> — Score the lead as normal.
          Notes are mandatory. Status will be set from the score once all sections are done.</span>`;
        board.insertBefore(banner, board.firstChild);
      }
    }
    const notesEl = document.getElementById('caller-notes');
    if (notesEl) {
      notesEl.placeholder = 'Required: What information was requested from the lead?';
      notesEl.style.borderColor = '#4c1d95';
    }
    updateSummary();

  } else {
    const existingBanner = document.getElementById('info-req-banner');
    if (existingBanner) existingBanner.remove();

    const dispPanel = document.getElementById('disp-panel');
    const inner     = document.getElementById('disp-panel-inner');
    const title     = document.getElementById('disp-panel-title');
    if (dispPanel) dispPanel.style.display = 'block';
    if (inner)     inner.style.borderColor = cfg.color;
    if (title)     { title.textContent = `${cfg.label} — Add Notes`; title.style.color = cfg.color; }

    const dispNotesEl = document.getElementById('disp-notes');
    if (dispNotesEl) dispNotesEl.value = State.currentNotes || '';

    updateDispositionSaveBtn();
  }
}

function clearDisposition() {
  State.currentDisposition = null;
  ['drop','info-requested','callback'].forEach(k => {
    document.getElementById(`disp-btn-${k}`)?.classList.remove('active');
  });
  document.querySelector('.disp-clear')?.remove();

  const panel = document.getElementById('disp-panel');
  if (panel) panel.style.display = 'none';

  document.getElementById('info-req-banner')?.remove();

  const notesEl = document.getElementById('caller-notes');
  if (notesEl) {
    notesEl.placeholder = 'Internal notes...';
    notesEl.style.borderColor = '';
  }
  updateSummary();
}

function updateDispositionSaveBtn() {
  const btn   = document.getElementById('disp-save-btn');
  const notes = (document.getElementById('disp-notes')?.value || '').trim();
  const errEl = document.getElementById('disp-notes-error');
  if (!btn) return;
  if (notes.length > 0) {
    btn.classList.add('ready');
    btn.textContent = 'Save Disposition →';
    if (errEl) errEl.style.display = 'none';
  } else {
    btn.classList.remove('ready');
    btn.textContent = 'Add notes to save';
  }
}

async function saveDisposition() {
  const disp  = State.currentDisposition;
  const notes = (document.getElementById('disp-notes')?.value || '').trim();
  const errEl = document.getElementById('disp-notes-error');

  if (!notes) {
    if (errEl) errEl.style.display = 'block';
    document.getElementById('disp-notes')?.focus();
    return;
  }

  const lead = State.leads.find(l => l.id === State.currentLeadId);
  if (!lead || !disp) return;

  const payload = {
    lead_id:         lead.lead_id || lead.id,
    full_name:       lead.full_name,
    phone_number:    lead.phone_number,
    city:            lead.city,
    email:           lead.email,
    gender:          lead.gender,
    dob:             lead.dob,
    education_level: lead.education_level,
    age:             lead.age,
    ad_name:         lead.ad_name,
    platform:        lead.platform,
    intent_purpose:  lead.intent_purpose,
    time_commitment: lead.time_commitment,
    target_city:     lead.target_city,
    lead_alloc:      lead.lead_alloc,
    scores:          State.currentScores || {},
    flags:           State.currentFlags  || {},
    notes,
    total:           lead.total || null,
    flag_count:      Object.values(State.currentFlags || {}).filter(Boolean).length,
    status:          disp,
    updated_at:      new Date().toISOString()
  };

  try {
    const { data, error } = await _db
      .from('scored_leads')
      .upsert(payload, { onConflict: 'lead_id' })
      .select();

    if (error) {
      console.error('❌ SUPABASE ERROR:', error);
      showToast('Save failed: ' + error.message, 'error');
    } else {
      State.scoredMap[State.currentLeadId] = payload;
      State.leads = State.leads.map(l =>
        l.id === State.currentLeadId ? { ...l, ...payload } : l
      );
      const labels = { 'drop': 'Dropped', 'info-requested': 'Info Requested', 'callback': 'Call Back' };
      showToast(`✓ Saved: ${labels[disp]}`, 'success');
      renderLeadGrid();
    }
  } catch (err) {
    console.error('💥 CATCH ERROR:', err);
    showToast('Network error: ' + err.message, 'error');
  }
}

// ── RESTORE FORM STATE ─────────────────────────────────────────
function restoreFormState() {
  SECTIONS.forEach(sec => {
    const v = State.currentScores[sec.id];
    if (!v) return;
    const radio = document.querySelector(`input[name="sec-${sec.id}"][value="${v}"]`);
    if (radio) { radio.checked = true; applyRadioStyle(sec.id, v); }
  });
  RED_FLAGS.forEach((_, i) => {
    if (!State.currentFlags[i]) return;
    const label = document.getElementById(`flag-label-${i}`);
    const cb    = label?.querySelector('input[type=checkbox]');
    if (cb) { cb.checked = true; label.classList.add('active'); }
  });

  if (State.currentDisposition) {
    selectDisposition(State.currentDisposition);
  }
}

// ── SCORE CHANGE ───────────────────────────────────────────────
function onScoreChange(secId, val) {
  State.currentScores[secId] = val;
  applyRadioStyle(secId, val);
  updateSummary();
}

function applyRadioStyle(secId, val) {
  const valEl = document.getElementById('val-' + secId);
  if (valEl) {
    valEl.textContent = val + 'pts';
    valEl.style.color = val >= 5 ? '#16a34a' : val === 3 ? '#d97706' : '#dc2626';
  }
  document.querySelectorAll(`input[name="sec-${secId}"]`).forEach(r => {
    const face = r.closest('.radio-face');
    if (!face) return;
    if (r.checked) {
      face.style.background  = 'white';
      face.style.color       = 'black';
      face.style.borderColor = 'white';
    } else {
      face.style.background  = '';
      face.style.color       = '';
      face.style.borderColor = '';
    }
  });
}

// ── FLAG CHANGE ────────────────────────────────────────────────
function onFlagChange(idx, checked) {
  State.currentFlags[idx] = checked;
  document.getElementById(`flag-label-${idx}`)?.classList.toggle('active', checked);
  updateSummary();
}

// ── UPDATE SUMMARY ─────────────────────────────────────────────
function updateSummary() {
  const total     = calcTotal(State.currentScores);
  const flagCount = Object.values(State.currentFlags).filter(Boolean).length;
  const allDone   = SECTIONS.every(s => State.currentScores[s.id]);
  const done      = SECTIONS.filter(s => State.currentScores[s.id]).length;
  const disp      = State.currentDisposition;

  if (total > 0) {
    const st      = getStatus(total, flagCount);
    const summary = document.getElementById('score-summary');
    if (summary) {
      summary.style.display     = 'block';
      summary.style.borderColor = st.color;
      const numEl  = document.getElementById('sum-num');
      const statEl = document.getElementById('sum-status');
      if (numEl)  { numEl.textContent  = total;    numEl.style.color  = st.color; }
      if (statEl) { statEl.textContent = st.label; statEl.style.color = st.color; }
    }
  }

  const saveBtn  = document.getElementById('save-btn');
  if (!saveBtn) return;
  const notesVal = (document.getElementById('caller-notes')?.value || '').trim();

  if (disp === 'info-requested') {
    const notesOk = notesVal.length > 0;
    let notesErrEl = document.getElementById('info-req-notes-error');

    if (allDone && notesOk) {
      saveBtn.className   = 'save-btn ready info-req-ready';
      saveBtn.textContent = 'Save as Info Requested →';
      if (notesErrEl) notesErrEl.style.display = 'none';
    } else if (allDone && !notesOk) {
      saveBtn.className   = 'save-btn disabled';
      saveBtn.textContent = '⚠ Add notes before saving';
      if (!notesErrEl) {
        const notesCard = document.querySelector('.notes-card');
        if (notesCard) {
          notesErrEl = document.createElement('div');
          notesErrEl.id = 'info-req-notes-error';
          notesErrEl.className = 'disp-notes-error';
          notesErrEl.style.margin = '6px 0 0';
          notesErrEl.textContent = '⚠ Notes are mandatory. Describe what information was requested.';
          notesCard.after(notesErrEl);
        }
      } else {
        notesErrEl.style.display = 'block';
      }
    } else {
      saveBtn.className   = 'save-btn disabled';
      saveBtn.textContent = `Score all sections to save (${done} / ${SECTIONS.length} done)`;
      if (notesErrEl) notesErrEl.style.display = 'none';
    }
  } else {
    document.getElementById('info-req-notes-error')?.remove();
    if (allDone) {
      saveBtn.className   = 'save-btn ready';
      saveBtn.textContent = 'Save Qualification Score →';
    } else {
      saveBtn.className   = 'save-btn disabled';
      saveBtn.textContent = `Score all sections to save (${done} / ${SECTIONS.length} done)`;
    }
  }
}

// ── SAVE LEAD (full scoring) ───────────────────────────────────
async function saveLead() {
  const lead = State.leads.find(l => l.id === State.currentLeadId);
  if (!lead) return;

  const total      = calcTotal(State.currentScores);
  const flagCount  = Object.values(State.currentFlags).filter(Boolean).length;
  const statusObj  = getStatus(total, flagCount);
  const notes      = document.getElementById('caller-notes')?.value || '';
  const disp       = State.currentDisposition;

  if (disp === 'info-requested' && !notes.trim()) {
    const notesEl = document.getElementById('caller-notes');
    if (notesEl) { notesEl.focus(); notesEl.style.borderColor = '#7c3aed'; }
    let errEl = document.getElementById('info-req-notes-error');
    if (!errEl) {
      const notesCard = document.querySelector('.notes-card');
      if (notesCard) {
        errEl = document.createElement('div');
        errEl.id = 'info-req-notes-error';
        errEl.className = 'disp-notes-error';
        errEl.style.margin = '6px 0 0';
        errEl.textContent = '⚠ Notes are mandatory. Describe what information was requested.';
        notesCard.after(errEl);
      }
    } else { errEl.style.display = 'block'; }
    return;
  }

  const finalStatus = disp === 'info-requested' ? 'info-requested' : statusObj.key;

  const payload = {
    lead_id:         lead.lead_id || lead.id,
    full_name:       lead.full_name,
    phone_number:    lead.phone_number,
    city:            lead.city,
    email:           lead.email,
    gender:          lead.gender,
    dob:             lead.dob,
    education_level: lead.education_level,
    age:             lead.age,
    ad_name:         lead.ad_name,
    platform:        lead.platform,
    intent_purpose:  lead.intent_purpose,
    time_commitment: lead.time_commitment,
    target_city:     lead.target_city,
    lead_alloc:      lead.lead_alloc,
    scores:          State.currentScores,
    flags:           State.currentFlags,
    notes:           notes,
    total,
    flag_count:      flagCount,
    status:          finalStatus,
    updated_at:      new Date().toISOString()
  };

  try {
    const { data, error } = await _db
      .from('scored_leads')
      .upsert(payload, { onConflict: 'lead_id' })
      .select();

    if (error) {
      console.error('❌ SUPABASE ERROR:', error);
      showToast('Save failed: ' + error.message, 'error');
    } else {
      State.scoredMap[State.currentLeadId] = payload;
      State.leads = State.leads.map(l =>
        l.id === State.currentLeadId ? { ...l, ...payload } : l
      );
      showToast(`✓ Saved: ${payload.total}pts · ${payload.status}`, 'success');
      renderLeadGrid();
    }
  } catch (err) {
    console.error('💥 CATCH ERROR:', err);
    showToast('Network error: ' + err.message, 'error');
  }
}

// ── EDIT FROM DASHBOARD ────────────────────────────────────────
function editFromDash(id) {
  State.activeTab = 'leads';
  document.getElementById('tab-leads')?.classList.add('active');
  document.getElementById('tab-dashboard')?.classList.remove('active');
  const filterBar = document.querySelector('.grid-controls');
  if (filterBar) filterBar.style.display = 'flex';
  selectLead(id);
}

// ── EXCEL IMPORT ───────────────────────────────────────────────
async function handleExcelImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const workbook = XLSX.read(e.target.result, { type: 'binary' });
    const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    if (confirm(`Import ${json.length} leads?`)) await processExcelToSupabase(json);
  };
  reader.readAsBinaryString(file);
}

async function processExcelToSupabase(rows) {
  setSyncStatus('Uploading...');
  const map = new Map();
  rows.forEach(row => {
    const id = String(row.phone_number || row.Phone || row.ID || '').trim();
    if (!id) return;
    map.set(id, {
      lead_id:         id,
      full_name:       row.full_name       || row.Name          || 'Unknown',
      phone_number:    row.phone_number    || row.Phone         || '',
      city:            row.city            || row.City          || '—',
      email:           row.email           || '',
      gender:          row.Lead_Gender     || '',
      dob:             row.date_of_birth   || row.Formatted_Date || '',
      education_level: row.education_level || '',
      age:             row.Age             || '',
      ad_name:         row.ad_name         || '',
      platform:        row.platform        || '',
      intent_purpose:  row['आप_किसके_लिए_जानकारी_ले_रहे_हैं?'] || '',
      time_commitment: row['क्या_आप_अपने_फूड_बिज़नेस_को_समय_देने_के_लिए_तैयार_हैं?'] || '',
      target_city:     row.Target_City     || '',
      lead_alloc:      row.Lead_Allocation || 'Unassigned',
      updated_at:      new Date().toISOString()
    });
  });

  const leads = Array.from(map.values());
  try {
    const { error } = await _db
      .from('scored_leads')
      .upsert(leads, { onConflict: 'lead_id', ignoreDuplicates: true });
    if (error) throw error;
    showToast(`✓ ${leads.length} leads imported`, 'success');
    refreshAll();
  } catch (err) {
    console.error('[Import Error]:', err);
    showToast('Upload error: ' + err.message, 'error');
  }
}

// ── HELPERS ────────────────────────────────────────────────────
function setSyncStatus(msg) {
  const el = document.getElementById('sync-status');
  if (el) el.textContent = msg;
}

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = `toast ${type === 'success' ? 'success' : ''} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}