'use strict';

// ── Service Worker ──────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ── DOM helper ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Auth ────────────────────────────────────────────────────────────────────
function getUser() {
  try { return JSON.parse(localStorage.getItem('homesnap_user') || 'null'); }
  catch { return null; }
}

function saveUser(user) {
  localStorage.setItem('homesnap_user', JSON.stringify(user));
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function ensureMonthReset(user) {
  const mk = getCurrentMonthKey();
  if (user.monthKey !== mk) {
    user.snapCountThisMonth = 0;
    user.monthKey = mk;
    saveUser(user);
  }
  return user;
}

function login(email, password) {
  const existing = getUser();
  if (existing && existing.email === email) {
    // Accept any password for the stored user (demo auth)
    return { success: true, user: existing };
  }
  if (existing && existing.email !== email) {
    return { success: false, error: 'Wrong email or password' };
  }
  // No user exists yet — auto create on sign in too (simplifies demo)
  return signup(email, password);
}

function signup(email, password) {
  if (!email || !password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }
  const existing = getUser();
  if (existing && existing.email === email) {
    return { success: false, error: 'Account already exists. Please sign in.' };
  }
  const user = {
    email,
    name: email.split('@')[0],
    plan: 'free',
    createdAt: new Date().toISOString(),
    snapCountThisMonth: 0,
    monthKey: getCurrentMonthKey()
  };
  saveUser(user);
  return { success: true, user };
}

function logout() {
  localStorage.removeItem('homesnap_user');
  location.reload();
}

// ── Snap history ─────────────────────────────────────────────────────────────
function getHistory() {
  try { return JSON.parse(localStorage.getItem('homesnap_history') || '[]'); }
  catch { return []; }
}

function saveSnap(snap) {
  const history = getHistory();
  history.unshift(snap);
  if (history.length > 100) history.length = 100;
  localStorage.setItem('homesnap_history', JSON.stringify(history));
}

function deleteSnap(id) {
  const history = getHistory().filter(s => s.id !== id);
  localStorage.setItem('homesnap_history', JSON.stringify(history));
}

// ── Currency ─────────────────────────────────────────────────────────────────
function detectCurrency() {
  const locale = navigator.language || 'en-US';
  const region = locale.split('-')[1] || '';
  const map = {
    AE: 'AED', SA: 'SAR', US: 'USD', GB: 'GBP',
    DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR',
    IN: 'INR', AU: 'AUD', CA: 'CAD', SG: 'SGD', JP: 'JPY',
    PK: 'PKR', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR',
    NG: 'NGN', KE: 'KES', ZA: 'ZAR', BR: 'BRL', CN: 'CNY',
    MX: 'MXN', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK',
    NZ: 'NZD', HK: 'HKD', MY: 'MYR', TH: 'THB', PH: 'PHP'
  };
  return map[region] || 'USD';
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Auth UI ───────────────────────────────────────────────────────────────────
let authMode = 'signin';

function switchAuthTab(mode) {
  authMode = mode;
  $('tab-signin').classList.toggle('active', mode === 'signin');
  $('tab-signup').classList.toggle('active', mode === 'signup');
  $('auth-submit-btn').textContent = mode === 'signin' ? 'Sign In' : 'Create Account';
  $('auth-error').classList.add('hidden');
  $('auth-error').textContent = '';
}

function handleAuth(e) {
  e.preventDefault();
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value;
  const errorEl = $('auth-error');
  errorEl.classList.add('hidden');

  const result = authMode === 'signin' ? login(email, password) : signup(email, password);
  if (!result.success) {
    errorEl.textContent = result.error;
    errorEl.classList.remove('hidden');
    return;
  }
  initApp(result.user);
}

// ── App init ──────────────────────────────────────────────────────────────────
function initApp(user) {
  user = ensureMonthReset(user);
  $('auth-screen').classList.add('hidden');
  $('app-shell').classList.remove('hidden');

  // Header
  const initial = (user.email || 'U')[0].toUpperCase();
  $('user-avatar').textContent = initial;
  $('user-dropdown-email').textContent = user.email;
  $('user-dropdown-plan').textContent = user.plan === 'pro' ? '⚡ Pro Plan' : '🔒 Free Plan';

  // Profile tab
  $('profile-avatar').textContent = initial;
  $('profile-email').textContent = user.email;
  updateProfileUI(user);

  // Bind file inputs
  bindFileInput('file-camera');
  bindFileInput('file-upload');
  $('preview-change').addEventListener('click', () => {
    setImage(null);
    $('file-camera').click();
  });
  $('analyze-btn').addEventListener('click', analyze);

  // Close user menu on outside click
  document.addEventListener('click', e => {
    const wrap = $('user-avatar-wrap');
    if (wrap && !wrap.contains(e.target)) {
      $('user-dropdown').classList.add('hidden');
    }
  });
}

function toggleUserMenu() {
  $('user-dropdown').classList.toggle('hidden');
}

function updateProfileUI(user) {
  const planBadge = $('profile-plan-badge');
  const usageCard = $('usage-card');
  const upgradeBtn = $('upgrade-btn');

  if (user.plan === 'pro') {
    planBadge.textContent = '⚡ Pro';
    planBadge.style.background = 'linear-gradient(135deg, rgba(108,99,255,0.2), rgba(167,139,250,0.1))';
    planBadge.style.color = '#a78bfa';
    planBadge.style.border = '1px solid rgba(108,99,255,0.3)';
    usageCard.innerHTML = `
      <div class="usage-header">
        <span class="usage-label">Snaps this month</span>
        <span class="usage-count" style="color:var(--accent2)">Unlimited</span>
      </div>
      <p class="usage-note" style="color:var(--green)">Pro plan active — snap without limits</p>
    `;
    upgradeBtn.style.display = 'none';
  } else {
    const count = user.snapCountThisMonth || 0;
    const max = 5;
    const remaining = Math.max(0, max - count);
    const pct = Math.min(100, (count / max) * 100);
    planBadge.textContent = 'Free';
    $('usage-count').textContent = `${count} / ${max}`;
    $('usage-fill').style.width = `${pct}%`;
    $('usage-fill').style.background = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'var(--accent)';
    $('usage-note').textContent = remaining > 0 ? `${remaining} snap${remaining === 1 ? '' : 's'} remaining this month` : 'Limit reached — upgrade for unlimited snaps';
    upgradeBtn.style.display = '';
  }
}

// ── Tab switching ────────────────────────────────────────────────────────────
function switchTab(tab) {
  ['snap', 'history', 'profile'].forEach(t => {
    $(`tab-${t}`).classList.toggle('active', t === tab);
    $(`nav-${t}`).classList.toggle('active', t === tab);
  });
  if (tab === 'history') renderHistory();
  if (tab === 'profile') {
    const user = getUser();
    if (user) updateProfileUI(ensureMonthReset(user));
  }
  window.scrollTo({ top: 0 });
}

// ── File inputs ───────────────────────────────────────────────────────────────
let imageDataUrl = null;

function bindFileInput(id) {
  $(id).addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImage(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  });
}

function setImage(dataUrl) {
  imageDataUrl = dataUrl;
  const placeholder = $('capture-placeholder');
  const previewWrap = $('preview-wrap');
  const previewImage = $('preview-image');
  const captureZone = $('capture-zone');
  const analyzeSection = $('analyze-section');
  const resultsSection = $('results-section');
  const errorToast = $('error-toast');

  if (dataUrl) {
    previewImage.src = dataUrl;
    placeholder.classList.add('hidden');
    previewWrap.classList.remove('hidden');
    captureZone.classList.add('has-image');
    analyzeSection.classList.remove('hidden');
  } else {
    placeholder.classList.remove('hidden');
    previewWrap.classList.add('hidden');
    captureZone.classList.remove('has-image');
    analyzeSection.classList.add('hidden');
  }
  resultsSection.classList.add('hidden');
  errorToast.classList.add('hidden');
}

// ── Loading messages ──────────────────────────────────────────────────────────
const loadingMessages = [
  'Analyzing image...',
  'Identifying appliance...',
  'Calculating efficiency scores...',
  'Checking market status...',
  'Almost done...'
];
let loadingInterval = null;
let loadingIndex = 0;

function startLoadingMessages() {
  const el = $('loading-msg');
  loadingIndex = 0;
  el.textContent = loadingMessages[0];
  el.classList.remove('hidden');
  loadingInterval = setInterval(() => {
    loadingIndex = (loadingIndex + 1) % loadingMessages.length;
    el.textContent = loadingMessages[loadingIndex];
  }, 1200);
}

function stopLoadingMessages() {
  if (loadingInterval) { clearInterval(loadingInterval); loadingInterval = null; }
  $('loading-msg').classList.add('hidden');
}

// ── Analyze ───────────────────────────────────────────────────────────────────
async function analyze() {
  if (!imageDataUrl) return;

  const user = ensureMonthReset(getUser());
  if (!user) return;

  // Free tier check
  if (user.plan !== 'pro' && user.snapCountThisMonth >= 5) {
    showUpgradeModal();
    return;
  }

  setLoading(true);
  $('error-toast').classList.add('hidden');
  $('results-section').classList.add('hidden');

  const base64 = imageDataUrl.split(',')[1];
  const mediaType = imageDataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
  const currency = detectCurrency();

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mediaType, currency })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

    if (!data.identified) {
      showError("Hmm, I couldn't identify a home appliance in this image. Try a clearer photo of the device, ideally showing the front panel or label.");
      return;
    }

    // Increment snap count
    user.snapCountThisMonth = (user.snapCountThisMonth || 0) + 1;
    saveUser(user);

    // Auto-save to history
    const snap = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      imageDataUrl: imageDataUrl,
      deviceName: data.device_name || 'Unknown Device',
      brand: data.brand || '',
      category: data.category || '',
      overallScore: data.overall_rating?.score || 0,
      overallLabel: data.overall_rating?.label || '',
      currency,
      result: data
    };
    saveSnap(snap);

    renderResults(data, snap.id, imageDataUrl);
    updateProfileUI(ensureMonthReset(getUser()));
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
  } finally {
    setLoading(false);
  }
}

function setLoading(on) {
  const analyzeBtn = $('analyze-btn');
  analyzeBtn.disabled = on;
  analyzeBtn.classList.toggle('loading', on);
  $('btn-text').classList.toggle('hidden', on);
  $('btn-spinner').classList.toggle('hidden', !on);
  if (on) startLoadingMessages(); else stopLoadingMessages();
}

function showError(msg) {
  const errorToast = $('error-toast');
  errorToast.textContent = msg;
  errorToast.classList.remove('hidden');
  errorToast.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Share as image card ───────────────────────────────────────────────────────
async function shareResult(result, imageDataUrl) {
  const blob = await generateShareCard(result, imageDataUrl);
  const file = new File([blob], 'homesnap-report.png', { type: 'image/png' });

  try {
    // Try native share with image (works on iOS Safari, Android Chrome → WhatsApp, Email, Save)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `HomeSnap: ${result.device_name}`,
        text: `Appliance report for ${result.device_name}`,
        files: [file]
      });
      return;
    }
    // Fallback: download as PNG
    downloadBlob(blob, 'homesnap-report.png');
    showToast('Report saved to your device!');
  } catch (err) {
    if (err.name === 'AbortError') return;
    // Final fallback: download
    downloadBlob(blob, 'homesnap-report.png');
    showToast('Report saved to your device!');
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function generateShareCard(result, imageDataUrl) {
  return new Promise(resolve => {
    const W = 800, H = 1000;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#0f0f13';
    ctx.fillRect(0, 0, W, H);

    // Top accent bar
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#6c63ff'); grad.addColorStop(1, '#a78bfa');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 6);

    // Header
    ctx.fillStyle = '#6c63ff';
    roundRect(ctx, 32, 28, 44, 44, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('HS', 54, 55);
    ctx.fillStyle = '#f0f0f8';
    ctx.font = 'bold 18px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('HomeSnap', 88, 55);
    ctx.fillStyle = '#6b7280';
    ctx.font = '13px system-ui';
    ctx.fillText('Appliance Intelligence Report', 88, 72);

    // Divider
    ctx.strokeStyle = '#1e1e2e';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(32, 90); ctx.lineTo(W - 32, 90); ctx.stroke();

    // Appliance image thumbnail (if available)
    let yPos = 110;
    const drawContent = () => {
      // Device name section
      ctx.fillStyle = '#1a1a24';
      roundRect(ctx, 32, yPos, W - 64, 90, 12);
      ctx.fill();
      ctx.strokeStyle = '#2e2e3e';
      ctx.lineWidth = 1;
      roundRect(ctx, 32, yPos, W - 64, 90, 12);
      ctx.stroke();

      ctx.fillStyle = '#f0f0f8';
      ctx.font = 'bold 22px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(result.device_name || 'Unknown Device', 52, yPos + 34);
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px system-ui';
      const meta = [result.brand, result.model !== 'Unknown' ? result.model : null, result.category].filter(Boolean).join(' · ');
      ctx.fillText(meta, 52, yPos + 58);

      // Score badge
      const score = result.overall_rating?.score || 0;
      const scoreColor = score >= 8 ? '#10b981' : score >= 6 ? '#f59e0b' : score >= 4 ? '#fb923c' : '#ef4444';
      ctx.fillStyle = scoreColor;
      ctx.font = 'bold 28px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(`${score}/10`, W - 52, yPos + 44);
      ctx.font = '12px system-ui';
      ctx.fillText(result.overall_rating?.label || '', W - 52, yPos + 64);

      yPos += 110;

      // Badges row
      const badges = [
        { text: result.year_estimate || '', color: '#6c63ff', bg: 'rgba(108,99,255,0.15)' },
        { text: result.market_status?.status || '', color: result.market_status?.status === 'Current' ? '#10b981' : '#f59e0b', bg: result.market_status?.status === 'Current' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)' },
        { text: result.replacement?.urgency || '', color: result.replacement?.urgency?.includes('Not') ? '#10b981' : result.replacement?.urgency?.includes('Consider') ? '#f59e0b' : '#ef4444', bg: result.replacement?.urgency?.includes('Not') ? 'rgba(16,185,129,0.15)' : result.replacement?.urgency?.includes('Consider') ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)' }
      ];
      let bx = 32;
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'left';
      badges.forEach(b => {
        if (!b.text) return;
        const tw = ctx.measureText(b.text).width + 24;
        ctx.fillStyle = b.bg;
        roundRect(ctx, bx, yPos, tw, 28, 14);
        ctx.fill();
        ctx.fillStyle = b.color;
        ctx.fillText(b.text, bx + 12, yPos + 18);
        bx += tw + 8;
      });
      yPos += 48;

      // Data grid — 2 columns
      const cards = [
        { icon: '⏱', label: 'Age', value: result.age_years || '-' },
        { icon: '🏭', label: 'Build Quality', value: result.manufacturing_quality?.label || '-' },
        { icon: '🌿', label: 'Environment', value: result.environmental_impact?.label || '-', sub: result.environmental_impact?.energy_rating },
        { icon: '⚡', label: 'Running Cost', value: result.utility_bills?.annual_estimate || '-' },
        { icon: '🔄', label: 'Replace In', value: result.replacement?.timeline || '-' },
        { icon: '📊', label: 'Market Status', value: result.market_status?.status || '-' },
      ];

      const cW = (W - 64 - 16) / 2;
      cards.forEach((c, i) => {
        const cx = 32 + (i % 2) * (cW + 16);
        const cy = yPos + Math.floor(i / 2) * 110;
        ctx.fillStyle = '#1a1a24';
        roundRect(ctx, cx, cy, cW, 96, 12);
        ctx.fill();
        ctx.strokeStyle = '#2e2e3e';
        roundRect(ctx, cx, cy, cW, 96, 12);
        ctx.stroke();

        ctx.font = '20px system-ui';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.fillText(c.icon, cx + 16, cy + 30);

        ctx.fillStyle = '#6b7280';
        ctx.font = '11px system-ui';
        ctx.fillText(c.label.toUpperCase(), cx + 16, cy + 52);

        ctx.fillStyle = '#f0f0f8';
        ctx.font = 'bold 15px system-ui';
        const val = c.value.length > 18 ? c.value.slice(0, 16) + '…' : c.value;
        ctx.fillText(val, cx + 16, cy + 72);
        if (c.sub) {
          ctx.fillStyle = '#6b7280';
          ctx.font = '11px system-ui';
          ctx.fillText(c.sub, cx + 16, cy + 86);
        }
      });

      yPos += 3 * 110 + 16;

      // Verdict
      if (result.overall_rating?.verdict) {
        ctx.fillStyle = '#1a1a24';
        roundRect(ctx, 32, yPos, W - 64, 70, 12);
        ctx.fill();
        ctx.strokeStyle = '#2e2e3e';
        roundRect(ctx, 32, yPos, W - 64, 70, 12);
        ctx.stroke();
        ctx.fillStyle = '#6b7280';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText('OVERALL ASSESSMENT', 52, yPos + 22);
        ctx.fillStyle = '#f0f0f8';
        ctx.font = '13px system-ui';
        const verdict = result.overall_rating.verdict;
        const words = verdict.split(' ');
        let line = '', lines = [], maxW = W - 120;
        words.forEach(w => {
          const test = line ? `${line} ${w}` : w;
          if (ctx.measureText(test).width > maxW) { lines.push(line); line = w; }
          else line = test;
        });
        if (line) lines.push(line);
        lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, 52, yPos + 42 + i * 18));
        yPos += 86;
      }

      // Footer
      ctx.fillStyle = '#2e2e3e';
      ctx.fillRect(32, H - 50, W - 64, 1);
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('home-snap-pwa.vercel.app', 32, H - 20);
      ctx.textAlign = 'right';
      ctx.fillText(new Date().toLocaleDateString(), W - 32, H - 20);

      canvas.toBlob(resolve, 'image/png');
    };

    // If we have a snap image, draw it
    if (imageDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#1a1a24';
        roundRect(ctx, 32, yPos, W - 64, 160, 12);
        ctx.fill();
        // Draw image centered/cropped
        const iAspect = img.width / img.height;
        const boxW = W - 64, boxH = 160;
        let iW = boxW, iH = iW / iAspect;
        if (iH < boxH) { iH = boxH; iW = iH * iAspect; }
        const ix = 32 + (boxW - iW) / 2, iy = yPos + (boxH - iH) / 2;
        ctx.save();
        roundRect(ctx, 32, yPos, W - 64, 160, 12);
        ctx.clip();
        ctx.drawImage(img, ix, iy, iW, iH);
        ctx.restore();
        yPos += 176;
        drawContent();
      };
      img.onerror = () => { yPos += 0; drawContent(); };
      img.src = imageDataUrl;
    } else {
      drawContent();
    }
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Render Results ────────────────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 8) return 'green';
  if (score >= 6) return 'yellow';
  if (score >= 4) return 'orange';
  return 'red';
}

function badgeClass(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('good') || l.includes('excel') || l.includes('eco') || l.includes('current') || l.includes('low')) return 'badge-green';
  if (l.includes('average') || l.includes('medium') || l.includes('consider') || l.includes('updated')) return 'badge-yellow';
  if (l.includes('poor') || l.includes('high impact') || l.includes('replace now') || l.includes('discontin')) return 'badge-red';
  return 'badge-purple';
}

function urgencyBadge(u) {
  if (!u) return 'badge-purple';
  const l = u.toLowerCase();
  if (l.includes('not')) return 'badge-green';
  if (l.includes('consider')) return 'badge-yellow';
  if (l.includes('replace now')) return 'badge-red';
  return 'badge-orange';
}

function scoreTextColor(score) {
  if (!score) return 'var(--text)';
  if (score >= 8) return 'var(--green)';
  if (score >= 6) return 'var(--yellow)';
  if (score >= 4) return 'var(--orange)';
  return 'var(--red)';
}

function scoreIconBg(score) {
  if (!score) return '167,139,250,0.15';
  if (score >= 8) return '52,211,153,0.15';
  if (score >= 6) return '251,191,36,0.15';
  if (score >= 4) return '251,146,60,0.15';
  return '248,113,113,0.15';
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildResultHTML(r) {
  return `
    <div class="result-header">
      <div class="device-name">${esc(r.device_name)}</div>
      <div style="color:var(--text-muted);font-size:0.85rem;margin-top:2px">${esc(r.brand)}${r.model && r.model !== 'Unknown' ? ' · ' + esc(r.model) : ''} · ${esc(r.category)}</div>
      <div class="device-meta">
        <span class="badge badge-purple">${esc(r.year_estimate)}</span>
        <span class="badge ${badgeClass(r.overall_rating?.label)}">${esc(r.overall_rating?.label)}</span>
        <span class="badge ${badgeClass(r.market_status?.status)}">${esc(r.market_status?.status)}</span>
        ${r.confidence === 'low' ? '<span class="badge badge-orange">Low confidence</span>' : ''}
      </div>
    </div>

    <div class="cards-grid">
      <div class="card">
        <div class="card-icon" style="background:rgba(167,139,250,0.15)">⏱️</div>
        <div class="card-label">Age</div>
        <div class="card-value">${esc(r.age_years)}</div>
        <div class="card-sub">${esc(r.year_estimate)}</div>
      </div>
      <div class="card">
        <div class="card-icon" style="background:rgba(${scoreIconBg(r.manufacturing_quality?.score)})">🏭</div>
        <div class="card-label">Build Quality</div>
        <div class="card-value" style="color:${scoreTextColor(r.manufacturing_quality?.score)}">${esc(r.manufacturing_quality?.label)}</div>
        <div class="score-bar"><div class="score-fill ${scoreColor(r.manufacturing_quality?.score)}" style="width:${(r.manufacturing_quality?.score || 0) * 10}%"></div></div>
        <div class="card-sub">${esc(r.manufacturing_quality?.detail)}</div>
      </div>
      <div class="card">
        <div class="card-icon" style="background:rgba(52,211,153,0.15)">🌿</div>
        <div class="card-label">Environment</div>
        <div class="card-value" style="color:${scoreTextColor(r.environmental_impact?.score)}">${esc(r.environmental_impact?.label)}</div>
        <div class="score-bar"><div class="score-fill ${scoreColor(r.environmental_impact?.score)}" style="width:${(r.environmental_impact?.score || 0) * 10}%"></div></div>
        <div class="card-sub">Rating: <strong>${esc(r.environmental_impact?.energy_rating)}</strong></div>
      </div>
      <div class="card">
        <div class="card-icon" style="background:rgba(251,191,36,0.15)">⚡</div>
        <div class="card-label">Running Cost</div>
        <div class="card-value">${esc(r.utility_bills?.annual_estimate)}</div>
        <div class="score-bar"><div class="score-fill ${scoreColor(11 - (r.utility_bills?.score || 5))}" style="width:${(r.utility_bills?.score || 0) * 10}%"></div></div>
        <div class="card-sub">${esc(r.utility_bills?.label)}</div>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="card-icon" style="background:rgba(248,113,113,0.15)">🔄</div>
          <div>
            <div class="card-label">Replacement</div>
            <div class="card-value">${esc(r.replacement?.timeline)}</div>
          </div>
        </div>
        <span class="badge ${urgencyBadge(r.replacement?.urgency)}">${esc(r.replacement?.urgency)}</span>
      </div>
      <div class="card-sub">${esc(r.replacement?.reason)}</div>
    </div>

    <div class="verdict-card">
      <h4>Market Status</h4>
      <p>${esc(r.market_status?.detail)}</p>
    </div>

    <div class="verdict-card">
      <h4>Overall Assessment</h4>
      <p>${esc(r.overall_rating?.verdict)}</p>
      ${r.fun_fact ? `<p style="margin-top:10px;color:var(--accent2);font-size:0.82rem;padding-top:10px;border-top:1px solid var(--border)">💡 ${esc(r.fun_fact)}</p>` : ''}
    </div>
  `;
}

function renderResults(r, snapId, imageDataUrl) {
  const resultsSection = $('results-section');

  const html = buildResultHTML(r) + `
    <div class="result-actions">
      <button class="result-action-btn" onclick="shareResult(window.__lastResult, window.__lastImageDataUrl)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        Share
      </button>
      <button class="result-action-btn result-action-primary" onclick="switchTab('history');showToast('Saved to history!')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        View in History
      </button>
    </div>

    <button class="reset-btn" id="reset-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
      </svg>
      Scan another appliance
    </button>
  `;

  window.__lastResult = r;
  window.__lastImageDataUrl = imageDataUrl;
  resultsSection.innerHTML = html;
  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth' });

  // Animate score bars
  setTimeout(() => {
    document.querySelectorAll('#results-section .score-fill').forEach(el => {
      const w = el.style.width;
      el.style.width = '0';
      setTimeout(() => { el.style.width = w; }, 50);
    });
  }, 100);

  $('reset-btn').addEventListener('click', () => {
    setImage(null);
    resultsSection.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ── History ───────────────────────────────────────────────────────────────────
function renderHistory() {
  const history = getHistory();
  const grid = $('history-grid');
  const empty = $('history-empty');
  const user = ensureMonthReset(getUser());

  if (!history.length) {
    empty.classList.remove('hidden');
    grid.innerHTML = '';
    return;
  }

  empty.classList.add('hidden');

  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const isPro = user && user.plan === 'pro';

  grid.innerHTML = history.map((snap, idx) => {
    const isOld = !isPro && new Date(snap.createdAt).getTime() < thirtyDaysAgo;
    const scoreC = snap.overallScore >= 7 ? 'badge-green' : snap.overallScore >= 5 ? 'badge-yellow' : 'badge-red';
    const date = new Date(snap.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    return `
      <div class="snap-card ${isOld ? 'snap-card-blurred' : ''}" data-id="${esc(snap.id)}" onclick="openSnapDetail('${esc(snap.id)}')">
        <div class="snap-card-img-wrap">
          <img src="${esc(snap.imageDataUrl)}" alt="${esc(snap.deviceName)}" loading="lazy" />
          ${isOld ? '<div class="snap-blur-overlay"><span>30-day limit</span><button class="snap-upgrade-cta" onclick="event.stopPropagation();showUpgradeModal()">Upgrade</button></div>' : ''}
        </div>
        <div class="snap-card-body">
          <div class="snap-card-name">${esc(snap.deviceName)}</div>
          <div class="snap-card-meta">${esc(snap.category)} · ${date}</div>
          <div class="snap-card-footer">
            <span class="badge ${scoreC}" style="font-size:0.65rem">${esc(snap.overallLabel) || snap.overallScore + '/10'}</span>
            <button class="snap-delete-btn" onclick="event.stopPropagation();confirmDeleteSnap('${esc(snap.id)}')" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function confirmDeleteSnap(id) {
  if (!confirm('Delete this snap from history?')) return;
  deleteSnap(id);
  renderHistory();
  showToast('Snap deleted');
}

// ── Detail Sheet ───────────────────────────────────────────────────────────────
function openSnapDetail(id) {
  const history = getHistory();
  const snap = history.find(s => s.id === id);
  if (!snap) return;

  const content = $('sheet-content');
  content.innerHTML = `
    <div class="sheet-img-wrap">
      <img src="${esc(snap.imageDataUrl)}" alt="${esc(snap.deviceName)}" />
    </div>
    ${buildResultHTML(snap.result)}
    <div class="result-actions" style="margin-top:16px">
      <button class="result-action-btn" onclick="shareResult(${JSON.stringify(snap.result).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026')})">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        Share
      </button>
      <button class="result-action-btn result-action-danger" onclick="confirmDeleteSnap('${esc(snap.id)}');closeSheet()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
        Delete
      </button>
    </div>
    <div style="height:24px"></div>
  `;

  // Animate score bars in sheet
  setTimeout(() => {
    content.querySelectorAll('.score-fill').forEach(el => {
      const w = el.style.width;
      el.style.width = '0';
      setTimeout(() => { el.style.width = w; }, 50);
    });
  }, 200);

  $('sheet-overlay').classList.remove('hidden');
  $('detail-sheet').classList.remove('hidden');
  $('detail-sheet').classList.add('sheet-open');
  document.body.style.overflow = 'hidden';
}

function closeSheet() {
  $('detail-sheet').classList.remove('sheet-open');
  setTimeout(() => {
    $('sheet-overlay').classList.add('hidden');
    $('detail-sheet').classList.add('hidden');
    document.body.style.overflow = '';
  }, 320);
}

// ── Upgrade Modal ──────────────────────────────────────────────────────────────
const PLAN_PRICES = {
  pro: {
    USD:'$4.99', GBP:'£3.99', EUR:'€4.49', AED:'AED 18',
    SAR:'SAR 18', QAR:'QAR 18', KWD:'KWD 1.5', BHD:'BHD 1.9',
    OMR:'OMR 1.9', INR:'₹399', AUD:'A$7.99', CAD:'C$6.99',
    SGD:'S$6.99', NZD:'NZ$7.99', HKD:'HK$39', JPY:'¥750',
    CNY:'¥35', PKR:'PKR 1,400', BRL:'R$24.9', MXN:'MX$89',
    ZAR:'R89', NGN:'₦7,500', KES:'KES 650', CHF:'CHF 4.49',
    SEK:'SEK 52', NOK:'NOK 52', DKK:'DKK 33', MYR:'RM 22',
    THB:'฿179', PHP:'₱289',
  },
  business: {
    USD:'$19.99', GBP:'£15.99', EUR:'€17.99', AED:'AED 73',
    SAR:'SAR 75', QAR:'QAR 73', KWD:'KWD 6.1', BHD:'BHD 7.5',
    OMR:'OMR 7.7', INR:'₹1,599', AUD:'A$29.99', CAD:'C$26.99',
    SGD:'S$26.99', NZD:'NZ$29.99', HKD:'HK$155', JPY:'¥2,999',
    CNY:'¥145', PKR:'PKR 5,500', BRL:'R$99', MXN:'MX$349',
    ZAR:'R349', NGN:'₦29,999', KES:'KES 2,599', CHF:'CHF 17.99',
    SEK:'SEK 209', NOK:'NOK 209', DKK:'DKK 134', MYR:'RM 89',
    THB:'฿699', PHP:'₱1,149',
  },
};

function showUpgradeModal() {
  const currency = detectCurrency();
  const proEl = $('modal-price-pro');
  if (proEl) proEl.textContent = PLAN_PRICES.pro[currency] || PLAN_PRICES.pro.USD;
  const bizEl = $('modal-price-biz');
  if (bizEl) bizEl.textContent = PLAN_PRICES.business[currency] || PLAN_PRICES.business.USD;
  $('upgrade-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function hideUpgradeModal() {
  $('upgrade-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

const PLAN_LABELS = { pro: '⚡ Pro', business: '🏢 Business', enterprise: '🌐 Enterprise' };

function activatePlan(plan) {
  const user = getUser();
  if (!user) return;
  user.plan = plan;
  saveUser(user);
  hideUpgradeModal();
  updateProfileUI(ensureMonthReset(user));
  $('user-dropdown-plan').textContent = `${PLAN_LABELS[plan] || plan} Plan`;
  showToast(`${PLAN_LABELS[plan]} plan activated!`, 'success');
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
(function boot() {
  const user = getUser();
  if (user) {
    initApp(user);
  } else {
    $('auth-screen').classList.remove('hidden');
    $('app-shell').classList.add('hidden');
  }
})();
