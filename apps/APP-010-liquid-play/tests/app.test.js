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
    (this.listeners.get(type) || []).forEach((handler) => handler({
      preventDefault() {}, stopPropagation() {}, pointerId: 1, clientX: 0, clientY: 0,
      target: this, ...event
    }));
  }
}

function createEnvironment(reduced = false) {
  let now = 0;
  let viewport = { width: 390, height: 844 };
  let nextFrame = 1;
  const frames = new Map();
  const windowTarget = new Target();
  const documentTarget = new Target();
  const playArea = new Target();
  const button = new Target();
  const status = { textContent: "" };
  const media = new Target();
  media.matches = reduced;
  button.hidden = true;
  button.disabled = false;
  playArea.getBoundingClientRect = () => ({ ...viewport });
  playArea.setPointerCapture = () => {};
  const drawCalls = [];
  const gradient = { addColorStop() {} };
  const context2d = new Proxy({}, { get: (_, key) => {
    if (key === "createLinearGradient" || key === "createRadialGradient") return () => gradient;
    return (...args) => { drawCalls.push([key, ...args]); };
  }, set: () => true });
  const canvas = { width: 0, height: 0, style: {}, getContext: () => context2d };
  const elements = { "liquid-canvas": canvas, "play-area": playArea, "motion-permission": button, status };
  documentTarget.hidden = false;
  documentTarget.getElementById = (id) => elements[id];
  windowTarget.devicePixelRatio = 1;
  windowTarget.orientation = 0;
  windowTarget.setTimeout = (fn) => { windowTarget.pendingTimeout = fn; return 1; };
  windowTarget.clearTimeout = () => { windowTarget.pendingTimeout = null; };
  windowTarget.DeviceOrientationEvent = function DeviceOrientationEvent() {};
  windowTarget.screen = { orientation: { angle: 0 } };
  const sandbox = {
    window: windowTarget,
    document: documentTarget,
    screen: windowTarget.screen,
    DeviceOrientationEvent: windowTarget.DeviceOrientationEvent,
    matchMedia: () => media,
    performance: { now: () => now },
    clearTimeout: () => { windowTarget.pendingTimeout = null; },
    requestAnimationFrame: (callback) => { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id) => frames.delete(id),
    Math, Number, Object, Map, console
  };
  vm.createContext(sandbox);
  const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  vm.runInContext(source, sandbox, { filename: "app.js" });

  function step(count = 1, milliseconds = 16.667) {
    for (let i = 0; i < count; i += 1) {
      now += milliseconds;
      const pending = [...frames.entries()];
      frames.clear();
      pending.forEach(([, callback]) => callback(now));
    }
  }
  return { sandbox, playArea, button, documentTarget, windowTarget, media, step, drawCalls,
    setViewport: (width, height) => { viewport = { width, height }; windowTarget.dispatch("resize"); },
    pendingFrames: () => frames.size };
}

const env = createEnvironment();
const debug = env.sandbox.window.__LIQUID_PLAY_DEBUG__;
assert.ok(debug, "debug inspection API exists");
let state = debug.snapshot();
assert.equal(state.blobCount, 3, "three blobs are stable");
assert.equal(env.pendingFrames(), 1, "exactly one animation frame is pending");

const startX = state.blobs.map((blob) => blob.x);
env.windowTarget.dispatch("deviceorientation", { gamma: 20, beta: 0 });
env.windowTarget.dispatch("deviceorientation", { gamma: 20, beta: 0 });
env.windowTarget.dispatch("deviceorientation", { gamma: 20, beta: 0 });
env.step(120);
state = debug.snapshot();
assert.ok(state.blobs.every((blob, index) => blob.x > startX[index]), "tilt moves blobs toward gravity");
assert.equal(state.sensorState, "active", "valid sensor samples activate tilt input");
assert.ok(state.blobs.every((blob) => blob.x >= blob.radius * 0.8 && blob.x <= state.width - blob.radius * 0.8), "blobs remain horizontal bounds");
assert.ok(state.blobs.some((blob) => blob.stretch > 0.09), "moving blobs have stronger travel-direction stretch");
assert.ok(state.blobs.some((blob) => blob.tailLag > 0.01), "rear shape follows with a delayed liquid tail");
assert.ok(state.blobs.some((blob) => Math.abs(blob.idleX) > 0.001 || Math.abs(blob.idleY) > 0.001), "slow irregular resting shape is active");
assert.ok(state.blobs.some((blob) => Math.abs(blob.poolLean) > 0.001), "asymmetric liquid-pool lean remains subtle and active");
assert.ok(env.drawCalls.filter(([name]) => name === "bezierCurveTo").length >= 6, "soft teardrop paths are drawn");
assert.ok(env.drawCalls.filter(([name]) => name === "ellipse").length >= 6, "two face eyes are drawn on every blob");
assert.ok(env.drawCalls.filter(([name]) => name === "quadraticCurveTo").length >= 3, "small smiles are drawn with the blob transform");
assert.ok(Math.max(...state.blobs.map((blob) => Math.hypot(blob.vx, blob.vy))) > 20, "normal response exceeds the previous approximate terminal speed");

debug.simulateTilt(0, 0);
const stretchedBeforeStop = state.blobs[0].stretch;
env.step(1);
assert.ok(debug.snapshot().blobs[0].stretch > 0, "shape does not snap back immediately");
env.step(90);
const beforeHold = debug.snapshot();
assert.ok(beforeHold.blobs[0].stretch < stretchedBeforeStop, "shape eases back as speed falls");
assert.ok(beforeHold.blobs[0].tailLag > 0, "tail remains briefly while the body eases back");
env.playArea.dispatch("pointerdown", { pointerId: 1, clientX: 20, clientY: 800 });
env.step(15);
assert.equal(debug.snapshot().holdActive, true, "long press activates after threshold");
env.playArea.dispatch("pointerdown", { pointerId: 2, clientX: 40, clientY: 780 });
env.step(50);
state = debug.snapshot();
assert.equal(state.pointerCount, 2, "multiple pointers are tracked without force addition");
assert.ok(state.force.x < 0 && state.force.y > 0, "centroid creates one stable force vector");
env.playArea.dispatch("pointercancel", { pointerId: 1 });
env.playArea.dispatch("pointerup", { pointerId: 2 });
const velocityAtRelease = Math.hypot(state.blobs[0].vx, state.blobs[0].vy);
env.step(1);
assert.ok(Math.hypot(debug.snapshot().blobs[0].vx, debug.snapshot().blobs[0].vy) > 0 && velocityAtRelease > 0, "release preserves short inertia");

for (let i = 0; i < 60; i += 1) {
  env.playArea.dispatch("pointerdown", { pointerId: i + 10, clientX: i % 2 ? 380 : 10, clientY: 400 });
  env.playArea.dispatch("pointerup", { pointerId: i + 10 });
}
env.step(10);
assert.equal(debug.snapshot().pointerCount, 0, "rapid taps leave no pointer state");
assert.equal(env.pendingFrames(), 1, "rapid taps do not duplicate animation loop");

env.setViewport(844, 390);
env.step(5);
state = debug.snapshot();
assert.deepEqual([state.width, state.height], [844, 390], "landscape boundary recalculated");
assert.ok(state.blobs.every((blob) => blob.x >= 0 && blob.x <= 844 && blob.y >= 0 && blob.y <= 390), "rotation keeps blobs visible");
env.setViewport(390, 844);
env.step(5);
assert.ok(debug.snapshot().blobs.every((blob) => blob.x >= 0 && blob.x <= 390 && blob.y >= 0 && blob.y <= 844), "portrait restoration keeps blobs visible");

env.documentTarget.hidden = true;
env.documentTarget.dispatch("visibilitychange");
assert.equal(debug.snapshot().running, false, "hidden page stops animation");
assert.equal(env.pendingFrames(), 0, "hidden page has no pending frame");
env.documentTarget.hidden = false;
env.documentTarget.dispatch("visibilitychange");
env.windowTarget.dispatch("pageshow");
assert.equal(env.pendingFrames(), 1, "visibility and pageshow cannot double-start loop");

env.step(7200); // two simulated minutes at 60fps
state = debug.snapshot();
assert.equal(state.blobCount, 3, "two-minute simulation does not grow blob count");
assert.equal(env.pendingFrames(), 1, "two-minute simulation keeps one loop");
assert.ok(state.blobs.every((blob) => Number.isFinite(blob.x) && Number.isFinite(blob.y)), "long run stays finite");

const wallEnv = createEnvironment();
const wallDebug = wallEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
wallDebug.simulateTilt(1, 0);
let maximumWallContact = 0;
for (let i = 0; i < 1200; i += 1) {
  wallEnv.step(1);
  maximumWallContact = Math.max(maximumWallContact, ...wallDebug.snapshot().blobs.map((blob) => blob.wallContact));
}
assert.ok(maximumWallContact >= 0.14, `wall contact creates a clearly stronger soft compression state (${maximumWallContact})`);

const contactEnv = createEnvironment();
contactEnv.setViewport(180, 180);
contactEnv.step(5);
assert.ok(contactEnv.sandbox.window.__LIQUID_PLAY_DEBUG__.snapshot().blobs.some((blob) => blob.contact > 0), "blob overlap creates mutual liquid compression");

const reducedEnv = createEnvironment(true);
const reducedDebug = reducedEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
reducedDebug.simulateTilt(1, 0);
const reducedStart = reducedDebug.snapshot().blobs[0].x;
reducedEnv.step(120);
const reducedState = reducedDebug.snapshot();
assert.equal(reducedState.reducedMotion, true, "reduced motion is detected");
assert.ok(reducedState.blobs[0].x > reducedStart, "reduced motion keeps play active");
assert.ok(reducedState.blobs[0].vx <= 36.01, "reduced motion limits speed");
assert.equal(reducedState.blobs[0].tailLag, 0, "reduced motion disables the delayed tail");
assert.ok(Math.abs(reducedState.blobs[0].idleX) < 0.009, "reduced motion keeps idle irregularity subtle");
assert.equal(reducedState.blobs[0].poolLean, 0, "reduced motion disables asymmetric pool leaning");

const fallbackEnv = createEnvironment();
fallbackEnv.windowTarget.pendingTimeout();
assert.equal(fallbackEnv.sandbox.window.__LIQUID_PLAY_DEBUG__.snapshot().sensorState, "fallback", "missing sensor samples fall back without error");

console.log("APP-010 automated tests: PASS");
