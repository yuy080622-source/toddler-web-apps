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
  removeEventListener(type, handler) {
    if (!this.listeners.has(type)) return;
    this.listeners.set(type, this.listeners.get(type).filter((item) => item !== handler));
  }
  listenerCount(type) { return (this.listeners.get(type) || []).length; }
  dispatch(type, event = {}) {
    const dispatchedEvent = {
      preventDefault() {}, stopPropagation() {}, pointerId: 1, clientX: 0, clientY: 0,
      target: this, ...event
    };
    (this.listeners.get(type) || []).forEach((handler) => handler(dispatchedEvent));
    return dispatchedEvent;
  }
}

const appRoot = path.join(__dirname, "..");
const repositoryRoot = path.join(appRoot, "..", "..");
const indexSource = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");
const portalAppsSource = fs.readFileSync(path.join(repositoryRoot, "portal", "apps.js"), "utf8");
const portalStyleSource = fs.readFileSync(path.join(repositoryRoot, "portal", "style.css"), "utf8");
assert.equal((indexSource.match(/\.\.\/\.\.\/shared\/ga4\.js/g) || []).length, 1, "APP-010 loads shared GA4 exactly once");
assert.equal((indexSource.match(/\.\.\/\.\.\/shared\/clarity\.js/g) || []).length, 1, "APP-010 loads shared Clarity exactly once");
assert.equal((indexSource.match(/\.\.\/\.\.\/shared\/portal-home\.js/g) || []).length, 1, "APP-010 loads shared portal-home behavior exactly once");
assert.equal((indexSource.match(/data-portal-home/g) || []).length, 1, "APP-010 has one shared home button");
assert.ok(indexSource.includes("<title>ぷにぷにジェリー</title>"), "public title omits the provisional suffix");
assert.ok(appSource.includes('closest?.("[data-portal-home]")'), "APP-010 defensively excludes home-button pointers from jelly input");
assert.ok(!/gtag\(|clarity\(|dataLayer|deviceorientation.*(?:gtag|clarity)|(?:gtag|clarity).*deviceorientation/.test(appSource), "APP-010 sends no custom analytics or sensor values");
assert.equal((portalAppsSource.match(/\{ name:/g) || []).length, 5, "portal lists five public apps");
assert.ok(portalAppsSource.includes('name: "ぷにぷにジェリー"') && portalAppsSource.includes('href: "apps/APP-010-liquid-play/"'), "portal links the public APP-010 name and existing URL");
assert.ok(portalStyleSource.includes(".app-card--jelly .app-icon"), "portal includes the gentle APP-010 card background");

function createEnvironment(reduced = false, sensorOptions = {}) {
  let now = 0;
  let nextTimer = 1;
  const timers = new Map();
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
    if (key === "createLinearGradient" || key === "createRadialGradient") return (...args) => {
      drawCalls.push([key, ...args]);
      return gradient;
    };
    return (...args) => { drawCalls.push([key, ...args]); };
  }, set: (_, key, value) => { drawCalls.push([`set:${String(key)}`, value]); return true; } });
  const canvas = { width: 0, height: 0, style: {}, getContext: () => context2d };
  const elements = { "liquid-canvas": canvas, "play-area": playArea, "motion-permission": button, status };
  documentTarget.hidden = false;
  documentTarget.getElementById = (id) => elements[id];
  windowTarget.devicePixelRatio = 1;
  windowTarget.orientation = 0;
  windowTarget.setTimeout = (fn, delay = 0) => { const id = nextTimer++; timers.set(id, { fn, delay }); return id; };
  windowTarget.clearTimeout = (id) => { timers.delete(id); };
  if (sensorOptions.supported !== false) {
    windowTarget.DeviceOrientationEvent = function DeviceOrientationEvent() {};
    if (sensorOptions.permissionResult) {
      windowTarget.DeviceOrientationEvent.requestPermission = () => Promise.resolve(sensorOptions.permissionResult);
    }
  }
  windowTarget.screen = { orientation: { angle: 0 } };
  const sandbox = {
    window: windowTarget,
    document: documentTarget,
    screen: windowTarget.screen,
    DeviceOrientationEvent: windowTarget.DeviceOrientationEvent,
    matchMedia: () => media,
    performance: { now: () => now },
    clearTimeout: (id) => { timers.delete(id); },
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
  function runTimers(maxDelay = Infinity) {
    [...timers.entries()].filter(([, timer]) => timer.delay <= maxDelay).forEach(([id, timer]) => {
      if (!timers.has(id)) return;
      timers.delete(id);
      timer.fn();
    });
  }
  return { sandbox, playArea, button, documentTarget, windowTarget, media, step, drawCalls, runTimers,
    setViewport: (width, height) => { viewport = { width, height }; windowTarget.dispatch("resize"); },
    pendingFrames: () => frames.size,
    pendingTimers: () => timers.size };
}

function angularDistance(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function exerciseJellyTurn(from, to, label, reduced = false) {
  const reversalEnv = createEnvironment(reduced);
  const reversalDebug = reversalEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
  reversalEnv.setViewport(1024, 768);
  reversalDebug.simulateTilt(from[0], from[1]);
  reversalEnv.step(100);
  const before = reversalDebug.snapshot().blobs[0];
  assert.ok(before.stretch >= (reduced ? 0.004 : 0.08), `${label}: initial direction creates visible stretch (${before.stretch})`);
  reversalDebug.simulateTilt(to[0], to[1]);
  let minimumVisibleStretch = before.stretch;
  let maximumTurnSoftness = 0;
  let maximumJellyPulse = 0;
  let previousAngle = before.shapeAngle;
  let maximumAngleStep = 0;
  for (let frame = 0; frame < 360; frame += 1) {
    reversalEnv.step(1);
    const blob = reversalDebug.snapshot().blobs[0];
    const angleStep = angularDistance(blob.shapeAngle, previousAngle);
    previousAngle = blob.shapeAngle;
    maximumAngleStep = Math.max(maximumAngleStep, angleStep);
    maximumTurnSoftness = Math.max(maximumTurnSoftness, blob.turnSoftness);
    maximumJellyPulse = Math.max(maximumJellyPulse, blob.jellyPulse);
    minimumVisibleStretch = Math.min(minimumVisibleStretch, blob.stretch * (1 - blob.turnSoftness * (reduced ? 0.25 : 0.58)));
    assert.ok([blob.shapeAngle, blob.stretch, blob.turnSoftness, blob.jellyPulse].every(Number.isFinite), `${label}: turn state stays finite`);
  }
  const after = reversalDebug.snapshot().blobs[0];
  assert.ok(maximumAngleStep <= (reduced ? 0.02501 : 0.05201), `${label}: rotation stays softly bounded (${maximumAngleStep})`);
  assert.ok(maximumTurnSoftness >= (reduced ? 0.03 : 0.2), `${label}: turn temporarily rounds and softens the jelly (${maximumTurnSoftness})`);
  assert.ok(minimumVisibleStretch < before.stretch * (reduced ? 0.98 : 0.8), `${label}: directional stretch relaxes during the turn`);
  assert.ok(maximumJellyPulse > (reduced ? 0.001 : 0.02), `${label}: a restrained jelly pulse accompanies the turn`);
  assert.ok(after.stretch > (reduced ? 0.003 : 0.06), `${label}: jelly re-extends in its new direction`);
  assert.ok(angularDistance(after.shapeAngle, Math.atan2(to[1], to[0])) < 0.4, `${label}: shape eventually follows the new direction`);
  assert.ok(reversalDebug.snapshot().blobs.every((blob) => Math.abs(blob.faceTilt) <= 0.121), `${label}: face stays upright instead of rotating 180 degrees`);
  return { env: reversalEnv, debug: reversalDebug };
}

const env = createEnvironment();
const debug = env.sandbox.window.__LIQUID_PLAY_DEBUG__;
assert.ok(debug, "debug inspection API exists");
let state = debug.snapshot();
assert.equal(state.blobCount, 3, "three blobs are stable");
assert.equal(env.pendingFrames(), 1, "exactly one animation frame is pending");
assert.equal(state.holdSignal.strength, 0, "tilt-only startup has no calling signal");
assert.ok(state.blobs.every((blob) => blob.mouthActivity === 0), "resting jellies start with their quiet expression");
assert.ok(Math.abs(state.blobs[0].radius / state.blobs[1].radius - 1.35) < 0.001, "red jelly is 1.35 times the blue reference size");
assert.ok(Math.abs(state.blobs[2].radius / state.blobs[1].radius - 0.8) < 0.001, "yellow jelly is 0.8 times the blue reference size");
assert.ok(state.blobs[0].radius > state.blobs[1].radius && state.blobs[1].radius > state.blobs[2].radius, "red, blue, and yellow have a clear large-medium-small order");

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
assert.ok(env.drawCalls.filter(([name]) => name === "closePath").length >= 6, "one closed mouth path is drawn with each blob transform");
assert.ok(env.drawCalls.filter(([name]) => name === "createRadialGradient").length >= 6, "body depth and inner highlights use layered jelly gradients");
assert.ok(env.drawCalls.filter(([name]) => name === "clip").length >= 3, "internal jelly texture is clipped inside each body");
assert.ok(Math.max(...state.blobs.map((blob) => Math.hypot(blob.vx, blob.vy))) > 20, "normal response exceeds the previous approximate terminal speed");
assert.ok(state.blobs.every((blob) => blob.mouthActivity === 0), "fast tilt-only movement keeps the quiet smile");
assert.ok(state.blobs.every((blob) => Math.abs(blob.faceTilt) <= 0.121), "active expressions stay upright");

debug.simulateTilt(0, 0);
const stretchedBeforeStop = state.blobs[0].stretch;
env.step(1);
assert.ok(debug.snapshot().blobs[0].stretch > 0, "shape does not snap back immediately");
env.step(90);
const beforeHold = debug.snapshot();
assert.ok(beforeHold.blobs[0].stretch < stretchedBeforeStop, "shape eases back as speed falls");
assert.ok(beforeHold.blobs[0].tailLag > 0, "tail remains briefly while the body eases back");
env.playArea.dispatch("pointerdown", { pointerId: 1, clientX: 20, clientY: 800 });
const arcsBeforeHold = env.drawCalls.filter(([name]) => name === "arc").length;
env.step(15);
assert.equal(debug.snapshot().holdActive, true, "long press activates after threshold");
assert.ok(debug.snapshot().holdSignal.strength > 0, "long press gently reveals the calling signal");
assert.ok(env.drawCalls.filter(([name]) => name === "arc").length > arcsBeforeHold, "calling aura and rings are drawn only after the hold activates");
env.playArea.dispatch("pointerdown", { pointerId: 2, clientX: 40, clientY: 780 });
env.step(50);
state = debug.snapshot();
assert.equal(state.pointerCount, 2, "multiple pointers are tracked without force addition");
assert.ok(state.force.x < 0 && state.force.y > 0, "centroid creates one stable force vector");
assert.deepEqual([state.holdSignal.x, state.holdSignal.y], [30, 790], "multiple pointers render one calling signal at their centroid");
assert.deepEqual([state.holdSignal.visualX, state.holdSignal.visualY], [30, 780], "calling sign stays aligned while its visual center clears the fingertip slightly");
assert.ok(state.holdSignal.innerRadius >= 36 && state.holdSignal.outerRadius >= 68, "calling ripples extend beyond a typical fingertip area");
assert.equal(state.holdSignal.ringCount, 2, "multiple pointers still create one two-ring signal group");
assert.ok(state.holdSignal.innerAlphaScale > state.holdSignal.outerAlphaScale, "outer ripple is more transparent than the inner ripple");
assert.ok(state.holdSignal.innerLineWidth > state.holdSignal.outerLineWidth, "outer ripple is thinner than the inner ripple");
assert.ok(state.blobs.every((blob) => blob.mouthActivity >= 0.6), "long-press attraction keeps the active expression subtle but visible");
debug.simulateTilt(1, 0);
env.step(20);
assert.ok(debug.snapshot().blobs.every((blob) => blob.mouthActivity >= 0.6), "long press keeps the zero mouth when tilt is also active");
env.drawCalls.length = 0;
env.step(1);
const holdArcs = env.drawCalls.filter(([name]) => name === "arc");
assert.equal(holdArcs.length, 3, "one hold signal group draws one aura and two rings per frame");
assert.ok(Math.min(...holdArcs.map((call) => call[3])) >= 36 && Math.max(...holdArcs.map((call) => call[3])) >= 51, "rendered ripple remains visible outside the finger area");
const rippleWidths = env.drawCalls.filter(([name]) => name === "set:lineWidth").map((call) => call[1]);
assert.ok(rippleWidths.at(-2) > rippleWidths.at(-1), "rendered outer ripple uses a thinner stroke");
env.playArea.dispatch("pointercancel", { pointerId: 1 });
env.playArea.dispatch("pointerup", { pointerId: 2 });
assert.equal(debug.snapshot().holdSignal.strength, 0, "releasing all pointers removes the calling signal immediately");
const velocityAtRelease = Math.hypot(state.blobs[0].vx, state.blobs[0].vy);
env.step(1);
assert.ok(Math.hypot(debug.snapshot().blobs[0].vx, debug.snapshot().blobs[0].vy) > 0 && velocityAtRelease > 0, "release preserves short inertia");
env.step(300);
assert.ok(debug.snapshot().blobs.every((blob) => blob.mouthActivity < 0.01), "released long press eases every mouth back to the smile");

for (let i = 0; i < 60; i += 1) {
  env.playArea.dispatch("pointerdown", { pointerId: i + 10, clientX: i % 2 ? 380 : 10, clientY: 400 });
  env.playArea.dispatch("pointerup", { pointerId: i + 10 });
}
env.step(10);
assert.equal(debug.snapshot().pointerCount, 0, "rapid taps leave no pointer state");
assert.equal(env.pendingFrames(), 1, "rapid taps do not duplicate animation loop");

const expressionEnv = createEnvironment();
const expressionDebug = expressionEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
const lowTiltEnv = createEnvironment();
const lowTiltDebug = lowTiltEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
lowTiltDebug.simulateTilt(0.2, 0);
lowTiltEnv.step(120);
assert.ok(lowTiltDebug.snapshot().blobs.some((blob) => Math.abs(blob.vx) > 0), "low tilt still moves the jellies");
assert.ok(lowTiltDebug.snapshot().blobs.every((blob) => blob.mouthActivity === 0), "low-speed tilt keeps the smile");
expressionEnv.drawCalls.length = 0;
expressionEnv.step(1);
assert.equal(expressionEnv.drawCalls.filter(([name]) => name === "bezierCurveTo").length, 18, "resting frame adds one two-curve smile path per jelly to the body curves");
assert.equal(expressionEnv.drawCalls.filter(([name]) => name === "ellipse").length, 12, "resting frame has no separate oval mouth path");
expressionDebug.simulateTilt(1, 0);
expressionEnv.step(180);
assert.ok(expressionDebug.snapshot().blobs.every((blob) => blob.mouthActivity === 0), "sustained fast tilt never activates the zero mouth");
expressionEnv.playArea.dispatch("pointerdown", { pointerId: 71, clientX: 350, clientY: 700 });
expressionEnv.step(15);
const intermediateMouth = expressionDebug.snapshot().blobs[0].mouthActivity;
assert.ok(intermediateMouth > 0 && intermediateMouth < 0.66, "long press passes through a continuous intermediate mouth shape");
expressionEnv.drawCalls.length = 0;
expressionEnv.step(1);
assert.equal(expressionEnv.drawCalls.filter(([name]) => name === "bezierCurveTo").length, 18, "intermediate expression still draws one mouth path per jelly");
assert.equal(expressionEnv.drawCalls.filter(([name]) => name === "ellipse").length, 12, "intermediate expression never overlays an oval mouth");
expressionEnv.step(120);
assert.ok(expressionDebug.snapshot().blobs[0].mouthActivity > 0.55, "held jelly reaches the active zero mouth shape");
expressionEnv.drawCalls.length = 0;
expressionEnv.step(1);
assert.equal(expressionEnv.drawCalls.filter(([name]) => name === "bezierCurveTo").length, 18, "active frame draws only one transformed mouth per jelly");
assert.equal(expressionEnv.drawCalls.filter(([name]) => name === "ellipse").length, 12, "active frame has no simultaneous smile and oval mouth");
const activeMouthCurves = expressionEnv.drawCalls.filter(([name]) => name === "bezierCurveTo");
const activeUpperMouth = activeMouthCurves[4];
const activeLowerMouth = activeMouthCurves[5];
const activeMouthWidth = activeUpperMouth[5] - activeLowerMouth[5];
const activeMouthHeight = activeLowerMouth[2] - activeUpperMouth[2];
assert.ok(activeUpperMouth[2] < activeUpperMouth[6] && activeLowerMouth[2] > activeUpperMouth[6], "active zero mouth curves sit above and below level corners");
assert.ok(activeMouthHeight > activeMouthWidth * 1.15, "active mouth is a small vertical zero rather than a wide smile or triangle");
expressionEnv.playArea.dispatch("pointerup", { pointerId: 71 });
expressionEnv.step(420);
assert.ok(expressionDebug.snapshot().blobs[0].mouthActivity < 0.08, "released hold eases naturally back to the smile shape even while moving");

env.setViewport(844, 390);
env.step(5);
state = debug.snapshot();
assert.deepEqual([state.width, state.height], [844, 390], "landscape boundary recalculated");
assert.ok(state.blobs.every((blob) => blob.x >= 0 && blob.x <= 844 && blob.y >= 0 && blob.y <= 390), "rotation keeps blobs visible");
assert.ok(Math.abs(state.blobs[0].radius / state.blobs[1].radius - 1.35) < 0.001 && Math.abs(state.blobs[2].radius / state.blobs[1].radius - 0.8) < 0.001, "landscape resize preserves the size ratio");
env.setViewport(390, 844);
env.step(5);
assert.ok(debug.snapshot().blobs.every((blob) => blob.x >= 0 && blob.x <= 390 && blob.y >= 0 && blob.y <= 844), "portrait restoration keeps blobs visible");
env.setViewport(1024, 768);
env.step(5);
state = debug.snapshot();
assert.ok(state.blobs.every((blob) => blob.x >= blob.radius && blob.x <= 1024 - blob.radius && blob.y >= blob.radius && blob.y <= 768 - blob.radius), "tablet layout keeps all differently sized jellies inside their radius-aware bounds");
assert.ok(state.blobs[2].radius >= 48, "small yellow jelly remains large enough for its face and internal highlight");
env.setViewport(390, 844);
env.step(5);

env.documentTarget.hidden = true;
env.documentTarget.dispatch("visibilitychange");
assert.equal(debug.snapshot().running, false, "hidden page stops animation");
assert.equal(env.pendingFrames(), 0, "hidden page has no pending frame");
assert.ok(debug.snapshot().blobs.every((blob) => blob.mouthActivity === 0), "background transition restores the normal smile state");
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
assert.ok(wallDebug.snapshot().blobs.every((blob) => blob.mouthActivity === 0), "wall contact alone keeps the smile");

const contactEnv = createEnvironment();
contactEnv.setViewport(180, 180);
contactEnv.step(5);
assert.ok(contactEnv.sandbox.window.__LIQUID_PLAY_DEBUG__.snapshot().blobs.some((blob) => blob.contact > 0), "blob overlap creates mutual liquid compression");
assert.ok(contactEnv.sandbox.window.__LIQUID_PLAY_DEBUG__.snapshot().blobs.every((blob) => blob.mouthActivity === 0), "jelly contact alone keeps the smile");

exerciseJellyTurn([-1, 0], [1, 0], "left to right");
exerciseJellyTurn([1, 0], [-1, 0], "right to left");
exerciseJellyTurn([0, -1], [0, 1], "up to down");
exerciseJellyTurn([0, 1], [0, -1], "down to up");
exerciseJellyTurn([-0.8, -0.8], [0.8, 0.8], "diagonal reversal");

const quarterTurnEnv = createEnvironment();
const quarterTurnDebug = quarterTurnEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
quarterTurnEnv.setViewport(1024, 768);
quarterTurnDebug.simulateTilt(-1, 0);
quarterTurnEnv.step(90);
quarterTurnDebug.simulateTilt(0, 1);
let quarterTurnSoftness = 0;
let quarterTurnAngleStep = 0;
let quarterPreviousAngle = quarterTurnDebug.snapshot().blobs[0].shapeAngle;
for (let frame = 0; frame < 100; frame += 1) {
  quarterTurnEnv.step(1);
  const blob = quarterTurnDebug.snapshot().blobs[0];
  quarterTurnSoftness = Math.max(quarterTurnSoftness, blob.turnSoftness);
  quarterTurnAngleStep = Math.max(quarterTurnAngleStep, angularDistance(blob.shapeAngle, quarterPreviousAngle));
  quarterPreviousAngle = blob.shapeAngle;
}
assert.ok(quarterTurnSoftness < 0.5, "a roughly 90-degree turn keeps more of the flowing jelly shape");
assert.ok(quarterTurnAngleStep <= 0.05201, "a roughly 90-degree turn remains softly bounded");

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
redirectedEnv.step(30);
const angleBeforeRedirect = redirectedDebug.snapshot().blobs[0].shapeAngle;
redirectedDebug.simulateTilt(0, -1);
let redirectedCompleted = false;
let redirectMaximumStep = 0;
let redirectPreviousAngle = angleBeforeRedirect;
for (let frame = 0; frame < 360; frame += 1) {
  redirectedEnv.step(1);
  const blob = redirectedDebug.snapshot().blobs[0];
  redirectMaximumStep = Math.max(redirectMaximumStep, angularDistance(blob.shapeAngle, redirectPreviousAngle));
  redirectPreviousAngle = blob.shapeAngle;
  redirectedCompleted ||= angularDistance(blob.shapeAngle, -Math.PI / 2) < 0.4 && blob.stretch > 0.05;
}
assert.ok(redirectedCompleted && redirectMaximumStep <= 0.05201, "changing input mid-turn follows the latest direction without a spin");

const holdReversalEnv = createEnvironment();
const holdReversalDebug = holdReversalEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
holdReversalEnv.setViewport(1024, 768);
holdReversalEnv.step(1);
holdReversalEnv.playArea.dispatch("pointerdown", { pointerId: 71, clientX: 300, clientY: 384 });
holdReversalEnv.step(90);
holdReversalEnv.playArea.dispatch("pointermove", { pointerId: 71, clientX: 800, clientY: 384 });
let holdMovedRight = false;
let holdTurnSoftness = 0;
for (let frame = 0; frame < 420; frame += 1) {
  holdReversalEnv.step(1);
  const frameState = holdReversalDebug.snapshot();
  holdMovedRight ||= frameState.force.x > 0 && frameState.blobs.some((blob) => blob.vx > 0);
  holdTurnSoftness = Math.max(holdTurnSoftness, frameState.blobs[0].turnSoftness);
}
const holdReversalState = holdReversalDebug.snapshot();
assert.ok(holdMovedRight, "moving a long press across the screen reverses through the shared force and shape path");
assert.ok(holdTurnSoftness > 0.1, "long-press direction change uses the same soft jelly turn response");
assert.ok(holdReversalState.blobs.every((blob) => [blob.shapeAngle, blob.stretch, blob.tailLag].every(Number.isFinite)), "long-press direction change keeps jelly shape state finite");
holdReversalEnv.playArea.dispatch("pointercancel", { pointerId: 71 });
assert.equal(holdReversalDebug.snapshot().pointerCount, 0, "pointercancel clears the hold after reversal");

const releaseDuringReversalEnv = createEnvironment();
const releaseDuringReversalDebug = releaseDuringReversalEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
releaseDuringReversalEnv.setViewport(1024, 768);
releaseDuringReversalEnv.step(1);
releaseDuringReversalEnv.playArea.dispatch("pointerdown", { pointerId: 81, clientX: 300, clientY: 384 });
releaseDuringReversalEnv.step(90);
releaseDuringReversalEnv.playArea.dispatch("pointermove", { pointerId: 81, clientX: 800, clientY: 384 });
releaseDuringReversalEnv.step(60);
assert.ok(releaseDuringReversalDebug.snapshot().blobs[0].turnSoftness > 0.01, "long press reaches a soft turn before release test");
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
for (let frame = 0; frame < 180 && interruptedDebug.snapshot().blobs[0].turnSoftness < 0.1; frame += 1) interruptedEnv.step(1);
assert.ok(interruptedDebug.snapshot().blobs[0].turnSoftness >= 0.1, "background test reaches a soft turn state");
interruptedEnv.documentTarget.hidden = true;
interruptedEnv.documentTarget.dispatch("visibilitychange");
assert.ok(interruptedDebug.snapshot().blobs.every((blob) => blob.turnSoftness === 0 && blob.jellyPulse === 0), "background transition clears transient jelly state");
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
assert.equal(reducedState.blobs[0].mouthActivity, 0, "reduced-motion tilt-only movement keeps the smile");
exerciseJellyTurn([-1, 0], [1, 0], "reduced-motion reversal", true);

const reducedHoldEnv = createEnvironment(true);
const reducedHoldDebug = reducedHoldEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
reducedHoldEnv.step(1);
reducedHoldEnv.playArea.dispatch("pointerdown", { pointerId: 91, clientX: 200, clientY: 420 });
reducedHoldEnv.step(15);
assert.equal(reducedHoldDebug.snapshot().holdActive, true, "reduced motion keeps long-press play active");
assert.ok(reducedHoldDebug.snapshot().blobs.every((blob) => blob.mouthActivity > 0 && blob.mouthActivity <= 0.38), "reduced-motion hold alone activates the restrained zero mouth");
assert.ok(reducedHoldDebug.snapshot().holdSignal.strength > 0 && reducedHoldDebug.snapshot().holdSignal.strength < 0.7, "reduced motion reveals the calling sign more gently");
assert.equal(reducedHoldDebug.snapshot().holdSignal.ringCount, 1, "reduced motion uses one restrained calling ring");
assert.ok(reducedHoldDebug.snapshot().holdSignal.outerRadius >= 54, "reduced-motion ring still clears the fingertip and remains visible");
reducedHoldEnv.drawCalls.length = 0;
reducedHoldEnv.step(1);
assert.equal(reducedHoldEnv.drawCalls.filter(([name]) => name === "arc").length, 2, "reduced motion draws one visible aura and one ring");
reducedHoldEnv.playArea.dispatch("pointercancel", { pointerId: 91 });
assert.equal(reducedHoldDebug.snapshot().holdSignal.strength, 0, "reduced-motion pointercancel clears the calling sign");

const fallbackEnv = createEnvironment();
fallbackEnv.runTimers(2500);
assert.equal(fallbackEnv.sandbox.window.__LIQUID_PLAY_DEBUG__.snapshot().sensorState, "fallback", "missing sensor samples fall back without error");

function runPortalHomeTests() {
  let now = 0;
  let nextFrame = 1;
  const frames = new Map();
  const assignments = [];
  const button = new Target();
  const classes = new Set();
  const properties = new Map();
  button.dataset = { portalHome: "../../" };
  button.classList = { add: (value) => classes.add(value), remove: (value) => classes.delete(value) };
  button.style = { setProperty: (key, value) => properties.set(key, value), removeProperty: (key) => properties.delete(key) };
  button.setAttribute = (key, value) => { button[key] = value; };
  button.getBoundingClientRect = () => ({ left: 0, right: 66, top: 0, bottom: 66 });
  button.setPointerCapture = () => {};
  button.hasPointerCapture = () => false;
  const portalSandbox = {
    document: { querySelectorAll: () => [button] },
    performance: { now: () => now },
    window: {
      requestAnimationFrame: (callback) => { const id = nextFrame++; frames.set(id, callback); return id; },
      cancelAnimationFrame: (id) => frames.delete(id),
      location: { assign: (url) => assignments.push(url) }
    },
    Math
  };
  vm.createContext(portalSandbox);
  vm.runInContext(fs.readFileSync(path.join(repositoryRoot, "shared", "portal-home.js"), "utf8"), portalSandbox);
  const dispatch = (type, overrides = {}) => {
    let stopped = false;
    let prevented = false;
    button.dispatch(type, {
      pointerId: 41, button: 0, clientX: 33, clientY: 33,
      preventDefault: () => { prevented = true; },
      stopPropagation: () => { stopped = true; },
      ...overrides
    });
    return { stopped, prevented };
  };
  const advance = (time) => {
    now = time;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(time));
  };

  let pointerResult = dispatch("pointerdown");
  assert.deepEqual(pointerResult, { stopped: true, prevented: true }, "home pointerdown is contained before it can reach jelly input");
  advance(500);
  dispatch("pointerup");
  assert.equal(assignments.length, 0, "short home press does not navigate");
  assert.equal(frames.size, 0, "short home press clears its temporary progress frame");

  dispatch("pointerdown", { pointerId: 42 });
  advance(900);
  dispatch("pointercancel", { pointerId: 42 });
  assert.equal(assignments.length, 0, "cancelled home hold does not navigate");

  dispatch("pointerdown", { pointerId: 43 });
  advance(3001);
  assert.deepEqual(assignments, ["../../"], "two-second home hold returns to the portal");
  assert.ok(classes.has("is-holding"), "completed navigation retains progress state until the page leaves");
}

runPortalHomeTests();

async function runSensorPermissionTests() {
  const alreadyAllowedEnv = createEnvironment(false, { permissionResult: "granted" });
  const alreadyAllowedDebug = alreadyAllowedEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
  assert.equal(alreadyAllowedEnv.button.hidden, true, "permission-capable startup keeps the button hidden during the sensor probe");
  alreadyAllowedEnv.windowTarget.dispatch("deviceorientation", { gamma: 12, beta: 4 });
  assert.equal(alreadyAllowedDebug.snapshot().sensorState, "active", "a valid startup event activates a previously allowed sensor without a button");
  assert.equal(alreadyAllowedEnv.button.hidden, true, "previously allowed sensor never exposes the permission button");
  assert.equal(alreadyAllowedEnv.windowTarget.listenerCount("deviceorientation"), 1, "startup attaches exactly one sensor listener");
  assert.equal(alreadyAllowedDebug.snapshot().sensorTimerCount, 0, "valid sensor input clears both sensor timers");

  const needsPermissionEnv = createEnvironment(false, { permissionResult: "granted" });
  const needsPermissionDebug = needsPermissionEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
  needsPermissionEnv.runTimers(600);
  assert.equal(needsPermissionDebug.snapshot().sensorState, "permission", "missing probe events transition to permission state");
  assert.equal(needsPermissionEnv.button.hidden, false, "permission button appears only after the short probe expires");
  needsPermissionEnv.button.dispatch("click");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(needsPermissionDebug.snapshot().sensorState, "checking", "granted permission restarts sensor checking");
  assert.equal(needsPermissionEnv.button.hidden, true, "granted permission hides the button");
  needsPermissionEnv.windowTarget.dispatch("deviceorientation", { gamma: 9, beta: 3 });
  assert.equal(needsPermissionDebug.snapshot().sensorState, "active", "a valid post-grant event activates tilt");
  assert.equal(needsPermissionEnv.windowTarget.listenerCount("deviceorientation"), 1, "permission restart does not duplicate the sensor listener");

  const deniedEnv = createEnvironment(false, { permissionResult: "denied" });
  const deniedDebug = deniedEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
  deniedEnv.runTimers(600);
  deniedEnv.button.dispatch("click");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(deniedDebug.snapshot().sensorState, "fallback", "denied permission transitions to long-press fallback");
  assert.equal(deniedEnv.button.hidden, true, "denied permission hides the permission button");
  assert.equal(deniedDebug.snapshot().sensorTimerCount, 0, "denied permission clears sensor timers");

  const noPermissionApiEnv = createEnvironment();
  const noPermissionApiDebug = noPermissionApiEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
  noPermissionApiEnv.windowTarget.dispatch("deviceorientation", { gamma: 11, beta: 2 });
  assert.equal(noPermissionApiDebug.snapshot().sensorState, "active", "valid events activate sensors without a permission API");
  for (let index = 0; index < 31; index += 1) noPermissionApiEnv.windowTarget.dispatch("deviceorientation", { gamma: "invalid", beta: "invalid" });
  assert.equal(noPermissionApiDebug.snapshot().sensorState, "fallback", "persistently invalid values leave active mode for long-press fallback");

  const noEventEnv = createEnvironment();
  noEventEnv.runTimers(2500);
  assert.equal(noEventEnv.sandbox.window.__LIQUID_PLAY_DEBUG__.snapshot().sensorState, "fallback", "no permission API and no events use long-press fallback");

  const unsupportedEnv = createEnvironment(false, { supported: false });
  const unsupportedDebug = unsupportedEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
  assert.equal(unsupportedDebug.snapshot().sensorState, "fallback", "unsupported devices immediately use long-press fallback");
  assert.equal(unsupportedEnv.windowTarget.listenerCount("deviceorientation"), 0, "unsupported devices do not attach a listener");

  const lifecycleEnv = createEnvironment(false, { permissionResult: "granted" });
  const lifecycleDebug = lifecycleEnv.sandbox.window.__LIQUID_PLAY_DEBUG__;
  assert.equal(lifecycleEnv.windowTarget.listenerCount("deviceorientation"), 1, "lifecycle test starts with one listener");
  lifecycleEnv.windowTarget.dispatch("pageshow");
  lifecycleEnv.windowTarget.dispatch("pageshow");
  assert.equal(lifecycleEnv.windowTarget.listenerCount("deviceorientation"), 1, "repeated pageshow never duplicates the listener");
  assert.ok(lifecycleDebug.snapshot().sensorTimerCount <= 2, "repeated pageshow replaces rather than stacks sensor timers");
  lifecycleEnv.documentTarget.hidden = true;
  lifecycleEnv.documentTarget.dispatch("visibilitychange");
  assert.equal(lifecycleDebug.snapshot().sensorTimerCount, 0, "visibilitychange to hidden clears sensor timers");
  lifecycleEnv.documentTarget.hidden = false;
  lifecycleEnv.documentTarget.dispatch("visibilitychange");
  assert.equal(lifecycleEnv.windowTarget.listenerCount("deviceorientation"), 1, "visibility restoration rechecks with one listener");
  lifecycleEnv.windowTarget.dispatch("pagehide");
  assert.equal(lifecycleDebug.snapshot().sensorTimerCount, 0, "pagehide clears sensor timers");

  const reloadEquivalentEnv = createEnvironment(false, { permissionResult: "granted" });
  reloadEquivalentEnv.windowTarget.dispatch("deviceorientation", { gamma: 8, beta: 1 });
  assert.equal(reloadEquivalentEnv.sandbox.window.__LIQUID_PLAY_DEBUG__.snapshot().sensorState, "active", "reload-equivalent initialization recovers from a valid existing permission event");
  assert.equal(reloadEquivalentEnv.button.hidden, true, "reload-equivalent initialization does not show the button first");
}

runSensorPermissionTests().then(() => {
  console.log("APP-010 automated tests: PASS");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
