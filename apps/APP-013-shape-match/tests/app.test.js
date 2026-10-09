"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const SNAP_FALLBACK = 1080;
const CYCLE_FALLBACK = SNAP_FALLBACK + 1800 + 220;

class Target {
  constructor(width = 140, height = width) {
    this.listeners = new Map();
    this.classes = new Set();
    this.captures = new Set();
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.offsetWidth = width;
    this.offsetHeight = height;
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
      toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name)
    };
  }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }
  get offsetWidth() { return parseFloat(this.style.width) || this._width; }
  set offsetWidth(value) { this._width = value; }
  get offsetHeight() { return parseFloat(this.style.height) || this._height; }
  set offsetHeight(value) { this._height = value; }
  dispatch(type, event = {}) {
    const input = { button: 0, pointerId: 1, preventDefault() {}, ...event };
    (this.listeners.get(type) || []).forEach((callback) => callback(input));
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  toggleAttribute(name, active) {
    if (active) this.attributes[name] = "";
    else delete this.attributes[name];
  }
  hasPointerCapture(id) { return this.captures.has(id); }
  setPointerCapture(id) { this.captures.add(id); }
  releasePointerCapture(id) {
    this.captures.delete(id);
    this.dispatch("lostpointercapture", { pointerId: id });
  }
}

function translation(element) {
  return element.style.transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px/).slice(1).map(Number);
}

function environment(reduced = false) {
  const window = new Target();
  const document = new Target();
  const media = new Target();
  media.matches = reduced;
  document.hidden = false;
  const board = new Target();
  const status = { textContent: "" };
  const piece = new Target();
  const target = new Target(304, 198);
  const shapes = ["circle", "rectangle", "egg", "triangle", "diamond"].map(() => new Target());
  const animals = ["turtle", "dog", "chick", "fox", "fish"].map(() => new Target());
  const ids = { board, status, piece, target, features: new Target(), "piece-svg": new Target() };
  ["circle", "rectangle", "egg", "triangle", "diamond"].forEach((shape, i) => { ids["shape-" + shape] = shapes[i]; });
  ["turtle", "dog", "chick", "fox", "fish"].forEach((animal, i) => { ids["animal-" + animal] = animals[i]; });
  ["turtle", "dog", "chick", "fox", "fish"].forEach((animal) => { ids["details-" + animal] = new Target(); });
  let width = 366;
  let height = 820;
  let now = 0;
  let timerId = 0;
  let maxTimers = 0;
  const timers = new Map();
  board.getBoundingClientRect = () => ({ left: 12, top: 12, width, height });
  [piece, target].forEach((element) => {
    element.getBoundingClientRect = () => {
      const [x, y] = translation(element);
      return { left: x + 12, top: y + 12, width: element.offsetWidth, height: element.offsetHeight };
    };
  });
  document.getElementById = (id) => ids[id];
  const sandbox = {
    window, document, matchMedia: () => media, console,
    setTimeout(callback, delay) {
      const id = ++timerId;
      timers.set(id, { callback, at: now + delay });
      maxTimers = Math.max(maxTimers, timers.size);
      return id;
    },
    clearTimeout: (id) => timers.delete(id)
  };
  vm.runInNewContext(source, sandbox, { filename: "APP-013/app.js" });
  function advance(milliseconds) {
    const end = now + milliseconds;
    while (true) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
    }
    now = end;
  }
  function point(element) {
    const [x, y] = translation(element);
    return { clientX: x + element.offsetWidth / 2 + 12, clientY: y + element.offsetHeight / 2 + 12 };
  }
  function start(id = 1) { piece.dispatch("pointerdown", { pointerId: id, ...point(piece) }); }
  function approach(id = 1, pointOverride = point(target)) {
    start(id);
    piece.dispatch("pointermove", { pointerId: id, ...pointOverride });
  }
  return { window, document, media, board, status, piece, target, shapes, animals, timers, point, start, approach, advance,
    maxTimers: () => maxTimers,
    resize(w, h, size = 140) {
      width = w - 24; height = h - 24;
      piece.offsetWidth = piece.offsetHeight = size;
      target.offsetWidth = 2 * (size + 12);
      target.offsetHeight = 1.3 * (size + 12);
      window.dispatch("resize");
    }
  };
}

function checkStage(env, shape, animal) {
  assert.equal(env.board.dataset.shape, shape);
  assert.equal(env.board.dataset.animal, animal);
  assert.equal(env.shapes.filter((item) => !("hidden" in item.attributes)).length, 1, "one visible shape");
  assert.equal(env.animals.filter((item) => !("hidden" in item.attributes)).length, 1, "one visible animal");
}

const env = environment();
const listenerCount = () => [env.window, env.document, env.media, env.piece, env.target].reduce((sum, target) =>
  sum + [...target.listeners.values()].reduce((count, listeners) => count + listeners.length, 0), 0);
const originalListeners = listenerCount();
checkStage(env, "circle", "turtle");
assert.equal(env.board.dataset.state, "idle");
assert.equal(env.timers.size, 0);
const home = env.point(env.piece);

// A regular touch is not a tap-to-complete shortcut.
env.start();
assert.equal(env.board.dataset.state, "dragging");
env.piece.dispatch("pointerup", home);
assert.equal(env.board.dataset.state, "idle");
assert.deepEqual(env.point(env.piece), home);
assert.equal(env.status.textContent, "");
assert.equal(env.timers.size, 0);

// Wide magnet accepts well outside the central socket, before pointerup.
const destination = env.point(env.target);
env.approach(1, { clientX: destination.clientX + 130, clientY: destination.clientY });
assert.equal(env.board.dataset.state, "completing", "auto snap happens on pointermove");
assert.equal(env.piece.captures.size, 0, "snap releases ownership immediately");
assert.deepEqual(env.point(env.piece), destination);
assert.equal(env.piece.attributes["aria-disabled"], "true");
assert.equal(env.board.classList.contains("is-complete"), false, "snap precedes animal completion");
env.advance(999);
assert.equal(env.status.textContent, "");
env.advance(1);
assert.equal(env.status.textContent, "", "completion waits for actual transform arrival");
env.piece.dispatch("pointerup", { pointerId: 1, ...home });
env.piece.dispatch("pointercancel", { pointerId: 1 });
env.piece.dispatch("transitionend", { target: env.piece, propertyName: "opacity", elapsedTime: 1 });
env.piece.dispatch("transitionend", { target: env.piece, propertyName: "transform", elapsedTime: 0.28 });
assert.equal(env.board.classList.contains("is-complete"), false, "a stale return transition cannot finish a snap");
env.piece.dispatch("transitionend", { target: env.piece, propertyName: "transform", elapsedTime: 1 });
assert.equal(env.status.textContent, "かめができた");
assert.equal(env.board.classList.contains("is-complete"), true);
assert.equal(env.timers.size, 1);
const rewardTimer = [...env.timers.keys()][0];
env.piece.dispatch("transitionend", { target: env.piece, propertyName: "transform", elapsedTime: 1 });
assert.equal([...env.timers.keys()][0], rewardTimer, "a duplicate arrival cannot restart the reward");

// A late up/cancel and fast repeated inputs cannot start another stage chain.
for (let i = 0; i < 100; i++) {
  env.piece.dispatch("pointerdown", { pointerId: i + 2, ...home });
  env.piece.dispatch("pointermove", { pointerId: i + 2, ...destination });
  env.piece.dispatch("pointerup", { pointerId: i + 2, ...destination });
  env.piece.dispatch("pointercancel", { pointerId: 1 });
  env.piece.dispatch("keydown", { key: "Enter" });
}
assert.equal(env.timers.size, 1);
env.advance(1799);
checkStage(env, "circle", "turtle");
env.advance(1);
assert.equal(env.board.dataset.state, "transitioning");
assert.equal(env.timers.size, 1);
env.advance(219);
checkStage(env, "circle", "turtle");
env.advance(1);
checkStage(env, "rectangle", "dog");
assert.equal(env.board.dataset.state, "idle");
assert.equal(env.timers.size, 0);
env.approach();
env.advance(SNAP_FALLBACK);
assert.equal(env.status.textContent, "いぬができた");
env.advance(2020);
checkStage(env, "egg", "chick");
env.approach();
env.advance(SNAP_FALLBACK);
assert.equal(env.status.textContent, "ひよこができた");
env.advance(2020);
checkStage(env, "triangle", "fox");
env.approach();
env.advance(SNAP_FALLBACK);
assert.equal(env.status.textContent, "きつねができた");
env.advance(2020);
checkStage(env, "diamond", "fish");
env.approach();
env.advance(SNAP_FALLBACK);
assert.equal(env.status.textContent, "さかなができた");
env.advance(2020);
checkStage(env, "circle", "turtle");

// Only the first pointer owns the piece.
env.start(10);
env.piece.dispatch("pointerdown", { pointerId: 20, ...home });
env.piece.dispatch("pointermove", { pointerId: 20, ...env.point(env.target) });
env.piece.dispatch("pointerup", { pointerId: 20, ...env.point(env.target) });
assert.equal(env.board.dataset.state, "dragging");
assert.equal(env.piece.captures.size, 1);
assert.equal(env.piece.hasPointerCapture(10), true);
env.piece.dispatch("pointermove", { pointerId: 10, ...env.point(env.target) });
assert.equal(env.board.dataset.state, "completing");
env.advance(CYCLE_FALLBACK);
checkStage(env, "rectangle", "dog");

// Outside drops and capture cancellation are neutral and immediately reusable.
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  const start = env.point(env.piece);
  env.start(42);
  env.piece.dispatch("pointermove", { pointerId: 42, clientX: 350, clientY: 780 });
  env.piece.dispatch(type, { pointerId: 42, clientX: 350, clientY: 780 });
  assert.equal(env.board.dataset.state, "idle");
  assert.equal(env.piece.captures.size, 0);
  assert.deepEqual(env.point(env.piece), start);
  assert.equal(env.status.textContent, "");
  assert.equal(env.timers.size, 0);
}

// Interrupt every phase and ensure old callbacks cannot revive a half-complete animal.
for (let stage = 0; stage < 5; stage++) {
for (const phase of ["dragging", "snapping", "glow", "reward", "transitioning"]) {
  for (const event of ["visibilitychange", "pagehide"]) {
    const current = env.board.dataset.animal;
    if (phase === "dragging") env.start();
    else {
      env.approach();
      if (phase === "glow") env.advance(SNAP_FALLBACK + 100);
      if (phase === "reward") env.advance(SNAP_FALLBACK + 700);
      if (phase === "transitioning") env.advance(SNAP_FALLBACK + 1800);
    }
    const stale = [...env.timers.values()].map((timer) => timer.callback);
    if (event === "visibilitychange") { env.document.hidden = true; env.document.dispatch(event); }
    else env.window.dispatch(event, { persisted: true });
    assert.equal(env.timers.size, 0);
    assert.equal(env.piece.captures.size, 0);
    assert.equal(env.board.dataset.state, "idle");
    assert.equal(env.board.dataset.animal, current, "suspension preserves the current stage");
    assert.equal(env.board.classList.contains("is-complete"), false);
    assert.equal(env.piece.attributes["aria-disabled"], "false");
    stale.forEach((callback) => callback());
    env.approach();
    assert.equal(env.timers.size, 0, "hidden input/stale timers are ignored");
    env.document.hidden = false;
    env.document.dispatch("visibilitychange");
    env.window.dispatch("pageshow", { persisted: true });
    assert.equal(env.board.dataset.state, "idle");
  }
}
env.approach();
env.advance(CYCLE_FALLBACK);
}

for (const [w, h, size] of [[390,844,140],[844,390,140],[1024,768,150]]) {
  env.approach();
  env.advance(SNAP_FALLBACK);
  const animal = env.board.dataset.animal;
  env.resize(w, h, size);
  assert.equal(env.board.dataset.animal, animal);
  assert.equal(env.board.dataset.state, "idle");
  assert.equal(env.timers.size, 0);
  const p = env.piece.getBoundingClientRect();
  const t = env.target.getBoundingClientRect();
  assert.ok(p.left >= 12 && p.top >= 12 && p.left + p.width <= w - 12 && p.top + p.height <= h - 12);
  assert.ok(t.left >= 12 && t.top >= 12 && t.left + t.width <= w - 12 && t.top + t.height <= h - 12);
  assert.ok(t.top + t.height < p.top, "animal and piece are separated");
  env.start();
  assert.equal(env.board.dataset.state, "dragging", "landscape touch alone does not complete");
  env.piece.dispatch("pointercancel", { pointerId: 1 });
}

const reduced = environment(true);
reduced.approach();
reduced.advance(59);
assert.equal(reduced.status.textContent, "");
reduced.advance(1);
reduced.piece.dispatch("transitionend", { target: reduced.piece, propertyName: "transform", elapsedTime: 0.06 });
assert.equal(reduced.status.textContent, "かめができた");
reduced.advance(1920);
checkStage(reduced, "rectangle", "dog");
reduced.piece.dispatch("keydown", { key: " " });
assert.equal(reduced.board.dataset.state, "completing");
reduced.advance(2060);
checkStage(reduced, "egg", "chick");
reduced.piece.dispatch("click", { detail: 1 });
assert.equal(reduced.board.dataset.state, "idle", "ordinary click is not a shortcut");
reduced.piece.dispatch("click", { detail: 0 });
assert.equal(reduced.board.dataset.state, "completing", "assistive activation is supported");
reduced.media.matches = false;
reduced.media.dispatch("change");
assert.equal(reduced.board.dataset.state, "idle");
assert.equal(reduced.timers.size, 0);

// 300 fallback-driven stages / 930 seconds, including missing transitionend and BFCache.
for (let stage = 0; stage < 5; stage++) {
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    env.start(99);
    env.piece.dispatch("pointerdown", { pointerId: 100, ...env.point(env.piece) });
    env.piece.dispatch("pointermove", { pointerId: 100, ...env.point(env.target) });
    assert.equal(env.board.dataset.state, "dragging");
    env.piece.dispatch(type, { pointerId: 99, clientX: 350, clientY: 820 });
    assert.equal(env.board.dataset.state, "idle");
    assert.equal(env.timers.size, 0);
  }
  env.approach();
  for (let i = 0; i < 100; i++) env.piece.dispatch("keydown", { key: "Enter" });
  assert.equal(env.timers.size, 1);
  env.advance(CYCLE_FALLBACK);
}
env.resize(390, 844);
for (let i = 0; i < 300; i++) {
  env.approach();
  assert.equal(env.timers.size, 1);
  env.advance(CYCLE_FALLBACK);
  assert.equal(env.timers.size, 0);
  env.window.dispatch("pageshow", { persisted: true });
}
assert.equal(env.maxTimers(), 1);
assert.equal(listenerCount(), originalListeners, "stages and return do not add event listeners");
assert.equal(env.piece.captures.size, 0);
assert.ok(!/setInterval|requestAnimationFrame|createElement|localStorage|sessionStorage|fetch\(|XMLHttpRequest|AudioContext|new Audio/.test(source));
console.log("APP-013 deterministic regression: PASS (300 stages / 930 simulated seconds, arrival event/fallback, single timer, glow/reward lifecycle, input ownership)");
