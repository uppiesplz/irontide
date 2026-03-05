var L = Object.defineProperty;
var X = (r, t, e) => t in r ? L(r, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : r[t] = e;
var o = (r, t, e) => X(r, typeof t != "symbol" ? t + "" : t, e);
class E {
  constructor() {
    o(this, "listeners", /* @__PURE__ */ new Map());
  }
  on(t, e) {
    this.listeners.has(t) || this.listeners.set(t, /* @__PURE__ */ new Set()), this.listeners.get(t).add(e);
  }
  off(t, e) {
    var i;
    (i = this.listeners.get(t)) == null || i.delete(e);
  }
  emit(t, e) {
    var i;
    (i = this.listeners.get(t)) == null || i.forEach((s) => s(e));
  }
  removeAll() {
    this.listeners.clear();
  }
}
class z {
  constructor(t, e) {
    o(this, "canvas");
    o(this, "ctx");
    o(this, "options");
    o(this, "dpr");
    this.canvas = t, this.options = e, this.dpr = typeof window < "u" && window.devicePixelRatio || 1;
    const i = t.getContext("2d");
    if (!i)
      throw new Error("Unable to get 2d canvas context");
    this.ctx = i, this.resize(t.clientWidth);
  }
  resize(t) {
    if (t <= 0) return;
    this.dpr = typeof window < "u" && window.devicePixelRatio || 1;
    const { height: e } = this.options;
    this.canvas.width = Math.round(t * this.dpr), this.canvas.height = Math.round(e * this.dpr), this.canvas.style.width = `${t}px`, this.canvas.style.height = `${e}px`, this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  calculateBarDimensions(t, e) {
    let i;
    const s = this.options.barGap;
    this.options.barWidth === "auto" ? i = Math.max(1, Math.round(3 / this.dpr) || 1) : i = this.options.barWidth;
    const n = i + s;
    return { barWidth: i, gap: s, totalBarWidth: n };
  }
  render(t, e, i, s) {
    const n = this.ctx, a = this.canvas.clientWidth, l = this.options.height, u = l / 2;
    if (n.clearRect(0, 0, a, l), t.length === 0 || s === 0) return;
    const { barWidth: m, totalBarWidth: h } = this.calculateBarDimensions(a, a), c = Math.floor(a / h), v = t.length / 2;
    n.fillStyle = this.options.waveColor;
    for (let d = 0; d < c && d < v; d++) {
      const P = t[d * 2], y = t[d * 2 + 1], x = d * h, M = u - y * u, D = u - P * u, W = Math.max(1, D - M);
      n.fillRect(x, M, m, W);
    }
    const { start: f, end: p } = e, b = p - f, w = b > 0 ? (i - f) / b : 0, g = Math.max(0, Math.min(a, w * a));
    if (g > 0) {
      n.save(), n.beginPath(), n.rect(0, 0, g, l), n.clip(), n.fillStyle = this.options.progressColor;
      for (let d = 0; d < c && d < v; d++) {
        const P = t[d * 2], y = t[d * 2 + 1], x = d * h, M = u - y * u, D = u - P * u, W = Math.max(1, D - M);
        n.fillRect(x, M, m, W);
      }
      n.restore();
    }
    g > 0 && g < a && (n.fillStyle = this.options.progressColor, n.fillRect(Math.round(g) - 0.5, 0, 1, l));
  }
  destroy() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
class A {
  constructor(t, e) {
    o(this, "canvas");
    o(this, "options");
    o(this, "emitter", new E());
    o(this, "enabled");
    o(this, "rafId", null);
    o(this, "momentumRafId", null);
    // Momentum state
    o(this, "velocity", 0);
    o(this, "lastMoveTime", 0);
    o(this, "lastMoveX", 0);
    o(this, "isPanning", !1);
    // Touch state
    o(this, "touchStartX", 0);
    o(this, "touchStartY", 0);
    o(this, "initialPinchDistance", null);
    // Bound handlers for cleanup
    o(this, "boundClick");
    o(this, "boundMouseDown");
    o(this, "boundMouseMove");
    o(this, "boundMouseUp");
    o(this, "boundWheel");
    o(this, "boundTouchStart");
    o(this, "boundTouchMove");
    o(this, "boundTouchEnd");
    this.canvas = t, this.options = e, this.enabled = e.interact, this.boundClick = this.handleClick.bind(this), this.boundMouseDown = this.handleMouseDown.bind(this), this.boundMouseMove = this.handleMouseMove.bind(this), this.boundMouseUp = this.handleMouseUp.bind(this), this.boundWheel = this.handleWheel.bind(this), this.boundTouchStart = this.handleTouchStart.bind(this), this.boundTouchMove = this.handleTouchMove.bind(this), this.boundTouchEnd = this.handleTouchEnd.bind(this), this.enabled && this.attachListeners();
  }
  on(t, e) {
    this.emitter.on(t, e);
  }
  off(t, e) {
    this.emitter.off(t, e);
  }
  setInteraction(t) {
    this.enabled !== t && (this.enabled = t, t ? this.attachListeners() : this.detachListeners());
  }
  destroy() {
    this.detachListeners(), this.stopMomentum(), this.rafId !== null && (cancelAnimationFrame(this.rafId), this.rafId = null), this.emitter.removeAll();
  }
  attachListeners() {
    this.canvas.addEventListener("click", this.boundClick), this.canvas.addEventListener("mousedown", this.boundMouseDown), this.canvas.addEventListener("wheel", this.boundWheel, { passive: !1 }), this.canvas.addEventListener("touchstart", this.boundTouchStart, { passive: !1 }), this.canvas.addEventListener("touchmove", this.boundTouchMove, { passive: !1 }), this.canvas.addEventListener("touchend", this.boundTouchEnd);
  }
  detachListeners() {
    this.canvas.removeEventListener("click", this.boundClick), this.canvas.removeEventListener("mousedown", this.boundMouseDown), this.canvas.removeEventListener("wheel", this.boundWheel), this.canvas.removeEventListener("touchstart", this.boundTouchStart), this.canvas.removeEventListener("touchmove", this.boundTouchMove), this.canvas.removeEventListener("touchend", this.boundTouchEnd), document.removeEventListener("mousemove", this.boundMouseMove), document.removeEventListener("mouseup", this.boundMouseUp);
  }
  getCanvasRatio(t) {
    const e = this.canvas.getBoundingClientRect();
    return Math.max(0, Math.min(1, (t - e.left) / e.width));
  }
  handleClick(t) {
    if (this.isPanning || t.button === 1) return;
    const e = this.getCanvasRatio(t.clientX);
    this.emitter.emit("seek", { ratio: e });
  }
  handleMouseDown(t) {
    t.button === 1 && (t.preventDefault(), this.isPanning = !0, this.lastMoveX = t.clientX, this.lastMoveTime = performance.now(), this.velocity = 0, document.addEventListener("mousemove", this.boundMouseMove), document.addEventListener("mouseup", this.boundMouseUp));
  }
  handleMouseMove(t) {
    this.isPanning && this.rafId === null && (this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      const e = performance.now(), i = t.clientX - this.lastMoveX, s = e - this.lastMoveTime;
      s > 0 && (this.velocity = i / s), this.lastMoveX = t.clientX, this.lastMoveTime = e, this.emitter.emit("scroll", { deltaPixels: -i });
    }));
  }
  handleMouseUp(t) {
    document.removeEventListener("mousemove", this.boundMouseMove), document.removeEventListener("mouseup", this.boundMouseUp), this.isPanning && this.options.momentum && Math.abs(this.velocity) > 0.01 && this.startMomentum(), setTimeout(() => {
      this.isPanning = !1;
    }, 0);
  }
  handleWheel(t) {
    t.preventDefault(), this.emitter.emit("scroll", { deltaPixels: t.deltaX || t.deltaY });
  }
  handleTouchStart(t) {
    t.touches.length === 1 ? (this.touchStartX = t.touches[0].clientX, this.touchStartY = t.touches[0].clientY, this.lastMoveX = t.touches[0].clientX, this.lastMoveTime = performance.now(), this.velocity = 0) : t.touches.length === 2 ? (t.preventDefault(), this.initialPinchDistance = this.getPinchDistance(t.touches)) : t.touches.length === 3 && (t.preventDefault(), this.isPanning = !0, this.lastMoveX = t.touches[1].clientX, this.lastMoveTime = performance.now());
  }
  handleTouchMove(t) {
    this.rafId === null && (this.rafId = requestAnimationFrame(() => {
      if (this.rafId = null, t.touches.length === 1) {
        const e = this.getCanvasRatio(t.touches[0].clientX), i = performance.now(), s = i - this.lastMoveTime;
        s > 0 && (this.velocity = (t.touches[0].clientX - this.lastMoveX) / s), this.lastMoveX = t.touches[0].clientX, this.lastMoveTime = i, this.emitter.emit("seek", { ratio: e });
      } else if (t.touches.length === 2 && this.initialPinchDistance !== null) {
        t.preventDefault();
        const e = this.getPinchDistance(t.touches), i = e / this.initialPinchDistance;
        this.emitter.emit("zoom", { scale: i }), this.initialPinchDistance = e;
      } else if (t.touches.length === 3) {
        t.preventDefault();
        const e = performance.now(), i = t.touches[1].clientX - this.lastMoveX, s = e - this.lastMoveTime;
        s > 0 && (this.velocity = i / s), this.lastMoveX = t.touches[1].clientX, this.lastMoveTime = e, this.emitter.emit("scroll", { deltaPixels: -i });
      }
    }));
  }
  handleTouchEnd(t) {
    t.touches.length === 0 && (this.initialPinchDistance = null, this.options.momentum && Math.abs(this.velocity) > 0.01 && this.startMomentum(), this.isPanning = !1);
  }
  getPinchDistance(t) {
    const e = t[0].clientX - t[1].clientX, i = t[0].clientY - t[1].clientY;
    return Math.sqrt(e * e + i * i);
  }
  startMomentum() {
    this.stopMomentum();
    let t = performance.now();
    const e = () => {
      const i = performance.now(), s = i - t;
      if (t = i, this.velocity *= Math.pow(this.options.momentumDeceleration, s / 16), Math.abs(this.velocity) < 1e-3) {
        this.velocity = 0, this.momentumRafId = null;
        return;
      }
      const n = -this.velocity * s;
      this.emitter.emit("scroll", { deltaPixels: n }), this.momentumRafId = requestAnimationFrame(e);
    };
    this.momentumRafId = requestAnimationFrame(e);
  }
  stopMomentum() {
    this.momentumRafId !== null && (cancelAnimationFrame(this.momentumRafId), this.momentumRafId = null), this.velocity = 0;
  }
}
let T = null, _ = null, C = !1;
async function S() {
  return _ || (T || (T = (async () => {
    try {
      const r = await import("./irontide_core-CeTvVXFH.js"), t = r.default;
      return await t(), r.init_irontide(), _ = r, C = !0, r;
    } catch (r) {
      throw T = null, C = !1, r;
    }
  })()), T);
}
function B(r) {
  return r === "wasm" ? "wasm" : r === "web" ? "web" : C ? "wasm" : "web";
}
async function R(r, t, e, i) {
  const s = (h, c) => {
    e == null || e(h, c);
  };
  s(0, "downloading");
  const n = await fetch(r);
  if (!n.ok)
    throw new Error(`Failed to fetch audio: ${n.status} ${n.statusText}`);
  const a = await O(n, (h) => {
    s(h * 25, "downloading");
  });
  s(25, "downloading");
  let l = t;
  if (t === "auto")
    try {
      await S(), l = "wasm";
    } catch {
      i == null || i("WASM initialization failed, falling back to Web Audio API"), l = "web";
    }
  const u = B(l);
  s(25, "decoding");
  let m;
  if (u === "wasm") {
    const h = await S(), c = new Uint8Array(a);
    m = h.decodeAudio(c, (v) => {
      s(25 + v * 35, "decoding");
    }), s(60, "decoding");
  } else {
    const h = new AudioContext();
    try {
      const c = await h.decodeAudioData(a.slice(0));
      s(60, "decoding"), s(60, "processing");
      const v = await S(), f = c.numberOfChannels, p = c.length, b = new Float32Array(p * f);
      for (let w = 0; w < f; w++) {
        const g = c.getChannelData(w);
        for (let d = 0; d < p; d++)
          b[d * f + w] = g[d];
        s(60 + (w + 1) / f * 30, "processing");
      }
      m = new v.AudioData(b, c.sampleRate, f);
    } finally {
      await h.close();
    }
  }
  return s(100, "ready"), { audioData: m };
}
async function O(r, t) {
  const e = r.headers.get("content-length");
  if (!e || !r.body) {
    const h = await r.arrayBuffer();
    return t(1), h;
  }
  const i = parseInt(e, 10), s = r.body.getReader(), n = [];
  let a = 0;
  for (; ; ) {
    const { done: h, value: c } = await s.read();
    if (h) break;
    n.push(c), a += c.length, t(i > 0 ? a / i : 0);
  }
  const l = new ArrayBuffer(a), u = new Uint8Array(l);
  let m = 0;
  for (const h of n)
    u.set(h, m), m += h.length;
  return l;
}
const k = {
  decoder: "auto",
  height: 128,
  waveColor: "#464340",
  progressColor: "#e1b728",
  barWidth: "auto",
  barGap: 1,
  interact: !0,
  momentum: !0,
  momentumDeceleration: 0.95,
  onLoading: void 0
};
class I {
  constructor(t, e, i, s, n, a, l) {
    o(this, "emitter", new E());
    o(this, "renderer");
    o(this, "interaction");
    o(this, "audioData");
    o(this, "canvas");
    o(this, "container");
    o(this, "resizeObserver", null);
    o(this, "_currentTime", 0);
    o(this, "_duration", 0);
    o(this, "_pixelsPerSecond", 0);
    // 0 = fit to width
    o(this, "_scrollPosition", 0);
    // 0-1
    o(this, "minZoom", 1);
    o(this, "maxZoom", 1e3);
    o(this, "_decoder", "auto");
    this.container = t, this.canvas = e, this.renderer = i, this.interaction = s, this.audioData = n, this.emitter = a, this._duration = n.duration, this._decoder = l, this.wireInteraction(), this.setupResizeHandling(), this.render();
  }
  static async create(t) {
    const e = { ...k, ...t }, i = typeof e.container == "string" ? document.querySelector(e.container) : e.container;
    if (!i)
      throw new Error(
        `Container not found: ${typeof t.container == "string" ? t.container : "element"}`
      );
    const s = document.createElement("canvas");
    s.style.display = "block", s.style.width = "100%", i.appendChild(s);
    try {
      const n = new E(), a = new z(s, {
        height: e.height,
        waveColor: e.waveColor,
        progressColor: e.progressColor,
        barWidth: e.barWidth,
        barGap: e.barGap
      }), l = i.getBoundingClientRect();
      l.width > 0 && a.resize(l.width);
      const u = new A(s, {
        interact: e.interact,
        momentum: e.momentum,
        momentumDeceleration: e.momentumDeceleration
      }), { audioData: m } = await R(
        e.src,
        e.decoder,
        (c, v) => {
          var f;
          (f = e.onLoading) == null || f.call(e, c, v), n.emit("loading", { progress: c, stage: v });
        },
        (c) => {
          n.emit("warning", c);
        }
      ), h = new I(
        i,
        s,
        a,
        u,
        m,
        n,
        e.decoder
      );
      return n.emit("ready", void 0), h;
    } catch (n) {
      throw i.removeChild(s), n;
    }
  }
  // --- Events ---
  on(t, e) {
    this.emitter.on(t, e);
  }
  off(t, e) {
    this.emitter.off(t, e);
  }
  // --- Public methods ---
  setCurrentTime(t) {
    this._currentTime = Math.max(0, Math.min(this._duration, t)), this.autoScrollToPlayhead(), this.render();
  }
  getCurrentTime() {
    return this._currentTime;
  }
  getDuration() {
    return this._duration;
  }
  /**
   * Set zoom level in pixels per second.
   * Use 0 to fit the entire waveform to the container width.
   */
  zoom(t) {
    t === 0 ? (this._pixelsPerSecond = 0, this._scrollPosition = 0) : this._pixelsPerSecond = Math.max(this.minZoom, Math.min(this.maxZoom, t)), this.render();
  }
  getZoom() {
    return this._pixelsPerSecond;
  }
  zoomIn(t = 2) {
    this.zoom(this.getEffectivePxPerSec() * t);
  }
  zoomOut(t = 2) {
    this.zoom(this.getEffectivePxPerSec() / t);
  }
  scrollToTime(t) {
    const e = this.getTotalWidth(), i = this.canvas.clientWidth;
    if (e <= i) return;
    const s = this.getEffectivePxPerSec(), n = e - i;
    let a = t * s - i / 2;
    a = Math.max(0, Math.min(n, a)), this._scrollPosition = a / n, this.render(), this.emitter.emit("scroll", this._scrollPosition);
  }
  setScrollPosition(t) {
    this._scrollPosition = Math.max(0, Math.min(1, t)), this.render(), this.emitter.emit("scroll", this._scrollPosition);
  }
  getScrollPosition() {
    return this._scrollPosition;
  }
  setInteraction(t) {
    this.interaction.setInteraction(t);
  }
  async load(t) {
    this.audioData && typeof this.audioData.free == "function" && this.audioData.free();
    const { audioData: e } = await R(
      t,
      this._decoder,
      (i, s) => {
        this.emitter.emit("loading", { progress: i, stage: s });
      },
      (i) => {
        this.emitter.emit("warning", i);
      }
    );
    this.audioData = e, this._duration = e.duration, this._currentTime = 0, this._scrollPosition = 0, this._pixelsPerSecond = 0, this.render(), this.emitter.emit("ready", void 0);
  }
  destroy() {
    this.resizeObserver && (this.resizeObserver.disconnect(), this.resizeObserver = null), this.interaction.destroy(), this.renderer.destroy(), this.canvas.parentElement && this.canvas.parentElement.removeChild(this.canvas), this.emitter.removeAll(), this.audioData && typeof this.audioData.free == "function" && this.audioData.free();
  }
  // --- Internal ---
  getEffectivePxPerSec() {
    return this._pixelsPerSecond > 0 ? this._pixelsPerSecond : this.canvas.clientWidth / this._duration;
  }
  getTotalWidth() {
    return this._duration * this.getEffectivePxPerSec();
  }
  getScrollOffset() {
    const t = this.getTotalWidth(), e = this.canvas.clientWidth;
    return t <= e ? 0 : this._scrollPosition * (t - e);
  }
  getVisibleTimeRange() {
    const t = this.getScrollOffset(), e = this.canvas.clientWidth, i = this.getEffectivePxPerSec();
    return {
      start: Math.max(0, t / i),
      end: Math.min(this._duration, (t + e) / i)
    };
  }
  wireInteraction() {
    this.interaction.on("seek", (t) => {
      const { start: e, end: i } = this.getVisibleTimeRange(), s = e + t.ratio * (i - e);
      this._currentTime = Math.max(0, Math.min(this._duration, s)), this.render(), this.emitter.emit("seek", this._currentTime);
    }), this.interaction.on("scroll", (t) => {
      const e = this.getTotalWidth(), i = this.canvas.clientWidth;
      if (e <= i) return;
      const s = e - i, n = this.getScrollOffset(), a = Math.max(0, Math.min(s, n + t.deltaPixels));
      this._scrollPosition = a / s, this.render(), this.emitter.emit("scroll", this._scrollPosition);
    }), this.interaction.on("zoom", (t) => {
      this.zoom(this.getEffectivePxPerSec() * t.scale);
    });
  }
  setupResizeHandling() {
    typeof ResizeObserver > "u" || (this.resizeObserver = new ResizeObserver(() => {
      const t = this.container.clientWidth;
      t > 0 && (this.renderer.resize(t), this.render());
    }), this.resizeObserver.observe(this.container));
  }
  autoScrollToPlayhead() {
    const { start: t, end: e } = this.getVisibleTimeRange(), i = (e - t) * 0.1;
    (this._currentTime < t + i || this._currentTime > e - i) && this.scrollToTime(this._currentTime);
  }
  render() {
    const t = this.canvas.clientWidth;
    if (t <= 0 || !this.audioData) return;
    const { start: e, end: i } = this.getVisibleTimeRange(), s = this.audioData.sample_rate, n = Math.floor(e * s), a = Math.min(this.audioData.len, Math.ceil(i * s)), l = this.getTotalWidth(), { totalBarWidth: u } = this.renderer.calculateBarDimensions(t, l), m = Math.floor(t / u);
    if (m <= 0 || a <= n) return;
    const h = this.audioData.calculatePeaks(m, n, a);
    this.renderer.render(h, { start: e, end: i }, this._currentTime, this._duration);
  }
}
export {
  I as Waveform,
  S as initIrontide
};
