(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const NAMES = { susu: 'Susu', neko: 'Neko', bobo: '波波', narr: '旁白' };
const CN = ['零','一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','二十一','二十二','二十三','二十四','二十五','二十六'];

/* ---------- state: auto-save on this device (falls back to memory if the browser blocks storage) ---------- */
const KEY = 'idiomKitchen.v1';
let mem = null, store = null;
try { store = window.localStorage; store.setItem('__t', '1'); store.removeItem('__t'); } catch (e) { store = null; }
const fresh = () => ({ done: {}, reviews: {}, outfit: 'daily' });
function load() {
  try { const v = store && JSON.parse(store.getItem(KEY)); if (v && v.done) return { ...fresh(), ...v }; } catch (e) {}
  return mem || fresh();
}
function save() { mem = S; try { if (store) store.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
let S = load();

/* ---------- progress code (base32, no server) ---------- */
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const outfitIds = () => ['daily', ...C.weeks.map(w => w.reward.id)];
function encodeCode(st) {
  let bits = '';
  const put = (v, n) => { bits += v.toString(2).padStart(n, '0'); };
  const nos = C.all.map(a => a.no).sort((a, b) => a - b);
  let L = 0; nos.forEach(n => { if (st.done['i' + n]) L = n; });
  const rw = Object.keys(st.reviews).filter(k => st.reviews[k]).map(Number);
  const W = rw.length ? Math.max(...rw) : 0;
  put(1, 2); put(Math.max(0, outfitIds().indexOf(st.outfit)), 5); put(L, 8);
  for (let n = 1; n <= L; n++) put(Math.min(3, st.done['i' + n] || 0), 2);
  put(W, 5); for (let n = 1; n <= W; n++) put(st.reviews[n] ? 1 : 0, 1);
  while (bits.length % 5) bits += '0';
  const vals = []; for (let i = 0; i < bits.length; i += 5) vals.push(parseInt(bits.slice(i, i + 5), 2));
  vals.push(vals.reduce((a, v, i) => a + v * (i + 1), 0) % 32);
  return vals.map(v => B32[v]).join('').replace(/(.{4})(?=.)/g, '$1-');
}
function decodeCode(code) {
  const clean = String(code).toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
  if (clean.length < 5) return null;
  const vals = [...clean].map(c => B32.indexOf(c)); if (vals.includes(-1)) return null;
  const chk = vals.pop(); if (vals.reduce((a, v, i) => a + v * (i + 1), 0) % 32 !== chk) return null;
  const bits = vals.map(v => v.toString(2).padStart(5, '0')).join(''); let p = 0;
  const get = n => { if (p + n > bits.length) throw 0; const v = parseInt(bits.slice(p, p + n), 2); p += n; return v; };
  try {
    if (get(2) !== 1) return null;
    const o = get(5), L = get(8), st = fresh();
    for (let n = 1; n <= L; n++) { const v = get(2); if (v) st.done['i' + n] = v; }
    const W = get(5); for (let n = 1; n <= W; n++) if (get(1)) st.reviews[n] = true;
    st.outfit = outfitIds()[o] || 'daily';
    return st;
  } catch (e) { return null; }
}
function mergeIn(st) {
  for (const k in st.done) S.done[k] = Math.max(S.done[k] || 0, st.done[k]);
  for (const k in st.reviews) if (st.reviews[k]) S.reviews[k] = true;
  if (st.outfit) S.outfit = st.outfit;
  save();
}
const codeLink = code => location.origin + location.pathname + '#p=' + code.replace(/-/g, '');
function qrSvg(text) {
  try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (e) { return ''; }
}
function progressBox() {
  const code = encodeCode(S), link = codeLink(code);
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box pbox"><h3>進度碼</h3>
    <p class="mut">${store ? '呢部機會自動儲存進度。' : '呢個預覽版唔可以自動儲存，記得抄低進度碼。'}換另一部機時，用相機掃 QR code，或者輸入下面嘅進度碼。</p>
    <div class="pcode-wrap"><div class="qr">${qrSvg(link)}</div>
    <div><div class="mut">現時進度：${allDone()} 個成語・★ ${allStars()}</div><div class="pcode" id="pcode">${code.split('-').map(g => `<span>${g}</span>`).join('-<wbr>')}</div>
    <div class="actions" style="justify-content:flex-start;margin-top:10px"><button class="btn btn-soft" id="pcopy">複製連結</button>${navigator.share ? '<button class="btn btn-soft" id="pshare">分享</button>' : ''}</div></div></div>
    <h3 style="margin-top:18px;font-size:20px">輸入進度碼</h3>
    <div class="pin"><input id="pin" placeholder="輸入進度碼" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="輸入進度碼"><button class="btn btn-main" id="pload">載入</button></div>
    <div class="actions"><button class="btn btn-soft" data-n>關閉</button></div></div>`;
  document.body.appendChild(m);
  m.querySelector('[data-n]').onclick = () => m.remove();
  m.querySelector('#pcopy').onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast('複製好喇'), () => { prompt('請複製呢條連結', link); }); };
  const sh = m.querySelector('#pshare'); if (sh) sh.onclick = () => navigator.share({ title: '成語美食街進度', text: '進度碼：' + code, url: link }).catch(() => {});
  m.querySelector('#pload').onclick = () => {
    const st = decodeCode(m.querySelector('#pin').value);
    if (!st) { toast('進度碼唔啱，請再檢查一次'); return; }
    m.remove(); mergeIn(st); toast('載入好喇'); setTab('street');
  };
}
function checkLinkCode() {
  const h = location.hash.match(/^#p=([0-9A-Za-z-]+)/); if (!h) return;
  history.replaceState(null, '', location.pathname + location.search);
  const st = decodeCode(h[1]); if (!st) { toast('進度碼唔啱'); return; }
  const n = Object.keys(st.done).length;
  confirmBox('載入進度？', `呢個進度碼有 ${n} 個成語。載入後會同呢部機嘅進度合併，唔會清走已學嘅成語。`, () => { mergeIn(st); toast('載入好喇'); setTab('street'); });
}
let C = null, ALL_LESSONS = [];

/* ---------- audio ---------- */
let cur = null;
function play(name, btn) {
  try {
    if (cur) { cur.pause(); cur = null; }
    document.querySelectorAll('.play.is-playing').forEach(b => b.classList.remove('is-playing'));
    const a = new Audio('audio/' + name + '.mp3');
    cur = a;
    if (btn) { btn.classList.add('is-playing'); a.onended = a.onerror = () => btn.classList.remove('is-playing'); }
    return a.play().catch(() => {});
  } catch (e) {}
}
const playIco = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
const playBtn = (name, label = '播放') => `<button class="play" data-play="${name}" aria-label="${label}">${playIco}</button>`;

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1800); }
function confetti() {
  const box = document.createElement('div'); box.className = 'confetti';
  const ids = ['heart', 'star', 'berry', 'heart', 'star'];
  for (let i = 0; i < 40; i++) { const c = document.createElement('i'); c.innerHTML = `<svg><use href="#${ids[i % 5]}"/></svg>`; c.style.left = Math.random() * 100 + 'vw'; c.style.animationDelay = Math.random() * .6 + 's'; box.appendChild(c); }
  document.body.appendChild(box); setTimeout(() => box.remove(), 3200);
}
function hl(text, idiom) { return text.split(idiom).join(`<span class="hl">${idiom}</span>`); }
const svg = (id, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
const stk = (id, css) => `<svg class="stk" style="${css}" aria-hidden="true"><use href="#${id}"/></svg>`;
const starStr = n => '★'.repeat(n) + '☆'.repeat(2 - n);
const backBtn = '<button class="back" id="back" aria-label="返回"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>';

/* ---------- helpers ---------- */
const week = n => C.weeks.find(w => w.n === n);
const wDone = w => w.idioms.filter(i => S.done[i.id]).length;
const allDone = () => Object.keys(S.done).length;
const allStars = () => Object.values(S.done).reduce((a, b) => a + b, 0);
const unlocked = (w, idx) => idx === 0 || !!S.done[w.idioms[idx - 1].id];
const findLesson = id => { for (const w of C.weeks) { const i = w.idioms.findIndex(x => x.id === id); if (i > -1) return [w, i]; } return null; };
const outfits = () => [{ id: 'daily', img: 'characters', name: '日常裝', desc: 'Susu 紅點點裙、波波廚師服、Neko 紫色貓貓衫', open: true, week: 0 },
  ...C.weeks.map(w => ({ ...w.reward, week: w.n, open: !!S.reviews[w.n] }))];
const wornImg = () => { const o = outfits().find(x => x.id === S.outfit && x.open); return o || outfits()[0]; };

/* ---------- navigation ---------- */
let tab = 'street';
function setTab(t) {
  tab = t;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('is-on', b.dataset.tab === t));
  document.body.classList.remove('in-lesson');
  window.scrollTo(0, 0);
  ({ street, search, book, closet })[t]();
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
document.addEventListener('click', e => { const p = e.target.closest('[data-play]'); if (p) play(p.dataset.play, p); });
let returnTo = () => setTab('street');

/* ---------- street (home) ---------- */
function street() {
  const open = C.weeks.map(w => {
    const d = wDone(w), rv = !!S.reviews[w.n];
    return `<button class="shop" data-w="${w.n}">
      <div class="shop-img"><img src="img/${w.cover}.webp" alt="" loading="lazy"><span class="shop-no">第 ${w.n} 站</span>${rv ? '<span class="shop-ok">全部完成</span>' : ''}</div>
      <div class="shop-body"><div class="shop-name">${w.shop}</div><div class="shop-sub">${w.sub}</div>
      <div class="shop-idioms">${w.idioms.map(i => `<span class="${S.done[i.id] ? 'got' : ''}">${i.idiom}</span>`).join('')}</div>
      <div class="shop-foot"><div class="bar sm"><i style="width:${d / 5 * 100}%"></i></div><b>${d}/5</b></div>
      <div class="shop-gift">${svg('heart')}完成可解鎖：${w.reward.name}</div></div></button>`;
  }).join('');
  const future = [];
  for (let n = C.weeks.length + 1; n <= C.totalWeeks; n++) {
    const items = C.all.filter(a => a.week === n);
    future.push(`<div class="soon"><span class="soon-no">第 ${n} 站</span><div class="soon-list">${items.map(a => `<span>${a.idiom}</span>`).join('')}</div><span class="soon-tag">即將開張</span></div>`);
  }
  const wo = wornImg();
  app.innerHTML = `
  <section class="hero">${stk('heart', 'width:44px;top:-18px;right:6%;z-index:4')}${stk('star', 'width:50px;bottom:-20px;right:30%;z-index:4;animation-delay:-1s')}${stk('berry', 'width:42px;bottom:-16px;left:3%;z-index:4;animation-delay:-2s')}
    <img src="img/street.webp" alt="Susu、波波同 Neko 喺成語美食街">
    <div class="hero-copy"><svg class="bow" aria-hidden="true"><use href="#bow"/></svg><span class="eyebrow">三年級・130 個成語</span><h1>成語<br>美食街</h1>
    <p>每星期開一間新店，每日煮一道成語菜式！</p></div></section>
  <div class="strip"><b>${allDone()} / ${C.all.length}</b><div class="bar"><i style="width:${allDone() / C.all.length * 100}%"></i></div><span class="stars">★ ${allStars()}</span></div>
  <div class="quick"><button class="qbtn" id="goSearch">${svg('star')}找成語</button><div class="wearing mini"><img src="img/${wo.img}.webp" alt=""><div><b>今日造型：${wo.name}</b><div class="mut">去「衣櫃」幫佢哋換衫</div></div></div></div>
  <h2 class="sec">${svg('cupcake')}已開張嘅店 <small>點入去學成語</small></h2>
  <div class="shops">${open}</div>
  ${future.length ? `<h2 class="sec">${svg('berry')}即將開張 <small>仲有 ${C.totalWeeks - C.weeks.length} 間店</small></h2>
  <div class="soons">${future.join('')}</div>` : ''}
  <div class="parent">家長區：已完成 ${allDone()} / ${C.all.length} 個成語。<button class="pbtn" id="pcodeBtn">${svg('heart')}進度碼（換機用）</button><button id="reset">重新開始</button></div>`;
  app.querySelectorAll('[data-w]').forEach(b => b.onclick = () => shop(+b.dataset.w));
  $('#goSearch').onclick = () => setTab('search');
  $('#pcodeBtn').onclick = progressBox;
  $('#reset').onclick = () => confirmBox('重新開始？', '所有食譜卡同衣服都會清除。', () => { S = fresh(); save(); street(); });
}

/* ---------- shop (one week) ---------- */
function shop(n) {
  const w = week(n);
  returnTo = () => shop(n);
  document.body.classList.remove('in-lesson'); window.scrollTo(0, 0);
  const dc = wDone(w), nextIdx = w.idioms.findIndex(i => !S.done[i.id]), reviewOpen = dc === 5, rv = !!S.reviews[n];
  const cards = w.idioms.map((it, i) => {
    const done = !!S.done[it.id], open = unlocked(w, i), next = i === nextIdx;
    const cls = done ? 'is-done' : next ? 'is-next' : open ? '' : 'is-locked';
    const badge = done ? `完成 ${starStr(S.done[it.id])}` : next ? '今日煮呢道' : open ? it.day : '未解鎖';
    return `<button class="day ${cls}" data-go="${i}" ${open ? '' : 'aria-disabled="true"'}>
      <span class="badge">${badge}</span>${open ? '' : `<svg class="lockpad" aria-hidden="true"><use href="#lock"/></svg>`}
      <img class="thumb" src="img/${it.img}.webp" alt="" loading="lazy">
      <div class="body"><div class="dname">${it.day}・第 ${it.no} 個・課本第 ${it.page} 頁</div>
      <div class="idiom">${open ? it.idiom : '？？？？'}</div>
      <div class="dish">${svg('heart')}今日菜式：${open ? it.dish : '神秘菜式'}</div></div></button>`;
  }).join('');
  const rvc = `<button class="day review ${rv ? 'is-done' : reviewOpen ? 'is-next' : 'is-locked'}" data-review>
      <span class="badge">${rv ? '完成' : reviewOpen ? '解鎖新衫' : '完成五道菜先開'}</span>
      <div class="thumb-alt"><div class="grid5">${w.idioms.map(i => `<span>${reviewOpen ? i.idiom : '？？？？'}</span>`).join('')}<span style="color:var(--tomato)">＋新衫</span></div></div>
      <div class="body"><div class="dname">星期六・溫習遊戲</div><div class="idiom" style="font-size:28px">波波大挑戰</div><div class="dish">${svg('heart')}完成可以解鎖：${w.reward.name}</div></div></button>`;
  app.innerHTML = `
  <div class="lhead">${backBtn}<div class="ltitle"><div class="k" style="font-family:var(--f-body)">第 ${n} 站・${w.shop}</div><div class="s">${w.sub}</div></div></div>
  <section class="hero" style="margin-top:8px">${stk('heart', 'width:40px;top:-16px;right:8%;z-index:4')}${stk('star', 'width:46px;bottom:-18px;left:4%;z-index:4;animation-delay:-1s')}
    <img src="img/${w.cover}.webp" alt="${w.shop}">
    <div class="hero-copy"><svg class="bow" aria-hidden="true"><use href="#bow"/></svg><span class="eyebrow">第${CN[n]}星期</span><h1>${w.shop.replace(' ', '<br>')}</h1>
    <p>同 Susu、Neko、波波一齊學 5 個成語！</p></div></section>
  <div class="strip"><b>${dc} / 5</b><div class="bar"><i style="width:${dc / 5 * 100}%"></i></div><span class="stars">★ ${w.idioms.reduce((s, i) => s + (S.done[i.id] || 0), 0)}</span></div>
  <h2 class="sec">${svg('cupcake')}本星期餐牌 <small>${w.sub}</small></h2>
  <div class="days">${cards}${rvc}</div>`;
  $('#back').onclick = () => setTab('street');
  app.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.go; if (!unlocked(w, i)) { toast('先完成上一道菜啦'); return; } lesson(w, i, 0);
  }));
  app.querySelector('[data-review]').addEventListener('click', () => { if (!reviewOpen) { toast('完成五道菜先可以玩'); return; } review(w, 0); });
}

function confirmBox(title, msg, yes) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box"><h3>${title}</h3><p>${msg}</p><div class="actions"><button class="btn btn-soft" data-n>取消</button><button class="btn btn-main" data-y>確定</button></div></div>`;
  document.body.appendChild(m);
  m.querySelector('[data-n]').onclick = () => m.remove();
  m.querySelector('[data-y]').onclick = () => { m.remove(); yes(); };
}

/* ---------- search ---------- */
let sq = '', sStroke = '全部';
function search() {
  returnTo = () => setTab('search');
  const strokes = ['全部', ...new Set(C.all.map(a => a.stroke))];
  app.innerHTML = `<h2 class="sec" style="margin-top:30px">${svg('star')}找成語 <small>全套 ${C.all.length} 個・按課本筆畫排序</small></h2>
    <div class="searchbox">${svg('heart')}<input id="q" type="search" inputmode="search" placeholder="打一個字，例如「心」" value="${sq}" aria-label="搜尋成語"></div>
    <div class="filters" role="group" aria-label="筆畫">${strokes.map(s => `<button class="fchip ${s === sStroke ? 'on' : ''}" data-s="${s}">${s}</button>`).join('')}</div>
    <div class="legend"><span><i class="dot got"></i>已學</span><span><i class="dot open"></i>可以學</span><span><i class="dot soon"></i>即將推出</span></div>
    <div id="results" class="results"></div>`;
  const render = () => {
    const list = C.all.filter(a => (sStroke === '全部' || a.stroke === sStroke) && (!sq || a.idiom.includes(sq) || String(a.page) === sq || String(a.no) === sq));
    $('#results').innerHTML = list.length ? list.map(a => {
      const L = findLesson('i' + a.no), st = S.done['i' + a.no] ? 'got' : L ? 'open' : 'soon';
      const label = st === 'got' ? `已學 ${starStr(S.done['i' + a.no])}` : st === 'open' ? '可以學' : '即將推出';
      return `<button class="row ${st}" data-id="i${a.no}" ${st === 'soon' ? 'aria-disabled="true"' : ''}>
        <span class="rno">${a.no}</span><span class="rk">${sq ? hl(a.idiom, sq) : a.idiom}</span>
        <span class="rmeta">${a.stroke}・第 ${a.page} 頁・第 ${a.week} 站</span><span class="rst">${label}</span></button>`;
    }).join('') : '<div class="empty-note">搵唔到呢個成語，試吓打少啲字？</div>';
    app.querySelectorAll('.row').forEach(b => b.onclick = () => {
      const L = findLesson(b.dataset.id);
      if (!L) { toast('呢間店仲未開張'); return; }
      const [w, i] = L;
      if (!unlocked(w, i)) { toast(`先完成「${w.idioms[i - 1].idiom}」啦`); return; }
      lesson(w, i, 0);
    });
  };
  $('#q').addEventListener('input', e => { sq = e.target.value.trim(); render(); });
  app.querySelectorAll('.fchip').forEach(b => b.onclick = () => { sStroke = b.dataset.s; app.querySelectorAll('.fchip').forEach(x => x.classList.toggle('on', x === b)); render(); });
  render();
}

/* ---------- lesson ---------- */
const STEPS = ['成語劇場', '準備材料', '試食意思', '小廚師挑戰'];
function shell(w, it, step, inner) {
  document.body.classList.add('in-lesson');
  window.scrollTo(0, 0);
  app.innerHTML = `<div class="lhead">${backBtn}
  <div class="ltitle"><div class="k">${it.idiom}</div><div class="s">第 ${w.n} 站・${it.day}・${it.dish}</div></div>
  <div class="steps" aria-label="第 ${step + 1} 步，共 4 步">${STEPS.map((_, i) => `<i class="${i < step ? 'done' : i === step ? 'on' : ''}"></i>`).join('')}</div></div>
  <section class="card"><div class="stage-label"><span class="n">${step + 1}</span>${STEPS[step]}</div>${inner}</section>`;
  $('#back').onclick = () => { if (cur) cur.pause(); returnTo(); };
}
function lesson(w, idx, step, ctx = {}) {
  const it = w.idioms[idx];
  if (step === 0) return theatre(w, idx, it);
  if (step === 1) return ingredients(w, idx, it);
  if (step === 2) return meaning(w, idx, it);
  if (step === 3) return quiz(w, idx, it, 0, ctx.miss || 0);
  return finish(w, idx, it, ctx.stars);
}
function theatre(w, idx, it) {
  shell(w, it, 0, `<div class="theatre"><div class="pic"><img src="img/${it.img}.webp" alt="${it.idiom}的場景"></div>
    <div><div class="lines" id="lines"></div><div class="actions"><button class="btn btn-soft" id="replay">重聽</button><button class="btn btn-main" id="nextline">開始 ▶</button></div></div></div>`);
  let n = 0; const box = $('#lines'), nb = $('#nextline');
  const show = () => {
    const [sp, t] = it.scene[n];
    const av = sp === 'narr' ? `<div class="who narr">旁白</div>` : `<div class="who"><img src="img/f_${sp}.webp" alt=""></div>`;
    box.insertAdjacentHTML('beforeend', `<div class="line ${sp}">${av}<div class="bubble"><span class="nm">${NAMES[sp]}</span><span class="t">${hl(t, it.idiom)}</span></div></div>`);
    play(`${it.id}_s${n}`); n++;
    nb.textContent = n < it.scene.length ? '下一句 ▶' : '去準備材料 ▶';
  };
  nb.onclick = () => { if (n < it.scene.length) show(); else lesson(w, idx, 1); };
  $('#replay').onclick = () => { box.innerHTML = ''; n = 0; show(); };
}
function ingredients(w, idx, it) {
  const [kp, kc, knote] = it.key;
  const chars = [...it.idiom].map((c, i) => `<div class="ch ${i === kp ? 'key' : ''}">${c}${i === kp ? '<span class="tag">小心</span>' : ''}</div>`).join('');
  shell(w, it, 1, `<p style="text-align:center;color:var(--ink-2)">四個字就係四樣材料，點下面兩格睇吓係咩意思 ${playBtn(it.id + '_name', '讀成語')}</p>
    <div class="chars">${chars}</div>
    <div class="parts">${it.parts.map((p, i) => `<button class="part hidden" data-p="${i}"><div class="pk">${p[0]}</div><div class="pv">${p[1]}</div></button>`).join('')}</div>
    <div class="literal" id="lit" hidden>${it.literal}</div>
    <div class="keynote">${svg('star')}<span>紅色嘅「${kc}」字要小心：${knote}</span></div>
    <div class="actions"><button class="btn btn-main" id="nx" disabled>去試食意思 ▶</button></div>`);
  const opened = new Set();
  app.querySelectorAll('.part').forEach(b => b.onclick = () => {
    b.classList.remove('hidden'); opened.add(b.dataset.p);
    if (opened.size === 2) { $('#lit').hidden = false; $('#nx').disabled = false; }
  });
  play(it.id + '_name');
  $('#nx').onclick = () => lesson(w, idx, 2);
}
const TONE = { good: '好的意思（褒義）', bad: '不好的意思（貶義）', neutral: '形容心情（中性）' };
function meaning(w, idx, it) {
  const extra = (it.opposite ? `<div class="tipbox">相反意思：「${it.idiom}」↔「${it.opposite}」</div>` : '') + (it.tip ? `<div class="tipbox">${it.tip}</div>` : '');
  shell(w, it, 2, `<div class="meaning">${playBtn(it.id + '_meaning', '讀意思')}<p>${it.meaning}</p></div>
    <span class="tone ${it.tone}">${it.toneText || TONE[it.tone]}</span>
    <h3 style="margin-top:20px;display:flex;align-items:center;gap:10px">波波教你點用 ${playBtn(it.id + '_ex', '讀例句')}</h3>
    <ul class="ex">${it.examples.map(e => `<li>${hl(e, it.idiom)}</li>`).join('')}</ul>${extra}
    <div class="actions"><button class="btn btn-main" id="nx">接受挑戰 ▶</button></div>`);
  play(it.id + '_meaning', $('.meaning .play'));
  $('#nx').onclick = () => lesson(w, idx, 3);
}
function quiz(w, idx, it, qi, miss) {
  const q = it.quiz[qi];
  shell(w, it, 3, `<div class="qcount">第 ${qi + 1} 題 / 共 ${it.quiz.length} 題</div><div class="q">${q.q}</div>
    <div class="opts">${q.opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="l">${'ABC'[i]}</span>${o}</button>`).join('')}</div>
    <div class="actions"><button class="btn btn-main" id="nx" hidden>${qi + 1 < it.quiz.length ? '下一題 ▶' : '上菜 ▶'}</button></div>`);
  let wrongHere = false;
  app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    if ($('#nx').hidden === false) return;
    const i = +b.dataset.i;
    if (i === q.a) { b.classList.add('right'); play(qi % 2 ? 'ok2' : 'ok1'); $('#nx').hidden = false; }
    else { b.classList.add('wrong'); wrongHere = true; play('no'); b.disabled = true; }
  });
  $('#nx').onclick = () => {
    const m = miss + (wrongHere ? 1 : 0);
    if (qi + 1 < it.quiz.length) quiz(w, idx, it, qi + 1, m);
    else lesson(w, idx, 4, { stars: Math.max(1, 2 - m) });
  };
}
function finish(w, idx, it, stars) {
  S.done[it.id] = Math.max(S.done[it.id] || 0, stars); save();
  document.body.classList.add('in-lesson'); window.scrollTo(0, 0);
  const weekComplete = wDone(w) === 5 && !S.reviews[w.n];
  const nextIt = w.idioms[idx + 1];
  app.innerHTML = `<div class="recipe celebrate"><svg class="bow" aria-hidden="true"><use href="#bow"/></svg><span class="stamp">新食譜卡</span>
    <div class="rd">${it.dish}</div><div class="rk">${it.idiom}</div><div class="rs">${starStr(stars)}</div>
    <img src="img/${it.img}.webp" alt=""><div class="rm">${it.meaning}</div></div>
    <div class="actions" style="justify-content:center"><button class="btn btn-soft" id="again">再煮一次</button>
    <button class="btn btn-main" id="home">${weekComplete ? '去玩星期六大挑戰 ▶' : '返店舖 ▶'}</button></div>`;
  confetti(); play('done');
  $('#again').onclick = () => lesson(w, idx, 0);
  $('#home').onclick = () => { if (weekComplete) review(w, 0); else shop(w.n); };
}

/* ---------- Saturday review ---------- */
function rshell(w, step, inner) {
  document.body.classList.add('in-lesson'); window.scrollTo(0, 0);
  app.innerHTML = `<div class="lhead">${backBtn}
  <div class="ltitle"><div class="k">波波大挑戰</div><div class="s">第 ${w.n} 站・星期六溫習遊戲</div></div>
  <div class="steps">${[0, 1].map(i => `<i class="${i < step ? 'done' : i === step ? 'on' : ''}"></i>`).join('')}</div></div>
  <section class="card">${inner}</section>`;
  $('#back').onclick = () => shop(w.n);
}
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
function review(w, step) {
  if (step === 0) {
    const L = shuffle(w.idioms.map(i => i.id)), R = shuffle(w.idioms.map(i => i.id));
    const by = id => w.idioms.find(i => i.id === id);
    rshell(w, 0, `<div class="stage-label"><span class="n">1</span>成語配對</div><p style="margin-bottom:14px">先點左邊嘅成語，再點右邊啱嘅意思。</p>
      <div class="match"><div class="col">${L.map(id => `<button class="mi kai" data-l="${id}">${by(id).idiom}</button>`).join('')}</div>
      <div class="col">${R.map(id => `<button class="mi" data-r="${id}">${by(id).meaning}</button>`).join('')}</div></div>`);
    let sel = null, ok = 0;
    app.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { app.querySelectorAll('[data-l]').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); sel = b; play(b.dataset.l + '_name'); });
    app.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
      if (!sel) { toast('先揀左邊嘅成語'); return; }
      if (sel.dataset.l === b.dataset.r) { sel.classList.replace('sel', 'ok'); b.classList.add('ok'); sel = null; ok++; play('ok1'); if (ok === 5) setTimeout(() => review(w, 1), 900); }
      else { b.classList.add('bad'); play('no'); setTimeout(() => b.classList.remove('bad'), 400); }
    });
    return;
  }
  let qi = 0; const used = new Set();
  const render = () => {
    const q = w.review.fill[qi];
    rshell(w, 1, `<div class="stage-label"><span class="n">2</span>波波點餐：揀啱嘅成語填入句子</div><div class="qcount">第 ${qi + 1} 句 / 共 5 句</div>
      <div class="fillq">${q.q.replace('＿＿＿＿', '<span class="blank">　</span>')}</div>
      <div class="chips">${w.idioms.map(i => `<button class="chip ${used.has(i.idiom) ? 'used' : ''}">${i.idiom}</button>`).join('')}</div>`);
    app.querySelectorAll('.chip').forEach(b => b.onclick = () => {
      if (b.textContent === q.a) {
        $('.blank').textContent = q.a; used.add(q.a); play('ok2');
        setTimeout(() => { qi++; if (qi < 5) render(); else weekDone(w); }, 1000);
      } else { b.classList.add('bad'); play('no'); setTimeout(() => b.classList.remove('bad'), 400); }
    });
  };
  render();
}
function weekDone(w) {
  S.reviews[w.n] = true; S.outfit = w.reward.id; save();
  document.body.classList.add('in-lesson'); window.scrollTo(0, 0);
  app.innerHTML = `<div class="recipe celebrate" style="border-color:var(--lilac)"><svg class="bow" aria-hidden="true"><use href="#bow"/></svg><span class="stamp" style="background:var(--lilac);box-shadow:0 0 0 3px var(--lilac)">解鎖新衫</span>
    <div class="rd" style="color:var(--lilac-d)">第${CN[w.n]}星期完成</div><div class="rk" style="font-size:40px">${w.reward.name}</div>
    <img src="img/${w.reward.img}.webp" alt="Susu、波波同 Neko 著住${w.reward.name}" style="aspect-ratio:1"><div class="rm">你已經學識 ${w.idioms.length} 個新成語，佢哋換上新衫多謝你！</div></div>
    <div class="actions" style="justify-content:center"><button class="btn btn-soft" id="st">返美食街</button><button class="btn btn-main" id="cl">去衣櫃睇吓 ▶</button></div>`;
  confetti(); play(w.n === 1 ? 'week' : 'week' + w.n);
  $('#cl').onclick = () => setTab('closet');
  $('#st').onclick = () => setTab('street');
}

/* ---------- recipe book ---------- */
function book() {
  returnTo = () => setTab('book');
  const sections = C.weeks.map(w => `<h3 class="bweek">第 ${w.n} 站・${w.shop} <small>${wDone(w)} / 5</small></h3>
    <div class="book">${w.idioms.map(it => S.done[it.id]
      ? `<button class="rc" data-play="${it.id}_name"><img src="img/${it.img}.webp" alt=""><div class="rk">${it.idiom}</div><div class="rd">${it.dish}</div><div class="rs">${starStr(S.done[it.id])}</div></button>`
      : `<div class="rc empty">未煮<br>${it.day}</div>`).join('')}</div>`).join('');
  app.innerHTML = `<h2 class="sec" style="margin-top:30px">${svg('berry')}我的食譜卡 <small>收集咗 ${allDone()} / ${C.all.length} 張</small></h2>
    ${sections}
    <div class="book" style="margin-top:16px"><div class="rc more">仲有 ${C.all.length - C.weeks.length * 5} 道菜<br>陸續推出</div></div>
    <p style="margin-top:16px;color:var(--ink-2);font-size:15px">點食譜卡可以再聽一次成語。兩粒星＝挑戰題一次就答啱。</p>`;
}

/* ---------- closet ---------- */
function closet() {
  const o = outfits();
  app.innerHTML = `<h2 class="sec" style="margin-top:30px">${svg('heart')}衣櫃 <small>點一套衫幫佢哋換上</small></h2>
    <div class="closet">${o.map(x => `<button class="outfit ${S.outfit === x.id && x.open ? 'is-worn' : ''} ${x.open ? '' : 'is-locked'}" data-o="${x.id}" ${x.open ? '' : 'aria-disabled="true"'}>
      <img src="img/${x.img}.webp" alt="${x.name}">${x.open ? '' : `<div class="lock"><svg aria-hidden="true" viewBox="0 0 60 66"><use href="#lock"/></svg>完成第 ${x.week} 站大挑戰<br>就可以解鎖</div>`}
      <div class="on">${x.name}</div><div class="od">${x.open ? x.desc : `第 ${x.week} 站獎勵`}</div></button>`).join('')}</div>
    <p style="margin-top:16px;color:var(--ink-2);font-size:15px">之後每完成一個星期，都會解鎖一套新衫。</p>`;
  app.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
    const x = o.find(y => y.id === b.dataset.o); if (!x.open) { toast('完成大挑戰先解鎖'); return; }
    S.outfit = x.id; save(); closet(); toast('換好衫喇');
  });
}

fetch('content.json').then(r => r.json()).then(d => { C = d; street(); checkLinkCode(); })
  .catch(() => { app.innerHTML = '<p style="padding:40px">載入失敗，請重新整理。</p>'; });
})();
