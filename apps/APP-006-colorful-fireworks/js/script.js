(() => {
  "use strict";

  const canvas = document.getElementById("fireworksCanvas");
  const app = document.getElementById("app");
  const guide = document.getElementById("guide");
  const soundButton = document.getElementById("soundButton");
  const soundIcon = document.getElementById("soundIcon");
  const canvasError = document.getElementById("canvasError");

  const MAX_PARTICLES = 200;
  const NORMAL_PARTICLE_COUNT = 36;
  const REDUCED_PARTICLE_COUNT = 18;
  const MAX_PIXEL_RATIO = 2;
  const MAX_CONCURRENT_SOUNDS = 4;
  const SOUND_STORAGE_KEY = "colorfulFireworksSound";

  const COLOR_PALETTES = [
    ["#ff78b5", "#ffe46e", "#fff1c7"],
    ["#72dcff", "#9c94ff", "#d7b8ff"],
    ["#78e6a0", "#c8f36d", "#fffdf2"],
    ["#ff9d5c", "#ffe06b", "#ff82b7"]
  ];

  let context = null;
  let particles = [];
  let animationFrameId = null;
  let previousTime = 0;
  let isRunning = false;
  let isDestroyed = false;
  let soundEnabled = loadSoundPreference();
  let audioContext = null;
  let pendingSoundCount = 0;
  const activeSoundNodes = new Set();
  let resizeFrameId = null;
  let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function initializeCanvas() {
    if (!canvas || !canvas.getContext) {
      showCanvasError();
      return false;
    }

    context = canvas.getContext("2d");
    if (!context) {
      showCanvasError();
      return false;
    }

    resizeCanvas();
    return true;
  }

  function showCanvasError() {
    if (canvasError) canvasError.hidden = false;
  }

  function resizeCanvas() {
    if (!context) return;

    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function scheduleCanvasResize() {
    window.cancelAnimationFrame(resizeFrameId);
    resizeFrameId = window.requestAnimationFrame(resizeCanvas);
  }

  function getPointerPosition(event) {
    const rectangle = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rectangle.left,
      y: event.clientY - rectangle.top
    };
  }

  function randomBetween(minimum, maximum) {
    return minimum + Math.random() * (maximum - minimum);
  }

  function chooseRandomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function createFirework(x, y) {
    if (!context || !isRunning) return;

    const palette = chooseRandomItem(COLOR_PALETTES);
    const particleCount = reducedMotion ? REDUCED_PARTICLE_COUNT : NORMAL_PARTICLE_COUNT;
    const newParticles = [];

    for (let index = 0; index < particleCount; index += 1) {
      const angle = (Math.PI * 2 * index) / particleCount + randomBetween(-0.12, 0.12);
      const speed = randomBetween(reducedMotion ? 1.5 : 2.1, reducedMotion ? 3.5 : 5.4);
      const lifetime = randomBetween(reducedMotion ? 380 : 650, reducedMotion ? 650 : 1050);

      newParticles.push({
        x,
        y,
        previousX: x,
        previousY: y,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        size: randomBetween(1.8, 4.2),
        color: chooseRandomItem(palette),
        age: 0,
        lifetime,
        hasTrail: !reducedMotion && Math.random() < 0.38
      });
    }

    particles.push(...newParticles);
    if (particles.length > MAX_PARTICLES) {
      particles.splice(0, particles.length - MAX_PARTICLES);
    }

    hideGuide();
    playPopSound();
  }

  function updateParticles(deltaTime) {
    const frameScale = Math.min(deltaTime / 16.67, 2);
    const drag = Math.pow(0.982, frameScale);
    const gravity = (reducedMotion ? 0.035 : 0.055) * frameScale;

    for (const particle of particles) {
      particle.previousX = particle.x;
      particle.previousY = particle.y;
      particle.velocityX *= drag;
      particle.velocityY = particle.velocityY * drag + gravity;
      particle.x += particle.velocityX * frameScale;
      particle.y += particle.velocityY * frameScale;
      particle.age += deltaTime;
    }

    particles = particles.filter((particle) => particle.age < particle.lifetime);
  }

  function drawParticles() {
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const particle of particles) {
      const lifeProgress = particle.age / particle.lifetime;
      const opacity = Math.max(0, (1 - lifeProgress) ** 1.35);
      const currentSize = particle.size * (1 - lifeProgress * 0.28);

      context.save();
      context.globalAlpha = opacity;
      context.fillStyle = particle.color;
      context.shadowBlur = reducedMotion ? 5 : 9;
      context.shadowColor = particle.color;

      if (particle.hasTrail) {
        context.strokeStyle = particle.color;
        context.lineWidth = Math.max(1, currentSize * 0.55);
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(particle.previousX, particle.previousY);
        context.lineTo(particle.x - particle.velocityX * 1.8, particle.y - particle.velocityY * 1.8);
        context.stroke();
      }

      context.beginPath();
      context.arc(particle.x, particle.y, Math.max(0.5, currentSize), 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function animationLoop(currentTime) {
    if (!isRunning || !context) return;

    const deltaTime = previousTime ? Math.min(currentTime - previousTime, 34) : 16.67;
    previousTime = currentTime;
    updateParticles(deltaTime);
    drawParticles();
    animationFrameId = window.requestAnimationFrame(animationLoop);
  }

  function hideGuide() {
    if (!guide.classList.contains("is-hidden")) {
      guide.classList.add("is-hidden");
      guide.setAttribute("aria-hidden", "true");
    }
  }

  function loadSoundPreference() {
    try {
      return window.localStorage.getItem(SOUND_STORAGE_KEY) !== "off";
    } catch (error) {
      return true;
    }
  }

  function saveSoundPreference() {
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, soundEnabled ? "on" : "off");
    } catch (error) {
      // 保存できない環境でも、そのページを開いている間は切り替えを有効にします。
    }
  }

  function updateSoundButton() {
    soundButton.setAttribute("aria-pressed", String(soundEnabled));
    soundButton.setAttribute("aria-label", soundEnabled ? "音をオフにする" : "音をオンにする");
    soundIcon.textContent = soundEnabled ? "🔊" : "🔇";
  }

  async function prepareAudio() {
    if (!soundEnabled) return null;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      if (!audioContext) audioContext = new AudioContextClass();
      if (audioContext.state === "suspended") await audioContext.resume();
      return audioContext;
    } catch (error) {
      return null;
    }
  }

  async function playPopSound() {
    if (!soundEnabled || document.hidden || activeSoundNodes.size + pendingSoundCount >= MAX_CONCURRENT_SOUNDS) return;

    pendingSoundCount += 1;
    const activeAudioContext = await prepareAudio();
    pendingSoundCount -= 1;
    if (!activeAudioContext || !soundEnabled || document.hidden || activeSoundNodes.size >= MAX_CONCURRENT_SOUNDS) return;

    try {
      const now = activeAudioContext.currentTime;
      const oscillator = activeAudioContext.createOscillator();
      const gain = activeAudioContext.createGain();
      const filter = activeAudioContext.createBiquadFilter();

      activeSoundNodes.add(oscillator);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(230, now);
      oscillator.frequency.exponentialRampToValueAtTime(135, now + 0.28);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(850, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(activeAudioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.31);
      oscillator.addEventListener("ended", () => {
        activeSoundNodes.delete(oscillator);
        oscillator.disconnect();
        filter.disconnect();
        gain.disconnect();
      }, { once: true });
    } catch (error) {
      // 音の生成に失敗しても、花火のアニメーションは続けます。
    }
  }

  function toggleSound(event) {
    event.preventDefault();
    event.stopPropagation();
    soundEnabled = !soundEnabled;
    saveSoundPreference();
    updateSoundButton();

    if (soundEnabled && !document.hidden) prepareAudio();
  }

  function handlePointerDown(event) {
    if (!event.isPrimary && event.pointerType !== "touch") return;
    event.preventDefault();
    const position = getPointerPosition(event);
    createFirework(position.x, position.y);
  }

  function handleKeyboard(event) {
    if (event.target === soundButton) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    createFirework(window.innerWidth / 2, window.innerHeight / 2);
  }

  function handleMotionPreferenceChange(event) {
    reducedMotion = event.matches;
  }

  function stopActiveSounds() {
    for (const oscillator of activeSoundNodes) {
      try {
        oscillator.stop();
      } catch (error) {
        // すでに停止したノードはそのまま終了処理へ任せます。
      }
    }
    activeSoundNodes.clear();
  }

  function pauseAnimation() {
    isRunning = false;
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    previousTime = 0;
    particles = [];
    if (context) context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    stopActiveSounds();

    if (audioContext && audioContext.state === "running") {
      audioContext.suspend().catch(() => {});
    }
  }

  function startAnimation() {
    if (isDestroyed || isRunning || !context || document.hidden) return;
    isRunning = true;
    previousTime = 0;
    animationFrameId = window.requestAnimationFrame(animationLoop);
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      pauseAnimation();
    } else {
      startAnimation();
    }
  }

  function cleanUp() {
    isDestroyed = true;
    pauseAnimation();
    window.cancelAnimationFrame(resizeFrameId);

    if (audioContext && audioContext.state !== "closed") {
      audioContext.close().catch(() => {});
    }
  }

  function handlePageHide(event) {
    if (event.persisted) {
      pauseAnimation();
    } else {
      cleanUp();
    }
  }

  function handlePageShow(event) {
    if (event.persisted && !isDestroyed) startAnimation();
  }

  function addEventListeners() {
    canvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
    soundButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    soundButton.addEventListener("click", toggleSound);
    app.addEventListener("keydown", handleKeyboard);
    window.addEventListener("resize", scheduleCanvasResize);
    window.addEventListener("orientationchange", scheduleCanvasResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionPreference.addEventListener) {
      motionPreference.addEventListener("change", handleMotionPreferenceChange);
    }
  }

  if (initializeCanvas()) {
    addEventListeners();
    updateSoundButton();
    startAnimation();
    app.focus({ preventScroll: true });
  }
})();
