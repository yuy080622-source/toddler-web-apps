"use strict";

const activities = {
  hand: {
    id: "hand", title: "おてて あらおう", icon: "👐", themeColor: "hand",
    completionMessage: "ぴかぴか！ できたね！",
    steps: [
      { id: "water-on", instructionText: "おみずを だそう", requiredAction: "tap", requiredCount: 1, hintTarget: ".target", effectType: "water" },
      { id: "soap", instructionText: "せっけんを つけよう", requiredAction: "tap", requiredCount: 1, hintTarget: ".target", effectType: "bubbles" },
      { id: "scrub", instructionText: "ごしごし しよう", requiredAction: "rub", requiredCount: 5, hintTarget: ".target", effectType: "scrub" },
      { id: "rinse", instructionText: "おみずで ながそう", requiredAction: "tap", requiredCount: 1, hintTarget: ".target", effectType: "rinse" },
      { id: "dry", instructionText: "ふきふき しよう", requiredAction: "tap", requiredCount: 1, hintTarget: ".target", effectType: "dry" }
    ]
  },
  tooth: {
    id: "tooth", title: "はみがき しよう", icon: "😁", themeColor: "tooth",
    completionMessage: "はみがき できたね！",
    steps: [
      { id: "hold", instructionText: "はぶらしを もとう", requiredAction: "tap", requiredCount: 1, hintTarget: ".mouth", effectType: "hold" },
      { id: "brush-one", instructionText: "しゃかしゃか しよう", requiredAction: "rub", requiredCount: 8, hintTarget: ".mouth", effectType: "brush" },
      { id: "brush-two", instructionText: "もうすこし！", requiredAction: "rub", requiredCount: 5, hintTarget: ".mouth", effectType: "brush" },
      { id: "shine", instructionText: "ぴかぴか！", requiredAction: "auto", requiredCount: 0, hintTarget: "", effectType: "shine" }
    ]
  },
  tidy: {
    id: "tidy", title: "おもちゃ おかたづけ", icon: "🧺", themeColor: "tidy",
    completionMessage: "おかたづけ できたね！",
    steps: [{ id: "put-away", instructionText: "おもちゃを おかたづけ しよう", requiredAction: "toys", requiredCount: 4, hintTarget: ".toy:not(.is-put-away)", effectType: "tidy" }]
  }
};

const state = {
  currentScreen: "home", activityId: null, stepIndex: 0, actionCount: 0,
  soundOn: localStorage.getItem("dailyHabitsSound") !== "off",
  reacting: false, hintTimer: null, timers: [], pointer: null, distance: 0,
  tidyIds: new Set(), userInteracted: false
};

const screens = { home: document.querySelector("#home-screen"), play: document.querySelector("#play-screen"), complete: document.querySelector("#complete-screen") };
const playScreen = screens.play;
const playArea = document.querySelector("#play-area");
const instruction = document.querySelector("#instruction");
const progress = document.querySelector("#progress");

function addTimer(callback, delay) {
  const id = window.setTimeout(() => { state.timers = state.timers.filter(timer => timer !== id); callback(); }, delay);
  state.timers.push(id);
  return id;
}

function clearRuntime() {
  clearTimeout(state.hintTimer);
  state.timers.forEach(clearTimeout);
  state.timers = [];
  state.pointer = null;
  state.reacting = false;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, screen]) => screen.classList.toggle("is-active", key === name));
  state.currentScreen = name;
  window.scrollTo(0, 0);
}

function updateSoundButtons() {
  document.querySelectorAll(".sound-toggle").forEach(button => {
    button.querySelector("span").textContent = state.soundOn ? "🔊" : "🔇";
    button.setAttribute("aria-label", state.soundOn ? "おとを けす" : "おとを だす");
  });
}

function speak(text) {
  if (!state.soundOn || !state.userInteracted || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/！/g, "。"));
  utterance.lang = "ja-JP";
  utterance.rate = .82;
  utterance.pitch = 1.12;
  window.speechSynthesis.speak(utterance);
}

let audioContext = null;
function playTone(kind = "tap") {
  if (!state.soundOn || !state.userInteracted) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = kind === "complete" ? 660 : kind === "pop" ? 520 : 390;
    gain.gain.setValueAtTime(.06, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .14);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + .15);
  } catch (_) { /* 音が使えなくても、遊びは続けられます。 */ }
}

function setHint() {
  clearTimeout(state.hintTimer);
  state.hintTimer = window.setTimeout(() => {
    if (state.currentScreen !== "play") return;
    const step = activities[state.activityId].steps[state.stepIndex];
    const target = step && playArea.querySelector(step.hintTarget);
    if (target) target.classList.add("hint");
  }, 3000);
}

function clearHint() {
  clearTimeout(state.hintTimer);
  playArea.querySelectorAll(".hint").forEach(el => el.classList.remove("hint"));
}

function buildProgress() {
  const steps = activities[state.activityId].steps;
  progress.innerHTML = steps.map((_, index) => `<span class="progress-dot ${index < state.stepIndex ? "is-done" : index === state.stepIndex ? "is-current" : ""}" aria-hidden="true"></span>`).join("");
  progress.setAttribute("aria-label", `${steps.length}このうち ${Math.min(state.stepIndex + 1, steps.length)}こめ`);
}

function startActivity(id) {
  clearRuntime();
  state.activityId = id;
  state.stepIndex = 0;
  state.actionCount = 0;
  state.distance = 0;
  state.tidyIds = new Set();
  playScreen.className = `screen play-screen is-active theme-${id}`;
  showScreen("play");
  if (id === "tidy") renderTidy(); else renderStep();
}

function renderStep() {
  state.reacting = false;
  state.actionCount = 0;
  state.distance = 0;
  const activity = activities[state.activityId];
  const step = activity.steps[state.stepIndex];
  instruction.textContent = step.instructionText;
  buildProgress();
  if (activity.id === "hand") renderHand(step);
  if (activity.id === "tooth") renderTooth(step);
  speak(step.instructionText);
  setHint();
  if (step.requiredAction === "auto") addTimer(() => finishActivity(), 1100);
}

function renderHand(step) {
  const content = {
    "water-on": ["🚰", "じゃーっと おみず"], "soap": ["🧴", "せっけんを ぽん"],
    "scrub": ["👐", "とんとん でも こすっても OK"], "rinse": ["👐", "あわを ながそう"], "dry": ["🧻", "タオルで ふきふき"]
  }[step.id];
  playArea.innerHTML = `<div class="scene"><button class="target" type="button" aria-label="${step.instructionText}">${content[0]}</button>${step.id === "water-on" || step.id === "rinse" ? '<span class="water"></span>' : ""}<span class="scene-label">${content[1]}</span></div>`;
  const target = playArea.querySelector(".target");
  target.addEventListener("pointerdown", onActionPointerDown);
  if (step.requiredAction === "rub") attachRubHandlers(target);
}

function renderTooth(step) {
  const dirt = step.id === "brush-two" ? .45 : step.id === "shine" ? 0 : 1;
  playArea.innerHTML = `<div class="scene"><button class="mouth" type="button" aria-label="${step.instructionText}">😁</button><span class="dirt-dots" style="--dirt:${dirt}"></span><span class="brush ${step.id !== "hold" ? "at-mouth" : ""}">🪥</span><span class="scene-label">くちの どこを さわっても いいよ</span></div>`;
  const mouth = playArea.querySelector(".mouth");
  if (step.requiredAction !== "auto") mouth.addEventListener("pointerdown", onActionPointerDown);
  if (step.requiredAction === "rub") attachRubHandlers(mouth);
  if (step.id === "shine") makeSparkles(5);
}

function onActionPointerDown(event) {
  event.preventDefault();
  if (state.reacting) return;
  clearHint();
  state.actionCount += 1;
  playTone("tap");
  const step = activities[state.activityId].steps[state.stepIndex];
  applyStepFeedback(step);
  if (state.actionCount >= step.requiredCount) completeStep(); else setHint();
}

function attachRubHandlers(target) {
  target.addEventListener("pointerdown", event => {
    target.setPointerCapture?.(event.pointerId);
    state.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  target.addEventListener("pointermove", event => {
    if (!state.pointer || state.pointer.id !== event.pointerId || state.reacting) return;
    const moved = Math.hypot(event.clientX - state.pointer.x, event.clientY - state.pointer.y);
    if (moved < 14) return;
    state.pointer.x = event.clientX; state.pointer.y = event.clientY;
    state.distance += moved;
    if (state.distance >= 28) {
      state.distance = 0;
      state.actionCount += 1;
      clearHint();
      applyStepFeedback(activities[state.activityId].steps[state.stepIndex]);
      if (state.actionCount >= activities[state.activityId].steps[state.stepIndex].requiredCount) completeStep();
    }
  });
  ["pointerup", "pointercancel"].forEach(type => target.addEventListener(type, () => { state.pointer = null; setHint(); }));
}

function applyStepFeedback(step) {
  if (step.effectType === "water" || step.effectType === "rinse") playArea.querySelector(".water")?.classList.add("is-on");
  if (["bubbles", "scrub", "brush"].includes(step.effectType)) makeBubbles(step.effectType === "scrub" ? 3 : 1);
  if (step.effectType === "brush") {
    const dirt = playArea.querySelector(".dirt-dots");
    if (dirt) dirt.style.setProperty("--dirt", Math.max(0, 1 - state.actionCount / step.requiredCount));
  }
}

function completeStep() {
  if (state.reacting) return;
  state.reacting = true;
  clearHint();
  makeSparkles(3);
  const activity = activities[state.activityId];
  addTimer(() => {
    state.stepIndex += 1;
    if (state.stepIndex >= activity.steps.length) finishActivity(); else renderStep();
  }, 480);
}

function renderTidy() {
  instruction.textContent = activities.tidy.steps[0].instructionText;
  buildProgress();
  playArea.innerHTML = `<div class="scene tidy-scene"><div class="toy-box" aria-label="おもちゃばこ">🧺</div><button class="toy" data-id="ball" aria-label="ボール">⚽</button><button class="toy" data-id="blocks" aria-label="つみき">🧱</button><button class="toy" data-id="bear" aria-label="ぬいぐるみ">🧸</button><button class="toy" data-id="car" aria-label="ミニカー">🚗</button></div>`;
  playArea.querySelectorAll(".toy").forEach(attachToyHandlers);
  speak(instruction.textContent);
  setHint();
}

function attachToyHandlers(toy) {
  toy.addEventListener("pointerdown", event => {
    if (toy.classList.contains("is-put-away")) return;
    event.preventDefault();
    clearHint();
    toy.setPointerCapture?.(event.pointerId);
    state.pointer = { id: event.pointerId, toy, startX: event.clientX, startY: event.clientY, moved: false, originalLeft: toy.offsetLeft, originalTop: toy.offsetTop };
  });
  toy.addEventListener("pointermove", event => {
    if (!state.pointer || state.pointer.id !== event.pointerId || state.pointer.toy !== toy) return;
    const dx = event.clientX - state.pointer.startX;
    const dy = event.clientY - state.pointer.startY;
    if (Math.hypot(dx, dy) > 8) state.pointer.moved = true;
    if (!state.pointer.moved) return;
    toy.classList.add("is-dragging");
    toy.style.left = `${state.pointer.originalLeft + dx}px`;
    toy.style.top = `${state.pointer.originalTop + dy}px`;
    toy.style.right = "auto";
  });
  const end = event => {
    if (!state.pointer || state.pointer.id !== event.pointerId || state.pointer.toy !== toy) return;
    const wasMoved = state.pointer.moved;
    state.pointer = null;
    toy.classList.remove("is-dragging");
    const box = playArea.querySelector(".toy-box").getBoundingClientRect();
    const pointInBox = event.clientX >= box.left - 25 && event.clientX <= box.right + 25 && event.clientY >= box.top - 25 && event.clientY <= box.bottom + 25;
    toy.removeAttribute("style");
    if (!wasMoved || pointInBox) putAwayToy(toy); else setHint();
  };
  toy.addEventListener("pointerup", end);
  toy.addEventListener("pointercancel", () => { toy.removeAttribute("style"); toy.classList.remove("is-dragging"); state.pointer = null; setHint(); });
}

function putAwayToy(toy) {
  if (state.tidyIds.has(toy.dataset.id)) return;
  state.tidyIds.add(toy.dataset.id);
  toy.classList.add("is-put-away");
  playTone("pop");
  makeSparkles(2);
  const remaining = 4 - state.tidyIds.size;
  if (remaining === 1) { instruction.textContent = "あと ひとつ！"; speak("あと ひとつ"); }
  if (remaining === 0) {
    clearHint();
    addTimer(() => playArea.querySelector(".toy-box")?.classList.add("is-closed"), 350);
    addTimer(finishActivity, 900);
  } else setHint();
}

function makeBubbles(count) {
  for (let i = 0; i < count; i += 1) {
    const bubble = document.createElement("span");
    bubble.className = "bubble";
    const size = 18 + Math.random() * 25;
    bubble.style.cssText = `width:${size}px;height:${size}px;left:${25 + Math.random() * 50}%;top:${45 + Math.random() * 25}%`;
    playArea.appendChild(bubble);
    addTimer(() => bubble.remove(), 1250);
  }
}

function makeSparkles(count, container = playArea) {
  for (let i = 0; i < count; i += 1) {
    const star = document.createElement("span");
    star.className = "sparkle";
    star.textContent = i % 2 ? "✨" : "⭐";
    star.style.left = `${12 + Math.random() * 76}%`;
    star.style.top = `${12 + Math.random() * 66}%`;
    container.appendChild(star);
    addTimer(() => star.remove(), 1300);
  }
}

function finishActivity() {
  clearRuntime();
  const activity = activities[state.activityId];
  document.querySelector("#complete-art").textContent = activity.id === "hand" ? "👏" : activity.id === "tooth" ? "😁" : "🧺";
  document.querySelector("#complete-message").textContent = activity.completionMessage;
  const actions = document.querySelector("#complete-actions");
  actions.classList.add("is-waiting");
  showScreen("complete");
  state.userInteracted = true;
  speak(activity.completionMessage);
  playTone("complete");
  makeSparkles(activity.id === "hand" ? 8 : 6, document.querySelector("#celebration"));
  addTimer(() => actions.classList.remove("is-waiting"), 1900);
}

function goHome() {
  clearRuntime();
  playArea.innerHTML = "";
  progress.innerHTML = "";
  showScreen("home");
}

document.addEventListener("pointerdown", () => { state.userInteracted = true; }, { once: true });
document.querySelectorAll(".activity-card").forEach(card => {
  card.addEventListener("pointerdown", () => { card.classList.add("is-pressed"); playTone("tap"); });
  card.addEventListener("pointerup", () => { card.classList.remove("is-pressed"); startActivity(card.dataset.activity); });
  card.addEventListener("pointercancel", () => card.classList.remove("is-pressed"));
  card.addEventListener("click", event => { if (event.detail === 0) startActivity(card.dataset.activity); });
});
document.querySelectorAll(".sound-toggle").forEach(button => button.addEventListener("click", event => {
  event.stopPropagation();
  state.userInteracted = true;
  state.soundOn = !state.soundOn;
  localStorage.setItem("dailyHabitsSound", state.soundOn ? "on" : "off");
  if (!state.soundOn && "speechSynthesis" in window) window.speechSynthesis.cancel();
  updateSoundButtons();
  if (state.soundOn) playTone("tap");
}));
document.querySelector("#home-button").addEventListener("click", goHome);
document.querySelector("#complete-home-button").addEventListener("click", goHome);
document.querySelector("#retry-button").addEventListener("click", () => startActivity(state.activityId));
window.addEventListener("pagehide", clearRuntime);
document.addEventListener("visibilitychange", () => { if (document.hidden && "speechSynthesis" in window) window.speechSynthesis.cancel(); });
updateSoundButtons();
