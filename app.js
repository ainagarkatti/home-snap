'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let imageDataUrl = null;

// ── DOM refs ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const captureZone    = $('capture-zone');
const placeholder    = $('capture-placeholder');
const previewWrap    = $('preview-wrap');
const previewImage   = $('preview-image');
const analyzeBtn     = $('analyze-btn');
const analyzeSection = $('analyze-section');
const resultsSection = $('results-section');
const errorToast     = $('error-toast');

// ── File inputs ────────────────────────────────────────────────────────────
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
bindFileInput('file-camera');
bindFileInput('file-upload');

$('preview-change').addEventListener('click', () => {
  setImage(null);
  $('file-camera').click();
});

// ── Image state ────────────────────────────────────────────────────────────
function setImage(dataUrl) {
  imageDataUrl = dataUrl;
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

// ── Analyze ────────────────────────────────────────────────────────────────
analyzeBtn.addEventListener('click', analyze);

async function analyze() {
  if (!imageDataUrl) return;

  setLoading(true);
  errorToast.classList.add('hidden');
  resultsSection.classList.add('hidden');

  const base64 = imageDataUrl.split(',')[1];
  const mediaType = imageDataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mediaType })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

    if (!data.identified) {
      showError("Hmm, I couldn't identify a home appliance in this image. Try a clearer photo of the device, ideally showing the front panel or label.");
      return;
    }

    renderResults(data);
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
  } finally {
    setLoading(false);
  }
}

function setLoading(on) {
  analyzeBtn.disabled = on;
  analyzeBtn.classList.toggle('loading', on);
  $('btn-text').classList.toggle('hidden', on);
  $('btn-spinner').classList.toggle('hidden', !on);
}

function showError(msg) {
  errorToast.textContent = msg;
  errorToast.classList.remove('hidden');
  errorToast.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Render Results ─────────────────────────────────────────────────────────
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

function renderResults(r) {
  const html = `
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
      <!-- Age -->
      <div class="card">
        <div class="card-icon" style="background:rgba(167,139,250,0.15)">⏱️</div>
        <div class="card-label">Age</div>
        <div class="card-value">${esc(r.age_years)}</div>
        <div class="card-sub">${esc(r.year_estimate)}</div>
      </div>

      <!-- Manufacturing -->
      <div class="card">
        <div class="card-icon" style="background:rgba(${scoreIconBg(r.manufacturing_quality?.score)})">🏭</div>
        <div class="card-label">Build Quality</div>
        <div class="card-value" style="color:${scoreTextColor(r.manufacturing_quality?.score)}">${esc(r.manufacturing_quality?.label)}</div>
        <div class="score-bar"><div class="score-fill ${scoreColor(r.manufacturing_quality?.score)}" style="width:${(r.manufacturing_quality?.score || 0) * 10}%"></div></div>
        <div class="card-sub">${esc(r.manufacturing_quality?.detail)}</div>
      </div>

      <!-- Environmental -->
      <div class="card">
        <div class="card-icon" style="background:rgba(52,211,153,0.15)">🌿</div>
        <div class="card-label">Environment</div>
        <div class="card-value" style="color:${scoreTextColor(r.environmental_impact?.score)}">${esc(r.environmental_impact?.label)}</div>
        <div class="score-bar"><div class="score-fill ${scoreColor(r.environmental_impact?.score)}" style="width:${(r.environmental_impact?.score || 0) * 10}%"></div></div>
        <div class="card-sub">Rating: <strong>${esc(r.environmental_impact?.energy_rating)}</strong></div>
      </div>

      <!-- Utility bills -->
      <div class="card">
        <div class="card-icon" style="background:rgba(251,191,36,0.15)">⚡</div>
        <div class="card-label">Running Cost</div>
        <div class="card-value">${esc(r.utility_bills?.annual_estimate)}</div>
        <div class="score-bar"><div class="score-fill ${scoreColor(11 - (r.utility_bills?.score || 5))}" style="width:${(r.utility_bills?.score || 0) * 10}%"></div></div>
        <div class="card-sub">${esc(r.utility_bills?.label)}</div>
      </div>
    </div>

    <!-- Replacement -->
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

    <!-- Market status -->
    <div class="verdict-card">
      <h4>Market Status</h4>
      <p>${esc(r.market_status?.detail)}</p>
    </div>

    <!-- Overall verdict -->
    <div class="verdict-card">
      <h4>Overall Assessment</h4>
      <p>${esc(r.overall_rating?.verdict)}</p>
      ${r.fun_fact ? `<p style="margin-top:10px;color:var(--accent2);font-size:0.82rem;padding-top:10px;border-top:1px solid var(--border)">💡 ${esc(r.fun_fact)}</p>` : ''}
    </div>

    <button class="reset-btn" id="reset-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
      </svg>
      Scan another appliance
    </button>
  `;

  resultsSection.innerHTML = html;
  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth' });

  // Animate score bars after render
  setTimeout(() => {
    document.querySelectorAll('.score-fill').forEach(el => {
      const w = el.style.width;
      el.style.width = '0';
      setTimeout(() => { el.style.width = w; }, 50);
    });
  }, 100);

  document.getElementById('reset-btn')?.addEventListener('click', () => {
    setImage(null);
    resultsSection.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
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
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ───────────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
