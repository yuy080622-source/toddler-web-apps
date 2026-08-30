(() => {
  "use strict";

  const canvas = document.getElementById("liquid-canvas");
  const playArea = document.getElementById("play-area");
  const permissionButton = document.getElementById("motion-permission");
  const status = document.getElementById("status");
  const context = canvas.getContext("2d", { alpha: false });
  const reduceQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const colors = ["#ff7a8a", "#42bfc2", "#f4c84d"];
  const pointers = new Map();
  const force = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let blobs = [];
  let width = 1;
  let height = 1;
  let dpr = 1;
  let frameId = 0;
  let lastTime = 0;
  let running = false;
  let reducedMotion = reduceQuery.matches;
  let sensorState = "checking";
  let validSensorSamples = 0;
  let invalidSensorSamples = 0;
  let permissionRequested = false;
  let sensorTimer = 0;
  let holdStart = 0;
  let holdActive = false;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function announce(message) {
    status.textContent = message;
  }

  function makeBlobs() {
    const base = clamp(Math.min(width, height) * 0.17, 62, 126);
    const starts = [
      [0.25, 0.28, 1],
      [0.70, 0.48, 0.9],
      [0.38, 0.76, 0.82]
    ];
    blobs = starts.map(([px, py, scale], index) => ({
      x: width * px,
      y: height * py,
      vx: 0,
      vy: 0,
      radius: base * scale,
      color: colors[index],
      contact: 0,
      wallContact: 0,
      shapeAngle: 0,
      stretch: 0,
      wobble: 0,
      tailLag: 0,
      idlePhase: index * 2.17,
      idleX: 0,
      idleY: 0
    }));
    keepInside();
  }

  function resize() {
    const oldWidth = width;
    const oldHeight = height;
    const rect = playArea.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!blobs.length) {
      makeBlobs();
    } else {
      const scaleX = width / oldWidth;
      const scaleY = height / oldHeight;
      blobs.forEach((blob) => {
        blob.x *= scaleX;
        blob.y *= scaleY;
        blob.radius = clamp(Math.min(width, height) * (0.17 - blobs.indexOf(blob) * 0.014), 56, 126);
      });
      keepInside();
    }
    draw();
  }

  function keepInside() {
    blobs.forEach((blob) => {
      const margin = Math.min(blob.radius, Math.min(width, height) * 0.44);
      blob.x = clamp(blob.x, margin, Math.max(margin, width - margin));
      blob.y = clamp(blob.y, margin, Math.max(margin, height - margin));
    });
  }

  function orientationAngle() {
    if (screen.orientation && Number.isFinite(screen.orientation.angle)) return screen.orientation.angle;
    return Number.isFinite(window.orientation) ? window.orientation : 0;
  }

  function handleOrientation(event) {
    const beta = Number(event.beta);
    const gamma = Number(event.gamma);
    if (!Number.isFinite(beta) || !Number.isFinite(gamma) || Math.abs(beta) > 180 || Math.abs(gamma) > 90) {
      invalidSensorSamples += 1;
      if (invalidSensorSamples > 30 && validSensorSamples < 3) useFallback("センサーを使えないため、長押しで遊べます");
      return;
    }
    invalidSensorSamples = 0;
    validSensorSamples += 1;
    const angle = ((orientationAngle() % 360) + 360) % 360;
    let x = gamma;
    let y = beta;
    if (angle === 90) [x, y] = [-beta, gamma];
    else if (angle === 270) [x, y] = [beta, -gamma];
    else if (angle === 180) [x, y] = [-gamma, -beta];
    const normalize = (value) => {
      const limited = clamp(value, -32, 32);
      if (Math.abs(limited) < 2.5) return 0;
      return (limited - Math.sign(limited) * 2.5) / 29.5;
    };
    tilt.targetX = normalize(x);
    tilt.targetY = normalize(y);
    sensorState = "active";
    permissionButton.hidden = true;
    clearTimeout(sensorTimer);
  }

  function listenForSensor() {
    window.addEventListener("deviceorientation", handleOrientation, true);
    clearTimeout(sensorTimer);
    sensorTimer = window.setTimeout(() => {
      if (validSensorSamples < 3) useFallback("長押しすると液体が指へ寄ります");
    }, 2500);
  }

  function useFallback(message) {
    if (sensorState !== "active") sensorState = "fallback";
    tilt.targetX = 0;
    tilt.targetY = 0;
    announce(message);
  }

  async function requestMotionPermission(event) {
    event.stopPropagation();
    if (permissionRequested) return;
    permissionRequested = true;
    permissionButton.disabled = true;
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      permissionButton.hidden = true;
      if (result === "granted") {
        sensorState = "checking";
        listenForSensor();
        announce("端末をかたむけて遊べます");
      } else {
        useFallback("長押しすると液体が指へ寄ります");
      }
    } catch (_) {
      permissionButton.hidden = true;
      useFallback("長押しすると液体が指へ寄ります");
    }
  }

  function setupSensor() {
    if (!("DeviceOrientationEvent" in window)) {
      useFallback("長押しすると液体が指へ寄ります");
      return;
    }
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      sensorState = "permission";
      permissionButton.hidden = false;
      announce("長押しでも遊べます");
      return;
    }
    listenForSensor();
  }

  function pointerCentroid() {
    let x = 0;
    let y = 0;
    pointers.forEach((point) => { x += point.x; y += point.y; });
    const count = Math.max(1, pointers.size);
    return { x: x / count, y: y / count };
  }

  function onPointerDown(event) {
    if (event.target === permissionButton) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { playArea.setPointerCapture(event.pointerId); } catch (_) { /* capture is optional */ }
    if (pointers.size === 1) holdStart = performance.now();
  }

  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function endPointer(event) {
    pointers.delete(event.pointerId);
    if (!pointers.size) {
      holdActive = false;
      holdStart = 0;
    }
  }

  function updateForce(now) {
    const smooth = reducedMotion ? 0.035 : 0.065;
    tilt.x += (tilt.targetX - tilt.x) * smooth;
    tilt.y += (tilt.targetY - tilt.y) * smooth;
    if (pointers.size && holdStart && now - holdStart >= 180) holdActive = true;
    let targetX = tilt.x;
    let targetY = tilt.y;
    if (holdActive) {
      const point = pointerCentroid();
      const cx = blobs.reduce((sum, blob) => sum + blob.x, 0) / blobs.length;
      const cy = blobs.reduce((sum, blob) => sum + blob.y, 0) / blobs.length;
      const dx = point.x - cx;
      const dy = point.y - cy;
      const length = Math.hypot(dx, dy) || 1;
      const strength = Math.min(1, length / Math.max(120, Math.min(width, height) * 0.45));
      targetX = dx / length * strength;
      targetY = dy / length * strength;
    }
    const response = reducedMotion ? 0.08 : 0.16;
    force.x += (targetX - force.x) * response;
    force.y += (targetY - force.y) * response;
  }

  function resolveContacts() {
    blobs.forEach((blob) => {
      blob.contact *= 0.86;
      blob.wallContact *= 0.84;
    });
    for (let i = 0; i < blobs.length; i += 1) {
      for (let j = i + 1; j < blobs.length; j += 1) {
        const a = blobs[i];
        const b = blobs[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);
        if (distance < 0.001) { dx = 1; dy = 0; distance = 1; }
        const desired = (a.radius + b.radius) * 0.9;
        if (distance >= desired) continue;
        const overlap = desired - distance;
        const nx = dx / distance;
        const ny = dy / distance;
        const correction = overlap * 0.14;
        a.x -= nx * correction;
        a.y -= ny * correction;
        b.x += nx * correction;
        b.y += ny * correction;
        a.vx -= nx * correction * 1.7;
        a.vy -= ny * correction * 1.7;
        b.vx += nx * correction * 1.7;
        b.vy += ny * correction * 1.7;
        const compression = clamp(overlap / desired, 0, 0.24);
        a.contact = Math.max(a.contact, compression);
        b.contact = Math.max(b.contact, compression);
      }
    }
  }

  function update(dt, now) {
    updateForce(now);
    const motionScale = reducedMotion ? 0.42 : 1;
    const acceleration = (reducedMotion ? 48 : 72) * motionScale;
    const damping = reducedMotion ? 0.935 : 0.968;
    const maxSpeed = reducedMotion ? 36 : 126;
    blobs.forEach((blob) => {
      blob.vx += force.x * acceleration * dt;
      blob.vy += force.y * acceleration * dt;
      blob.vx *= Math.pow(damping, dt * 60);
      blob.vy *= Math.pow(damping, dt * 60);
      const speed = Math.hypot(blob.vx, blob.vy);
      if (speed > maxSpeed) {
        blob.vx = blob.vx / speed * maxSpeed;
        blob.vy = blob.vy / speed * maxSpeed;
      }
      blob.x += blob.vx * dt;
      blob.y += blob.vy * dt;
      const margin = blob.radius;
      if (blob.x < margin || blob.x > width - margin) {
        blob.x = clamp(blob.x, margin, width - margin);
        blob.vx *= reducedMotion ? -0.12 : -0.25;
        blob.wallContact = Math.max(blob.wallContact, reducedMotion ? 0.035 : 0.18);
      }
      if (blob.y < margin || blob.y > height - margin) {
        blob.y = clamp(blob.y, margin, height - margin);
        blob.vy *= reducedMotion ? -0.12 : -0.25;
        blob.wallContact = Math.max(blob.wallContact, reducedMotion ? 0.035 : 0.18);
      }
    });
    resolveContacts();
    keepInside();
    updateShapes(now);
  }

  function angleDifference(target, current) {
    return Math.atan2(Math.sin(target - current), Math.cos(target - current));
  }

  function updateShapes(now) {
    blobs.forEach((blob) => {
      const speed = Math.hypot(blob.vx, blob.vy);
      const moving = speed > 1.2;
      const targetAngle = moving ? Math.atan2(blob.vy, blob.vx) : blob.shapeAngle;
      const turn = angleDifference(targetAngle, blob.shapeAngle);
      const angleResponse = reducedMotion ? 0.045 : 0.058;
      blob.shapeAngle += turn * angleResponse;
      const accelerationPull = reducedMotion ? 0 : clamp(Math.hypot(force.x, force.y) * 0.055, 0, 0.055);
      const targetStretch = reducedMotion
        ? clamp(speed / 600, 0, 0.075)
        : clamp(speed / 245 + accelerationPull + Math.abs(turn) * 0.018, 0, 0.42);
      const stretchResponse = targetStretch > blob.stretch ? (reducedMotion ? 0.045 : 0.105) : (reducedMotion ? 0.025 : 0.032);
      blob.stretch += (targetStretch - blob.stretch) * stretchResponse;
      const turnWobble = reducedMotion ? 0 : clamp(turn * Math.min(speed / 75, 1) * 0.09, -0.13, 0.13);
      blob.wobble += (turnWobble - blob.wobble) * (Math.abs(turnWobble) > Math.abs(blob.wobble) ? 0.11 : 0.042);
      const targetTail = reducedMotion ? 0 : clamp(Math.abs(turn) * Math.min(speed / 70, 1) * 0.12 + blob.stretch * 0.22, 0, 0.18);
      blob.tailLag += (targetTail - blob.tailLag) * (targetTail > blob.tailLag ? 0.075 : 0.026);
      const idleAmount = reducedMotion ? 0.008 : 0.026;
      const idleTargetX = Math.sin(now / 1450 + blob.idlePhase) * idleAmount;
      const idleTargetY = Math.sin(now / 1900 + blob.idlePhase * 1.43) * idleAmount * 0.72;
      blob.idleX += (idleTargetX - blob.idleX) * 0.018;
      blob.idleY += (idleTargetY - blob.idleY) * 0.018;
    });
  }

  function drawBlob(blob) {
    const squash = (blob.contact + blob.wallContact) * (reducedMotion ? 0.28 : 1);
    const stretch = blob.stretch;
    const front = blob.radius * (1 + stretch * 1.82 - squash * 0.32 + blob.idleX);
    const back = blob.radius * (1 + stretch * 0.52 + blob.tailLag + squash * 0.24 - blob.idleX * 0.45);
    const vertical = blob.radius * (1 - stretch * 0.46 + squash * 0.82 + blob.idleY);
    const wobble = blob.wobble * blob.radius;
    context.save();
    context.translate(blob.x, blob.y);
    context.rotate(blob.shapeAngle);
    context.shadowColor = "rgba(38, 83, 74, .16)";
    context.shadowBlur = reducedMotion ? 8 : 15;
    context.shadowOffsetY = 6;
    const gradient = context.createRadialGradient(-back * 0.22, -vertical * 0.34, blob.radius * 0.08, 0, 0, Math.max(front, vertical));
    gradient.addColorStop(0, "rgba(255,255,255,.86)");
    gradient.addColorStop(0.16, blob.color);
    gradient.addColorStop(1, blob.color);
    context.globalAlpha = 0.9;
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(front, 0);
    context.bezierCurveTo(front, -vertical * 0.552, front * 0.552, -vertical, wobble * 0.35, -vertical);
    context.bezierCurveTo(-back * 0.50 + wobble, -vertical, -back, -vertical * 0.50, -back, wobble * 0.18);
    context.bezierCurveTo(-back, vertical * 0.58, -back * 0.52 - wobble, vertical, -wobble * 0.45, vertical);
    context.bezierCurveTo(front * 0.552, vertical, front, vertical * 0.552, front, 0);
    context.closePath();
    context.fill();
    context.shadowColor = "transparent";
    context.globalAlpha = 0.35;
    context.strokeStyle = "white";
    context.lineWidth = Math.max(3, blob.radius * 0.04);
    context.stroke();
    drawFace(blob, front, back, vertical, squash);
    context.restore();
  }

  function drawFace(blob, front, back, vertical, squash) {
    const faceCenter = (front - back) * 0.055 - blob.tailLag * blob.radius * 0.08;
    const eyeGap = blob.radius * (0.25 + blob.stretch * 0.46);
    const eyeY = -vertical * 0.08;
    const eyeRadiusX = Math.max(2.4, blob.radius * 0.038 * (1 + blob.stretch * 0.22));
    const eyeRadiusY = Math.max(2.2, blob.radius * 0.046 * (1 - squash * 0.65));
    context.globalAlpha = 0.58;
    context.fillStyle = "#244a45";
    context.beginPath();
    context.ellipse(faceCenter - eyeGap, eyeY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
    context.ellipse(faceCenter + eyeGap, eyeY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
    context.fill();
    const mouthY = vertical * 0.18;
    const mouthWidth = blob.radius * (0.15 + blob.stretch * 0.18);
    const surprise = clamp((blob.contact + blob.wallContact) * 4, 0, 1);
    context.strokeStyle = "#244a45";
    context.lineWidth = Math.max(2, blob.radius * 0.025);
    context.lineCap = "round";
    context.beginPath();
    if (surprise > 0.34) {
      context.ellipse(faceCenter, mouthY, mouthWidth * 0.42, Math.max(2, vertical * 0.035), 0, 0, Math.PI * 2);
    } else {
      context.moveTo(faceCenter - mouthWidth, mouthY);
      context.quadraticCurveTo(faceCenter, mouthY + vertical * 0.085, faceCenter + mouthWidth, mouthY);
    }
    context.stroke();
  }

  function draw() {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#f6fcf8");
    background.addColorStop(1, "#dcefe8");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    blobs.forEach(drawBlob);
  }

  function frame(now) {
    if (!running) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.033) : 1 / 60;
    lastTime = now;
    update(dt, now);
    draw();
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
    pointers.clear();
    holdActive = false;
    holdStart = 0;
  }

  permissionButton.addEventListener("click", requestMotionPermission);
  playArea.addEventListener("pointerdown", onPointerDown);
  playArea.addEventListener("pointermove", onPointerMove);
  playArea.addEventListener("pointerup", endPointer);
  playArea.addEventListener("pointercancel", endPointer);
  playArea.addEventListener("lostpointercapture", endPointer);
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", () => { resize(); start(); });
  reduceQuery.addEventListener("change", (event) => { reducedMotion = event.matches; });

  resize();
  setupSensor();
  start();

  window.__LIQUID_PLAY_DEBUG__ = Object.freeze({
    snapshot: () => ({
      blobCount: blobs.length,
      blobs: blobs.map(({ x, y, vx, vy, radius, contact, wallContact, shapeAngle, stretch, wobble, tailLag, idleX, idleY }) => ({
        x, y, vx, vy, radius, contact, wallContact, shapeAngle, stretch, wobble, tailLag, idleX, idleY
      })),
      force: { ...force },
      sensorState,
      pointerCount: pointers.size,
      holdActive,
      running,
      framePending: frameId ? 1 : 0,
      reducedMotion,
      width,
      height
    }),
    simulateTilt: (x, y) => {
      sensorState = "active";
      tilt.targetX = clamp(Number(x) || 0, -1, 1);
      tilt.targetY = clamp(Number(y) || 0, -1, 1);
    }
  });
})();
