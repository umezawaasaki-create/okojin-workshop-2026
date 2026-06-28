const GAS_URL  = 'https://script.google.com/macros/s/AKfycbzqiRxH0TAWTERknWymL7vOIq6xmnj4HnxNo_HDPKHXq2rwXORVuOUNK2CGwMLQFVyT/exec';
const ADMIN_PW = 'okojin2026';
const LS_KEY   = 'okojin_ws2026';
let gasData     = [];
let presentList  = [];
let presentIndex = 0;

// ── タブ切替 ────────────────────────────────────────────
function showTab(t, btn) {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('view-' + t).classList.add('active');
  if (t === 'gallery') loadGallery();
  if (t === 'admin') {
    document.getElementById('admin-lock').style.display = 'block';
    document.getElementById('admin-content').style.display = 'none';
    document.getElementById('pw-input').value = '';
    document.getElementById('pw-err').style.display = 'none';
  }
}

// ── 管理タブ切替 ────────────────────────────────────────
function showAdminTab(t, btn) {
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('admin-list').style.display     = t === 'list'     ? '' : 'none';
  document.getElementById('admin-analysis').style.display = t === 'analysis' ? '' : 'none';
  document.getElementById('admin-dream').style.display    = t === 'dream'    ? '' : 'none';
  document.getElementById('admin-advice').style.display   = t === 'advice'   ? '' : 'none';
  if (t === 'analysis') runAnalysis();
  if (t === 'dream')    runDreamAnalysis();
  if (t === 'advice')   runAdviceAnalysis();
}

// ── 字数カウント ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('f-future').addEventListener('input', function () {
    const n = this.value.length;
    const el = document.getElementById('char-count');
    el.textContent = n + '字';
    el.className = 'char-count' + (n >= 100 && n <= 200 ? ' ok' : n > 200 ? ' over' : '');
  });
});

// ── ローカルストレージ ───────────────────────────────────
function loadLocal() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
function saveLocal(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }
function makeId(g, c, n) { return g + '-' + c + '-' + n; }

// ── GASからデータ取得（JSONP） ──────────────────────────
function fetchFromGAS() {
  return new Promise(function (resolve) {
    var cbName = 'cb' + Date.now();
    var done = false;
    window[cbName] = function (data) {
      done = true;
      resolve(Array.isArray(data) ? data : []);
      try { delete window[cbName]; } catch (e) {}
      var el = document.getElementById('jsonp-' + cbName);
      if (el) el.parentNode.removeChild(el);
    };
    var s = document.createElement('script');
    s.id = 'jsonp-' + cbName;
    s.src = GAS_URL + '?callback=' + cbName + '&_=' + Date.now();
    s.onerror = function () { if (!done) { done = true; resolve([]); } };
    document.body.appendChild(s);
    setTimeout(function () { if (!done) { done = true; resolve([]); } }, 10000);
  });
}

// ── フォーム送信 ─────────────────────────────────────────
async function submitForm() {
  const grade    = document.getElementById('f-grade').value.trim();
  const cls      = document.getElementById('f-class').value.trim();
  const num      = document.getElementById('f-num').value.trim();
  const name     = document.getElementById('f-name').value.trim();
  const ai1      = document.getElementById('f-ai1').value.trim();
  const ai2      = document.getElementById('f-ai2').value.trim();
  const ai3      = document.getElementById('f-ai3').value.trim();
  const future   = document.getElementById('f-future').value.trim();
  const idea = document.getElementById('f-idea').value.trim();
  const job      = document.getElementById('f-job').value.trim();
  const hansei   = document.getElementById('f-hansei').value.trim();
  const kizuki   = document.getElementById('f-kizuki').value.trim();

  if (!grade || !cls || !num) { alert('学年・クラス・出席番号を入力してください。'); return; }
  if (!name)     { alert('氏名を入力してください。'); return; }
  if (!future)   { alert('「もしAIがさらに進化したら？」を記入してください。'); return; }
  if (!idea) { alert('学校への問いを記入してください。'); return; }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true; btn.textContent = '送信中…';

  const now = new Date();
  const dt  = now.toLocaleDateString('ja-JP') + ' ' + now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  const id  = makeId(grade, cls, num);
  const record = { id, grade, cls, num, name, ai1, ai2, ai3, future, idea, dt, job, hansei, kizuki };

  const local = loadLocal();
  const idx   = local.findIndex(r => r.id === id);
  if (idx >= 0) local[idx] = record; else local.push(record);
  saveLocal(local);

  try {
    const params = new URLSearchParams();
    Object.entries(record).forEach(([k, v]) => params.append(k, String(v)));
    await fetch(GAS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
  } catch (e) { console.error(e); }

  btn.disabled = false; btn.textContent = '✈ 提出する';
  document.getElementById('msg-success').style.display = 'block';
  setTimeout(() => { document.getElementById('msg-success').style.display = 'none'; }, 5000);
}

// ── クリア ───────────────────────────────────────────────
function clearForm() {
  ['f-grade','f-class','f-num','f-name','f-ai1','f-ai2','f-ai3','f-future','f-idea','f-job','f-hansei','f-kizuki']
    .forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('char-count').textContent = '0字';
  document.getElementById('char-count').className = 'char-count';
}

// ── 前回読込 ─────────────────────────────────────────────
function lookupStudent() {
  const grade = document.getElementById('f-grade').value.trim();
  const cls   = document.getElementById('f-class').value.trim();
  const num   = document.getElementById('f-num').value.trim();
  if (!grade || !cls || !num) { alert('学年・クラス・出席番号を入力してから「前回読込」を押してください。'); return; }
  const rec = loadLocal().find(r => r.id === makeId(grade, cls, num));
  if (rec) {
    document.getElementById('f-name').value    = rec.name    || '';
    document.getElementById('f-ai1').value     = rec.ai1     || '';
    document.getElementById('f-ai2').value     = rec.ai2     || '';
    document.getElementById('f-ai3').value     = rec.ai3     || '';
    document.getElementById('f-future').value  = rec.future  || '';
    document.getElementById('f-idea').value = rec.idea || '';
    document.getElementById('f-job').value      = rec.job      || '';
    document.getElementById('f-hansei').value   = rec.hansei   || '';
    document.getElementById('f-kizuki').value   = rec.kizuki   || '';
    const n  = (rec.future || '').length;
    const el = document.getElementById('char-count');
    el.textContent = n + '字';
    el.className = 'char-count' + (n >= 100 && n <= 200 ? ' ok' : n > 200 ? ' over' : '');
    alert('前回の入力を読み込みました。編集後に再提出してください。');
  } else {
    alert('入力が見つかりませんでした。新規として入力してください。');
  }
}

// ── みんなの回答 ─────────────────────────────────────────
async function loadGallery() {
  document.getElementById('gallery-loading').style.display = 'block';
  document.getElementById('gallery-grid').innerHTML = '';
  document.getElementById('gallery-empty').style.display = 'none';
  gasData = await fetchFromGAS();
  document.getElementById('gallery-loading').style.display = 'none';
  applyFilter();
}

function applyFilter() {
  const q   = (document.getElementById('gallery-search').value || '').toLowerCase();
  const cls = document.getElementById('class-filter').value;
  const classes = [...new Set(gasData.map(r => r.grade + '年' + r.cls + '組').filter(Boolean))].sort();
  const sel = document.getElementById('class-filter');
  const cur = sel.value;
  sel.innerHTML = '<option value="">全クラス</option>' + classes.map(c => `<option value="${c}"${c === cur ? ' selected' : ''}>${c}</option>`).join('');
  let filtered = gasData;
  if (cls)  filtered = filtered.filter(r => (r.grade + '年' + r.cls + '組') === cls);
  if (q)    filtered = filtered.filter(r => JSON.stringify(r).toLowerCase().includes(q));
  filtered = filtered.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
  presentList = filtered;
  document.getElementById('gallery-count').textContent = filtered.length + '件';
  const grid  = document.getElementById('gallery-grid');
  const empty = document.getElementById('gallery-empty');
  if (!filtered.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  grid.innerHTML = filtered.map((r, i) => `
    <div class="student-card" onclick="openPresent(${i})">
      <div class="student-card-header">
        <div class="student-card-name">${esc(r.name)}</div>
        <div class="student-card-id">${esc(r.grade)}年${esc(r.cls)}組 ${esc(r.num)}番</div>
      </div>
      <div class="student-card-body">
        <div class="card-section">
          <div class="card-section-label">AIが使われていると感じる場面</div>
          <div class="ai-tags">${[r.ai1, r.ai2, r.ai3].filter(Boolean).map(a => `<span class="ai-tag">${esc(a)}</span>`).join('')}</div>
        </div>
        <div class="card-section">
          <div class="card-section-label">もしAIが進化したら</div>
          <div class="card-section-text">${esc(r.future || '').replace(/\n/g, '<br>')}</div>
        </div>
        <div class="card-section">
          <div class="card-section-label">学校への問い</div>
          <div class="card-section-text">${esc(r.idea || '').replace(/\n/g, '<br>')}</div>
        </div>
        ${r.job ? `<div class="card-section">
          <div class="card-section-label">将来の夢・職業</div>
          <div class="card-section-text">${esc(r.job)}</div>
        </div>` : ''}
        ${r.hansei ? `<div class="card-section">
          <div class="card-section-label">AIと話してみて</div>
          <div class="card-section-text">${esc(r.hansei).replace(/\n/g, '<br>')}</div>
        </div>` : ''}
        ${r.kizuki ? `<div class="card-section">
          <div class="card-section-label">気づき・考えたこと</div>
          <div class="card-section-text">${esc(r.kizuki).replace(/\n/g, '<br>')}</div>
        </div>` : ''}
      </div>
    </div>`).join('');
}

// ── プレゼンモード ───────────────────────────────────────
function openPresent(i) {
  presentIndex = i;
  renderPresent();
  document.getElementById('present-overlay').classList.add('active');
}

function closePresent() {
  document.getElementById('present-overlay').classList.remove('active');
}

function navPresent(dir) {
  const next = presentIndex + dir;
  if (next < 0 || next >= presentList.length) return;
  presentIndex = next;
  renderPresent();
}

function renderPresent() {
  const r = presentList[presentIndex];
  if (!r) return;
  document.getElementById('present-name').textContent = r.name;
  document.getElementById('present-id').textContent   = `${r.grade}年${r.cls}組 ${r.num}番`;
  document.getElementById('present-body').innerHTML = `
    <div class="present-section">
      <div class="present-label">AIが使われていると感じる場面</div>
      <div class="present-ai-tags">${[r.ai1, r.ai2, r.ai3].filter(Boolean).map(a => `<span class="present-ai-tag">${esc(a)}</span>`).join('')}</div>
    </div>
    <div class="present-section">
      <div class="present-label">もしAIが進化したら</div>
      <div class="present-text">${esc(r.future || '').replace(/\n/g, '<br>')}</div>
    </div>
    <div class="present-section">
      <div class="present-label">学校への問い</div>
      <div class="present-text">${esc(r.idea || '').replace(/\n/g, '<br>')}</div>
    </div>
    ${r.job ? `<div class="present-section">
      <div class="present-label">将来の夢・職業</div>
      <div class="present-text">${esc(r.job)}</div>
    </div>` : ''}
    ${r.hansei ? `<div class="present-section">
      <div class="present-label">AIと話してみて</div>
      <div class="present-text">${esc(r.hansei).replace(/\n/g, '<br>')}</div>
    </div>` : ''}
    ${r.kizuki ? `<div class="present-section">
      <div class="present-label">気づき・考えたこと</div>
      <div class="present-text">${esc(r.kizuki).replace(/\n/g, '<br>')}</div>
    </div>` : ''}`;
  document.getElementById('present-progress').textContent = `${presentIndex + 1} / ${presentList.length}`;
  document.getElementById('present-prev').disabled = (presentIndex === 0);
  document.getElementById('present-next').disabled = (presentIndex === presentList.length - 1);
  document.getElementById('present-card').scrollTop = 0;
}

document.addEventListener('keydown', function (e) {
  const overlay = document.getElementById('present-overlay');
  if (!overlay.classList.contains('active')) return;
  if (e.key === 'Escape')      closePresent();
  if (e.key === 'ArrowLeft')   navPresent(-1);
  if (e.key === 'ArrowRight')  navPresent(1);
});

// ── 管理者 ───────────────────────────────────────────────
function checkPw() {
  if (document.getElementById('pw-input').value === ADMIN_PW) {
    document.getElementById('admin-lock').style.display    = 'none';
    document.getElementById('admin-content').style.display = 'block';
    loadDashboard();
  } else {
    document.getElementById('pw-err').style.display = 'block';
  }
}

async function loadDashboard() {
  gasData = await fetchFromGAS();
  const today = new Date().toLocaleDateString('ja-JP');
  document.getElementById('stats').innerHTML = `
    <div class="stat"><div class="stat-num">${gasData.length}</div><div class="stat-label">提出数（合計）</div></div>
    <div class="stat"><div class="stat-num">${gasData.filter(r => String(r.dt).startsWith(today)).length}</div><div class="stat-label">本日の提出</div></div>
    <div class="stat"><div class="stat-num">${gasData.length}</div><div class="stat-label">スプレッドシート反映済</div></div>`;
  renderTable();
}

function renderTable() {
  const q        = (document.getElementById('search-box') || {}).value || '';
  const filtered = q ? gasData.filter(r => JSON.stringify(r).toLowerCase().includes(q.toLowerCase())) : gasData;
  const tbody    = document.getElementById('table-body');
  const empty    = document.getElementById('empty-state');
  if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = filtered.slice().reverse().map((r, i) => `
    <tr>
      <td class="col-id">${esc(r.id || '')}</td>
      <td class="col-name" title="${esc(r.name)}">${esc(r.name)}</td>
      <td class="col-cls">${esc(r.grade || '')}年${esc(r.cls || '')}組</td>
      <td class="col-ai1" title="${esc(r.ai1 || '')}">${esc(r.ai1 || '—')}</td>
      <td class="col-q" title="${esc(r.idea || '')}">${esc((r.idea || '').substring(0, 35) + ((r.idea || '').length > 35 ? '…' : ''))}</td>
      <td class="col-dt">${esc(r.dt || '')}</td>
      <td class="col-act" style="text-align:center"><button class="expand-btn" onclick="toggleDetail(${i},this)">▾</button></td>
    </tr>
    <tr class="detail-row" id="detail-${i}">
      <td class="detail-cell" colspan="7">
        <strong>AI場面①</strong>　${esc(r.ai1 || '—')}<br>
        <strong>AI場面②</strong>　${esc(r.ai2 || '—')}<br>
        <strong>AI場面③</strong>　${esc(r.ai3 || '—')}<br><br>
        <strong>もしAIが進化したら</strong><br>${esc(r.future || '').replace(/\n/g, '<br>')}<br><br>
        <strong>学校への問い</strong><br>${esc(r.idea || '').replace(/\n/g, '<br>')}<br><br>
        <strong>将来の夢・職業</strong>　${esc(r.job || '（未記入）')}<br><br>
        <strong>AIと話してみて</strong><br>${esc(r.hansei || '（未記入）').replace(/\n/g, '<br>')}<br><br>
        <strong>気づき・考えたこと</strong><br>${esc(r.kizuki || '（未提出）').replace(/\n/g, '<br>')}
      </td>
    </tr>`).join('');
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toggleDetail(i, btn) {
  const row    = document.getElementById('detail-' + i);
  const isOpen = row.classList.contains('open');
  document.querySelectorAll('.detail-row.open').forEach(r => r.classList.remove('open'));
  document.querySelectorAll('.expand-btn').forEach(b => b.textContent = '▾');
  if (!isOpen) { row.classList.add('open'); btn.textContent = '▴'; }
}

function exportCSV() {
  if (!gasData.length) { alert('データがありません。'); return; }
  const header = ['出席番号','学年','クラス','番号','氏名','AI場面①','AI場面②','AI場面③','AIが進化したら','学校への問い','将来の夢・職業','AIと話してみて','気づき','提出日時'];
  const rows   = gasData.map(r => [r.id, r.grade, r.cls, r.num, r.name, r.ai1||'', r.ai2||'', r.ai3||'', r.future||'', r.idea||'', r.job||'', r.hansei||'', r.kizuki||'', r.dt]
    .map(v => `"${String(v).replace(/"/g, '""')}"`));
  const csv    = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob   = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a      = document.createElement('a');
  a.href       = URL.createObjectURL(blob);
  a.download   = '大高人WS2026_事前課題_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── AI分析 ───────────────────────────────────────────────
const GROUP_COLORS = [
  { bg:'#E6F1FB', border:'#85B7EB', text:'#0C447C', cbg:'#B5D4F4', ct:'#0C447C' },
  { bg:'#E1F5EE', border:'#5DCAA5', text:'#085041', cbg:'#9FE1CB', ct:'#085041' },
  { bg:'#FAEEDA', border:'#EF9F27', text:'#633806', cbg:'#FAC775', ct:'#633806' },
  { bg:'#FBEAF0', border:'#ED93B1', text:'#4B1528', cbg:'#F4C0D1', ct:'#4B1528' },
  { bg:'#EEEDFE', border:'#AFA9EC', text:'#26215C', cbg:'#CECBF6', ct:'#26215C' },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function typeText(el, text, speed) {
  for (let i = 0; i < text.length; i++) { el.textContent = text.slice(0, i + 1); await sleep(speed || 16); }
}

async function runAdviceAnalysis() {
  const btn    = document.getElementById('advice-btn');
  const status = document.getElementById('advice-status');
  const result = document.getElementById('advice-result');
  btn.disabled = true;
  result.innerHTML = '';
  status.textContent = '⏳ データを取得しています...';
  if (!gasData.length) { gasData = await fetchFromGAS(); }
  if (!gasData.length) { status.textContent = '❌ データがありません。スプレッドシートに回答が入力されているか確認してください。'; btn.disabled = false; return; }
  status.textContent = '⏳ 生徒の回答をもとに授業アドバイスを生成しています...（30秒ほどかかります）';

  try {
    const analysisResult = await new Promise(function (resolve, reject) {
      const cbName = 'advice_' + Date.now();
      const done   = { v: false };
      window[cbName] = function (data) {
        done.v = true; resolve(data);
        try { delete window[cbName]; } catch (e) {}
        const el = document.getElementById('jsonp-' + cbName);
        if (el) el.parentNode.removeChild(el);
      };
      const s  = document.createElement('script');
      s.id     = 'jsonp-' + cbName;
      s.src    = GAS_URL + '?action=analyzeAdvice&callback=' + cbName + '&_=' + Date.now();
      s.onerror = function () { if (!done.v) { done.v = true; reject(new Error('通信エラー')); } };
      document.body.appendChild(s);
      setTimeout(function () { if (!done.v) { done.v = true; reject(new Error('タイムアウト')); } }, 90000);
    });

    if (analysisResult.error) { throw new Error(analysisResult.error); }

    const text   = analysisResult.result;
    const clean  = text.replace(/```json\n?|```/g, '').trim();
    const parsed = JSON.parse(clean);

    status.textContent = '✅ 生成完了！';
    result.innerHTML = '';

    const PHASE_STYLES = [
      { bg: '#1E2761', badge: 'rgba(2,195,154,0.3)', badgeText: '#02C39A', label: 'Phase 0', title: '事前課題' },
      { bg: '#028090', badge: 'rgba(255,255,255,0.25)', badgeText: '#fff',   label: 'Phase 1', title: '座学 90分' },
      { bg: '#5a67d8', badge: 'rgba(255,255,255,0.25)', badgeText: '#fff',   label: 'Phase 2', title: 'NACK5スタジアム見学' },
      { bg: '#744210', badge: 'rgba(255,255,255,0.25)', badgeText: '#fff',   label: 'Phase 3', title: 'プレゼン 90分' },
    ];

    parsed.phases.forEach(function (phase, i) {
      const st = PHASE_STYLES[i] || PHASE_STYLES[PHASE_STYLES.length - 1];
      const card = document.createElement('div');
      card.style.cssText = 'background:#fff;border:1.5px solid #d1d9e0;border-radius:12px;overflow:hidden;margin-bottom:14px;opacity:0;transform:translateY(8px);transition:opacity .4s ease,transform .4s ease';
      card.innerHTML = `
        <div style="background:${st.bg};color:#fff;padding:12px 18px;display:flex;align-items:center;gap:10px">
          <span style="background:${st.badge};color:${st.badgeText};font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px">${st.label}</span>
          <span style="font-size:14px;font-weight:700">${esc(phase.title || st.title)}</span>
        </div>
        <div style="padding:16px 18px;font-size:12px;line-height:2;color:#374151">
          <div style="font-weight:700;color:#028090;margin-bottom:6px">▍ねらい</div>
          <p style="margin-bottom:14px">${esc(phase.goal)}</p>
          <div style="font-weight:700;color:#028090;margin-bottom:6px">▍推奨アクティビティ・進行アドバイス</div>
          <ul style="padding-left:18px;line-height:2.4;margin-bottom:14px">${phase.activities.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
          <div style="font-weight:700;color:#028090;margin-bottom:6px">▍この授業ならではのポイント（生徒の回答より）</div>
          <div style="background:#f0f4f8;border-radius:8px;padding:12px 16px;line-height:2">${esc(phase.insight)}</div>
        </div>`;
      result.appendChild(card);
      setTimeout(function () { card.style.opacity = '1'; card.style.transform = 'translateY(0)'; }, i * 120);
    });

  } catch (e) {
    console.error(e);
    status.textContent = '❌ 生成に失敗しました。もう一度お試しください。（' + e.message + ')';
  }
  btn.disabled = false;
}

async function runDreamAnalysis() {
  const btn    = document.getElementById('dream-analyze-btn');
  const status = document.getElementById('dream-analysis-status');
  const result = document.getElementById('dream-analysis-result');
  btn.disabled = true;
  result.innerHTML = '';
  status.textContent = '⏳ データを取得しています...';
  if (!gasData.length) { gasData = await fetchFromGAS(); }
  if (!gasData.length) { status.textContent = '❌ データがありません。'; btn.disabled = false; return; }
  status.textContent = '⏳ AIが将来の夢を分析しています...（30秒ほどかかります）';

  try {
    const analysisResult = await new Promise(function (resolve, reject) {
      const cbName = 'dream_' + Date.now();
      const done   = { v: false };
      window[cbName] = function (data) {
        done.v = true;
        resolve(data);
        try { delete window[cbName]; } catch (e) {}
        const el = document.getElementById('jsonp-' + cbName);
        if (el) el.parentNode.removeChild(el);
      };
      const s  = document.createElement('script');
      s.id     = 'jsonp-' + cbName;
      s.src    = GAS_URL + '?action=analyzeDream&callback=' + cbName + '&_=' + Date.now();
      s.onerror = function () { if (!done.v) { done.v = true; reject(new Error('通信エラー')); } };
      document.body.appendChild(s);
      setTimeout(function () { if (!done.v) { done.v = true; reject(new Error('タイムアウト')); } }, 60000);
    });

    if (analysisResult.error) { throw new Error(analysisResult.error); }

    const text   = analysisResult.result;
    const clean  = text.replace(/```json\n?|```/g, '').trim();
    const parsed = JSON.parse(clean);

    status.textContent = '✅ 分析完了！グループを表示しています...';

    for (let gi = 0; gi < parsed.groups.length; gi++) {
      const g   = parsed.groups[gi];
      const col = GROUP_COLORS[gi % GROUP_COLORS.length];
      const card = document.createElement('div');
      card.className = 'analysis-group';
      card.innerHTML = `
        <div class="analysis-group-header" style="background:${col.bg}">
          <span class="analysis-group-label" style="color:${col.text}">${esc(g.name)}</span>
          <span class="analysis-group-count" style="background:${col.cbg};color:${col.ct}">${g.members.length}名</span>
        </div>
        <div class="analysis-group-body">
          <div class="analysis-summary" id="dsummary-${gi}"></div>
          <div class="analysis-members">${g.members.map(m => `<span class="analysis-member">${esc(m)}</span>`).join('')}</div>
        </div>`;
      result.appendChild(card);
      await sleep(50);
      card.classList.add('visible');
      const summaryEl = document.getElementById('dsummary-' + gi);
      summaryEl.innerHTML = '<span class="typing-cursor"></span>';
      await sleep(200);
      summaryEl.textContent = '';
      await typeText(summaryEl, g.summary, 14);
      await sleep(200);
    }

    const overallCard = document.createElement('div');
    overallCard.className = 'analysis-overall';
    overallCard.innerHTML = '<div class="analysis-overall-label">全体の傾向</div><div class="analysis-overall-text" id="doverall"></div>';
    result.appendChild(overallCard);
    await sleep(100);
    overallCard.classList.add('visible');
    const overallEl = document.getElementById('doverall');
    overallEl.innerHTML = '<span class="typing-cursor"></span>';
    await sleep(200);
    overallEl.textContent = '';
    await typeText(overallEl, parsed.overall, 12);
    status.textContent = '✅ 分析完了！';

  } catch (e) {
    console.error(e);
    status.textContent = '❌ 分析に失敗しました。もう一度お試しください。（' + e.message + ')';
  }
  btn.disabled = false;
}

async function runAnalysis() {
  const btn    = document.getElementById('analyze-btn');
  const status = document.getElementById('analysis-status');
  const result = document.getElementById('analysis-result');
  btn.disabled = true;
  result.innerHTML = '';
  status.textContent = '⏳ データを取得しています...';
  if (!gasData.length) { gasData = await fetchFromGAS(); }
  if (!gasData.length) { status.textContent = '❌ データがありません。'; btn.disabled = false; return; }
  status.textContent = '⏳ AIが回答を分析しています...（30秒ほどかかります）';

  try {
    const analysisResult = await new Promise(function (resolve, reject) {
      const cbName = 'analysis_' + Date.now();
      const done   = { v: false };
      window[cbName] = function (data) {
        done.v = true;
        resolve(data);
        try { delete window[cbName]; } catch (e) {}
        const el = document.getElementById('jsonp-' + cbName);
        if (el) el.parentNode.removeChild(el);
      };
      const s  = document.createElement('script');
      s.id     = 'jsonp-' + cbName;
      s.src    = GAS_URL + '?action=analyze&callback=' + cbName + '&_=' + Date.now();
      s.onerror = function () { if (!done.v) { done.v = true; reject(new Error('通信エラー')); } };
      document.body.appendChild(s);
      setTimeout(function () { if (!done.v) { done.v = true; reject(new Error('タイムアウト')); } }, 60000);
    });

    if (analysisResult.error) { throw new Error(analysisResult.error); }

    const text   = analysisResult.result;
    const clean  = text.replace(/```json\n?|```/g, '').trim();
    const parsed = JSON.parse(clean);

    status.textContent = '✅ 分析完了！グループを表示しています...';

    for (let gi = 0; gi < parsed.groups.length; gi++) {
      const g   = parsed.groups[gi];
      const col = GROUP_COLORS[gi % GROUP_COLORS.length];
      const card = document.createElement('div');
      card.className = 'analysis-group';
      card.innerHTML = `
        <div class="analysis-group-header" style="background:${col.bg}">
          <span class="analysis-group-label" style="color:${col.text}">${esc(g.name)}</span>
          <span class="analysis-group-count" style="background:${col.cbg};color:${col.ct}">${g.members.length}名</span>
        </div>
        <div class="analysis-group-body">
          <div class="analysis-summary" id="asummary-${gi}"></div>
          <div class="analysis-members">${g.members.map(m => `<span class="analysis-member">${esc(m)}</span>`).join('')}</div>
        </div>`;
      result.appendChild(card);
      await sleep(50);
      card.classList.add('visible');
      const summaryEl = document.getElementById('asummary-' + gi);
      summaryEl.innerHTML = '<span class="typing-cursor"></span>';
      await sleep(200);
      summaryEl.textContent = '';
      await typeText(summaryEl, g.summary, 14);
      await sleep(200);
    }

    const overallCard = document.createElement('div');
    overallCard.className = 'analysis-overall';
    overallCard.innerHTML = '<div class="analysis-overall-label">全体の傾向</div><div class="analysis-overall-text" id="aoverall"></div>';
    result.appendChild(overallCard);
    await sleep(100);
    overallCard.classList.add('visible');
    const overallEl = document.getElementById('aoverall');
    overallEl.innerHTML = '<span class="typing-cursor"></span>';
    await sleep(200);
    overallEl.textContent = '';
    await typeText(overallEl, parsed.overall, 12);
    status.textContent = '✅ 分析完了！';

  } catch (e) {
    console.error(e);
    status.textContent = '❌ 分析に失敗しました。もう一度お試しください。（' + e.message + ')';
  }
  btn.disabled = false;
}
