"use strict";

// 調整しやすい設定を、ファイルの先頭にまとめています。
const CONFIG = {
  minSize: 72,
  maxSize: 130,
  minSpawnDelay: 700,
  maxSpawnDelay: 1100,
  minRiseTime: 6000,
  maxRiseTime: 10000,
  maxBubbles: 10,
  edgePadding: 12,
  popDuration: 430,
};

const BUBBLE_COLORS = [
  ["rgba(91, 211, 255, 0.32)", "rgba(255, 152, 214, 0.25)"],
  ["rgba(201, 144, 255, 0.30)", "rgba(113, 232, 209, 0.24)"],
  ["rgba(255, 220, 104, 0.28)", "rgba(126, 196, 255, 0.28)"],
  ["rgba(120, 235, 190, 0.29)", "rgba(255, 168, 207, 0.24)"],
  ["rgba(255, 166, 205, 0.29)", "rgba(167, 151, 255, 0.25)"],
];

const state = {
  soundEnabled: true,
  poppedCount: 0,
  spawnTimer: null,
  audioContext: null,
  guideVisible: true,
  isRunning: false,
  cleanupTimers: new Set(),
};

const elements = {};
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function initializeApp() {
  elements.playArea = document.querySelector("#playArea");
  elements.soundButton = document.querySelector("#soundButton");
  elements.soundIcon = document.querySelector("#soundIcon");
  elements.count = document.querySelector("#count");
  elements.guide = document.querySelector("#guide");

  elements.soundButton.addEventListener("pointerdown", stopPointerEvent);
  elements.soundButton.addEventListener("click", toggleSound);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("resize", handleResize);
  window.addEventListener("pagehide", cleanupApp, { once: true });

  startBubbleGeneration();
}

function startBubbleGeneration() {
  if (state.isRunning || document.hidden) return;
  state.isRunning = true;
  createBubble();
  scheduleNextBubble();
}

function scheduleNextBubble() {
  if (!state.isRunning) return;
  const delay = getRandomNumber(CONFIG.minSpawnDelay, CONFIG.maxSpawnDelay);
  state.spawnTimer = window.setTimeout(() => {
    createBubble();
    scheduleNextBubble();
  }, delay);
}

function createBubble() {
  if (!state.isRunning || getVisibleBubbleCount() >= CONFIG.maxBubbles) return;

  const bubble = document.createElement("button");
  const size = getRandomSize();
  const colors = getRandomColors();
  const position = getRandomPosition(size);
  const riseTime = getRandomNumber(CONFIG.minRiseTime, CONFIG.maxRiseTime);
  const drift = getSafeDrift(position, size);

  bubble.type = "button";
  bubble.className = "bubble";
  bubble.setAttribute("aria-label", "シャボン玉を割る");
  bubble.style.setProperty("--size", `${size}px`);
  bubble.style.setProperty("--rise-time", `${riseTime}ms`);
  bubble.style.setProperty("--bubble-a", colors[0]);
  bubble.style.setProperty("--bubble-b", colors[1]);
  bubble.style.setProperty("--drift", `${drift}px`);
  bubble.style.left = `${position}px`;

  bubble.addEventListener("pointerdown", handleBubblePointerDown);
  bubble.addEventListener("keydown", handleBubbleKeyDown);
  bubble.addEventListener("animationend", handleBubbleAnimationEnd);
  elements.playArea.appendChild(bubble);
}

function getRandomSize() {
  return Math.round(getRandomNumber(CONFIG.minSize, CONFIG.maxSize));
}

function getRandomColors() {
  return BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
}

function getRandomPosition(size) {
  const areaWidth = elements.playArea.clientWidth;
  const minX = CONFIG.edgePadding;
  const maxX = Math.max(minX, areaWidth - size - CONFIG.edgePadding);
  const existingBubbles = [...elements.playArea.querySelectorAll(".bubble:not(.is-popping)")];

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = getRandomNumber(minX, maxX);
    const overlapsStart = existingBubbles.some((bubble) => {
      const otherX = Number.parseFloat(bubble.style.left) || 0;
      const otherSize = Number.parseFloat(bubble.style.getPropertyValue("--size")) || 0;
      return Math.abs((candidate + size / 2) - (otherX + otherSize / 2)) < Math.min(size, otherSize) * 0.62;
    });
    if (!overlapsStart) return candidate;
  }

  return getRandomNumber(minX, maxX);
}

function getSafeDrift(left, size) {
  const roomLeft = left - CONFIG.edgePadding;
  const roomRight = elements.playArea.clientWidth - (left + size) - CONFIG.edgePadding;
  const maxDrift = Math.max(0, Math.min(34, roomLeft, roomRight));
  const drift = getRandomNumber(8, Math.max(8, maxDrift));
  return Math.random() < 0.5 ? -drift : drift;
}

function getRandomNumber(min, max) {
  return min + Math.random() * (max - min);
}

function handleBubblePointerDown(event) {
  event.preventDefault();
  event.stopPropagation();
  popBubble(event.currentTarget);
}

function handleBubbleKeyDown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  popBubble(event.currentTarget);
}

function popBubble(bubble) {
  if (!bubble || bubble.dataset.isPopping === "true") return;

  bubble.dataset.isPopping = "true";
  bubble.classList.add("is-popping");
  state.poppedCount += 1;

  updateCountDisplay();
  hideGuide();
  playPopSound();
  createSparkles(bubble);

  const timer = window.setTimeout(() => {
    removeBubble(bubble);
    state.cleanupTimers.delete(timer);
  }, CONFIG.popDuration);
  state.cleanupTimers.add(timer);
}

function createSparkles(bubble) {
  const bubbleRect = bubble.getBoundingClientRect();
  const areaRect = elements.playArea.getBoundingClientRect();
  const centerX = bubbleRect.left - areaRect.left + bubbleRect.width / 2;
  const centerY = bubbleRect.top - areaRect.top + bubbleRect.height / 2;
  const sparkleCount = reduceMotion.matches ? 4 : Math.round(getRandomNumber(5, 8));

  for (let index = 0; index < sparkleCount; index += 1) {
    const angle = (Math.PI * 2 * index) / sparkleCount + getRandomNumber(-0.2, 0.2);
    const distance = getRandomNumber(28, bubbleRect.width * 0.62);
    const sparkle = document.createElement("span");
    sparkle.className = "sparkle";
    sparkle.setAttribute("aria-hidden", "true");
    sparkle.style.left = `${centerX}px`;
    sparkle.style.top = `${centerY}px`;
    sparkle.style.setProperty("--spark-x", `${Math.cos(angle) * distance}px`);
    sparkle.style.setProperty("--spark-y", `${Math.sin(angle) * distance}px`);
    elements.playArea.appendChild(sparkle);
    removeAfterDelay(sparkle, CONFIG.popDuration);
  }

  const word = document.createElement("span");
  word.className = "pop-word";
  word.setAttribute("aria-hidden", "true");
  word.textContent = Math.random() < 0.5 ? "ぽん！" : "ぱちん！";
  word.style.left = `${centerX}px`;
  word.style.top = `${centerY}px`;
  elements.playArea.appendChild(word);
  removeAfterDelay(word, CONFIG.popDuration);
}

function removeAfterDelay(element, delay) {
  const timer = window.setTimeout(() => {
    element.remove();
    state.cleanupTimers.delete(timer);
  }, delay);
  state.cleanupTimers.add(timer);
}

function playPopSound() {
  if (!state.soundEnabled) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!state.audioContext) state.audioContext = new AudioContextClass();

    const context = state.audioContext;
    const play = () => {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(330, now);
      oscillator.frequency.exponentialRampToValueAtTime(180, now + 0.16);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(850, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.075, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);

      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.2);
    };

    if (context.state === "suspended") {
      context.resume().then(play).catch(() => {});
    } else {
      play();
    }
  } catch (error) {
    // 音が使えない環境でも、見た目の動作は続けます。
  }
}

function toggleSound(event) {
  event.preventDefault();
  event.stopPropagation();
  state.soundEnabled = !state.soundEnabled;
  elements.soundIcon.textContent = state.soundEnabled ? "🔊" : "🔇";
  elements.soundButton.setAttribute("aria-pressed", String(state.soundEnabled));
  elements.soundButton.setAttribute("aria-label", state.soundEnabled ? "音をオフにする" : "音をオンにする");
}

function stopPointerEvent(event) {
  event.stopPropagation();
}

function updateCountDisplay() {
  elements.count.textContent = state.poppedCount === 0
    ? "シャボン玉を タッチ！"
    : `${state.poppedCount}こ われたよ！`;
}

function hideGuide() {
  if (!state.guideVisible) return;
  state.guideVisible = false;
  elements.guide.classList.add("is-hidden");
}

function handleBubbleAnimationEnd(event) {
  if (event.animationName === "bubble-rise" || event.animationName === "bubble-pop") {
    removeBubble(event.currentTarget);
  }
}

function removeBubble(bubble) {
  if (bubble?.isConnected) bubble.remove();
}

function getVisibleBubbleCount() {
  return elements.playArea.querySelectorAll(".bubble").length;
}

function handleResize() {
  // 既存の泡がはみ出した場合だけ内側へ戻します。新しい泡は新しい幅で生成されます。
  const areaWidth = elements.playArea.clientWidth;
  elements.playArea.querySelectorAll(".bubble:not(.is-popping)").forEach((bubble) => {
    const size = Number.parseFloat(bubble.style.getPropertyValue("--size"));
    const currentLeft = Number.parseFloat(bubble.style.left);
    const maxLeft = Math.max(CONFIG.edgePadding, areaWidth - size - CONFIG.edgePadding);
    bubble.style.left = `${Math.min(Math.max(currentLeft, CONFIG.edgePadding), maxLeft)}px`;
  });
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopBubbleGeneration();
  } else {
    startBubbleGeneration();
  }
}

function stopBubbleGeneration() {
  state.isRunning = false;
  window.clearTimeout(state.spawnTimer);
  state.spawnTimer = null;
}

function cleanupApp() {
  stopBubbleGeneration();
  state.cleanupTimers.forEach((timer) => window.clearTimeout(timer));
  state.cleanupTimers.clear();
  if (state.audioContext && state.audioContext.state !== "closed") {
    state.audioContext.close().catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", initializeApp, { once: true });
