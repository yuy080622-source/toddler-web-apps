const animals = {
  dog: { sound: "assets/sounds/dog.mp3", voice: "わんわん", name: "いぬ" },
  cat: { sound: "assets/sounds/cat.mp3", voice: "にゃー", name: "ねこ" },
  elephant: { sound: "assets/sounds/elephant.mp3", voice: "ぱおーん", name: "ぞう" },
  tiger: { sound: "assets/sounds/tiger.mp3", voice: "がおー", name: "とら" }
};

const soundButton = document.querySelector("#sound-button");
const soundIcon = soundButton.querySelector(".sound-icon");
const message = document.querySelector("#message");
const cards = document.querySelectorAll(".animal-card");
const finishScreen = document.querySelector("#finish-screen");
const parentLockButton = document.querySelector("#parent-lock-button");
const parentPanel = document.querySelector("#parent-panel");
const closePanelButton = document.querySelector("#close-panel-button");
const resumeButton = document.querySelector("#resume-button");
const timeButtons = document.querySelectorAll("[data-minutes]");
const currentSetting = document.querySelector("#current-setting");
const volumeCheck = document.querySelector("#volume-check");
const volumeConfirmButton = document.querySelector("#volume-confirm-button");
const clearStatsButton = document.querySelector("#clear-stats-button");
const todayPlayTime = document.querySelector("#today-play-time");
const todayTouchCount = document.querySelector("#today-touch-count");
const favoriteAnimal = document.querySelector("#favorite-animal");
const countElements = {
  dog: document.querySelector("#dog-count"),
  cat: document.querySelector("#cat-count"),
  elephant: document.querySelector("#elephant-count"),
  tiger: document.querySelector("#tiger-count")
};
const audioPlayers = {};
let soundIsOn = true;
const savedMinutes = localStorage.getItem("animalTouchPlayMinutes");
let playMinutes = savedMinutes === null ? 10 : Number(savedMinutes);
let playTimer = null;
let timerHasStarted = false;
let playHasFinished = false;
let lastSoundTime = 0;
let statsTimer = null;
let stats = loadTodayStats();

function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createEmptyStats() {
  return {
    date: getTodayKey(),
    seconds: 0,
    touches: { dog: 0, cat: 0, elephant: 0, tiger: 0 }
  };
}

function loadTodayStats() {
  try {
    const saved = JSON.parse(localStorage.getItem("animalTouchTodayStats"));
    if (saved && saved.date === getTodayKey()) return saved;
  } catch (error) {
    // 保存内容が壊れている場合は、新しい記録を作ります。
  }
  return createEmptyStats();
}

function saveStats() {
  localStorage.setItem("animalTouchTodayStats", JSON.stringify(stats));
}

function updateStatsDisplay() {
  const totalTouches = Object.values(stats.touches).reduce((sum, count) => sum + count, 0);
  const minutes = Math.floor(stats.seconds / 60);
  const seconds = stats.seconds % 60;
  todayPlayTime.textContent = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
  todayTouchCount.textContent = `${totalTouches}回`;

  Object.entries(countElements).forEach(([key, element]) => {
    element.textContent = `${stats.touches[key]}回`;
  });

  if (totalTouches === 0) {
    favoriteAnimal.textContent = "よく遊んだ動物：まだありません";
    return;
  }

  const highestCount = Math.max(...Object.values(stats.touches));
  const favorites = Object.keys(stats.touches)
    .filter((key) => stats.touches[key] === highestCount)
    .map((key) => animals[key].name);
  favoriteAnimal.textContent = `よく遊んだ動物：${favorites.join("・")}`;
}

function startStatsTimer() {
  if (statsTimer) return;
  statsTimer = setInterval(() => {
    stats.seconds += 1;
    saveStats();
  }, 1000);
}

function stopStatsTimer() {
  clearInterval(statsTimer);
  statsTimer = null;
  saveStats();
}

function recordTouch(animalKey) {
  if (stats.date !== getTodayKey()) stats = createEmptyStats();
  stats.touches[animalKey] += 1;
  saveStats();
}

// 音声ファイルは最初のタッチ時に読み込みます。
Object.entries(animals).forEach(([key, animal]) => {
  const audio = new Audio();
  audio.preload = "none";
  audio.src = animal.sound;
  audioPlayers[key] = audio;
});

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = "ja-JP";
  speech.rate = 0.9;
  speech.pitch = 1.15;
  window.speechSynthesis.speak(speech);
}

function stopAllSounds() {
  Object.values(audioPlayers).forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function playAnimalSound(animalKey) {
  if (!soundIsOn) return;

  const now = Date.now();
  if (now - lastSoundTime < 500) return;
  lastSoundTime = now;

  const animal = animals[animalKey];
  const audio = audioPlayers[animalKey];
  let fallbackWasUsed = false;

  const useFallback = () => {
    if (fallbackWasUsed || !soundIsOn) return;
    fallbackWasUsed = true;
    speak(animal.voice);
  };

  audio.pause();
  audio.currentTime = 0;
  audio.onerror = useFallback;

  const playResult = audio.play();
  if (playResult) playResult.catch(useFallback);
}

function restartAnimation(card) {
  card.classList.remove("is-playing");
  void card.offsetWidth;
  card.classList.add("is-playing");

  clearTimeout(card.animationTimer);
  card.animationTimer = setTimeout(() => {
    card.classList.remove("is-playing");
  }, 1300);
}

function activateAnimal(card) {
  if (playHasFinished || !parentPanel.hidden || !volumeCheck.hidden) return;

  startPlayTimer();
  const animalKey = card.dataset.animal;
  const animal = animals[animalKey];

  startStatsTimer();
  recordTouch(animalKey);
  restartAnimation(card);
  playAnimalSound(animalKey);
  message.textContent = `${animal.name}さん、${animal.voice}！`;
}

function startPlayTimer() {
  if (timerHasStarted || playMinutes === 0) return;

  timerHasStarted = true;
  playTimer = setTimeout(finishPlay, playMinutes * 60 * 1000);
}

function finishPlay() {
  playHasFinished = true;
  clearTimeout(playTimer);
  stopAllSounds();
  stopStatsTimer();
  finishScreen.hidden = false;
  parentLockButton.focus();
}

function resetPlaySession() {
  clearTimeout(playTimer);
  playTimer = null;
  timerHasStarted = false;
  playHasFinished = false;
  finishScreen.hidden = true;
  stopAllSounds();
  stopStatsTimer();
  message.textContent = "どうぶつを さわってみてね";
}

function updateTimeButtons() {
  timeButtons.forEach((button) => {
    const selected = Number(button.dataset.minutes) === playMinutes;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  currentSetting.textContent = playMinutes === 0
    ? "現在の設定：時間制限なし"
    : `現在の設定：${playMinutes}分`;
}

function openParentPanel() {
  stopStatsTimer();
  updateTimeButtons();
  updateStatsDisplay();
  parentPanel.hidden = false;
  document.querySelector(".time-options .is-selected").focus();
}

function closeParentPanel() {
  parentPanel.hidden = true;
  if (playHasFinished) parentLockButton.focus();
  else soundButton.focus();
}

function setUpLongPress(button, onComplete) {
  let holdTimer = null;
  let longPressCompleted = false;

  const startHolding = (event) => {
    longPressCompleted = false;
    button.classList.add("is-holding");
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      longPressCompleted = true;
      button.classList.remove("is-holding");
      onComplete();
    }, 2000);
  };

  const stopHolding = () => {
    clearTimeout(holdTimer);
    button.classList.remove("is-holding");
  };

  button.addEventListener("pointerdown", startHolding);
  button.addEventListener("pointerup", stopHolding);
  button.addEventListener("pointercancel", stopHolding);
  button.addEventListener("pointerleave", stopHolding);
  button.addEventListener("contextmenu", (event) => event.preventDefault());

  button.addEventListener("click", (event) => {
    if (longPressCompleted) {
      event.preventDefault();
      event.stopImmediatePropagation();
      longPressCompleted = false;
    }
  }, true);
}

cards.forEach((card) => {
  card.addEventListener("click", () => activateAnimal(card));

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateAnimal(card);
    }
  });
});

soundButton.addEventListener("click", () => {
  if (!parentPanel.hidden) return;
  soundIsOn = !soundIsOn;
  soundButton.setAttribute("aria-pressed", String(soundIsOn));
  soundButton.setAttribute(
    "aria-label",
    `${soundIsOn ? "音声をオフにする" : "音声をオンにする"}。保護者設定は2秒長押し`
  );
  soundIcon.textContent = soundIsOn ? "🔊" : "🔇";
  message.textContent = soundIsOn ? "おとが でるよ" : "おとは おやすみ";

  if (!soundIsOn) {
    stopAllSounds();
  }
});

setUpLongPress(soundButton, openParentPanel);
setUpLongPress(parentLockButton, openParentPanel);

timeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    playMinutes = Number(button.dataset.minutes);
    localStorage.setItem("animalTouchPlayMinutes", String(playMinutes));
    resetPlaySession();
    updateTimeButtons();
  });
});

resumeButton.addEventListener("click", () => {
  resetPlaySession();
  closeParentPanel();
});

closePanelButton.addEventListener("click", closeParentPanel);

volumeConfirmButton.addEventListener("click", () => {
  localStorage.setItem("animalTouchVolumeCheckedDate", getTodayKey());
  volumeCheck.hidden = true;
  soundButton.focus();
});

clearStatsButton.addEventListener("click", () => {
  stats = createEmptyStats();
  saveStats();
  updateStatsDisplay();
  currentSetting.textContent = "今日の記録を消しました";
});

parentPanel.addEventListener("click", (event) => {
  if (event.target === parentPanel) closeParentPanel();
});

document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("dragstart", (event) => event.preventDefault());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopStatsTimer();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !parentPanel.hidden) closeParentPanel();
  if (event.altKey && event.key.toLowerCase() === "p") {
    event.preventDefault();
    openParentPanel();
  }
});

updateTimeButtons();
updateStatsDisplay();

if (localStorage.getItem("animalTouchVolumeCheckedDate") !== getTodayKey()) {
  volumeCheck.hidden = false;
  volumeConfirmButton.focus();
}
