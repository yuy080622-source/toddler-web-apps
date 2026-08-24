"use strict";

const fruits = [
  { id: "apple", name: "りんご", emoji: "🍎", image: "assets/images/apple.webp", sound: "assets/sounds/apple.mp3", backgroundColor: "#fff1e5", effectType: "bounce", particle: "★", particleColors: ["#ff665f", "#ffd45a", "#ff9b7d"] },
  { id: "banana", name: "バナナ", emoji: "🍌", image: "assets/images/banana.webp", sound: "assets/sounds/banana.mp3", backgroundColor: "#fff8cf", effectType: "sway", particle: "●", particleColors: ["#f4c62d", "#fff07a", "#f09d3e"] },
  { id: "strawberry", name: "いちご", emoji: "🍓", image: "assets/images/strawberry.webp", sound: "assets/sounds/strawberry.mp3", backgroundColor: "#ffe7ed", effectType: "heart", particle: "♥", particleColors: ["#f15b78", "#ff9db1", "#e94166"] },
  { id: "grape", name: "ぶどう", emoji: "🍇", image: "assets/images/grape.webp", sound: "assets/sounds/grape.mp3", backgroundColor: "#f0e8ff", effectType: "burst", particle: "●", particleColors: ["#8057c8", "#b886e8", "#e09aea"] }
];

const fruitButton = document.querySelector("#fruitButton");
const fruitImage = document.querySelector("#fruitImage");
const fruitEmoji = document.querySelector("#fruitEmoji");
const fruitName = document.querySelector("#fruitName");
const popName = document.querySelector("#popName");
const effectLayer = document.querySelector("#effectLayer");
const soundButton = document.querySelector("#soundButton");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const unavailableSounds = new Set();
// 正式MP3を配置したときだけtrueにする。MVPではタップ内で読み上げを直接開始する。
const useOfficialAudio = false;

let currentIndex = 0;
let soundEnabled = readSoundPreference();
let activeAudio = null;
let effectTimer = null;
let effectRunId = 0;
let pageIsActive = !document.hidden;

function readSoundPreference() {
  try { return localStorage.getItem("fruitPopSound") !== "off"; }
  catch (_) { return true; }
}

function saveSoundPreference() {
  try { localStorage.setItem("fruitPopSound", soundEnabled ? "on" : "off"); }
  catch (_) { /* Storage may be unavailable in private browsing. */ }
}

function renderFruit() {
  const fruit = fruits[currentIndex];
  document.documentElement.style.setProperty("--background", fruit.backgroundColor);
  document.querySelector('meta[name="theme-color"]').content = fruit.backgroundColor;
  fruitName.textContent = fruit.name;
  popName.textContent = `${fruit.name}！`;
  fruitEmoji.textContent = fruit.emoji;
  fruitEmoji.style.display = "block";
  fruitImage.style.display = "none";
  fruitImage.alt = fruit.name;
  if (fruitImage.getAttribute("src") !== fruit.image) fruitImage.src = fruit.image;
  fruitButton.setAttribute("aria-label", `${fruit.name}。タッチすると音と動きが出ます`);
}

fruitImage.addEventListener("load", () => {
  if (fruitImage.src.endsWith(fruits[currentIndex].image)) {
    fruitImage.style.display = "block";
    fruitEmoji.style.display = "none";
  }
});
fruitImage.addEventListener("error", () => { fruitImage.style.display = "none"; fruitEmoji.style.display = "block"; });

function stopSound() {
  if (activeAudio) { activeAudio.pause(); activeAudio.currentTime = 0; activeAudio = null; }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function speakWithBrowser(name) {
  if (!pageIsActive || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;
  const utterance = new SpeechSynthesisUtterance(`${name}！`);
  utterance.lang = "ja-JP";
  utterance.rate = 0.82;
  utterance.pitch = 1.12;
  utterance.volume = 0.8;
  window.speechSynthesis.speak(utterance);
}

function playName(fruit, runId) {
  stopSound();
  if (!soundEnabled) return;
  if (!useOfficialAudio) {
    speakWithBrowser(fruit.name);
    return;
  }
  if (unavailableSounds.has(fruit.sound)) {
    speakWithBrowser(fruit.name);
    return;
  }
  const audio = new Audio(fruit.sound);
  activeAudio = audio;
  audio.volume = 0.75;
  let fallbackStarted = false;
  const fallback = () => {
    if (fallbackStarted || runId !== effectRunId || !soundEnabled || !pageIsActive) return;
    fallbackStarted = true;
    if (activeAudio === audio) activeAudio = null;
    speakWithBrowser(fruit.name);
  };
  audio.addEventListener("error", () => {
    unavailableSounds.add(fruit.sound);
    fallback();
  }, { once: true });
  audio.addEventListener("ended", () => { if (activeAudio === audio) activeAudio = null; }, { once: true });
  audio.play().catch(fallback);
}

function clearEffect() {
  clearTimeout(effectTimer);
  effectTimer = null;
  fruitButton.className = "fruit-button";
  popName.classList.remove("show");
  effectLayer.replaceChildren();
}

function createParticles(fruit) {
  const count = reducedMotion.matches ? 4 : 8;
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index / count) - Math.PI / 2;
    const distance = reducedMotion.matches ? 58 + (index % 2) * 14 : 88 + (index % 3) * 22;
    const particle = document.createElement("span");
    particle.className = "particle";
    particle.textContent = fruit.particle;
    particle.style.color = fruit.particleColors[index % fruit.particleColors.length];
    particle.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    particle.style.setProperty("--r", `${index % 2 ? 35 : -35}deg`);
    fragment.append(particle);
  }
  effectLayer.append(fragment);
}

function activateFruit(event) {
  if (event?.type === "pointerdown") event.preventDefault();
  if (!pageIsActive) return;
  const fruit = fruits[currentIndex];
  effectRunId += 1;
  const runId = effectRunId;
  clearEffect();
  void fruitButton.offsetWidth;
  fruitButton.classList.add(`effect-${fruit.effectType}`);
  popName.classList.add("show");
  createParticles(fruit);
  playName(fruit, runId);
  effectTimer = window.setTimeout(() => {
    if (runId !== effectRunId || !pageIsActive) return;
    changeFruit(1, false);
  }, 720);
}

function changeFruit(offset, shouldStopSound = true) {
  effectRunId += 1;
  clearEffect();
  if (shouldStopSound) stopSound();
  currentIndex = (currentIndex + offset + fruits.length) % fruits.length;
  renderFruit();
}

function updateSoundButton() {
  soundButton.querySelector(".sound-icon").textContent = soundEnabled ? "🔊" : "🔇";
  soundButton.querySelector(".sound-label").textContent = soundEnabled ? "おと" : "しずか";
  soundButton.setAttribute("aria-pressed", String(soundEnabled));
  soundButton.setAttribute("aria-label", soundEnabled ? "音声をオフにする" : "音声をオンにする");
}

function pauseApp() {
  pageIsActive = false;
  effectRunId += 1;
  clearEffect();
  stopSound();
}

function resumeApp() {
  pageIsActive = true;
  soundEnabled = readSoundPreference();
  clearEffect();
  renderFruit();
  updateSoundButton();
}

function handleVisibilityChange() {
  if (document.hidden) pauseApp();
  else resumeApp();
}

function handlePageShow(event) {
  if (event.persisted || !pageIsActive) resumeApp();
}

fruitButton.addEventListener("pointerdown", activateFruit);
fruitButton.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activateFruit(event); }
});
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  if (!soundEnabled) stopSound();
  saveSoundPreference();
  updateSoundButton();
});
document.addEventListener("visibilitychange", handleVisibilityChange);
window.addEventListener("pagehide", pauseApp);
window.addEventListener("pageshow", handlePageShow);

renderFruit();
updateSoundButton();
