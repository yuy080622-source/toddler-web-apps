(() => {
  "use strict";

  const canvas = document.getElementById("water-canvas");
  const playArea = document.getElementById("play-area");
  const spoutTip = document.getElementById("spout-tip");
  const status = document.getElementById("status");
  const context = canvas.getContext("2d");
  const reduceQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const pointers = new Set();

  let width = 1;
  let height = 1;
  let dpr = 1;
  let originX = 136;
  let originY = 148;
  let poolLevel = 0;
  let flowStrength = 0;
  let hasInteracted = false;
  let reducedMotion = reduceQuery.matches;
  let running = false;
  let frameId = 0;
  let lastTime = 0;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function updateOrigin() {
    const rect = spoutTip.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    originY = rect.bottom - 2;
  }

  function resize() {
    const rect = playArea.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    updateOrigin();
    draw(performance.now());
  }

  function setFlowing(flowing) {
    playArea.classList.toggle("is-flowing", flowing);
    status.textContent = flowing ? "お水が出ています" : "お水が止まりました";
  }

  function onPointerDown(event) {
    event.preventDefault();
    if (!hasInteracted) {
      hasInteracted = true;
      playArea.classList.toggle("has-interacted", true);
    }
    pointers.add(event.pointerId);
    try { playArea.setPointerCapture(event.pointerId); } catch (_) { /* capture is optional */ }
    if (pointers.size === 1) setFlowing(true);
  }

  function endPointer(event) {
    const hadPointers = pointers.size > 0;
    pointers.delete(event.pointerId);
    if (hadPointers && pointers.size === 0) setFlowing(false);
  }

  function clearInput() {
    if (pointers.size) setFlowing(false);
    pointers.clear();
    flowStrength = 0;
  }

  function update(dt) {
    const flowing = pointers.size > 0;
    const rise = reducedMotion ? 7 : 10;
    const fall = reducedMotion ? 9 : 12;
    flowStrength = clamp(flowStrength + (flowing ? rise : -fall) * dt, 0, 1);
    if (flowing) poolLevel = clamp(poolLevel + dt * 0.2125, 0, 1);
    else poolLevel = clamp(poolLevel - dt * 0.036, 0, 1);
  }

  function poolGeometry() {
    const minRadiusX = Math.min(68, width * 0.26);
    const maxRadiusX = Math.min(width * 0.43, 300);
    const radiusX = minRadiusX + (maxRadiusX - minRadiusX) * poolLevel;
    const minRadiusY = Math.min(14, height * 0.045);
    const maxRadiusY = Math.min(54, height * 0.08);
    const radiusY = minRadiusY + (maxRadiusY - minRadiusY) * poolLevel;
    const desiredCenterX = originX + (width - originX) * (0.10 + poolLevel * 0.18);
    const centerX = clamp(desiredCenterX, radiusX + 12, width - radiusX - 12);
    const centerY = height - radiusY - 12;
    return {
      centerX,
      centerY,
      radiusX,
      radiusY,
      surfaceY: centerY - radiusY + 2
    };
  }

  function drawPool(now) {
    if (poolLevel <= 0.001) return;
    const pool = poolGeometry();
    const breathe = reducedMotion ? 0 : Math.sin(now * 0.0015) * 1.4 * poolLevel;
    const gradient = context.createLinearGradient(0, pool.centerY - pool.radiusY, 0, pool.centerY + pool.radiusY);
    gradient.addColorStop(0, `rgba(91, 196, 224, ${0.34 + poolLevel * 0.18})`);
    gradient.addColorStop(1, `rgba(46, 160, 211, ${0.55 + poolLevel * 0.16})`);
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(pool.centerX, pool.centerY, pool.radiusX + breathe, pool.radiusY, 0, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = 0.28;
    context.strokeStyle = "#4cb6d8";
    context.lineWidth = 2;
    context.stroke();

    context.globalAlpha = 0.42;
    context.strokeStyle = "#d9f8ff";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.beginPath();
    context.ellipse(
      pool.centerX - pool.radiusX * 0.12,
      pool.centerY - pool.radiusY * 0.10,
      pool.radiusX * 0.62,
      pool.radiusY * 0.55,
      -0.04,
      Math.PI * 1.08,
      Math.PI * 1.78
    );
    context.stroke();
    context.globalAlpha = 1;
  }

  function drawStream(now) {
    if (flowStrength <= 0.005) return;
    const surfaceY = poolGeometry().surfaceY;
    const streamBottom = Math.max(originY + 4, surfaceY + 3);
    const wobble = reducedMotion ? 0 : Math.sin(now * 0.006) * 3.2 * flowStrength;
    const streamWidth = (18 + Math.min(width, height) * 0.012) * flowStrength;
    const gradient = context.createLinearGradient(originX - streamWidth, 0, originX + streamWidth, 0);
    gradient.addColorStop(0, "rgba(101, 207, 236, .62)");
    gradient.addColorStop(0.46, "rgba(181, 240, 250, .90)");
    gradient.addColorStop(1, "rgba(47, 168, 216, .72)");
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(originX - streamWidth * 0.48, originY);
    context.bezierCurveTo(
      originX - streamWidth * 0.60 + wobble, originY + (streamBottom - originY) * 0.34,
      originX - streamWidth * 0.45 - wobble, originY + (streamBottom - originY) * 0.70,
      originX - streamWidth * 0.34, streamBottom
    );
    context.lineTo(originX + streamWidth * 0.34, streamBottom);
    context.bezierCurveTo(
      originX + streamWidth * 0.42 - wobble, originY + (streamBottom - originY) * 0.70,
      originX + streamWidth * 0.60 + wobble, originY + (streamBottom - originY) * 0.34,
      originX + streamWidth * 0.48, originY
    );
    context.closePath();
    context.fill();

    context.globalAlpha = reducedMotion ? 0.26 : 0.42;
    context.strokeStyle = "#f4feff";
    context.lineWidth = Math.max(2, streamWidth * 0.14);
    context.beginPath();
    context.moveTo(originX - streamWidth * 0.13, originY + 8);
    context.bezierCurveTo(originX + wobble * 0.4, originY + 74, originX - wobble * 0.3, streamBottom - 65, originX - streamWidth * 0.05, streamBottom - 10);
    context.stroke();
    context.globalAlpha = 1;

    if (!reducedMotion && flowStrength > 0.45) {
      for (let index = 0; index < 3; index += 1) {
        const phase = (now * 0.0022 + index * 2.1) % (Math.PI * 2);
        context.globalAlpha = 0.2 + index * 0.07;
        context.fillStyle = "#72d1eb";
        context.beginPath();
        context.arc(originX + Math.sin(phase) * (16 + index * 7), surfaceY - 5 - Math.abs(Math.cos(phase)) * 11, 2.5 + index * 0.7, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    }
  }

  function drawLandingRipples(now) {
    if (reducedMotion || !pointers.size || flowStrength < 0.18 || poolLevel < 0.005) return;
    const pool = poolGeometry();
    const impactX = clamp(originX, pool.centerX - pool.radiusX * 0.76, pool.centerX + pool.radiusX * 0.76);
    const phase = (now % 1600) / 1600;
    context.strokeStyle = "#d9f8ff";
    context.lineWidth = 1.7;
    for (let index = 0; index < 2; index += 1) {
      const ripplePhase = (phase + index * 0.5) % 1;
      context.globalAlpha = flowStrength * (1 - ripplePhase) * (index ? 0.13 : 0.18);
      context.beginPath();
      context.ellipse(
        impactX,
        pool.surfaceY + 3,
        11 + ripplePhase * 12,
        3.5 + ripplePhase * 2.4,
        0,
        0,
        Math.PI * 2
      );
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  function draw(now = performance.now()) {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    drawPool(now);
    drawStream(now);
    drawLandingRipples(now);
  }

  function frame(now) {
    if (!running) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.034) : 1 / 60;
    lastTime = now;
    update(dt);
    draw(now);
    frameId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || document.hidden) return;
    running = true;
    lastTime = 0;
    frameId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    lastTime = 0;
    clearInput();
  }

  playArea.addEventListener("pointerdown", onPointerDown);
  playArea.addEventListener("pointerup", endPointer);
  playArea.addEventListener("pointercancel", endPointer);
  playArea.addEventListener("lostpointercapture", endPointer);
  playArea.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else { resize(); start(); }
  });
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", () => { resize(); start(); });
  reduceQuery.addEventListener("change", (event) => { reducedMotion = event.matches; });

  resize();
  start();

  window.__FAUCET_WATER_DEBUG__ = Object.freeze({
    snapshot: () => ({
      pointerCount: pointers.size,
      flowing: pointers.size > 0,
      hasInteracted,
      flowStrength,
      poolLevel,
      reducedMotion,
      running,
      framePending: frameId ? 1 : 0,
      width,
      height,
      originX,
      originY,
      poolBounds: (() => {
        const pool = poolGeometry();
        return {
          left: pool.centerX - pool.radiusX,
          right: pool.centerX + pool.radiusX,
          top: pool.centerY - pool.radiusY,
          bottom: pool.centerY + pool.radiusY
        };
      })()
    })
  });
})();
