// ═══════════════════════════════════════════════════════════════
// auth.js — Team Filter Password Gate
// ═══════════════════════════════════════════════════════════════

// ── PASSWORD MAP ───────────────────────────────────────────────
const TEAM_PASSWORDS = {
  'master':          'Jyoti7andy!',
  'All Team Members':'Jyoti7andy!',
  'Unassigned':      'Jyoti7andy!',
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
  'Vruddhi':         'GrowHigher123',
  'Pawan':            'BraveSoul123',
  'Tulsi':            'BrightSun123',
  'Bhavith':           'HappyDay123',
  'Sharv':            'CalmSea123',
};

// ── SESSION STATE ──────────────────────────────────────────────
const _authUnlocked    = new Set();
let _authLastGoodAlloc = null;
let _pendingAllocValue = null;
let _onAuthSuccess     = null;
let _onAuthCancel      = null;

// ── CACHED DOM REFS ────────────────────────────────────────────
let _authEls = null;

// ── BUILD MODAL ────────────────────────────────────────────────
function _buildModal() {
  if (_authEls) return;

  const overlay = document.createElement('div');
  overlay.id        = 'auth-overlay';
  overlay.className = 'auth-overlay';

  // Build with a STABLE structure — no innerHTML will ever replace these nodes
  overlay.innerHTML = `
    <div class="auth-card">
      <div class="auth-icon">🔒</div>
      <div class="auth-title"></div>
      <p class="auth-sub-static">Enter the password to access <b class="auth-name-label"></b>'s leads.</p>
      <div class="auth-input-wrap">
        <input class="auth-input" type="password" placeholder="Enter password" autocomplete="new-password" />
        <span class="auth-eye">👁</span>
      </div>
      <div class="auth-error">⚠ Incorrect password. Try again.</div>
      <button class="auth-btn">Unlock →</button>
      <span class="auth-cancel">Cancel</span>
    </div>`;

  document.body.appendChild(overlay);

  // Cache refs once — these elements are NEVER removed or replaced
  _authEls = {
    overlay,
    title:  overlay.querySelector('.auth-title'),
    nameEl: overlay.querySelector('.auth-name-label'),  // only .textContent is ever set
    input:  overlay.querySelector('.auth-input'),
    eye:    overlay.querySelector('.auth-eye'),
    error:  overlay.querySelector('.auth-error'),
    btn:    overlay.querySelector('.auth-btn'),
    cancel: overlay.querySelector('.auth-cancel'),
  };

  // Wire events once
  _authEls.btn.addEventListener('click',     _authSubmit);
  _authEls.cancel.addEventListener('click',  _authCancel);
  _authEls.eye.addEventListener('click',     _authToggleEye);
  _authEls.input.addEventListener('keydown', e => { if (e.key === 'Enter') _authSubmit(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) _authCancel(); });
}

document.addEventListener('DOMContentLoaded', _buildModal);

// ── PUBLIC API ─────────────────────────────────────────────────
function requireAuthForAlloc(allocValue, onSuccess, onCancel) {
  // Already unlocked?
  if (_authUnlocked.has('master'))   { onSuccess(); return; }
  if (_authUnlocked.has(allocValue)) { onSuccess(); return; }

  _pendingAllocValue = allocValue;
  _onAuthSuccess     = onSuccess;
  _onAuthCancel      = onCancel || null;

  if (!_authEls) _buildModal();
  if (!_authEls) { console.error('[auth] Modal build failed'); return; }

  const displayName = allocValue || 'All Team Members';

  // Update only .textContent — never touch innerHTML so refs stay valid
  _authEls.title.textContent  = allocValue ? `${displayName}'s View` : 'Full Team View';
  _authEls.nameEl.textContent = displayName;

  // Reset input & error
  _authEls.input.value = '';
  _authEls.input.type  = 'password';
  _authEls.input.classList.remove('error');
  _authEls.error.classList.remove('show');

  _authEls.overlay.classList.add('visible');
  setTimeout(() => _authEls.input.focus(), 80);
}

// ── SUBMIT ─────────────────────────────────────────────────────
function _authSubmit() {
  if (!_authEls) return;

  const entered  = _authEls.input.value.trim();
  const allocVal = _pendingAllocValue;          // "" = All Team, null = never set

  const masterPw  = TEAM_PASSWORDS['master'];
  const isMaster  = entered === masterPw;
  const isOwnPw   = !!allocVal && (entered === TEAM_PASSWORDS[allocVal]);

  // "All Team Members" (allocVal === '' or null) — master only
  // Individual name — own password OR master
  const valid = (!allocVal) ? isMaster : (isMaster || isOwnPw);

  if (valid) {
    if (isMaster) _authUnlocked.add('master');
    else          _authUnlocked.add(allocVal);

    _authLastGoodAlloc = allocVal;
    _authEls.overlay.classList.remove('visible');

    const cb       = _onAuthSuccess;
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

// ── CANCEL ─────────────────────────────────────────────────────
function _authCancel() {
  if (_authEls) _authEls.overlay.classList.remove('visible');

  const sel = document.getElementById('filter-alloc');
  if (sel) sel.value = _authLastGoodAlloc ?? '';

  const cb       = _onAuthCancel;
  _pendingAllocValue = null;
  _onAuthSuccess     = null;
  _onAuthCancel      = null;
  if (cb) cb();
}

// ── TOGGLE EYE ─────────────────────────────────────────────────
function _authToggleEye() {
  if (!_authEls) return;
  _authEls.input.type = (_authEls.input.type === 'password') ? 'text' : 'password';
}