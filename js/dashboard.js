// ═══════════════════════════════════════════════════════════════
// dashboard.js — Operational Intelligence Dashboard
// Called by portal.js switchTab('dashboard')
// Depends on: State, SECTIONS (from config.js), Chart.js (CDN)
// ═══════════════════════════════════════════════════════════════

let _charts = {};

function destroyCharts() {
  Object.values(_charts).forEach(c => { try { c.destroy(); } catch(e) {} });
  _charts = {};
}

// ── MAIN RENDER ─────────────────────────────────────────────────
function renderDashboard() {
  destroyCharts();
  const panel = document.getElementById('content-panel');
  if (!panel) return;

  const all      = State.leads;
  const scored   = all.filter(l => l.scores && Object.keys(l.scores).length > 0);
  const total    = all.length;

  // ── Computed metrics ──────────────────────────────────────────
  const byStatus = (st) => all.filter(l => l.status === st).length;
  const fastTrack   = byStatus('fast-track');
  const nurture     = byStatus('nurture');
  const dropped     = byStatus('drop');
  const infoReq     = byStatus('info-requested');
  const callbacks   = byStatus('callback');
  const rejected    = all.filter(l => ['auto-reject','not-suitable','rejected'].includes(l.status)).length;
  const open        = all.filter(l => !l.status || l.status === 'Open' || l.status === "'Open'").length;
  const totalFlags  = all.reduce((a, l) => a + (l.flag_count || 0), 0);
  const convRate    = total > 0 ? ((fastTrack / total) * 100).toFixed(1) : '0.0';
  const processRate = total > 0 ? ((scored.length / total) * 100).toFixed(1) : '0.0';

  const avgScore = scored.length > 0
    ? (scored.reduce((a, l) => a + (l.total || 0), 0) / scored.length).toFixed(1)
    : '0.0';

  // ── Group helpers ─────────────────────────────────────────────
  const groupBy = (key) => {
    const map = {};
    all.forEach(l => { const v = l[key] || 'Unknown'; map[v] = (map[v]||0)+1; });
    return Object.entries(map).sort((a,b) => b[1]-a[1]);
  };
  const groupByScored = (key) => {
    const map = {};
    scored.forEach(l => { const v = l[key] || 'Unknown'; map[v] = (map[v]||0)+1; });
    return Object.entries(map).sort((a,b) => b[1]-a[1]);
  };

  const cityData   = groupBy('target_city').slice(0, 8);
  const allocData  = groupBy('lead_alloc').slice(0, 10);
  const platData   = groupBy('platform');
  const genderData = groupBy('gender');
  const eduData    = groupBy('education_level').slice(0, 6);

  // ── Section score averages ────────────────────────────────────
  const secAverages = SECTIONS.map(sec => {
    const vals = scored.map(l => Number(l.scores?.[sec.id])).filter(v => !isNaN(v) && v > 0);
    return { title: sec.title, id: sec.id, avg: vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length) : 0, count: vals.length };
  });

  // ── Team member breakdown ─────────────────────────────────────
  const statusKeys = ['fast-track','nurture','rejected','auto-reject','not-suitable','drop','info-requested','callback'];
  const teamMembers = [...new Set(all.map(l => l.lead_alloc || 'Unassigned'))];
  const teamData = teamMembers.map(member => {
    const memberLeads = all.filter(l => (l.lead_alloc || 'Unassigned') === member);
    const memberTotal = memberLeads.length;
    const ft       = memberLeads.filter(l => l.status === 'fast-track').length;
    const nur      = memberLeads.filter(l => l.status === 'nurture').length;
    const rej      = memberLeads.filter(l => ['auto-reject','not-suitable','rejected'].includes(l.status)).length;
    const drp      = memberLeads.filter(l => l.status === 'drop').length;
    const inf      = memberLeads.filter(l => l.status === 'info-requested').length;
    const cb       = memberLeads.filter(l => l.status === 'callback').length;
    const opn      = memberLeads.filter(l => !l.status || l.status === 'Open' || l.status === "'Open'").length;
    return { member, memberTotal, ft, nur, rej, drp, inf, cb, opn };
  }).sort((a, b) => b.memberTotal - a.memberTotal);

  // ── Flag breakdown ────────────────────────────────────────────
  const flagBreakdown = all.reduce((acc, l) => {
    const fc = l.flag_count || 0;
    if (fc === 0) acc.clean++;
    else if (fc === 1) acc.one++;
    else acc.multi++;
    return acc;
  }, { clean: 0, one: 0, multi: 0 });

  // ── Render HTML ───────────────────────────────────────────────
  panel.innerHTML = `
    <div class="db-wrap">

      <!-- ── PAGE HEADER ── -->
      <div class="db-page-header">
        <div class="db-page-header-left">
          <div class="db-eyebrow">Operational Intelligence</div>
          <h2 class="db-page-title">Lead Pipeline Dashboard</h2>
        </div>
        <div class="db-header-meta">
          <div class="db-header-meta-item">
            <span class="db-header-meta-label">Last Sync</span>
            <span class="db-header-meta-val">${new Date().toLocaleTimeString()}</span>
          </div>
          <div class="db-header-meta-sep"></div>
          <div class="db-header-meta-item">
            <span class="db-header-meta-label">Data As Of</span>
            <span class="db-header-meta-val">${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
          </div>
        </div>
      </div>

      <!-- ── KPI STRIP ── -->
      <div class="db-kpi-row">
        ${kpiCard('Total Pipeline',  total,            '',       '#fff',    'Σ', 'All leads in system')}
        ${kpiCard('Processed',       scored.length,    processRate+'%', '#d97706', '◎', 'Leads fully scored')}
        ${kpiCard('Fast Track',      fastTrack,        convRate+'%',   '#16a34a', '▲', 'Of total pipeline')}
        ${kpiCard('Nurture',         nurture,          '',       '#f59e0b', '~', 'Needs follow-up')}
        ${kpiCard('Pending / Open',  open,             '',       '#6b7280', '○', 'Not yet reviewed')}
        ${kpiCard('Avg Score',       avgScore+'pts',   '',       '#0ea5e9', '◈', 'Across scored leads')}
        ${kpiCard('Risk Flags',      totalFlags,       '',       '#dc2626', '⚑', 'Total flags raised')}
        ${kpiCard('Call Backs',      callbacks,        '',       '#0ea5e9', '↺', 'Awaiting callback')}
      </div>

      <!-- ── ROW 1: Status + Team Load ── -->
      <div class="db-row">

        <!-- Status Breakdown -->
        <div class="db-card db-card--medium">
          <div class="db-card-head">
            <div class="db-card-title">Status Distribution</div>
            <div class="db-card-sub">${total} total leads</div>
          </div>
          <div class="db-status-list">
            ${statusBar('Fast Track',    fastTrack,   total, '#16a34a')}
            ${statusBar('Nurture',       nurture,     total, '#d97706')}
            ${statusBar('Open',          open,        total, '#6b7280')}
            ${statusBar('Info Req.',     infoReq,     total, '#7c3aed')}
            ${statusBar('Call Back',     callbacks,   total, '#0ea5e9')}
            ${statusBar('Dropped',       dropped,     total, '#374151')}
            ${statusBar('Rejected',      rejected,    total, '#dc2626')}
          </div>
        </div>

        <!-- Doughnut Chart -->
        <div class="db-card db-card--chart-sm">
          <div class="db-card-head">
            <div class="db-card-title">Pipeline Split</div>
            <div class="db-card-sub">By status</div>
          </div>
          <div class="db-chart-wrap" style="height:220px;position:relative">
            <canvas id="chart-status-donut"></canvas>
          </div>
          <div class="db-legend" id="legend-status"></div>
        </div>

        <!-- Team Load -->
        <div class="db-card db-card--medium">
          <div class="db-card-head">
            <div class="db-card-title">Team Member Load</div>
            <div class="db-card-sub">Lead allocation</div>
          </div>
          <div class="db-alloc-list">
            ${allocData.map(([name, count]) => `
              <div class="db-alloc-row">
                <div class="db-alloc-avatar">${name.charAt(0).toUpperCase()}</div>
                <div class="db-alloc-info">
                  <div class="db-alloc-name">${name}</div>
                  <div class="db-alloc-bar-wrap">
                    <div class="db-alloc-bar" style="width:${Math.round((count/total)*100)}%"></div>
                  </div>
                </div>
                <div class="db-alloc-count">${count}</div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>

      <!-- ── ROW 2: Score Section Perf + Cities ── -->
      <div class="db-row">

        <!-- Section Score Averages -->
        <div class="db-card db-card--wide">
          <div class="db-card-head">
            <div class="db-card-title">Score Averages by Section</div>
            <div class="db-card-sub">Out of 5.0 — based on ${scored.length} scored leads</div>
          </div>
          <div class="db-section-scores">
            ${secAverages.map(s => `
              <div class="db-sec-score-row">
                <div class="db-sec-score-label">${s.title}</div>
                <div class="db-sec-score-bar-wrap">
                  <div class="db-sec-score-bar" style="width:${(s.avg/5)*100}%;background:${scoreColor(s.avg)}"></div>
                </div>
                <div class="db-sec-score-val" style="color:${scoreColor(s.avg)}">${s.avg.toFixed(1)}</div>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:18px">
            <canvas id="chart-section-bar" style="max-height:180px"></canvas>
          </div>
        </div>

        <!-- Target Cities -->
        <div class="db-card db-card--medium">
          <div class="db-card-head">
            <div class="db-card-title">Target Cities</div>
            <div class="db-card-sub">Lead distribution by city</div>
          </div>
          <div class="db-city-list">
            ${cityData.map(([city, count], i) => `
              <div class="db-city-row">
                <div class="db-city-rank">${i+1}</div>
                <div class="db-city-name">${city}</div>
                <div class="db-city-bar-wrap">
                  <div class="db-city-bar" style="width:${Math.round((count/cityData[0][1])*100)}%"></div>
                </div>
                <div class="db-city-count">${count}</div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>

      <!-- ── ROW 3: Risk + Platform + Education ── -->
      <div class="db-row">

        <!-- Risk Analysis -->
        <div class="db-card db-card--sm">
          <div class="db-card-head">
            <div class="db-card-title">Risk Analysis</div>
            <div class="db-card-sub">Flag distribution</div>
          </div>
          <div class="db-risk-grid">
            <div class="db-risk-item" style="border-color:#16a34a">
              <div class="db-risk-num" style="color:#16a34a">${flagBreakdown.clean}</div>
              <div class="db-risk-label">Clean Leads</div>
              <div class="db-risk-pct">${scored.length > 0 ? Math.round((flagBreakdown.clean/scored.length)*100) : 0}%</div>
            </div>
            <div class="db-risk-item" style="border-color:#d97706">
              <div class="db-risk-num" style="color:#d97706">${flagBreakdown.one}</div>
              <div class="db-risk-label">1 Flag</div>
              <div class="db-risk-pct">${scored.length > 0 ? Math.round((flagBreakdown.one/scored.length)*100) : 0}%</div>
            </div>
            <div class="db-risk-item" style="border-color:#dc2626">
              <div class="db-risk-num" style="color:#dc2626">${flagBreakdown.multi}</div>
              <div class="db-risk-label">Multi-Flag</div>
              <div class="db-risk-pct">${scored.length > 0 ? Math.round((flagBreakdown.multi/scored.length)*100) : 0}%</div>
            </div>
          </div>
          <div class="db-risk-bar-strip">
            <div style="width:${scored.length>0?Math.round((flagBreakdown.clean/scored.length)*100):0}%;background:#16a34a;height:6px;border-radius:2px 0 0 2px"></div>
            <div style="width:${scored.length>0?Math.round((flagBreakdown.one/scored.length)*100):0}%;background:#d97706;height:6px"></div>
            <div style="flex:1;background:#dc2626;height:6px;border-radius:0 2px 2px 0"></div>
          </div>
        </div>

        <!-- Platform breakdown -->
        <div class="db-card db-card--sm">
          <div class="db-card-head">
            <div class="db-card-title">Platform Source</div>
            <div class="db-card-sub">Leads by acquisition channel</div>
          </div>
          <div style="height:180px;position:relative">
            <canvas id="chart-platform"></canvas>
          </div>
        </div>

        <!-- Gender & Education -->
        <div class="db-card db-card--sm">
          <div class="db-card-head">
            <div class="db-card-title">Demographics</div>
            <div class="db-card-sub">Gender & Education split</div>
          </div>
          <div class="db-demo-section">
            <div class="db-demo-label">Gender</div>
            <div class="db-demo-pills">
              ${genderData.map(([g, c]) => `
                <div class="db-demo-pill">
                  <span class="db-demo-g">${g || 'Unknown'}</span>
                  <span class="db-demo-c">${c}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="db-demo-section" style="margin-top:16px">
            <div class="db-demo-label">Education</div>
            ${eduData.map(([edu, count]) => `
              <div class="db-edu-row">
                <span class="db-edu-name">${edu || 'Not Specified'}</span>
                <span class="db-edu-count">${count}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Intent & Time Commitment -->
        <div class="db-card db-card--sm">
          <div class="db-card-head">
            <div class="db-card-title">Lead Intent</div>
            <div class="db-card-sub">Who & readiness</div>
          </div>
          <div class="db-intent-section">
            <div class="db-demo-label">Purpose / Who it's for</div>
            ${groupBy('intent_purpose').slice(0,4).map(([v, c]) => `
              <div class="db-intent-row">
                <div class="db-intent-dot"></div>
                <span class="db-intent-label">${truncate(v, 34)}</span>
                <span class="db-intent-count">${c}</span>
              </div>
            `).join('')}
          </div>
          <div class="db-intent-section" style="margin-top:14px">
            <div class="db-demo-label">Time Commitment</div>
            ${groupBy('time_commitment').slice(0,3).map(([v, c]) => `
              <div class="db-intent-row">
                <div class="db-intent-dot" style="background:#d97706"></div>
                <span class="db-intent-label">${truncate(v, 34)}</span>
                <span class="db-intent-count">${c}</span>
              </div>
            `).join('')}
          </div>
        </div>

      </div>

      <!-- ── ROW 4: Team Member Comparison ── -->
      <div class="db-row">
        <div class="db-card" style="flex:1;min-width:0;overflow-x:auto">
          <div class="db-card-head">
            <div>
              <div class="db-card-title">Team Member Comparison</div>
              <div class="db-card-sub">Detailed qualification breakdown by team member</div>
            </div>
          </div>
          <table class="db-tm-table" id="team-member-table">
            <thead>
              <tr>
                <th class="db-tm-th db-tm-sortable" data-col="member"      onclick="sortTeamTable('member')">Team Member <span class="db-tm-sort-icon">↕</span></th>
                <th class="db-tm-th db-tm-sortable" data-col="memberTotal" onclick="sortTeamTable('memberTotal')">Total <span class="db-tm-sort-icon db-tm-sort-active">↓</span></th>
                <th class="db-tm-th db-tm-sortable" data-col="ft"          onclick="sortTeamTable('ft')">Fast-Track <span class="db-tm-sort-icon">↕</span></th>
                <th class="db-tm-th db-tm-sortable" data-col="nur"         onclick="sortTeamTable('nur')">Nurture <span class="db-tm-sort-icon">↕</span></th>
                <th class="db-tm-th db-tm-sortable" data-col="rej"         onclick="sortTeamTable('rej')">Rejected <span class="db-tm-sort-icon">↕</span></th>
                <th class="db-tm-th db-tm-sortable" data-col="drp"         onclick="sortTeamTable('drp')">Dropped <span class="db-tm-sort-icon">↕</span></th>
                <th class="db-tm-th db-tm-sortable" data-col="inf"         onclick="sortTeamTable('inf')">Info Requested <span class="db-tm-sort-icon">↕</span></th>
                <th class="db-tm-th db-tm-sortable" data-col="cb"          onclick="sortTeamTable('cb')">Call Back <span class="db-tm-sort-icon">↕</span></th>
                <th class="db-tm-th db-tm-sortable" data-col="opn"         onclick="sortTeamTable('opn')">Open <span class="db-tm-sort-icon">↕</span></th>
              </tr>
            </thead>
            <tbody id="team-member-tbody">
              ${teamData.map(r => teamMemberRow(r)).join('')}
            </tbody>
            <tfoot>
              <tr class="db-tm-total-row">
                <td class="db-tm-td db-tm-member-cell" style="color:#888;font-weight:700;font-size:11px;letter-spacing:0.08em">TOTAL</td>
                <td class="db-tm-td"><span class="db-tm-total-num">${total}</span></td>
                ${[fastTrack, nurture, rejected, dropped, infoReq, callbacks, open].map((v,i) => {
                  const colors = ['#16a34a','#d97706','#dc2626','#6b7280','#7c3aed','#0ea5e9','#4b5563'];
                  return `<td class="db-tm-td"><span class="db-tm-num" style="color:${colors[i]}">${v}</span><div class="db-tm-pct">${total>0?Math.round((v/total)*100):0}%</div></td>`;
                }).join('')}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>`;

  // ── Render Charts ────────────────────────────────────────────
  requestAnimationFrame(() => {
    renderStatusDonut({ fastTrack, nurture, open, infoReq, callbacks, dropped, rejected });
    renderSectionBar(secAverages);
    renderPlatformChart(platData);
  });
}

// ── CHART RENDERERS ──────────────────────────────────────────────
function renderStatusDonut({ fastTrack, nurture, open, infoReq, callbacks, dropped, rejected }) {
  const ctx = document.getElementById('chart-status-donut');
  if (!ctx) return;

  const data = [
    { label: 'Fast Track',    value: fastTrack,  color: '#16a34a' },
    { label: 'Nurture',       value: nurture,    color: '#d97706' },
    { label: 'Open',          value: open,       color: '#4b5563' },
    { label: 'Info Req.',     value: infoReq,    color: '#7c3aed' },
    { label: 'Call Back',     value: callbacks,  color: '#0ea5e9' },
    { label: 'Dropped',       value: dropped,    color: '#1f2937' },
    { label: 'Rejected',      value: rejected,   color: '#dc2626' },
  ].filter(d => d.value > 0);

  _charts['donut'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels:   data.map(d => d.label),
      datasets: [{ data: data.map(d => d.value), backgroundColor: data.map(d => d.color), borderWidth: 2, borderColor: '#0a0a0a' }]
    },
    options: {
      cutout: '68%',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.raw}` } } },
      animation: { animateRotate: true, duration: 900 }
    }
  });

  const legend = document.getElementById('legend-status');
  if (legend) {
    legend.innerHTML = data.map(d => `
      <div class="db-legend-item">
        <span class="db-legend-dot" style="background:${d.color}"></span>
        <span class="db-legend-label">${d.label}</span>
        <span class="db-legend-val">${d.value}</span>
      </div>
    `).join('');
  }
}

function renderSectionBar(secAverages) {
  const ctx = document.getElementById('chart-section-bar');
  if (!ctx) return;
  _charts['section'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: secAverages.map(s => s.title.replace(/^[^\s]+\s/, '')),
      datasets: [{
        data:            secAverages.map(s => s.avg.toFixed(2)),
        backgroundColor: secAverages.map(s => scoreColor(s.avg) + 'cc'),
        borderColor:     secAverages.map(s => scoreColor(s.avg)),
        borderWidth: 1, borderRadius: 3,
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { max: 5, grid: { color: '#1a1a1a' }, ticks: { color: '#555', font: { size: 10 } } },
        y: { grid: { display: false },            ticks: { color: '#888', font: { size: 10 } } },
      },
      animation: { duration: 700 }
    }
  });
}

function renderPlatformChart(platData) {
  const ctx = document.getElementById('chart-platform');
  if (!ctx) return;
  const colors = ['#dc2626','#0ea5e9','#d97706','#16a34a','#7c3aed','#f43f5e'];
  _charts['platform'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels:   platData.map(([k]) => k),
      datasets: [{ data: platData.map(([,v]) => v), backgroundColor: colors, borderWidth: 2, borderColor: '#0a0a0a' }]
    },
    options: {
      cutout: '58%',
      plugins: {
        legend: { position: 'right', labels: { color: '#888', font: { size: 10 }, boxWidth: 10, padding: 8 } },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.raw}` } }
      },
      animation: { duration: 800 }
    }
  });
}

// ── TEMPLATE HELPERS ──────────────────────────────────────────────
function kpiCard(label, value, sub, color, icon, hint) {
  return `
    <div class="db-kpi-card">
      <div class="db-kpi-icon" style="color:${color}">${icon}</div>
      <div class="db-kpi-body">
        <div class="db-kpi-value" style="color:${color}">${value}</div>
        <div class="db-kpi-label">${label}</div>
        ${sub ? `<div class="db-kpi-sub">${sub}</div>` : ''}
      </div>
      <div class="db-kpi-hint">${hint}</div>
    </div>`;
}

function statusBar(label, value, total, color) {
  const pct = total > 0 ? ((value/total)*100).toFixed(1) : 0;
  return `
    <div class="db-status-row">
      <div class="db-status-dot" style="background:${color}"></div>
      <div class="db-status-name">${label}</div>
      <div class="db-status-bar-wrap">
        <div class="db-status-bar" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="db-status-count" style="color:${color}">${value}</div>
      <div class="db-status-pct">${pct}%</div>
    </div>`;
}

function healthMetric(label, value, desc, color) {
  return `
    <div class="db-health-row">
      <div>
        <div class="db-health-label">${label}</div>
        <div class="db-health-desc">${desc}</div>
      </div>
      <div class="db-health-val" style="color:${color}">${value}</div>
    </div>`;
}

// ── TEAM MEMBER TABLE HELPERS ────────────────────────────────────
function teamMemberRow(r) {
  const pct = (n) => r.memberTotal > 0 ? Math.round((n / r.memberTotal) * 100) : 0;
  const cell = (n, color) => `
    <td class="db-tm-td">
      <span class="db-tm-num" style="color:${color}">${n}</span>
      <div class="db-tm-pct">(${pct(n)}%)</div>
    </td>`;
  return `
    <tr class="db-tm-row">
      <td class="db-tm-td db-tm-member-cell">${r.member}</td>
      <td class="db-tm-td"><span class="db-tm-total-num" style="color:var(--red)">${r.memberTotal}</span></td>
      ${cell(r.ft,  '#16a34a')}
      ${cell(r.nur, '#d97706')}
      ${cell(r.rej, '#dc2626')}
      ${cell(r.drp, '#6b7280')}
      ${cell(r.inf, '#7c3aed')}
      ${cell(r.cb,  '#0ea5e9')}
      ${cell(r.opn, '#4b5563')}
    </tr>`;
}

let _tmSortCol = 'memberTotal';
let _tmSortDir = -1; // -1 = desc, 1 = asc

function sortTeamTable(col) {
  const all = State.leads;
  const teamMembers = [...new Set(all.map(l => l.lead_alloc || 'Unassigned'))];
  let data = teamMembers.map(member => {
    const ml = all.filter(l => (l.lead_alloc || 'Unassigned') === member);
    const mt = ml.length;
    return {
      member, memberTotal: mt,
      ft:  ml.filter(l => l.status === 'fast-track').length,
      nur: ml.filter(l => l.status === 'nurture').length,
      rej: ml.filter(l => ['auto-reject','not-suitable','rejected'].includes(l.status)).length,
      drp: ml.filter(l => l.status === 'drop').length,
      inf: ml.filter(l => l.status === 'info-requested').length,
      cb:  ml.filter(l => l.status === 'callback').length,
      opn: ml.filter(l => !l.status || l.status === 'Open' || l.status === "'Open'").length,
    };
  });

  if (_tmSortCol === col) { _tmSortDir *= -1; }
  else { _tmSortCol = col; _tmSortDir = col === 'member' ? 1 : -1; }

  data.sort((a, b) => {
    const av = a[col], bv = b[col];
    if (typeof av === 'string') return av.localeCompare(bv) * _tmSortDir;
    return (av - bv) * _tmSortDir;
  });

  // Update sort icons
  document.querySelectorAll('.db-tm-sort-icon').forEach(el => {
    el.textContent = '↕'; el.classList.remove('db-tm-sort-active');
  });
  const activeHeader = document.querySelector(`[data-col="${col}"] .db-tm-sort-icon`);
  if (activeHeader) {
    activeHeader.textContent = _tmSortDir === -1 ? '↓' : '↑';
    activeHeader.classList.add('db-tm-sort-active');
  }

  const tbody = document.getElementById('team-member-tbody');
  if (tbody) tbody.innerHTML = data.map(r => teamMemberRow(r)).join('');
}

function scoreColor(val) {
  if (val >= 4) return '#16a34a';
  if (val >= 3) return '#d97706';
  if (val >= 2) return '#f97316';
  return '#dc2626';
}

function truncate(str, len) {
  if (!str) return '—';
  return str.length > len ? str.slice(0, len) + '…' : str;
}