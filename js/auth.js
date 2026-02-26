// ═══════════════════════════════════════════════════════════════
// auth.js — Team Filter Password Gate
// ═══════════════════════════════════════════════════════════════

// ── PASSWORD MAP ───────────────────────────────────────────────
const TEAM_PASSWORDS = {
  'master':          'BlueSky2026',
  'All Team Members':'HappyWork2026',
  'Unassigned':      'OpenDoor2026',
  'Anil':            'GreenLeaf123',
  'Brijraj':         'SunnyDay123',
  'Chef Akshay':     'FreshFood123',
  'Chef Mandeep':    'HotKitchen123',
  'Chef Rishi':      'TastyMeal123',
  'Hardik':          'FastRunner123',
  'Hardik Patel':    'SmartWorker123',
  'Himanshu':        'BrightLight123',
  'Mary':            'SweetHome123',
  'Neha':            'CalmRiver123',
  'Rohit':           'StrongPower123',
  'Sachin':          'GoodEnergy123',
  'Salim':           'CoolBreeze123',
  'Sapan':           'NewJourney123',
  'Sneha':           'KindHeart123',
  'Suruti':          'SoftCloud123',
  'Tejas':           'QuickStep123',
  'Vanshika':        'StarShine123',
  'Vruddhi':         'GrowHigher123'
}

// ── SESSION STATE ──────────────────────────────────────────────
const _authUnlocked    = new Set();
let _authLastGoodAlloc = null;   // null = never authed this session
let _pendingAllocValue = null;
let _onAuthSuccess     = null;
let _onAuthCancel      = null;

// ── CACHED DOM REFS (populated once modal is built) ────────────
let _authEls = null;

// ── BUILD MODAL (always deferred to DOMContentLoaded) ──────────
function _buildModal() {
  // Already built
  if (_authEls) return;

  const overlay = document.createElement('div');
  overlay.id        = 'auth-overlay';
  overlay.className = 'auth-overlay';
  overlay.innerHTML = `
    <div class="auth-card" id="auth-card">
      <div class="auth-icon">🔒</div>
      <div class="auth-title">Restricted Access</div>
      <p class="auth-sub">Enter the password to access <b class="auth-name-label">this view</b></p>
      <div class="auth-input-wrap">
        <input class="auth-input" type="password" placeholder="Enter password" autocomplete="off" />
        <span class="auth-eye">👁</span>
      </div>
      <div class="auth-error">⚠ Incorrect password. Try again.</div>
      <button class="auth-btn">Unlock →</button>
      <span class="auth-cancel">Cancel</span>
    </div>`;

  document.body.appendChild(overlay);

  // Cache every reference we'll ever need — no getElementById later
  const card     = overlay.querySelector('.auth-card');
  _authEls = {
    overlay,
    title:    overlay.querySelector('.auth-title'),
    sub:      overlay.querySelector('.auth-sub'),
    nameEl:   overlay.querySelector('.auth-name-label'),
    input:    overlay.querySelector('.auth-input'),
    eye:      overlay.querySelector('.auth-eye'),
    error:    overlay.querySelector('.auth-error'),
    btn:      overlay.querySelector('.auth-btn'),
    cancel:   overlay.querySelector('.auth-cancel'),
  };

  // Wire events via cached refs — no inline handlers
  _authEls.btn.addEventListener('click',    _authSubmit);
  _authEls.cancel.addEventListener('click', _authCancel);
  _authEls.eye.addEventListener('click',    _authToggleEye);
  _authEls.input.addEventListener('keydown', e => { if (e.key === 'Enter') _authSubmit(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) _authCancel(); });
}

// Always build after DOM is ready — no race condition
document.addEventListener('DOMContentLoaded', _buildModal);

// ── PUBLIC: gate the alloc filter ─────────────────────────────
function requireAuthForAlloc(allocValue, onSuccess, onCancel) {
  if (_authUnlocked.has('master'))   { onSuccess(); return; }
  if (_authUnlocked.has(allocValue)) { onSuccess(); return; }

  _pendingAllocValue = allocValue;
  _onAuthSuccess     = onSuccess;
  _onAuthCancel      = onCancel || null;

  // If somehow called before DOMContentLoaded (shouldn't happen but safe)
  if (!_authEls) { _buildModal(); }
  if (!_authEls) { console.error('[auth] Modal could not be built'); return; }

  const displayName = allocValue || 'All Team Members';
  _authEls.title.textContent  = allocValue ? `${displayName}'s View` : 'Full Team View';
  _authEls.nameEl.textContent = displayName;
  _authEls.sub.innerHTML      = `Enter the password to access <b class="auth-name-label">${displayName}</b>'s leads.`;
  _authEls.input.value        = '';
  _authEls.input.type         = 'password';
  _authEls.input.classList.remove('error');
  _authEls.error.classList.remove('show');

  _authEls.overlay.classList.add('visible');
  setTimeout(() => _authEls.input.focus(), 80);
}

// ── SUBMIT ────────────────────────────────────────────────────
function _authSubmit() {
  if (!_authEls) return;
  const entered  = _authEls.input.value.trim();
  const allocVal = _pendingAllocValue;

  const isMasterPw = entered === TEAM_PASSWORDS['master'];
  const isOwnPw    = allocVal && entered === TEAM_PASSWORDS[allocVal];
  const valid      = (allocVal === '' || allocVal === null) ? isMasterPw : (isMasterPw || isOwnPw);

  if (valid) {
    if (isMasterPw) _authUnlocked.add('master');
    else            _authUnlocked.add(allocVal);

    _authLastGoodAlloc = allocVal;
    _authEls.overlay.classList.remove('visible');

    const cb = _onAuthSuccess;
    _pendingAllocValue = null;
    _onAuthSuccess     = null;
    _onAuthCancel      = null;
    if (cb) cb();

  } else {
    _authEls.input.classList.add('error');
    _authEls.input.value = '';
    setTimeout(() => _authEls.input.classList.remove('error'), 600);
    _authEls.input.focus();
    _authEls.error.classList.add('show');
  }
}

// ── CANCEL ────────────────────────────────────────────────────
function _authCancel() {
  if (_authEls) _authEls.overlay.classList.remove('visible');

  // Revert the dropdown
  const sel = document.getElementById('filter-alloc');
  if (sel) sel.value = _authLastGoodAlloc ?? '';

  const cb = _onAuthCancel;
  _pendingAllocValue = null;
  _onAuthSuccess     = null;
  _onAuthCancel      = null;
  if (cb) cb();
}

// ── TOGGLE EYE ────────────────────────────────────────────────
function _authToggleEye() {
  if (!_authEls) return;
  _authEls.input.type = (_authEls.input.type === 'password') ? 'text' : 'password';
}