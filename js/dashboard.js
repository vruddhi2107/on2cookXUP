function renderDashboard(State) {
    const panel = document.getElementById('content-panel');
    if (!panel) return;

    // 1. Data Processing
    const scoredLeads = Object.values(State.scoredMap);
    const totalLeads = State.leads.length;
    const totalScored = scoredLeads.length;

    const statusCounts = {
        'fast-track': scoredLeads.filter(l => l.status === 'fast-track').length,
        'nurture': scoredLeads.filter(l => l.status === 'nurture').length,
        'rejected': scoredLeads.filter(l => ['auto-reject', 'not-suitable'].includes(l.status)).length,
        'pending': totalLeads - totalScored
    };

    // 2. Build Dashboard Layout
    panel.innerHTML = `
    <div class="dashboard-visual">
        <div class="dash-header">
            <h1 class="dash-title">Performance Analytics</h1>
            <div class="kpi-mini-row">
                <div class="kpi-mini"><b>${totalLeads}</b><span>Total Leads</span></div>
                <div class="kpi-mini"><b>${totalScored}</b><span>Scored</span></div>
            </div>
        </div>

        <div class="charts-grid">
            <div class="chart-container">
                <h4>Lead Qualification Status</h4>
                <canvas id="statusChart"></canvas>
            </div>
            <div class="chart-container">
                <h4>Section Average Scores (out of 5)</h4>
                <canvas id="sectionChart"></canvas>
            </div>
            <div class="chart-container full-width">
                <h4>Officer Productivity</h4>
                <canvas id="officerChart"></canvas>
            </div>
        </div>
    </div>`;

    // 3. Initialize Charts
    initCharts(statusCounts, scoredLeads);
}

function initCharts(statusCounts, scoredLeads) {
    // --- Chart 1: Status (Doughnut) ---
    new Chart(document.getElementById('statusChart'), {
        type: 'doughnut',
        data: {
            labels: ['Fast-Track', 'Nurture', 'Rejected', 'Pending'],
            datasets: [{
                data: [statusCounts['fast-track'], statusCounts['nurture'], statusCounts.rejected, statusCounts.pending],
                backgroundColor: ['#16a34a', '#d97706', '#dc2626', '#333'],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { position: 'bottom', labels: { color: '#fff' } } } }
    });

    // --- Chart 2: Section Averages (Radar) ---
    const sectionLabels = SECTIONS.map(s => s.part);
    const sectionAverages = SECTIONS.map(sec => {
        const vals = scoredLeads.map(l => l.scores?.[sec.id]).filter(v => v != null);
        return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0;
    });

    new Chart(document.getElementById('sectionChart'), {
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
            scales: { r: { grid: { color: '#333' }, angleLines: { color: '#333' }, ticks: { display: false }, suggestMin: 0, suggestMax: 5 } },
            plugins: { legend: { display: false } }
        }
    });

    // --- Chart 3: Officer Breakdown (Bar) ---
    const officerData = {};
    scoredLeads.forEach(l => {
        const name = l.lead_alloc || 'Unassigned';
        if (!officerData[name]) officerData[name] = 0;
        officerData[name]++;
    });

    new Chart(document.getElementById('officerChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(officerData),
            datasets: [{
                label: 'Leads Processed',
                data: Object.values(officerData),
                backgroundColor: '#dc2626'
            }]
        },
        options: {
            scales: {
                y: { grid: { color: '#111' }, ticks: { color: '#666' } },
                x: { grid: { display: false }, ticks: { color: '#fff' } }
            }
        }
    });
}