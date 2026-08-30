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

function angularDistance(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function exerciseReversal(from, to, label, reduced = false) {
  const reversalEnv = createEnvironment(reduced);
  const reversalDebug = reversalEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
  reversalEnv.setViewport(1024, 768);
  reversalDebug.simulateTilt(from[0], from[1]);
  reversalEnv.step(100);
  const before = reversalDebug.snapshot().blobs[0];
  assert.ok(before.stretch >= (reduced ? 0.004 : 0.08), `${label}: initial direction creates visible stretch (${before.stretch})`);
  reversalDebug.simulateTilt(to[0], to[1]);
  let sawShrinking = false;
  let sawNeutral = false;
  let neutralFrames = 0;
  let shrinkingAngle = before.shapeAngle;
  let heldOldAngle = true;
  let neutralWasRound = true;
  let switchedAtZero = false;
  let sawSwitched = false;
  let reextended = false;
  let previousAngle = before.shapeAngle;
  let switchAngleStep = 0;
  let nonSwitchAngleStep = 0;
  for (let frame = 0; frame < 320; frame += 1) {
    reversalEnv.step(1);
    const blob = reversalDebug.snapshot().blobs[0];
    const angleStep = angularDistance(blob.shapeAngle, previousAngle);
    previousAngle = blob.shapeAngle;
    if (blob.reversalPhase === "shrinking" && !sawSwitched) {
      if (!sawShrinking) shrinkingAngle = blob.shapeAngle;
      sawShrinking = true;
      heldOldAngle &&= angularDistance(blob.shapeAngle, shrinkingAngle) < 0.000001;
      nonSwitchAngleStep = Math.max(nonSwitchAngleStep, angleStep);
    } else if (blob.reversalPhase === "neutral" && !sawSwitched) {
      sawNeutral = true;
      neutralFrames += 1;
      heldOldAngle &&= angularDistance(blob.shapeAngle, shrinkingAngle) < 0.000001;
      neutralWasRound &&= blob.stretch === 0 && blob.tailLag === 0 && blob.wobble === 0 && blob.neutralMix === 1;
      nonSwitchAngleStep = Math.max(nonSwitchAngleStep, angleStep);
    } else if (blob.reversalPhase === "switched" && !sawSwitched) {
      switchAngleStep = Math.max(switchAngleStep, angleStep);
      switchedAtZero ||= blob.stretch === 0 && blob.tailLag === 0 && blob.wobble === 0 && blob.neutralMix === 1;
      sawSwitched = true;
    } else if (sawNeutral && blob.stretch > (reduced ? 0.004 : 0.07)) {
      reextended = true;
    }
    assert.ok(Number.isFinite(blob.shapeAngle) && Number.isFinite(blob.stretch), `${label}: reversal state stays finite`);
  }
  assert.ok(sawShrinking, `${label}: opposite motion enters shrinking phase`);
  assert.ok(heldOldAngle && nonSwitchAngleStep < 0.000001, `${label}: shapeAngle is completely fixed through shrinking and neutral`);
  assert.ok(sawNeutral && neutralFrames >= (reduced ? 3 : 5), `${label}: explicit neutral shape is held for multiple frames (${neutralFrames})`);
  assert.ok(neutralWasRound, `${label}: neutral removes stretch, tail, wobble, and directional shape mix`);
  assert.ok(switchedAtZero, `${label}: shapeAngle switches while the visible shape is still neutral`);
  assert.ok(switchAngleStep > 2.3, `${label}: angle changes once in the neutral switched phase instead of interpolating`);
  assert.ok(reextended, `${label}: new direction re-extends only after the neutral hold and switch`);
  assert.ok(reversalDebug.snapshot().blobs.every((blob) => Math.abs(blob.faceTilt) <= 0.121), `${label}: face stays upright instead of rotating 180 degrees`);
  return { env: reversalEnv, debug: reversalDebug };
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

exerciseReversal([-1, 0], [1, 0], "left to right");
exerciseReversal([1, 0], [-1, 0], "right to left");
exerciseReversal([0, -1], [0, 1], "up to down");
exerciseReversal([0, 1], [0, -1], "down to up");
exerciseReversal([-0.8, -0.8], [0.8, 0.8], "diagonal reversal");

const quarterTurnEnv = createEnvironment();
const quarterTurnDebug = quarterTurnEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
quarterTurnEnv.setViewport(1024, 768);
quarterTurnDebug.simulateTilt(-1, 0);
quarterTurnEnv.step(90);
quarterTurnDebug.simulateTilt(0, 1);
let quarterTurnReversal = false;
for (let frame = 0; frame < 100; frame += 1) {
  quarterTurnEnv.step(1);
  quarterTurnReversal ||= quarterTurnDebug.snapshot().blobs[0].reversing;
}
assert.equal(quarterTurnReversal, false, "a roughly 90-degree turn keeps flowing without an unnecessary round reset");

const alternatingEnv = createEnvironment();
const alternatingDebug = alternatingEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
alternatingEnv.setViewport(1024, 768);
for (let cycle = 0; cycle < 18; cycle += 1) {
  alternatingDebug.simulateTilt(cycle % 2 ? -1 : 1, 0);
  alternatingEnv.step(18);
}
const alternatingState = alternatingDebug.snapshot();
assert.equal(alternatingState.blobCount, 3, "rapid repeated reversals keep exactly three blobs");
assert.equal(alternatingEnv.pendingFrames(), 1, "rapid repeated reversals keep one RAF");
assert.ok(alternatingState.blobs.every((blob) => [blob.x, blob.y, blob.stretch, blob.shapeAngle].every(Number.isFinite)), "rapid repeated reversals do not create NaN");
assert.ok(alternatingState.blobs.every((blob) => blob.x >= 0 && blob.x <= 1024 && blob.y >= 0 && blob.y <= 768), "rapid repeated reversals keep blobs visible");

const redirectedEnv = createEnvironment();
const redirectedDebug = redirectedEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
redirectedEnv.setViewport(1024, 768);
redirectedDebug.simulateTilt(-1, 0);
redirectedEnv.step(100);
redirectedDebug.simulateTilt(1, 0);
for (let frame = 0; frame < 180 && redirectedDebug.snapshot().blobs[0].reversalPhase !== "shrinking"; frame += 1) redirectedEnv.step(1);
const firstPendingAngle = redirectedDebug.snapshot().blobs[0].pendingAngle;
redirectedDebug.simulateTilt(0, -1);
let pendingDirectionUpdated = false;
let redirectedCompleted = false;
for (let frame = 0; frame < 360; frame += 1) {
  redirectedEnv.step(1);
  const blob = redirectedDebug.snapshot().blobs[0];
  pendingDirectionUpdated ||= angularDistance(blob.pendingAngle, firstPendingAngle) > 0.35;
  redirectedCompleted ||= blob.reversalPhase === "normal" && pendingDirectionUpdated && blob.stretch > 0.05;
}
assert.ok(pendingDirectionUpdated && redirectedCompleted, "changing input during reversal updates the pending direction and completes safely");

const holdReversalEnv = createEnvironment();
const holdReversalDebug = holdReversalEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
holdReversalEnv.setViewport(1024, 768);
holdReversalEnv.step(1);
holdReversalEnv.playArea.dispatch("pointerdown", { pointerId: 71, clientX: 300, clientY: 384 });
holdReversalEnv.step(90);
holdReversalEnv.playArea.dispatch("pointermove", { pointerId: 71, clientX: 800, clientY: 384 });
let holdMovedRight = false;
const holdReversalPhases = new Set();
for (let frame = 0; frame < 420; frame += 1) {
  holdReversalEnv.step(1);
  const frameState = holdReversalDebug.snapshot();
  holdMovedRight ||= frameState.force.x > 0 && frameState.blobs.some((blob) => blob.vx > 0);
  holdReversalPhases.add(frameState.blobs[0].reversalPhase);
}
const holdReversalState = holdReversalDebug.snapshot();
assert.ok(holdMovedRight, "moving a long press across the screen reverses through the shared force and shape path");
assert.ok(holdReversalPhases.has("shrinking") && holdReversalPhases.has("neutral") && holdReversalPhases.has("switched"), "long-press reversal passes through all neutral phases");
assert.ok(holdReversalState.blobs.every((blob) => [blob.shapeAngle, blob.stretch, blob.tailLag].every(Number.isFinite)), "long-press direction change keeps liquid shape state finite");
holdReversalEnv.playArea.dispatch("pointercancel", { pointerId: 71 });
assert.equal(holdReversalDebug.snapshot().pointerCount, 0, "pointercancel clears the hold after reversal");

const releaseDuringReversalEnv = createEnvironment();
const releaseDuringReversalDebug = releaseDuringReversalEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
releaseDuringReversalEnv.setViewport(1024, 768);
releaseDuringReversalEnv.step(1);
releaseDuringReversalEnv.playArea.dispatch("pointerdown", { pointerId: 81, clientX: 300, clientY: 384 });
releaseDuringReversalEnv.step(90);
releaseDuringReversalEnv.playArea.dispatch("pointermove", { pointerId: 81, clientX: 800, clientY: 384 });
for (let frame = 0; frame < 240 && releaseDuringReversalDebug.snapshot().blobs[0].reversalPhase !== "shrinking"; frame += 1) releaseDuringReversalEnv.step(1);
assert.equal(releaseDuringReversalDebug.snapshot().blobs[0].reversalPhase, "shrinking", "long press reaches shrinking before release test");
releaseDuringReversalEnv.playArea.dispatch("pointerup", { pointerId: 81 });
releaseDuringReversalEnv.step(180);
const releasedReversalState = releaseDuringReversalDebug.snapshot();
assert.equal(releasedReversalState.pointerCount, 0, "releasing during reversal clears the pointer and hold");
assert.ok(releasedReversalState.blobs.every((blob) => [blob.x, blob.y, blob.stretch, blob.shapeAngle].every(Number.isFinite)), "release during reversal leaves finite liquid state");

const interruptedEnv = createEnvironment();
const interruptedDebug = interruptedEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
interruptedEnv.setViewport(1024, 768);
interruptedDebug.simulateTilt(-1, 0);
interruptedEnv.step(100);
interruptedDebug.simulateTilt(1, 0);
for (let frame = 0; frame < 180 && !interruptedDebug.snapshot().blobs[0].reversing; frame += 1) interruptedEnv.step(1);
assert.equal(interruptedDebug.snapshot().blobs[0].reversing, true, "background test reaches reversal state");
interruptedEnv.documentTarget.hidden = true;
interruptedEnv.documentTarget.dispatch("visibilitychange");
assert.ok(interruptedDebug.snapshot().blobs.every((blob) => !blob.reversing), "background transition clears transient reversal state");
interruptedEnv.documentTarget.hidden = false;
interruptedEnv.documentTarget.dispatch("visibilitychange");
interruptedEnv.windowTarget.dispatch("pageshow");
assert.equal(interruptedEnv.pendingFrames(), 1, "reversal interruption resumes with one RAF");

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
exerciseReversal([-1, 0], [1, 0], "reduced-motion reversal", true);

const fallbackEnv = createEnvironment();
fallbackEnv.windowTarget.pendingTimeout();
assert.equal(fallbackEnv.sandbox.window.__LIQUID_PLAY_DEBUG__.snapshot().sensorState, "fallback", "missing sensor samples fall back without error");

console.log("APP-010 automated tests: PASS");
