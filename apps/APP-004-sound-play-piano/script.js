"use strict";

const NOTES = [
  { id: "c4", label: "ド", frequency: 261.63, color: "#ff6b6b" },
  { id: "d4", label: "レ", frequency: 293.66, color: "#ffad5a" },
  { id: "e4", label: "ミ", frequency: 329.63, color: "#ffe66d" },
  { id: "f4", label: "ファ", frequency: 349.23, color: "#78d881" },
  { id: "g4", label: "ソ", frequency: 392.0, color: "#6edbea" },
  { id: "a4", label: "ラ", frequency: 440.0, color: "#6b9cff" },
  { id: "b4", label: "シ", frequency: 493.88, color: "#b78ae8" }
];

const MAX_VOICES = 5;
const MAX_PARTICLES = 60;
const SOUND_KEY = "sound-play-piano-sound-enabled";
const keyboard = document.querySelector("#keyboard");
const effects = document.querySelector("#effects");
const soundToggle = document.querySelector("#sound-toggle");
const status = document.querySelector("#status");

let soundEnabled = readSoundSetting();
let totalPlays = 0;
let celebrationActive = false;
let audioContext = null;
let masterGain = null;
const pointerKeys = new Map();
const activeVoices = [];
const keyTimers = new Map();

function readSoundSetting() {
  try { return localStorage.getItem(SOUND_KEY) !== "false"; }
  catch { return true; }
}

function buildKeyboard() {
  const fragment = document.createDocumentFragment();
  NOTES.forEach((note) => {
    const key = document.createElement("button");
    key.type = "button";
    key.className = "key";
    key.dataset.noteId = note.id;
    key.style.setProperty("--key-color", note.color);
    key.setAttribute("aria-label", `${note.label}の音`);
    key.textContent = note.label;
    fragment.append(key);
  });
  keyboard.append(fragment);
}

function updateSoundButton() {
  soundToggle.setAttribute("aria-pressed", String(!soundEnabled));
  soundToggle.setAttribute("aria-label", soundEnabled ? "音を消す" : "音を出す");
  soundToggle.querySelector(".sound-icon").textContent = soundEnabled ? "🔊" : "🔇";
  soundToggle.querySelector(".sound-text").textContent = soundEnabled ? "おと あり" : "おと なし";
}

function ensureAudio() {
  if (!soundEnabled) return false;
  try {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      audioContext = new AudioContextClass();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 0.32;
      masterGain.connect(audioContext.destination);
    }
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    return true;
  } catch { return false; }
}

function stopVoice(voice, quickly = false) {
  if (!audioContext || voice.stopping) return;
  voice.stopping = true;
  const now = audioContext.currentTime;
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setTargetAtTime(0.0001, now, quickly ? 0.015 : 0.06);
  try { voice.oscillator.stop(now + (quickly ? 0.08 : 0.25)); } catch { /* already stopped */ }
}

function disposeAllVoices() {
  activeVoices.splice(0).forEach((voice) => {
    voice.stopping = true;
    try { voice.gain.gain.cancelScheduledValues(audioContext?.currentTime || 0); } catch { /* unavailable context */ }
    try { voice.gain.gain.value = 0.0001; } catch { /* already disconnected */ }
    try { voice.oscillator.stop(); } catch { /* already stopped */ }
    try { voice.oscillator.disconnect(); } catch { /* already disconnected */ }
    try { voice.gain.disconnect(); } catch { /* already disconnected */ }
  });
}

function playTone(note) {
  if (!ensureAudio()) return;
  while (activeVoices.length >= MAX_VOICES) stopVoice(activeVoices.shift(), true);

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const voice = { oscillator, gain, stopping: false };
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(note.frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.78);
  oscillator.connect(gain).connect(masterGain);
  oscillator.start(now);
  oscillator.stop(now + 0.82);
  activeVoices.push(voice);
  oscillator.addEventListener("ended", () => {
    oscillator.disconnect();
    gain.disconnect();
    const index = activeVoices.indexOf(voice);
    if (index >= 0) activeVoices.splice(index, 1);
  }, { once: true });
}

function animateKey(key) {
  key.classList.remove("is-active");
  void key.offsetWidth;
  key.classList.add("is-active");
  clearTimeout(keyTimers.get(key));
  keyTimers.set(key, setTimeout(() => {
    key.classList.remove("is-active");
    keyTimers.delete(key);
  }, 380));
}

function createParticles(key, note, clientX, clientY) {
  const rect = key.getBoundingClientRect();
  const x = Number.isFinite(clientX) ? clientX : rect.left + rect.width / 2;
  const y = Number.isFinite(clientY) ? clientY : rect.top + rect.height / 2;
  const count = 2 + Math.floor(Math.random() * 4);
  for (let index = 0; index < count; index += 1) {
    const oldestParticle = effects.querySelector(".particle");
    if (effects.querySelectorAll(".particle").length >= MAX_PARTICLES) oldestParticle?.remove();
    const particle = document.createElement("span");
    particle.className = "particle";
    particle.textContent = Math.random() > 0.45 ? "♪" : "●";
    particle.style.setProperty("--x", `${x + (Math.random() - .5) * 36}px`);
    particle.style.setProperty("--y", `${y + (Math.random() - .5) * 18}px`);
    particle.style.setProperty("--drift", `${(Math.random() - .5) * 100}px`);
    particle.style.setProperty("--turn", `${(Math.random() - .5) * 50}deg`);
    particle.style.setProperty("--particle-color", note.color);
    effects.append(particle);
    particle.addEventListener("animationend", () => particle.remove(), { once: true });
  }
}

function showCelebration() {
  if (celebrationActive) return;
  celebrationActive = true;
  const item = document.createElement("div");
  item.className = "celebration";
  item.textContent = Math.random() > .5 ? "🌈" : "⭐";
  effects.append(item);
  item.addEventListener("animationend", () => {
    item.remove();
    celebrationActive = false;
  }, { once: true });
}

function triggerKey(key, clientX, clientY) {
  const note = NOTES.find((item) => item.id === key.dataset.noteId);
  if (!note) return;
  playTone(note);
  animateKey(key);
  createParticles(key, note, clientX, clientY);
  totalPlays += 1;
  status.textContent = `${note.label}の音`;
  if (totalPlays % 7 === 0) showCelebration();
}

function keyAtPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  return element ? element.closest(".key") : null;
}

keyboard.addEventListener("pointerdown", (event) => {
  const key = event.target.closest(".key");
  if (!key) return;
  event.preventDefault();
  pointerKeys.set(event.pointerId, key);
  try { key.setPointerCapture(event.pointerId); } catch { /* capture may be unavailable */ }
  triggerKey(key, event.clientX, event.clientY);
});

keyboard.addEventListener("pointermove", (event) => {
  if (!pointerKeys.has(event.pointerId)) return;
  event.preventDefault();
  const key = keyAtPoint(event.clientX, event.clientY);
  const previousKey = pointerKeys.get(event.pointerId);
  if (key && key !== previousKey) {
    pointerKeys.set(event.pointerId, key);
    triggerKey(key, event.clientX, event.clientY);
  }
});

function releasePointer(event) { pointerKeys.delete(event.pointerId); }
keyboard.addEventListener("pointerup", releasePointer);
keyboard.addEventListener("pointercancel", releasePointer);
keyboard.addEventListener("lostpointercapture", releasePointer);

keyboard.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
    event.preventDefault();
    triggerKey(event.target.closest(".key"));
  }
});

soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  try { localStorage.setItem(SOUND_KEY, String(soundEnabled)); } catch { /* private mode etc. */ }
  if (!soundEnabled) activeVoices.slice().forEach((voice) => stopVoice(voice, true));
  updateSoundButton();
  status.textContent = soundEnabled ? "音を出します" : "音を消しました";
});

function clearTransientState() {
  pointerKeys.clear();
  keyTimers.forEach((timer) => clearTimeout(timer));
  keyTimers.clear();
  keyboard.querySelectorAll(".is-active").forEach((key) => key.classList.remove("is-active"));
  effects.replaceChildren();
  celebrationActive = false;
  disposeAllVoices();
}

function suspendAudio() {
  clearTransientState();
  if (audioContext?.state === "running") audioContext.suspend().catch(() => {});
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) suspendAudio();
});
window.addEventListener("pagehide", suspendAudio);
window.addEventListener("pageshow", clearTransientState);

document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("dragstart", (event) => event.preventDefault());

buildKeyboard();
updateSoundButton();
