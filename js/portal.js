// ═══════════════════════════════════════════════════════════════
// portal.js — Main portal logic
// Depends on: config.js (db, SECTIONS, RED_FLAGS, getStatus, calcTotal)
//             db.js     (DB object)
//
// ⚠ MUST be served via  node server.js  →  http://localhost:3000
//   Opening with VS Code Live Server (port 5500) will BREAK /api/leads
// ═══════════════════════════════════════════════════════════════

// ── STATE ──────────────────────────────────────────────────────
const State = {
  leads:         [],
  scoredMap:     {},
  currentLeadId: null,
  currentScores: {},
  currentFlags:  {},
  currentNotes:  '',
  activeTab:     'leads',
  saving:        false,
};

// ── BOOTSTRAP ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setSyncStatus('Loading scores...');

  // 1. Load existing scores from Supabase (db is ready — config.js init'd it)
  await loadScoredFromDB();

  // 2. Load leads from backend proxy (/api/leads → Google Sheet)
  await loadLeads();

  renderLeadList();
  renderContentPanel('empty');
});

// ── SUPABASE SCORES ────────────────────────────────────────────
async function loadScoredFromDB() {
  const { data, error } = await db.from('scored_leads').select('*');
  if (error) {
    console.error("Error fetching scores:", error);
    return;
  }
  // Map lead_id to the full row object so dashboard can see scores, flags, and status
  State.scoredMap = data.reduce((acc, row) => {
    acc[row.lead_id] = row;
    return acc;
  }, {});
}

// ── LEADS FROM BACKEND ──────────────────────────────────────────
// 1. Update loadLeads to handle City filters dynamically
// ── REPLACEMENT FOR loadLeads & FILTERS ───────────────────────
async function loadLeads() {
  setSyncStatus('Fetching leads...');
  try {
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await db
        .from('scored_leads')
        .select('*')
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;

      allData = allData.concat(data);

      // If we got fewer rows than PAGE_SIZE, we've hit the end
      if (data.length < PAGE_SIZE) {
        keepFetching = false;
      } else {
        from += PAGE_SIZE;
      }
    }

    State.leads = allData.map(row => ({ ...row, id: row.lead_id }));

    setSyncStatus(`Synced · ${State.leads.length} leads`);
    populateFilters();

    if (State.activeTab === 'leads') {
      renderLeadGrid();
    } else if (State.activeTab === 'dashboard') {
      renderDashboard();
    }
  } catch (err) {
    console.error('loadLeads error:', err);
    setSyncStatus('Error loading leads');
  }
}

// ── UPDATED FILTER POPULATION ──────────────────────────────────
function populateFilters() {
  // Use target_city as the primary geographic key
  const getUnique = (key) => [...new Set(State.leads.map(l => l[key]).filter(Boolean))].sort();

  const citySel = document.getElementById('filter-city');
  const allocSel = document.getElementById('filter-alloc');
  const platSel = document.getElementById('filter-platform');

  if (citySel) citySel.innerHTML = '<option value="">All Target Cities</option>' + 
    getUnique('target_city').map(c => `<option value="${c}">${c}</option>`).join('');
  
  if (allocSel) allocSel.innerHTML = '<option value="">All Team Members</option>' + 
    getUnique('lead_alloc').map(o => `<option value="${o}">${o}</option>`).join('');

  if (platSel) platSel.innerHTML = '<option value="">All Platforms</option>' + 
    getUnique('platform').map(p => `<option value="${p}">${p}</option>`).join('');
}

// ── UPDATED GRID RENDERING ─────────────────────────────────────
function renderLeadGrid() {
  const panel = document.getElementById('content-panel');
  if (!panel || State.activeTab === 'dashboard') return;

  const search = (document.getElementById('search-input')?.value || '').toLowerCase();
  const cityF  = document.getElementById('filter-city')?.value || '';
  const allocF = document.getElementById('filter-alloc')?.value || '';
  const platF  = document.getElementById('filter-platform')?.value || '';

  const filtered = State.leads.filter(l => {
    const matchSearch = !search || 
                        l.full_name.toLowerCase().includes(search) || 
                        l.phone_number.includes(search);
    // Updated to match target_city and lead_alloc keys
    const matchCity = !cityF || l.target_city === cityF;
    const matchAlloc = !allocF || l.lead_alloc === allocF;
    const matchPlat = !platF || l.platform === platF;
    return matchSearch && matchCity && matchAlloc && matchPlat;
  });

  const meta = document.getElementById('leads-meta');
  if (meta) meta.textContent = `${filtered.length} Leads found`;

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
            const sc = State.scoredMap[l.id];
            const st = sc ? getStatus(sc.total, sc.flag_count) : { label: 'PENDING', color: 'var(--text-faint)' };
            return `
              <tr>
                <td>
                  <div class="td-name">${l.full_name}</div>
                  <div class="td-sub">${l.phone_number}</div>
                </td>
                <td>${l.target_city || '—'}</td>
                <td style="color:var(--red); font-weight:600;">${l.lead_alloc || 'Unassigned'}</td>
                <td><span class="plat-tag">${l.platform || 'FB'}</span></td>
                <td><span class="badge" style="color:${st.color}; border-color:${st.color}">${st.label}</span></td>
                <td><b style="font-size:14px; color:${st.color}">${sc?.total || '—'}</b></td>
                <td><button class="icon-btn" onclick="selectLead('${l.id}')">Open Profile</button></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderLeadGrid() {
  const panel = document.getElementById('content-panel');
  if (!panel || State.activeTab === 'dashboard') return;

  // Use optional chaining (?.) and fallback to empty string if element is missing
  const search = (document.getElementById('search-input')?.value || '').toLowerCase();
  const cityF  = document.getElementById('filter-city')?.value || '';
  const allocF = document.getElementById('filter-alloc')?.value || '';
  const platF  = document.getElementById('filter-platform')?.value || ''; // This was likely the culprit

  const filtered = State.leads.filter(l => {
    const sc = State.scoredMap[l.id];
    const matchSearch = !search || 
                        l.full_name.toLowerCase().includes(search) || 
                        l.phone_number.includes(search);
    const matchCity = !cityF || l.city === cityF;
    const matchAlloc = !allocF || l.lead_alloc === allocF;
    const matchPlat = !platF || l.platform === platF;
    return matchSearch && matchCity && matchAlloc && matchPlat;
  });

  // Update Metadata count
  const meta = document.getElementById('leads-meta');
  if (meta) meta.textContent = `${filtered.length} Leads found`;

  panel.innerHTML = `
    <div class="grid-container">
      <table class="portal-table">
        <thead>
          <tr>
            <th>Lead Name</th>
            <th>Location</th>
            <th>Team Member</th>
            <th>Platform</th>
            <th>Status</th>
            <th>Score</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(l => {
            const sc = State.scoredMap[l.id];
            const st = sc ? getStatus(sc.total, sc.flag_count) : { label: 'PENDING', color: 'var(--text-faint)' };
            return `
              <tr>
                <td>
                  <div class="td-name">${l.full_name}</div>
                  <div class="td-sub">${l.phone_number}</div>
                </td>
                <td>${l.city || '—'}</td>
                <td style="color:var(--red); font-weight:600;">${l.lead_alloc || 'Unassigned'}</td>
                <td><span class="plat-tag">${l.platform || 'FB'}</span></td>
                <td><span class="badge" style="color:${st.color}; border-color:${st.color}">${st.label}</span></td>
                <td><b style="font-size:14px; color:${st.color}">${sc?.total || '—'}</b></td>
                <td><button class="icon-btn" onclick="selectLead('${l.id}')">Open Profile</button></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}// ── ERROR BANNER ────────────────────────────────────────────────
function showBanner(title, body) {
  const panel = document.getElementById('content-panel');
  panel.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                min-height:100%;padding:48px;text-align:center;">
      <div style="background:#0d0000;border:1px solid #dc2626;border-top:3px solid #dc2626;
                  padding:32px;max-width:560px;width:100%;">
        <div style="font-size:28px;margin-bottom:16px;">⚠</div>
        <div style="font-size:14px;color:#dc2626;font-weight:500;margin-bottom:12px;">${title}</div>
        <div style="font-size:11px;color:#b0b0b0;line-height:1.8;">${body}</div>
        <div style="margin-top:24px;padding:12px;background:#060000;border:1px solid #1a0000;
                    font-size:11px;color:#787878;text-align:left;">
          <div style="color:#555;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">Steps</div>
          <div style="margin-bottom:4px;">1. Close this Live Server tab</div>
          <div style="margin-bottom:4px;">2. Open terminal in your project folder</div>
          <div style="margin-bottom:4px;">3. Run: <code style="background:#111;padding:1px 6px;color:#dc2626;">node server.js</code></div>
          <div>4. Open: <code style="background:#111;padding:1px 6px;color:#16a34a;">http://localhost:3000</code></div>
        </div>
      </div>
    </div>`;
}

// ── REFRESH ────────────────────────────────────────────────────
async function refreshAll() {
  await loadScoredFromDB();
  await loadLeads();
  renderLeadList();
}

// ── TABS ───────────────────────────────────────────────────────
function switchTab(tab) {
  State.activeTab = tab;
  
  // 1. Update Tab Button Styles
  const tabLeads = document.getElementById('tab-leads');
  const tabDash = document.getElementById('tab-dashboard');
  
  if (tabLeads) tabLeads.classList.toggle('active', tab === 'leads');
  if (tabDash) tabDash.classList.toggle('active', tab === 'dashboard');

  // 2. Toggle the Filter Bar
  const filterBar = document.querySelector('.grid-controls');
  if (filterBar) {
    filterBar.style.display = tab === 'dashboard' ? 'none' : 'flex';
  }

  // 3. Execution
  if (tab === 'dashboard') {
    // This calls the function directly from dashboard.js
    renderDashboard(State); 
  } else {
    // If there is a current lead, show the score form, otherwise show the grid
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

// ── FILTER POPULATION ──────────────────────────────────────────
function populateAllocFilter() {
  const officers = [...new Set(State.leads.map(l => l.allocation).filter(a => a && a !== '—'))].sort();
  const sel = document.getElementById('filter-alloc');
  if (!sel) return;
  sel.innerHTML = '<option value="">Team Members</option>' +
    officers.map(o => `<option value="${o}">${o}</option>`).join('');
}

// ── LEAD LIST ──────────────────────────────────────────────────
function renderLeadList() {
  const search  = (document.getElementById('search-input')?.value || '').toLowerCase();
  const statusF = document.getElementById('filter-status')?.value || '';
  const allocF  = document.getElementById('filter-alloc')?.value  || '';

  const filtered = State.leads.filter(l => {
    const sc = State.scoredMap[l.id];
    const st = sc ? getStatus(sc.total, sc.flag_count) : null;
    const matchSearch = !search ||
      l.full_name.toLowerCase().includes(search) ||
      (l.city  || '').toLowerCase().includes(search) ||
      (l.phone || '').includes(search);
    const matchStatus = !statusF || (statusF === 'pending' ? !sc : st?.key === statusF);
    const matchAlloc  = !allocF  || l.allocation === allocF;
    return matchSearch && matchStatus && matchAlloc;
  });

  const metaEl = document.getElementById('leads-meta');
  if (metaEl) metaEl.textContent = `${filtered.length} of ${State.leads.length} leads`;

  const list = document.getElementById('lead-list');
  if (!list) return;

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty-state" style="min-height:180px;">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">${State.leads.length === 0 ? 'No leads loaded' : 'No leads match'}</div>
        <div class="empty-sub">${State.leads.length === 0 ? 'Run node server.js and open http://localhost:3000' : 'Clear search or filters'}</div>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(l => {
    const sc = State.scoredMap[l.id];
    const st = sc ? getStatus(sc.total, sc.flag_count) : null;
    const active = l.id === State.currentLeadId;
    return `
    <div class="lead-item ${active ? 'active' : ''}" onclick="selectLead('${l.id}')">
      <div class="lead-item-name">${l.full_name}</div>
      <div class="lead-item-sub">${l.city || '—'} · ${l.age ? l.age + 'y' : ''} · ${l.gender || ''}</div>
      <div class="lead-item-row">
        <span class="lead-item-date">${l.date || ''} · <span style="color:var(--text-secondary)">${l.allocation}</span></span>
        <span class="badge" style="color:${st ? st.color : 'var(--text-faint)'};border-color:${st ? st.color : 'var(--border-1)'};font-size:8px;">
          ${st ? st.label : 'PENDING'}
        </span>
      </div>
      ${sc ? `<div class="mini-bar"><div class="mini-bar-fill" style="width:${(sc.total/25)*100}%;background:${st.color};"></div></div>` : ''}
    </div>`;
  }).join('');
}

// ── SELECT LEAD ────────────────────────────────────────────────
function selectLead(id) {
  State.currentLeadId = id;
  const lead = State.leads.find(l => l.id === id);
  if (!lead) return;

  const sc = State.scoredMap[id];
  State.currentScores = sc ? { ...sc.scores } : {};
  State.currentFlags  = sc ? { ...sc.flags  } : {};
  State.currentNotes  = sc ? (sc.notes || '') : '';

  const panel = document.getElementById('content-panel');
  panel.innerHTML = buildScoreFormHTML(lead);
  
  // Important: Restore visual state of radios/checks if they exist
  restoreFormState();
  updateSummary();
}

// ── CONTENT PANEL ──────────────────────────────────────────────
function renderContentPanel(mode) {
  const panel = document.getElementById('content-panel');
  if (!panel) return;

  if (mode === 'empty') {
    panel.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">←</div>
        <div class="empty-title">Select a lead to begin scoring</div>
        <div class="empty-sub">Choose any lead from the sidebar.<br/>Scores save to Supabase in real-time.</div>
      </div>`;
    return;
  }

  if (mode === 'score') {
    const lead = State.leads.find(l => l.id === State.currentLeadId);
    if (!lead) return;
    panel.innerHTML = buildScoreFormHTML(lead);
    restoreFormState();
    updateSummary();
  }
}

// ── SCORE FORM HTML ────────────────────────────────────────────
function buildScoreFormHTML(lead) {
  // Define the content for the sections based on your requirements
  const scripts = {
    motivation: {
      title: "🧠 PART 2: Motivation & Intent",
      ask: ["What made you apply?", "Working, studying, or full-time?", "Who will run it day-to-day?"],
      flags: "I applied because someone told me to try"
    },
    ops: {
      title: "🍽️ PART 3: Food & Ops Readiness",
      ask: ["Experience in cooking/handling?", "Where will you operate?", "Comfortable with early/late hours?"],
      flags: "Wants income but no daily involvement"
    },
    finance: {
      title: "💰 PART 4: Financial & Bank Readiness",
      ask: ["Comfortable with CM Yuva loan?", "Aadhaar/PAN ready?", "Can arrange 5-10% margin?"],
      flags: "Wants machine without loan process"
    },
    mindset: {
      title: "⚡ PART 5: Business Mindset",
      ask: ["Income aim for Year 1?", "Open to learning hygiene/costing?", "Interested in scaling up?"],
      flags: "Fixed expectations, resistant to training"
    }
  };

  return `
  <div class="lead-detail-view">
    <div class="detail-header">
      <div class="header-left">
        <button class="back-btn" onclick="renderLeadGrid()">← Back to Grid</button>
        <h1 class="detail-name">${lead.full_name}</h1>
        <div class="detail-meta">
          <span>📞 ${lead.phone_number}</span> | <span>📍 ${lead.target_city || '—'}</span> | <span>👥 Team Member: ${lead.lead_alloc || 'Unassigned'}</span>
        </div>
      </div>
      <div id="score-summary" class="summary-badge">
          <div id="sum-num">0</div>
          <div id="sum-status">PENDING</div>
      </div>
    </div>

    <div class="scoring-container">
      <div class="script-column">
        <div class="info-card onboarding">
          <h3>🧾 PART 6: On2Cook Offering</h3>
          <p>Explain clearly: Training, Smart System (Induction+MW), Menu support, Setup guidance, and District support.</p>
        </div>

        ${Object.entries(scripts).map(([key, data]) => `
          <div class="script-section">
            <h4>${data.title}</h4>
            <ul>${data.ask.map(q => `<li>${q}</li>`).join('')}</ul>
            <div class="script-flag">🚩 ${data.flags}</div>
          </div>
        `).join('')}

        <div class="info-card closure">
          <h3>🧮 PART 7: Final Step</h3>
          <p>If >20: "You seem like a fast-track candidate. Next: Bank orientation."</p>
        </div>
      </div>

      <div class="input-column">
        <div class="scoring-board">
          ${SECTIONS.map(sec => `
            <div class="score-card">
              <div class="card-head">
                <span class="sec-title">${sec.title}</span>
                <span class="sec-val" id="val-${sec.id}">0pts</span>
              </div>
              <div class="radio-group">
                <label class="radio-face"><input type="radio" name="sec-${sec.id}" value="5" onclick="onScoreChange('${sec.id}', 5)"> 5 (Strong)</label>
                <label class="radio-face"><input type="radio" name="sec-${sec.id}" value="3" onclick="onScoreChange('${sec.id}', 3)"> 3 (Average)</label>
                <label class="radio-face"><input type="radio" name="sec-${sec.id}" value="1" onclick="onScoreChange('${sec.id}', 1)"> 1 (Weak)</label>
              </div>
            </div>
          `).join('')}

          <div class="flags-card">
            <h4>🚩 Mandatory Red Flags</h4>
            <div class="flag-list">
              ${RED_FLAGS.map((f, i) => `
                <label class="flag-pill" id="flag-label-${i}">
                  <input type="checkbox" onchange="onFlagChange(${i}, this.checked)"> ${f}
                </label>
              `).join('')}
            </div>
          </div>

          <div class="notes-card">
            <textarea id="caller-notes" placeholder="Internal Team Member notes...">${State.currentNotes || ''}</textarea>
          </div>

          <button id="save-btn" class="save-btn disabled" onclick="saveLead()">
            Score all sections to save
          </button>
        </div>
      </div>
    </div>
  </div>`;
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
    const cbs = document.querySelectorAll('.flag-row input[type=checkbox]');
    if (cbs[i]) { cbs[i].checked = true; applyFlagStyle(i, true); }
  });
}

// ── SCORE CHANGE ───────────────────────────────────────────────
function onScoreChange(secId, val) {
  State.currentScores[secId] = val;
  applyRadioStyle(secId, val);
  updateSummary();
}

function applyRadioStyle(secId, val) {
  // Update the score number in the card header
  const valDisplay = document.getElementById('val-' + secId);
  if (valDisplay) {
    valDisplay.textContent = val + 'pts';
    valDisplay.style.color = val >= 5 ? '#16a34a' : val === 3 ? '#d97706' : '#dc2626';
  }

  // Highlight the selected radio card
  document.querySelectorAll(`input[name="sec-${secId}"]`).forEach(r => {
    const face = r.closest('.radio-face'); // Use closest to find the container
    if (face) {
      if (r.checked) {
        face.style.background = 'white';
        face.style.color = 'black';
        face.style.borderColor = 'white';
      } else {
        face.style.background = ''; // Resets to CSS default
        face.style.color = '';
        face.style.borderColor = '';
      }
    }
  });
}

// ── FLAG CHANGE ────────────────────────────────────────────────
function onFlagChange(idx, checked) {
  State.currentFlags[idx] = checked;
  
  // Toggle the visual "active" class on the pill
  const label = document.getElementById(`flag-label-${idx}`);
  if (label) {
    label.classList.toggle('active', checked);
  }
  
  updateSummary(); // Recalculate if flags affect status
}

function applyFlagStyle(idx, checked) {
  const box = document.getElementById(`fcheck-${idx}`);
  if (box) box.textContent = checked ? '✕' : '';
}

// ── UPDATE SUMMARY ─────────────────────────────────────────────
function updateSummary() {
  const total     = calcTotal(State.currentScores);
  const flagCount = Object.values(State.currentFlags).filter(Boolean).length;
  const allDone   = SECTIONS.every(s => State.currentScores[s.id]);

  if (total > 0) {
    const st      = getStatus(total, flagCount);
    const summary = document.getElementById('score-summary');
    if (summary) {
      summary.style.display     = 'block';
      summary.style.borderColor = st.color;

      const numEl = document.getElementById('sum-num');
      if (numEl) { numEl.textContent = total; numEl.style.color = st.color; }

      const statEl = document.getElementById('sum-status');
      if (statEl) { statEl.textContent = st.label; statEl.style.color = st.color; statEl.style.borderColor = st.color; }

      const fill = document.getElementById('sum-fill');
      if (fill) { fill.style.width = `${(total/25)*100}%`; fill.style.background = st.color; }

      const parts = document.getElementById('sum-parts');
      if (parts) {
        parts.innerHTML = SECTIONS.map(s => {
          const v = State.currentScores[s.id];
          const c = v >= 5 ? '#16a34a' : v === 3 ? '#d97706' : v === 1 ? '#dc2626' : 'var(--text-faint)';
          return `<div class="summary-part">
            <div class="summary-pval" style="color:${c};">${v || '–'}</div>
            <div class="summary-plabel">${s.part}</div>
          </div>`;
        }).join('');
      }
    }
  }

  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) {
    if (allDone) {
      saveBtn.className   = 'save-btn ready';
      saveBtn.textContent = 'Save Qualification Score →';
    } else {
      const done = SECTIONS.filter(s => State.currentScores[s.id]).length;
      saveBtn.className   = 'save-btn disabled';
      saveBtn.textContent = `Score all sections to save (${done} / 5 done)`;
    }
  }
}

// ── SAVE LEAD ──────────────────────────────────────────────────
async function saveLead() {
  const lead = State.leads.find(l => l.id === State.currentLeadId);
  if (!lead) return;

  const total = calcTotal(State.currentScores);
  const flagCount = Object.values(State.currentFlags).filter(Boolean).length;
  const st = getStatus(total, flagCount);

  const payload = {
    lead_id: State.currentLeadId,
    // Profile Data from Lead Object
    full_name: lead.full_name || '',
    phone_number: lead.phone_number || '',
    email: lead.email || '',
    city: lead.city || '',
    target_city: lead.target_city || '',
    ad_name: lead.ad_name || '',
    platform: lead.platform || '',
    intent_purpose: lead.intent_purpose || '',
    time_commitment: lead.time_commitment || '',
    gender: lead.gender || '',
    dob: lead.dob || '',
    education_level: lead.education_level || '',
    age: lead.age ? parseInt(lead.age) : null,
    lead_alloc: lead.lead_alloc || 'Unassigned',
    
    // Scoring Data
    scores: State.currentScores,
    flags: State.currentFlags,
    notes: document.getElementById('caller-notes')?.value || '',
    total: total,
    flag_count: flagCount,
    status: st.key,
    updated_at: new Date().toISOString()
  };

  const { error } = await db
    .from('scored_leads')
    .upsert(payload, { onConflict: 'lead_id' });

  if (error) {
    console.error("Supabase Error:", error);
    showToast("Error saving: " + error.message, "error");
  } else {
    State.scoredMap[State.currentLeadId] = payload;
    showToast(`✓ Saved as ${st.label}`, "success");
  }
}
// ── DASHBOARD ──────────────────────────────────────────────────
function renderDashboard() {
  const panel = document.getElementById('content-panel');
  if (!panel) return;

  const scoredLeads = Object.values(State.scoredMap);
  const totalLeads = State.leads.length;

  // Helper for counting unique values in the main pipeline
  const getStatArray = (key) => {
    const counts = {};
    State.leads.forEach(l => {
      const val = l[key] || 'Not Specified';
      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  };

  panel.innerHTML = `
    <div class="dash-container">
      <div class="dash-header">
        <h2 class="dash-title">Operational Intelligence</h2>
        <div class="kpi-strip">
          <div class="kpi-stat"><span>Total Pipeline</span><b>${totalLeads}</b></div>
          <div class="kpi-stat"><span>Processed</span><b>${scoredLeads.length}</b></div>
          <div class="kpi-stat red"><span>Risk Flags</span><b>${scoredLeads.reduce((acc, l) => acc + (l.flag_count || 0), 0)}</b></div>
        </div>
      </div>

      <div class="dash-grid">
        <div class="dash-col">
          <section class="dash-card">
            <h3>Qualification Success</h3>
            ${renderProgressBar('Fast-Track', scoredLeads.filter(l => l.status === 'fast-track').length, scoredLeads.length, '#16a34a')}
            ${renderProgressBar('Nurture', scoredLeads.filter(l => l.status === 'nurture').length, scoredLeads.length, '#d97706')}
            ${renderProgressBar('Rejected', scoredLeads.filter(l => ['auto-reject', 'not-suitable', 'rejected'].includes(l.status)).length, scoredLeads.length, '#dc2626')}
          </section>

          <section class="dash-card">
            <h3>Team Member Load</h3>
            <div class="stat-list">
              ${getStatArray('lead_alloc').map(([name, count]) => `
                <div class="stat-row"><span>${name}</span><b>${count} leads</b></div>
              `).join('')}
            </div>
          </section>  

          <section class="dash-card">
            <h3>Time Commitment</h3>
            <div class="stat-list">
              ${getStatArray('time_commitment').map(([name, count]) => `
                <div class="stat-row"><span>${name}</span><b>${count}</b></div>
              `).join('')}
            </div>
          </section>
        </div>

        <div class="dash-col">
          <section class="dash-card">
            <h3>Top Target Cities</h3>
            <div class="stat-list">
              ${getStatArray('target_city').slice(0, 6).map(([name, count]) => `
                <div class="stat-row"><span>${name}</span><b>${count}</b></div>
              `).join('')}
            </div>
          </section>

          <section class="dash-card">
            <h3>Score Analysis (Section Averages)</h3>
            <div class="stat-list">
              ${SECTIONS.map(sec => {
                // Extracts from the 'scores' jsonb field in your schema
                const vals = scoredLeads.map(l => l.scores?.[sec.id]).filter(v => v != null);
                const avg = vals.length ? (vals.reduce((a, b) => Number(a) + Number(b), 0) / vals.length).toFixed(1) : '0.0';
                return `<div class="stat-row"><span>${sec.title}</span><b style="color:var(--red)">${avg} / 5.0</b></div>`;
              }).join('')}
            </div>
          </section>

          <section class="dash-card">
            <h3>Risk Factor (Flags)</h3>
            <div class="stat-list">
               <div class="stat-row">
                 <span>Flagged Leads</span>
                 <b style="color:var(--red)">${scoredLeads.filter(l => (l.flag_count || 0) > 0).length}</b>
               </div>
               <div class="stat-row">
                 <span>Clean Leads</span>
                 <b style="color:#16a34a">${scoredLeads.filter(l => (l.flag_count || 0) === 0).length}</b>
               </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}

// Visual Helper for Progress Bars
function renderProgressBar(label, value, total, color) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  return `
    <div class="progress-item">
      <div class="progress-label"><span>${label}</span><b>${value}</b></div>
      <div class="progress-bg"><div class="progress-fill" style="width:${percent}%; background:${color}"></div></div>
    </div>
  `;
}

function initAdvancedCharts(scored, allLeads) {
  const commonOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#888', font: { size: 10 } } } } };

  // 1. Status Doughnut
  const sData = { 'Fast-Track': 0, 'Nurture': 0, 'Rejected': 0 };
  scored.forEach(l => {
    if (l.status === 'fast-track') sData['Fast-Track']++;
    else if (l.status === 'nurture') sData['Nurture']++;
    else sData['Rejected']++;
  });
  new Chart(document.getElementById('chart-status'), {
    type: 'doughnut',
    data: { labels: Object.keys(sData), datasets: [{ data: Object.values(sData), backgroundColor: ['#16a34a', '#d97706', '#dc2626'], borderWidth: 0 }] },
    options: commonOptions
  });

  // 2. Team Bar Chart
  const teamMap = {};
  allLeads.forEach(l => { teamMap[l.lead_alloc] = (teamMap[l.lead_alloc] || 0) + 1; });
  new Chart(document.getElementById('chart-team'), {
    type: 'bar',
    data: { labels: Object.keys(teamMap), datasets: [{ label: 'Leads', data: Object.values(teamMap), backgroundColor: '#dc2626' }] },
    options: commonOptions
  });

  // 3. City Pie Chart (Top 5)
  const cityMap = {};
  allLeads.forEach(l => { cityMap[l.target_city || 'Unknown'] = (cityMap[l.target_city || 'Unknown'] || 0) + 1; });
  const topCities = Object.entries(cityMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  new Chart(document.getElementById('chart-city'), {
    type: 'pie',
    data: { labels: topCities.map(c=>c[0]), datasets: [{ data: topCities.map(c=>c[1]), backgroundColor: ['#ff4d4d', '#ff1a1a', '#cc0000', '#990000', '#660000'] }] },
    options: commonOptions
  });

  // 4. Score Radar (Averages of the 5 Sections)
  const radarAverages = SECTIONS.map(sec => {
    const vals = scored.map(l => l.scores?.[sec.id]).filter(v => v != null);
    return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
  });
  new Chart(document.getElementById('chart-radar'), {
    type: 'radar',
    data: { labels: SECTIONS.map(s=>s.part), datasets: [{ label: 'Avg Skill Score', data: radarAverages, borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.2)' }] },
    options: { ...commonOptions, scales: { r: { min: 0, max: 5, grid: { color: '#222' } } } }
  });

  // 5. Intent vs Commitment
  const intentMap = {};
  allLeads.forEach(l => { intentMap[l.intent_purpose] = (intentMap[l.intent_purpose] || 0) + 1; });
  new Chart(document.getElementById('chart-intent'), {
    type: 'polarArea',
    data: { labels: Object.keys(intentMap).slice(0,4), datasets: [{ data: Object.values(intentMap).slice(0,4), backgroundColor: ['#16a34a','#d97706','#dc2626','#0284c7'] }] },
    options: commonOptions
  });

  // 6. Gender & Age
  const genderMap = { Male: 0, Female: 0, Other: 0 };
  allLeads.forEach(l => { if(genderMap.hasOwnProperty(l.gender)) genderMap[l.gender]++; });
  new Chart(document.getElementById('chart-demographics'), {
    type: 'bar',
    data: { labels: ['Male', 'Female', 'Other'], datasets: [{ data: Object.values(genderMap), backgroundColor: '#444' }] },
    options: commonOptions
  });

  // 7. Education
  const eduMap = {};
  allLeads.forEach(l => { eduMap[l.education_level] = (eduMap[l.education_level] || 0) + 1; });
  new Chart(document.getElementById('chart-edu'), {
    type: 'bar',
    data: { labels: Object.keys(eduMap), datasets: [{ label: 'Count', data: Object.values(eduMap), backgroundColor: '#dc2626' }] },
    options: { ...commonOptions, indexAxis: 'y' }
  });

  // 8. Flags
  const flagMap = { 'Safe': 0, 'Flagged': 0 };
  scored.forEach(l => { l.flag_count > 0 ? flagMap['Flagged']++ : flagMap['Safe']++; });
  new Chart(document.getElementById('chart-flags'), {
    type: 'doughnut',
    data: { labels: ['Clean', 'Flagged'], datasets: [{ data: [flagMap.Safe, flagMap.Flagged], backgroundColor: ['#111', '#dc2626'] }] },
    options: commonOptions
  });
}

function renderVisualCharts(statusCounts, scoredLeads) {
  // Chart 1: Qualification Funnel (Doughnut)
  new Chart(document.getElementById('funnelChart'), {
    type: 'doughnut',
    data: {
      labels: ['Fast-Track', 'Nurture', 'Rejected'],
      datasets: [{
        data: [statusCounts['fast-track'], statusCounts.nurture, statusCounts['not-suitable']],
        backgroundColor: ['#16a34a', '#d97706', '#dc2626'],
        borderWidth: 0
      }]
    },
    options: { plugins: { legend: { position: 'bottom', labels: { color: '#888', font: { size: 10 } } } } }
  });

  // Chart 2: Radar Chart (Section Strengths)
  const sectionLabels = SECTIONS.map(s => s.part);
  const sectionAverages = SECTIONS.map(sec => {
    const vals = scoredLeads.map(l => l.scores?.[sec.id]).filter(v => v != null);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  });

  new Chart(document.getElementById('radarChart'), {
    type: 'radar',
    data: {
      labels: sectionLabels,
      datasets: [{
        label: 'Avg Score',
        data: sectionAverages,
        backgroundColor: 'rgba(220, 38, 38, 0.2)',
        borderColor: '#dc2626',
        pointBackgroundColor: '#dc2626'
      }]
    },
    options: {
      scales: { r: { grid: { color: '#222' }, angleLines: { color: '#222' }, ticks: { display: false }, min: 0, max: 5 } },
      plugins: { legend: { display: false } }
    }
  });
}

// ── EDIT FROM DASHBOARD ────────────────────────────────────────
function editFromDash(id) {
  // 1. Switch the internal state
  State.activeTab = 'leads';
  
  // 2. Update the UI tabs
  document.getElementById('tab-leads').classList.add('active');
  document.getElementById('tab-dashboard').classList.remove('active');
  
  // 3. Show the filter bar again
  const filterBar = document.querySelector('.grid-controls');
  if (filterBar) filterBar.style.display = 'flex';

  // 4. Open the specific lead profile
  selectLead(id);
}

// ── SYNC STATUS ────────────────────────────────────────────────
function setSyncStatus(msg) {
  const el = document.getElementById('sync-status');
  if (el) el.textContent = msg;
}

// ── TOAST ──────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type === 'success' ? 'success' : ''} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}
async function handleExcelImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = e.target.result;
    const workbook = XLSX.read(data, { type: 'binary' });
    const sheetName = workbook.SheetNames[0];
    const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (confirm(`Import ${json.length} leads? (New IDs will be added, existing IDs will be updated)`)) {
      await processExcelToSupabase(json);
    }
  };
  reader.readAsBinaryString(file);
}

async function processExcelToSupabase(rows) {
  setSyncStatus('Cleaning & Uploading...');
  
  // 1. Create a Map to store unique leads (keys are the ID)
  const uniqueLeadsMap = new Map();

  rows.forEach(row => {
    // Generate the unique key (adjust 'phone_number' to match your Excel column)
    const id = String(row.phone_number || row.Phone || row.ID || "").trim();
    
    // Skip rows that have no ID
    if (!id) return;

    // Map all your profile fields
    const leadData = {
      lead_id: id,
      full_name: row.full_name || row.Name || 'Unknown',
      phone_number: row.phone_number || row.Phone || '',
      city: row.city || row.City || '—',
      email: row.email || '',
      gender: row.Lead_Gender || '',
      dob: row.date_of_birth || row.Formatted_Date || '',
      education_level: row.education_level || '',
      age: row.Age || '',
      ad_name: row.ad_name || '',
      platform: row.platform || '',
      intent_purpose: row['आप_किसके_लिए_जानकारी_ले_रहे_हैं?'] || '',
      time_commitment: row['क्या_आप_अपने_फूड_बिज़नेस_को_समय_देने_के_लिए_तैयार_हैं?'] || '',
      target_city: row.Target_City || '',
      lead_alloc: row['Lead_Allocation'] || 'Unassigned',
      status: 'pending',
      updated_at: new Date().toISOString()
    };

    // If duplicate exists in the Excel, the later row will overwrite the earlier one
    uniqueLeadsMap.set(id, leadData);
  });

  // 2. Convert Map back to an array
  const leadsToUpload = Array.from(uniqueLeadsMap.values());

  try {
    const { error } = await db
      .from('scored_leads')
      .upsert(leadsToUpload, { onConflict: 'lead_id' });

    if (error) throw error;

    showToast(` ${leadsToUpload.length} Unique Leads Imported`, 'success');
    refreshAll();
  } catch (err) {
    console.error('[Import Error]:', err);
    showToast(' Upload Error: ' + err.message, 'error');
  }
}