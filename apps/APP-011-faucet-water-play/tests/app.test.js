"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }
  dispatch(type, event = {}) {
    const dispatched = {
      preventDefault() {},
      pointerId: 1,
      ...event
    };
    (this.listeners.get(type) || []).forEach((handler) => handler(dispatched));
    return dispatched;
  }
}

const appRoot = path.join(__dirname, "..");
const indexSource = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const styleSource = fs.readFileSync(path.join(appRoot, "styles.css"), "utf8");
const appSource = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");

assert.match(indexSource, /<title>じゃぐちみずあそび<\/title>/, "title identifies APP-011");
assert.ok(indexSource.includes('href="styles.css?v=20260906-finish"'), "finishing CSS update is cache-busted");
assert.ok(indexSource.includes('src="app.js?v=20260906-finish"'), "finishing JavaScript update is cache-busted");
assert.equal((indexSource.match(/<canvas/g) || []).length, 1, "one Canvas is used");
assert.ok(!/shared\/(?:ga4|clarity|portal-home)/.test(indexSource), "MVP does not add analytics or portal behavior");
assert.match(styleSource, /height:\s*100dvh/, "dynamic viewport height is supported");
assert.match(styleSource, /env\(safe-area-inset-top\)/, "faucet respects the top safe area");
assert.match(styleSource, /prefers-reduced-motion:\s*reduce/, "reduced-motion styles exist");
assert.match(styleSource, /\.faucet__spout\s*\{[^}]*border-left:\s*0;/s, "spout removes the inner overlap seam at the curved neck");
assert.ok(!/setInterval|new Audio|fetch\(|XMLHttpRequest/.test(appSource), "no interval, audio, or external request is introduced");
assert.match(appSource, /visibilitychange/, "visibility changes are handled");
assert.match(appSource, /pagehide/, "pagehide is handled");
assert.match(appSource, /pageshow/, "pageshow and BFCache return are handled");

function createEnvironment(reduced = false) {
  let now = 0;
  let nextFrame = 1;
  let viewport = { width: 390, height: 844 };
  const frames = new Map();
  const drawCalls = [];
  const windowTarget = new Target();
  const documentTarget = new Target();
  const playArea = new Target();
  const media = new Target();
  const classes = new Set();
  const gradient = { addColorStop(...args) { drawCalls.push(["addColorStop", ...args]); } };
  const context = new Proxy({}, {
    get: (_, key) => {
      if (key === "createLinearGradient") return (...args) => {
        drawCalls.push([key, ...args]);
        return gradient;
      };
      return (...args) => drawCalls.push([key, ...args]);
    },
    set: (_, key, value) => { drawCalls.push([`set:${String(key)}`, value]); return true; }
  });
  const canvas = { width: 0, height: 0, style: {}, getContext: () => context };
  const spoutTip = { getBoundingClientRect: () => ({ left: 117, bottom: 151, width: 36 }) };
  const status = { textContent: "" };

  playArea.classList = {
    toggle(name, active) { if (active) classes.add(name); else classes.delete(name); },
    contains(name) { return classes.has(name); }
  };
  playArea.getBoundingClientRect = () => ({ ...viewport });
  playArea.setPointerCapture = () => {};
  media.matches = reduced;
  documentTarget.hidden = false;
  documentTarget.getElementById = (id) => ({
    "water-canvas": canvas,
    "play-area": playArea,
    "spout-tip": spoutTip,
    status
  })[id];
  windowTarget.devicePixelRatio = 1;

  const sandbox = {
    window: windowTarget,
    document: documentTarget,
    matchMedia: () => media,
    performance: { now: () => now },
    requestAnimationFrame(callback) {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) { frames.delete(id); },
    Math,
    Set,
    Object,
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(appSource, sandbox, { filename: "app.js" });

  function step(count = 1, milliseconds = 16.667) {
    for (let index = 0; index < count; index += 1) {
      now += milliseconds;
      const pending = [...frames.entries()];
      frames.clear();
      pending.forEach(([, callback]) => callback(now));
    }
  }

  return {
    sandbox,
    playArea,
    documentTarget,
    windowTarget,
    media,
    status,
    drawCalls,
    step,
    pendingFrames: () => frames.size,
    setViewport(width, height) {
      viewport = { width, height };
      windowTarget.dispatch("resize");
    }
  };
}

const env = createEnvironment();
const debug = env.sandbox.window.__FAUCET_WATER_DEBUG__;
assert.ok(debug, "debug inspection API exists");
assert.equal(debug.snapshot().pointerCount, 0, "startup has no active pointer");
assert.equal(debug.snapshot().hasInteracted, false, "hint is available before the first interaction");
assert.equal(env.pendingFrames(), 1, "startup has exactly one pending animation frame");
assert.deepEqual([debug.snapshot().originX, debug.snapshot().originY], [135, 149], "stream starts at the rendered spout tip");

env.playArea.dispatch("pointerdown", { pointerId: 1 });
assert.equal(debug.snapshot().flowing, true, "water responds immediately on pointerdown");
assert.equal(debug.snapshot().hasInteracted, true, "first pointerdown permanently dismisses the session hint");
assert.ok(env.playArea.classList.contains("has-interacted"), "dismissed hint state is reflected in the UI class");
assert.ok(env.playArea.classList.contains("is-flowing"), "visual hint is hidden while flowing");
assert.equal(env.status.textContent, "お水が出ています", "flow start is announced");
env.step(60);
let state = debug.snapshot();
assert.ok(state.flowStrength > 0.99, "flow reaches a clear stable amount");
assert.ok(state.poolLevel > 0.2, "pool grows at the increased rate during a hold");
assert.ok(env.drawCalls.some(([name]) => name === "bezierCurveTo"), "water uses soft bezier shapes");
assert.ok(env.drawCalls.some(([name]) => name === "createLinearGradient"), "water has transparent gradient depth");
assert.ok(env.drawCalls.filter(([name]) => name === "ellipse").length >= 2, "pool uses a complete ellipse and inner highlight");
assert.ok(env.drawCalls.some(([name]) => name === "arc"), "normal motion includes restrained splashes");
assert.ok(state.poolBounds.left >= 0 && state.poolBounds.right <= state.width, "portrait pool stays clear of horizontal edges");
assert.ok(state.poolBounds.top >= 0 && state.poolBounds.bottom < state.height, "portrait pool is a complete visible ellipse");
env.drawCalls.length = 0;
env.step(1);
assert.equal(env.drawCalls.filter(([name]) => name === "ellipse").length, 4, "flowing water draws two fixed landing ripples over the two pool ellipses");

env.playArea.dispatch("pointerdown", { pointerId: 2 });
env.playArea.dispatch("pointerup", { pointerId: 1 });
assert.equal(debug.snapshot().flowing, true, "water continues while another finger remains");
env.playArea.dispatch("pointercancel", { pointerId: 2 });
assert.equal(debug.snapshot().flowing, false, "last pointer cancellation stops water");
assert.equal(env.status.textContent, "お水が止まりました", "flow stop is announced");
const poolAtRelease = debug.snapshot().poolLevel;
env.step(90);
state = debug.snapshot();
assert.equal(state.flowStrength, 0, "stream fully stops after release");
assert.ok(state.poolLevel > 0 && state.poolLevel < poolAtRelease, "pool remains briefly and decays after release");
assert.ok(poolAtRelease - state.poolLevel > 0.05, "released pool uses the increased decay rate");
assert.equal(debug.snapshot().hasInteracted, true, "hint stays dismissed after release");

for (let index = 0; index < 80; index += 1) {
  env.playArea.dispatch("pointerdown", { pointerId: index + 10 });
  env.playArea.dispatch("pointerup", { pointerId: index + 10 });
}
env.step(5);
assert.equal(debug.snapshot().pointerCount, 0, "rapid taps leave no pointer state");
assert.equal(env.pendingFrames(), 1, "rapid taps do not duplicate the animation loop");

env.playArea.dispatch("pointerdown", { pointerId: 200 });
env.documentTarget.hidden = true;
env.documentTarget.dispatch("visibilitychange");
assert.equal(debug.snapshot().running, false, "hidden page stops animation");
assert.equal(debug.snapshot().pointerCount, 0, "hidden page clears active input");
assert.equal(debug.snapshot().hasInteracted, true, "lifecycle pause does not redisplay the session hint");
assert.equal(env.pendingFrames(), 0, "hidden page leaves no pending frame");
env.documentTarget.hidden = false;
env.documentTarget.dispatch("visibilitychange");
assert.equal(debug.snapshot().running, true, "visible page resumes animation");
assert.equal(env.pendingFrames(), 1, "resume creates one frame only");
env.windowTarget.dispatch("pageshow", { persisted: true });
assert.equal(env.pendingFrames(), 1, "BFCache return does not duplicate the loop");

env.setViewport(844, 390);
assert.deepEqual([debug.snapshot().width, debug.snapshot().height], [844, 390], "landscape resize updates the Canvas state");
assert.ok(debug.snapshot().poolBounds.left >= 0 && debug.snapshot().poolBounds.right <= 844, "landscape pool stays clear of horizontal edges");
assert.ok(debug.snapshot().poolBounds.bottom < 390, "landscape pool remains fully visible above the bottom edge");
assert.equal(env.pendingFrames(), 1, "resize does not duplicate the loop");

const reducedEnv = createEnvironment(true);
const reducedDebug = reducedEnv.sandbox.window.__FAUCET_WATER_DEBUG__;
reducedEnv.playArea.dispatch("pointerdown", { pointerId: 1 });
reducedEnv.step(80);
assert.equal(reducedDebug.snapshot().reducedMotion, true, "reduced-motion state is active");
assert.ok(reducedDebug.snapshot().flowStrength > 0.99, "reduced-motion preserves the core water response");
assert.ok(reducedDebug.snapshot().poolLevel > 0.25, "reduced-motion preserves the increased pool growth");
assert.equal(reducedEnv.drawCalls.filter(([name]) => name === "arc").length, 0, "reduced-motion removes animated splash droplets");
reducedEnv.drawCalls.length = 0;
reducedEnv.step(1);
assert.equal(reducedEnv.drawCalls.filter(([name]) => name === "ellipse").length, 2, "reduced-motion omits landing ripples while preserving the pool ellipses");

for (let index = 0; index < 60 * 60 * 3; index += 1) reducedEnv.step(1);
assert.ok(reducedDebug.snapshot().poolLevel <= 1, "three simulated minutes never exceed the pool cap");
assert.equal(reducedEnv.pendingFrames(), 1, "long running use keeps one animation frame");

console.log("APP-011 faucet water play regression: PASS");
