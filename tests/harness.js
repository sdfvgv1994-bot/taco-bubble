// 在 node 裡跑泡泡花園的遊戲程式：用假的瀏覽器物件頂替畫布、按鍵、觸控、存檔，
// 再執行測試要的那段程式，把結果用 JSON 印出來給 pytest 看。
// 用法：node harness.js <index.html 路徑> <測試程式> [存檔 JSON]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 照 index.html 裡 <script src> 的順序讀進每個積木
const htmlPath = process.argv[2];
const html = fs.readFileSync(htmlPath, 'utf8');
// 任何 <script ... src="..."> 寫法都認得（例如以後加了 defer），不會悄悄跳過某個積木
const srcs = [...html.matchAll(/<script\b[^>]*\bsrc="([^"?]+)(?:\?[^"]*)?"/g)].map((m) => m[1]);
if (!srcs.length) throw new Error('index.html 裡找不到 <script src>');
const blocks = srcs.map((s) => ({ name: s, code: fs.readFileSync(path.join(path.dirname(htmlPath), s), 'utf8') }));
const testCode = process.argv[3];
const store = process.argv[4] ? JSON.parse(process.argv[4]) : {};

const listeners = {};
const on = (target) => (type, fn) => { (listeners[target + ':' + type] ||= []).push(fn); };
const fire = (target, type, ev = {}) => (listeners[target + ':' + type] || []).forEach((fn) => fn({ preventDefault() {}, ...ev }));

const noop = () => {};
const gradient = { addColorStop: noop };
const ctx2d = new Proxy({}, {
  get: (o, k) => (k in o ? o[k] : (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => gradient : noop)),
  set: (o, k, v) => { o[k] = v; return true; },
});

const CANVAS_W = 340, CANVAS_H = 560;
const els = {};
// 只認 index.html 裡真的有的 id，程式裡 id 打錯字就會在測試報錯
const knownIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
function el(id) {
  if (!els[id] && !knownIds.has(id)) throw new Error('index.html 裡沒有 id="' + id + '"');
  if (!els[id]) {
    els[id] = {
      id, textContent: '', value: '', style: {}, tagName: 'DIV',
      setAttribute: noop, getContext: () => ctx2d, setPointerCapture: noop,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: CANVAS_W, height: CANVAS_H }),
      addEventListener: on(id),
    };
  }
  return els[id];
}
el('modeSelect').value = 'classic';
el('gardenColor').value = '#174a37';

let now = 0;
const timeouts = [];
const sandbox = {
  console, Math, Number, String, JSON, Set, Infinity, Array, Object, Error,
  performance: { now: () => now },
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  getComputedStyle: () => ({ getPropertyValue: () => '#174a37' }),
  HTMLElement: function HTMLElement() {},
  document: {
    hidden: false,
    getElementById: el,
    querySelector: () => ({ content: 'dev' }),
    documentElement: { style: { setProperty: noop } },
    addEventListener: on('document'),
  },
};
sandbox.window = {
  devicePixelRatio: 1,
  addEventListener: on('window'),
  requestAnimationFrame: noop,
  setTimeout: (fn, ms) => { timeouts.push({ fn, at: now + ms }); return timeouts.length; },
  clearTimeout: (i) => { if (timeouts[i - 1]) timeouts[i - 1].fn = noop; },
  setInterval: () => 1,
  clearInterval: noop,
};
vm.createContext(sandbox);
const helpers = `
  const __fire = this.__fire, __store = this.__store, __els = this.__els, __advance = this.__advance, __nowf = this.__now;
  // 推進時間：跑 animate 的每一格（1/60 秒），也會觸發到期的 setTimeout
  function tick(seconds) {
    const frames = Math.round(seconds * 60);
    for (let i = 0; i < frames; i += 1) {
      __advance(1000 / 60);
      animate(__nowf());
    }
  }
  // 手指：按下、拖到 (x, y)、放開
  function touchAim(x, y, release = true) {
    __fire('gameCanvas', 'pointerdown', { pointerType: 'touch', pointerId: 7, clientX: width / 2, clientY: height / 2 });
    __fire('gameCanvas', 'pointermove', { pointerType: 'touch', pointerId: 7, clientX: x, clientY: y });
    if (release) __fire('gameCanvas', 'pointerup', { pointerType: 'touch', pointerId: 7, clientX: x, clientY: y });
  }
  // 把一顆泡泡的位置換算成畫面座標（測位置用）
  function centerOf(row, column) { return bubbleCenter(row, column); }
  // 把盤面設成指定的顏色（undefined＝空格）
  function setBoard(rows) { board = rows.map((r) => r.map((c) => (c === null ? undefined : c))); }
`;
sandbox.__fire = fire;
sandbox.__store = store;
sandbox.__els = els;
sandbox.__now = () => now;
sandbox.__advance = (ms) => {
  now += ms;
  timeouts.filter((t) => t.at <= now && t.fn !== noop).forEach((t) => { const f = t.fn; t.fn = noop; f(); });
};
// 每個積木分開跑，跟瀏覽器一個一個 <script> 載入一樣：
// 前面積木的 let/const 後面看得到，但後面才寫的函式，前面載入時還不存在（載入順序寫錯就會在這裡報錯）
for (const b of blocks) vm.runInContext(b.code, sandbox, { filename: b.name });
const out = vm.runInContext(helpers + '\n;(function(){' + testCode + '\n}).call(this)', sandbox);
console.log(JSON.stringify({ out, store }));
