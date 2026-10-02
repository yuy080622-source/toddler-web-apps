"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

class Target {
  constructor(width = 96) {
    this.listeners = new Map();
    this.classes = new Set();
    this.captures = new Set();
    this.attributes = {};
    this.style = {};
    this.offsetWidth = width;
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
  dispatch(type, event = {}) {
    const input = { button: 0, pointerId: 1, preventDefault() {}, ...event };
    (this.listeners.get(type) || []).forEach((callback) => callback(input));
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  hasPointerCapture(id) { return this.captures.has(id); }
  setPointerCapture(id) { this.captures.add(id); }
  releasePointerCapture(id) {
    this.captures.delete(id);
    this.dispatch("lostpointercapture", { pointerId: id });
  }
}

function environment(reduced = false) {
  const window = new Target();
  const document = new Target();
  const media = new Target();
  media.matches = reduced;
  document.hidden = false;
  const board = new Target();
  const status = { textContent: "" };
  let width = 370;
  let height = 824;
  let now = 0;
  let timerId = 0;
  const timers = new Map();
  const shapes = ["circle", "square", "triangle"];
  const pieces = shapes.map(() => new Target());
  const targets = shapes.map(() => new Target(110));
  const ids = { board, status };
  board.getBoundingClientRect = () => ({ left: 10, top: 10, width, height });
  shapes.forEach((shape, i) => {
    ids[`piece-${shape}`] = pieces[i];
    ids[`target-${shape}`] = targets[i];
    pieces[i].getBoundingClientRect = () => {
      const [x, y] = translation(pieces[i]);
      return { left: x + 10, top: y + 10, width: 96, height: 96 };
    };
  });
  document.getElementById = (id) => ids[id];
  const sandbox = {
    window, document, matchMedia: () => media, console,
    setTimeout(callback, duration) {
      const id = ++timerId;
      timers.set(id, { callback, at: now + duration });
      return id;
    },
    clearTimeout: (id) => timers.delete(id)
  };
  vm.runInNewContext(source, sandbox, { filename: "APP-013/app.js" });
  function advance(milliseconds) {
    now += milliseconds;
    [...timers].forEach(([id, timer]) => {
      if (timer.at <= now) { timers.delete(id); timer.callback(); }
    });
  }
  function point(element) {
    const [x, y] = translation(element);
    return { clientX: x + element.offsetWidth / 2 + 10, clientY: y + element.offsetWidth / 2 + 10 };
  }
  function drag(index, destination, id = index + 1) {
    pieces[index].dispatch("pointerdown", { pointerId: id, ...point(pieces[index]) });
    pieces[index].dispatch("pointermove", { pointerId: id, ...destination });
    pieces[index].dispatch("pointerup", { pointerId: id, ...destination });
  }
  return { window, document, media, board, status, pieces, targets, timers, point, drag, advance,
    resize(w, h) { width = w; height = h; window.dispatch("resize"); }
  };
}

function translation(element) {
  return element.style.transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px/).slice(1).map(Number);
}
function placed(env, index) { return env.pieces[index].classes.has("is-placed"); }
function finish(env) { env.pieces.forEach((_, i) => env.drag(i, env.point(env.targets[i]))); }

const env = environment();
const listenerCount = () => [env.window, env.document, env.media, ...env.pieces].reduce((sum, target) =>
  sum + [...target.listeners.values()].reduce((count, listeners) => count + listeners.length, 0), 0);
const originalListeners = listenerCount();
const home = env.point(env.pieces[0]);
env.drag(0, env.point(env.targets[1]));
assert.equal(placed(env, 0), false, "wrong shape never places");
assert.deepEqual(env.point(env.pieces[0]), home, "wrong shape returns home");
assert.equal(env.status.textContent, "", "wrong drop produces no negative announcement");
env.drag(0, { clientX: 10, clientY: 800 });
assert.deepEqual(env.point(env.pieces[0]), home, "outside drop returns home");
const near = env.point(env.targets[0]);
env.drag(0, { clientX: near.clientX, clientY: near.clientY + 86 });
assert.equal(placed(env, 0), false, "drop beyond the generous boundary still returns home");
env.drag(0, { clientX: near.clientX + 70, clientY: near.clientY });
assert.equal(placed(env, 0), false, "overlapping wide regions prefer the nearer target, preserving wrong-shape return");
env.drag(0, { clientX: near.clientX, clientY: near.clientY + 70 });
assert.equal(placed(env, 0), true, "wide hit region accepts outside the visible target");
assert.deepEqual(env.point(env.pieces[0]), env.point(env.targets[0]), "success snaps exactly to target center");
env.pieces[0].dispatch("pointerdown", { ...home });
assert.equal(env.pieces[0].captures.size, 0, "placed piece cannot be dragged");
env.drag(1, env.point(env.targets[1]));
env.drag(2, env.point(env.targets[2]));
assert.equal(env.timers.size, 1, "three shapes schedule one reset");
for (let i = 0; i < 100; i++) env.pieces[0].dispatch("pointerdown", home);
assert.equal(env.timers.size, 1, "completion spam does not add timers");
env.advance(1099);
assert.ok(env.board.classes.has("is-complete"), "completion lasts the intended short interval");
env.advance(1);
assert.equal(env.timers.size, 0);
assert.ok(env.pieces.every((_, i) => !placed(env, i)), "all pieces reset");

// Three independent owners; a second finger on the same piece has no effect.
env.pieces.forEach((piece, i) => piece.dispatch("pointerdown", { pointerId: i + 10, ...env.point(piece) }));
env.pieces[0].dispatch("pointerdown", { pointerId: 99, ...home });
env.pieces[0].dispatch("pointerup", { pointerId: 99, ...env.point(env.targets[0]) });
assert.equal(placed(env, 0), false);
assert.ok(env.pieces.every((piece) => piece.captures.size === 1));
env.pieces.forEach((piece, i) => piece.dispatch("pointerup", { pointerId: i + 10, ...env.point(env.targets[i]) }));
assert.ok(env.pieces.every((_, i) => placed(env, i)), "three fingers can finish simultaneously");
env.advance(1100);

for (const type of ["pointercancel", "lostpointercapture"]) {
  env.pieces[0].dispatch("pointerdown", { pointerId: 42, ...env.point(env.pieces[0]) });
  env.pieces[0].dispatch("pointermove", { pointerId: 42, ...env.point(env.targets[0]) });
  assert.ok(env.targets[0].classes.has("is-near"), "correct target previews only while near");
  env.pieces[0].dispatch(type, { pointerId: 42 });
  assert.equal(placed(env, 0), false, "cancellation never turns into a match");
  assert.equal(env.pieces[0].captures.size, 0);
  assert.equal(env.targets[0].classes.has("is-near"), false);
  assert.deepEqual(env.point(env.pieces[0]), home);
}

env.drag(0, env.point(env.targets[0]));
env.pieces[1].dispatch("pointerdown", { pointerId: 55, ...env.point(env.pieces[1]) });
env.resize(824, 370);
assert.deepEqual(env.point(env.pieces[0]), env.point(env.targets[0]), "placed piece follows rotation");
assert.equal(env.pieces[1].captures.size, 0, "rotation releases dragging");
env.resize(370, 824);
for (const type of ["visibilitychange", "pagehide"]) {
  env.drag(1, env.point(env.targets[1]));
  env.drag(2, env.point(env.targets[2]));
  assert.equal(env.timers.size, 1);
  if (type === "visibilitychange") { env.document.hidden = true; env.document.dispatch(type); }
  else env.window.dispatch(type, { persisted: true });
  assert.equal(env.timers.size, 0, "suspension cancels completion timer");
  assert.ok(env.pieces.every((piece) => piece.captures.size === 0));
  env.drag(0, env.point(env.targets[0]));
  assert.equal(placed(env, 0), false, "hidden page ignores input");
  env.document.hidden = false;
  env.document.dispatch("visibilitychange");
  env.window.dispatch("pageshow", { persisted: true });
  env.drag(0, env.point(env.targets[0]));
  assert.equal(placed(env, 0), true, "return is immediately usable");
}
env.resize(824, 370);
finish(env);
env.resize(1004, 748);
assert.equal(env.timers.size, 0, "resize in completion cancels stale reset");

const reduced = environment(true);
finish(reduced);
assert.ok(reduced.pieces.every((piece) => !piece.classes.has("is-popping")), "reduced motion has no bounce");
assert.equal(reduced.timers.size, 1, "reduced motion still completes and resets");
reduced.advance(1100);
reduced.pieces[0].dispatch("keydown", { key: "Enter" });
assert.equal(placed(reduced, 0), true, "keyboard activates correct shape");
reduced.pieces[1].dispatch("click", { detail: 0 });
assert.equal(placed(reduced, 1), true, "assistive button activation works");
reduced.pieces[2].dispatch("click", { detail: 1 });
assert.equal(placed(reduced, 2), false, "a plain tap is not a match");

// 198 seconds on the deterministic clock, with 540 successful drag operations.
for (let i = 0; i < 180; i++) {
  finish(env);
  assert.equal(env.timers.size, 1);
  env.advance(1100);
  assert.equal(env.timers.size, 0);
  env.window.dispatch("pageshow", { persisted: true });
}
assert.equal(listenerCount(), originalListeners, "rounds and BFCache return never add listeners");
assert.ok(env.pieces.every((piece) => piece.captures.size === 0));
console.log("APP-013 deterministic regression: PASS (drag, 3 pointers, lifecycle, reduced motion, 540 drags)");
