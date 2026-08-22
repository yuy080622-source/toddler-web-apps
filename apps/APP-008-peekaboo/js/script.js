"use strict";

const CHARACTERS = [
  { id: "bear", name: "くまさん", image: "assets/images/bear.png", sound: "assets/sounds/bear.mp3", speech: "ばあ！くまさんだよ！", emoji: "🐻", color: "#e6aa6b" },
  { id: "rabbit", name: "うさぎさん", image: "assets/images/rabbit.png", sound: "assets/sounds/rabbit.mp3", speech: "ばあ！うさぎさんだよ！", emoji: "🐰", color: "#f3a3b8" },
  { id: "chick", name: "ひよこさん", image: "assets/images/chick.png", sound: "assets/sounds/chick.mp3", speech: "ばあ！ひよこさんだよ！", emoji: "🐥", color: "#f5cd45" },
  { id: "frog", name: "かえるさん", image: "assets/images/frog.png", sound: "assets/sounds/frog.mp3", speech: "ばあ！かえるさんだよ！", emoji: "🐸", color: "#7bcf78" }
];

const SETTINGS = { curtainDuration: 620, reducedCurtainDuration: 180, revealDuration: 2600, safetyBuffer: 120 };
const app = { state: "closed", soundOn: true, current: null, previousId: null, playCount: 0, closeTimer: null, transitionTimer: null, audio: null };
const elements = {};

function initializeApp() {
  Object.assign(elements, {
    stage: document.querySelector("#stage"), soundButton: document.querySelector("#soundButton"),
    soundIcon: document.querySelector(".sound-icon"), characterWrap: document.querySelector("#characterWrap"),
    characterImage: document.querySelector("#characterImage"), characterEmoji: document.querySelector("#characterEmoji"),
    characterName: document.querySelector("#characterName"), sparkles: document.querySelector("#sparkles"),
    instruction: document.querySelector("#instruction"), playCount: document.querySelector("#playCount"),
    liveMessage: document.querySelector("#liveMessage")
  });
  elements.stage.addEventListener("pointerdown", handleStagePointer);
  elements.stage.addEventListener("keydown", handleStageKeydown);
  elements.soundButton.addEventListener("click", toggleSound);
  elements.characterImage.addEventListener("load", showLoadedImage);
  elements.characterImage.addEventListener("error", showEmojiFallback);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", cleanupApp);
  prepareNextRound();
}

function chooseNextCharacter() {
  const choices = CHARACTERS.filter((character) => character.id !== app.previousId);
  return choices[Math.floor(Math.random() * choices.length)];
}

function prepareNextRound() {
  app.current = chooseNextCharacter();
  elements.characterName.textContent = app.current.name;
  elements.characterEmoji.textContent = app.current.emoji;
  elements.characterWrap.classList.remove("is-image");
  elements.characterImage.classList.remove("is-loaded");
  elements.characterImage.alt = app.current.name;
  elements.characterImage.src = app.current.image;
  elements.stage.style.setProperty("--theme-color", app.current.color);
  elements.stage.setAttribute("aria-label", "カーテンを開ける。タッチしてね");
  app.state = "closed";
}

function handleStagePointer(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  openCurtains();
}

function handleStageKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  openCurtains();
}

function getCurtainDuration() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? SETTINGS.reducedCurtainDuration : SETTINGS.curtainDuration;
}

function openCurtains() {
  if (app.state !== "closed") return;
  app.state = "opening";
  app.playCount += 1;
  app.previousId = app.current.id;
  updatePlayCount();
  createSparkles();
  elements.stage.classList.add("is-open");
  clearTransitionTimer();
  app.transitionTimer = window.setTimeout(revealCharacter, getCurtainDuration() + SETTINGS.safetyBuffer);
}

function revealCharacter() {
  if (app.state !== "opening") return;
  app.state = "revealed";
  elements.stage.classList.add("is-revealed");
  elements.stage.setAttribute("aria-label", `${app.current.name}がかくれていました。カーテンが閉じるまで待ってね`);
  elements.liveMessage.textContent = `${app.current.name}が でてきたよ！`;
  playCharacterSound(app.current);
  clearCloseTimer();
  app.closeTimer = window.setTimeout(closeCurtains, SETTINGS.revealDuration);
}

async function playCharacterSound(character) {
  if (!app.soundOn) return;
  stopAllSound();
  const audio = new Audio(character.sound);
  audio.volume = 0.58;
  app.audio = audio;
  audio.addEventListener("error", () => speakFallback(character.speech), { once: true });
  try { await audio.play(); } catch (error) { speakFallback(character.speech); }
}

function speakFallback(text) {
  if (!app.soundOn || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 0.82;
  utterance.pitch = 1.15;
  utterance.volume = 0.62;
  window.speechSynthesis.speak(utterance);
}

function createSparkles() {
  elements.sparkles.replaceChildren();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const count = reduced ? 3 : 7;
  const colors = ["#f7c843", "#ef7e79", "#72c8c5", "#f3a3bd", "#ffffff"];
  for (let index = 0; index < count; index += 1) {
    const spark = document.createElement("span");
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const distance = 95 + (index % 3) * 28;
    spark.className = "spark";
    spark.textContent = index % 2 ? "●" : "★";
    spark.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    spark.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    spark.style.setProperty("--delay", `${index * 45}ms`);
    spark.style.setProperty("--spark-color", colors[index % colors.length]);
    elements.sparkles.append(spark);
  }
}

function closeCurtains() {
  if (app.state !== "revealed") return;
  app.state = "closing";
  elements.stage.classList.remove("is-revealed", "is-open");
  elements.liveMessage.textContent = "";
  clearTransitionTimer();
  app.transitionTimer = window.setTimeout(resetRound, getCurtainDuration() + SETTINGS.safetyBuffer);
}

function resetRound() {
  if (app.state !== "closing") return;
  elements.sparkles.replaceChildren();
  prepareNextRound();
}

function toggleSound(event) {
  event.stopPropagation();
  app.soundOn = !app.soundOn;
  elements.soundButton.classList.toggle("is-on", app.soundOn);
  elements.soundButton.setAttribute("aria-pressed", String(app.soundOn));
  elements.soundButton.setAttribute("aria-label", app.soundOn ? "音声をオフにする" : "音声をオンにする");
  elements.soundIcon.textContent = app.soundOn ? "🔊" : "🔇";
  if (!app.soundOn) stopAllSound();
}

function updatePlayCount() {
  elements.instruction.textContent = "もういちど タッチ！";
  elements.playCount.textContent = `${app.playCount}かい みつけたね！`;
}

function showLoadedImage() {
  elements.characterImage.classList.add("is-loaded");
  elements.characterWrap.classList.add("is-image");
}

function showEmojiFallback() {
  elements.characterImage.classList.remove("is-loaded");
  elements.characterWrap.classList.remove("is-image");
}

function stopAllSound() {
  if (app.audio) { app.audio.pause(); app.audio.currentTime = 0; app.audio = null; }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function clearCloseTimer() { if (app.closeTimer !== null) { clearTimeout(app.closeTimer); app.closeTimer = null; } }
function clearTransitionTimer() { if (app.transitionTimer !== null) { clearTimeout(app.transitionTimer); app.transitionTimer = null; } }

function handleVisibilityChange() {
  if (document.hidden) {
    clearCloseTimer();
    clearTransitionTimer();
    stopAllSound();
  } else if (app.state !== "closed") {
    elements.stage.classList.remove("is-revealed", "is-open");
    prepareNextRound();
  }
}

function cleanupApp() { clearCloseTimer(); clearTransitionTimer(); stopAllSound(); }

document.addEventListener("DOMContentLoaded", initializeApp, { once: true });
