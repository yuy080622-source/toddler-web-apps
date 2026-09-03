(() => {
  "use strict";

  const canvas = document.getElementById("liquid-canvas");
  const playArea = document.getElementById("play-area");
  const permissionButton = document.getElementById("motion-permission");
  const status = document.getElementById("status");
  const context = canvas.getContext("2d", { alpha: false });
  const reduceQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const colors = [
    { base: "#f06f86", light: "rgba(255, 190, 201, .88)", edge: "rgba(194, 61, 88, .78)" },
    { base: "#35b7bc", light: "rgba(168, 239, 235, .86)", edge: "rgba(21, 126, 139, .76)" },
    { base: "#efc247", light: "rgba(255, 234, 157, .88)", edge: "rgba(199, 143, 34, .76)" }
  ];
  const sizeScales = [1.35, 1, 0.8];
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
  let sensorListenerAttached = false;
  let sensorProbeTimer = 0;
  let sensorFailureTimer = 0;
  let holdStart = 0;
  let holdActive = false;
  let holdSignalStrength = 0;
  const holdPoint = { x: 0, y: 0 };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const baseRadius = () => clamp(Math.min(width, height) * 0.155, 60, 93);

  function announce(message) {
    status.textContent = message;
  }

  function makeBlobs() {
    const starts = [
      [0.26, 0.25],
      [0.72, 0.48],
      [0.38, 0.77]
    ];
    const base = baseRadius();
    blobs = starts.map(([px, py], index) => ({
      x: width * px,
      y: height * py,
      vx: 0,
      vy: 0,
      radius: base * sizeScales[index],
      color: colors[index],
      contact: 0,
      wallContact: 0,
      shapeAngle: 0,
      stretch: 0,
      wobble: 0,
      tailLag: 0,
      turnSoftness: 0,
      jellyPulse: 0,
      faceTilt: 0,
      mouthActivity: 0,
      idlePhase: index * 2.17,
      idleX: 0,
      idleY: 0,
      poolLean: 0,
      organicTop: [0.09, -0.075, 0.065][index],
      organicBottom: [-0.07, 0.085, -0.09][index],
      organicFront: [0.07, 0.03, 0.06][index],
      organicBack: [0.02, 0.08, 0.04][index],
      organicTall: [0.96, 0.93, 0.97][index]
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
        blob.radius = baseRadius() * sizeScales[blobs.indexOf(blob)];
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
    if (document.hidden) return;
    const beta = Number(event.beta);
    const gamma = Number(event.gamma);
    if (!Number.isFinite(beta) || !Number.isFinite(gamma) || Math.abs(beta) > 180 || Math.abs(gamma) > 90) {
      invalidSensorSamples += 1;
      if (invalidSensorSamples > 30) useFallback("センサーを使えないため、長押しで遊べます");
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
    clearSensorTimers();
  }

  function clearSensorTimers() {
    if (sensorProbeTimer) window.clearTimeout(sensorProbeTimer);
    if (sensorFailureTimer) window.clearTimeout(sensorFailureTimer);
    sensorProbeTimer = 0;
    sensorFailureTimer = 0;
  }

  function attachSensorListener() {
    if (sensorListenerAttached) return;
    window.addEventListener("deviceorientation", handleOrientation, true);
    sensorListenerAttached = true;
  }

  function beginSensorCheck({ offerPermission = true } = {}) {
    clearSensorTimers();
    attachSensorListener();
    validSensorSamples = 0;
    invalidSensorSamples = 0;
    sensorState = "checking";
    permissionButton.hidden = true;
    sensorFailureTimer = window.setTimeout(() => {
      sensorFailureTimer = 0;
      if (sensorState === "checking") useFallback("長押しするとジェリーが指へ寄ります");
    }, 2500);
    if (offerPermission && typeof DeviceOrientationEvent.requestPermission === "function") {
      sensorProbeTimer = window.setTimeout(() => {
        sensorProbeTimer = 0;
        if (sensorState !== "checking") return;
        if (permissionRequested) {
          useFallback("長押しするとジェリーが指へ寄ります");
          return;
        }
        if (sensorFailureTimer) window.clearTimeout(sensorFailureTimer);
        sensorFailureTimer = 0;
        sensorState = "permission";
        permissionButton.hidden = false;
        permissionButton.disabled = false;
        announce("長押しでも遊べます");
      }, 600);
    }
  }

  function useFallback(message) {
    sensorState = "fallback";
    clearSensorTimers();
    permissionButton.hidden = true;
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
        beginSensorCheck({ offerPermission: false });
        announce("端末をかたむけて遊べます");
      } else {
        useFallback("長押しするとジェリーが指へ寄ります");
      }
    } catch (_) {
      permissionButton.hidden = true;
      useFallback("長押しするとジェリーが指へ寄ります");
    }
  }

  function setupSensor() {
    clearSensorTimers();
    permissionButton.hidden = true;
    if (!("DeviceOrientationEvent" in window)) {
      useFallback("長押しするとジェリーが指へ寄ります");
      return;
    }
    beginSensorCheck();
  }

  function pointerCentroid() {
    let x = 0;
    let y = 0;
    pointers.forEach((point) => { x += point.x; y += point.y; });
    const count = Math.max(1, pointers.size);
    return { x: x / count, y: y / count };
  }

  function onPointerDown(event) {
    if (event.target === permissionButton || event.target.closest?.("[data-portal-home]")) return;
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
      holdSignalStrength = 0;
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
      holdPoint.x = point.x;
      holdPoint.y = point.y;
      holdSignalStrength += (1 - holdSignalStrength) * (reducedMotion ? 0.055 : 0.11);
      const cx = blobs.reduce((sum, blob) => sum + blob.x, 0) / blobs.length;
      const cy = blobs.reduce((sum, blob) => sum + blob.y, 0) / blobs.length;
      const dx = point.x - cx;
      const dy = point.y - cy;
      const length = Math.hypot(dx, dy) || 1;
      const strength = Math.min(1, length / Math.max(120, Math.min(width, height) * 0.45));
      targetX = dx / length * strength;
      targetY = dy / length * strength;
    } else {
      holdSignalStrength = 0;
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
      const angleResponse = reducedMotion ? 0.035 : 0.048;
      const maximumAngleStep = reducedMotion ? 0.025 : 0.052;
      blob.shapeAngle += clamp(turn * angleResponse, -maximumAngleStep, maximumAngleStep);
      const turnSoftnessTarget = reducedMotion
        ? clamp((Math.abs(turn) - 0.9) / 2.25, 0, 0.22)
        : clamp((Math.abs(turn) - 0.52) / 2.35, 0, 0.68);
      blob.turnSoftness += (turnSoftnessTarget - blob.turnSoftness) * (turnSoftnessTarget > blob.turnSoftness ? 0.14 : 0.045);
      const accelerationPull = reducedMotion ? 0 : clamp(Math.hypot(force.x, force.y) * 0.055, 0, 0.055);
      const baseStretch = reducedMotion
        ? clamp(speed / 600, 0, 0.075)
        : clamp(speed / 220 + accelerationPull + Math.abs(turn) * 0.023, 0, 0.475);
      const targetStretch = baseStretch * (1 - blob.turnSoftness * (reducedMotion ? 0.6 : 0.76));
      let stretchResponse = targetStretch > blob.stretch ? (reducedMotion ? 0.045 : 0.108) : (reducedMotion ? 0.025 : 0.023);
      blob.stretch += (targetStretch - blob.stretch) * stretchResponse;
      const targetTail = reducedMotion ? 0 : clamp(Math.abs(turn) * Math.min(speed / 70, 1) * 0.09 + blob.stretch * 0.20, 0, 0.16);
      const tailResponse = targetTail > blob.tailLag ? 0.07 : 0.022;
      blob.tailLag += (targetTail - blob.tailLag) * tailResponse;
      const turnWobble = reducedMotion ? 0 : clamp(turn * Math.min(speed / 75, 1) * 0.07 * (1 - blob.turnSoftness * 0.55), -0.095, 0.095);
      const wobbleResponse = Math.abs(turnWobble) > Math.abs(blob.wobble) ? 0.10 : 0.038;
      blob.wobble += (turnWobble - blob.wobble) * wobbleResponse;
      const pulseTarget = reducedMotion
        ? clamp((blob.contact + blob.wallContact) * 0.22 + blob.turnSoftness * 0.08, 0, 0.08)
        : clamp(blob.contact * 1.5 + blob.wallContact * 1.25 + blob.turnSoftness * 0.24, 0, 0.34);
      blob.jellyPulse += (pulseTarget - blob.jellyPulse) * (pulseTarget > blob.jellyPulse ? 0.16 : 0.036);
      const targetFaceTilt = reducedMotion ? 0 : clamp(blob.vy / 126 * 0.12, -0.12, 0.12);
      blob.faceTilt += (targetFaceTilt - blob.faceTilt) * 0.08;
      const mouthTarget = holdActive ? (reducedMotion ? 0.38 : 0.66) : 0;
      const mouthResponse = mouthTarget > blob.mouthActivity
        ? (reducedMotion ? 0.04 : 0.075)
        : (reducedMotion ? 0.024 : 0.038);
      blob.mouthActivity += (mouthTarget - blob.mouthActivity) * mouthResponse;
      const idleAmount = reducedMotion ? 0.008 : 0.034;
      const idleTargetX = Math.sin(now / 1450 + blob.idlePhase) * idleAmount;
      const idleTargetY = Math.sin(now / 1900 + blob.idlePhase * 1.43) * idleAmount * 0.72;
      blob.idleX += (idleTargetX - blob.idleX) * 0.018;
      blob.idleY += (idleTargetY - blob.idleY) * 0.018;
      const leanTarget = reducedMotion ? 0 : Math.sin(now / 2300 + blob.idlePhase * 0.81) * 0.028;
      blob.poolLean += (leanTarget - blob.poolLean) * 0.014;
    });
  }

  function drawBlob(blob) {
    const directional = 1 - blob.turnSoftness * (reducedMotion ? 0.25 : 0.58);
    const squash = (blob.contact + blob.wallContact) * (reducedMotion ? 0.25 : 0.92) + blob.jellyPulse;
    const stretch = blob.stretch * directional;
    const front = blob.radius * (1 + blob.organicFront * directional + stretch * 1.62 - squash * 0.24 + blob.idleX * directional);
    const back = blob.radius * (1 + blob.organicBack * directional + stretch * 0.52 + blob.tailLag * directional + squash * 0.24 - blob.idleX * 0.40 * directional);
    const organicTall = 1 + (blob.organicTall - 1) * directional;
    const vertical = Math.max(blob.radius * (reducedMotion ? 0.87 : 0.78), blob.radius * (organicTall - stretch * 0.34 + squash * 0.72 + blob.idleY * directional));
    const wobble = blob.wobble * blob.radius * directional;
    const topShift = blob.radius * (blob.organicTop + blob.poolLean) * directional + wobble * 0.30;
    const bottomShift = blob.radius * (blob.organicBottom - blob.poolLean * 0.7) * directional - wobble * 0.38;
    context.save();
    context.translate(blob.x, blob.y);
    context.rotate(blob.shapeAngle);
    context.shadowColor = "rgba(38, 83, 74, .16)";
    context.shadowBlur = reducedMotion ? 8 : 15;
    context.shadowOffsetY = 6;
    const gradient = context.createRadialGradient(-back * 0.24, -vertical * 0.32, blob.radius * 0.06, 0, 0, Math.max(front, vertical));
    gradient.addColorStop(0, "rgba(255,255,255,.72)");
    gradient.addColorStop(0.20, blob.color.light);
    gradient.addColorStop(0.68, blob.color.base);
    gradient.addColorStop(1, blob.color.edge);
    context.globalAlpha = 0.82;
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(front, 0);
    context.bezierCurveTo(front, -vertical * 0.53, front * 0.54, -vertical, topShift, -vertical);
    context.bezierCurveTo(-back * 0.48 + wobble, -vertical * 1.02, -back, -vertical * 0.48, -back, wobble * 0.18);
    context.bezierCurveTo(-back, vertical * 0.61, -back * 0.50 - wobble, vertical * 0.98, bottomShift, vertical);
    context.bezierCurveTo(front * 0.56, vertical * 1.02, front, vertical * 0.54, front, 0);
    context.closePath();
    context.fill();
    context.save();
    context.clip();
    const innerGlow = context.createRadialGradient(-back * 0.16, -vertical * 0.16, 0, 0, 0, blob.radius * 0.9);
    innerGlow.addColorStop(0, "rgba(255,255,255,.30)");
    innerGlow.addColorStop(0.58, "rgba(255,255,255,.08)");
    innerGlow.addColorStop(1, "rgba(255,255,255,0)");
    context.globalAlpha = reducedMotion ? 0.28 : 0.38;
    context.fillStyle = innerGlow;
    context.beginPath();
    context.ellipse(-back * 0.08, -vertical * 0.07, blob.radius * 0.72, blob.radius * 0.60, -0.18, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 0.34;
    context.fillStyle = "rgba(255,255,255,.72)";
    context.beginPath();
    context.ellipse(-back * 0.30, -vertical * 0.38, blob.radius * 0.16, blob.radius * 0.10, -0.45, 0, Math.PI * 2);
    context.fill();
    context.restore();
    context.shadowColor = "transparent";
    context.globalAlpha = 0.48;
    context.strokeStyle = "white";
    context.lineWidth = Math.max(3, blob.radius * 0.04);
    context.stroke();
    context.restore();
    drawFace(blob, front, back, vertical, squash, stretch);
  }

  function drawFace(blob, front, back, vertical, squash, stretch) {
    const faceCenter = (front - back) * 0.055 - blob.tailLag * blob.radius * 0.08;
    const eyeGap = blob.radius * (0.22 + stretch * 0.34);
    const eyeY = -vertical * 0.08;
    const eyeRadiusX = Math.max(2.1, blob.radius * 0.032 * (1 + stretch * 0.18));
    const eyeRadiusY = Math.max(2, blob.radius * 0.039 * (1 - squash * 0.65));
    context.save();
    context.translate(blob.x, blob.y);
    context.rotate(blob.faceTilt);
    const faceAlpha = 0.52;
    context.globalAlpha = faceAlpha;
    context.fillStyle = "#244a45";
    context.beginPath();
    context.ellipse(faceCenter - eyeGap, eyeY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
    context.ellipse(faceCenter + eyeGap, eyeY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
    context.fill();
    const mouthY = vertical * 0.18;
    const mouthWidth = blob.radius * (0.13 + stretch * 0.13);
    context.strokeStyle = "#244a45";
    context.lineWidth = Math.max(1.7, blob.radius * 0.021);
    context.lineCap = "round";
    const openAmount = clamp(blob.mouthActivity, 0, 0.82);
    const ovalProgress = clamp(openAmount / (reducedMotion ? 0.5 : 0.62), 0, 1);
    const ovalAmount = ovalProgress * ovalProgress * (3 - 2 * ovalProgress);
    const activeMouthWidth = mouthWidth * (1 - ovalAmount * (reducedMotion ? 0.58 : 0.72));
    const mouthHalfHeight = vertical * ovalAmount * (reducedMotion ? 0.044 : 0.058);
    const smileCurve = vertical * 0.085 * Math.pow(1 - ovalAmount, 2.4);
    const mouthCenterY = mouthY + vertical * ovalAmount * 0.018;
    context.globalAlpha = faceAlpha;
    context.beginPath();
    context.moveTo(faceCenter - activeMouthWidth, mouthCenterY);
    context.bezierCurveTo(
      faceCenter - activeMouthWidth * 0.44,
      mouthCenterY + smileCurve - mouthHalfHeight,
      faceCenter + activeMouthWidth * 0.44,
      mouthCenterY + smileCurve - mouthHalfHeight,
      faceCenter + activeMouthWidth,
      mouthCenterY
    );
    context.bezierCurveTo(
      faceCenter + activeMouthWidth * 0.44,
      mouthCenterY + smileCurve + mouthHalfHeight,
      faceCenter - activeMouthWidth * 0.44,
      mouthCenterY + smileCurve + mouthHalfHeight,
      faceCenter - activeMouthWidth,
      mouthCenterY
    );
    context.closePath();
    context.stroke();
    context.restore();
  }

  function drawHoldSignal(now) {
    if (!holdActive || holdSignalStrength <= 0.01) return;
    const strength = holdSignalStrength * (reducedMotion ? 0.8 : 1);
    const visualX = holdPoint.x;
    const visualY = holdPoint.y - 10;
    const auraRadius = reducedMotion ? 58 : 70;
    const aura = context.createRadialGradient(visualX, visualY, 24, visualX, visualY, auraRadius);
    aura.addColorStop(0, `rgba(70, 151, 137, ${0.14 * strength})`);
    aura.addColorStop(0.42, `rgba(80, 164, 149, ${0.085 * strength})`);
    aura.addColorStop(0.72, `rgba(97, 179, 164, ${0.035 * strength})`);
    aura.addColorStop(1, "rgba(111, 190, 175, 0)");
    context.fillStyle = aura;
    context.beginPath();
    context.arc(visualX, visualY, auraRadius, 0, Math.PI * 2);
    context.fill();

    const ringCount = reducedMotion ? 1 : 2;
    const phase = reducedMotion ? 0.18 : (now % 2400) / 2400;
    const baseRadii = reducedMotion ? [38] : [36, 51];
    const spreads = reducedMotion ? [16] : [12, 17];
    for (let index = 0; index < ringCount; index += 1) {
      const ringPhase = reducedMotion ? phase : (phase + index * 0.18) % 1;
      const distanceFade = index === 0 ? 1 : 0.58;
      context.globalAlpha = strength * distanceFade * (1 - ringPhase * 0.68) * (reducedMotion ? 0.27 : 0.34);
      context.lineWidth = (reducedMotion ? 1.8 : 2.35) * (index === 0 ? 1 : 0.68);
      context.strokeStyle = "#469486";
      context.beginPath();
      context.arc(visualX, visualY, baseRadii[index] + ringPhase * spreads[index], 0, Math.PI * 2);
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  function draw(now = performance.now()) {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#f6fcf8");
    background.addColorStop(1, "#dcefe8");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    drawHoldSignal(now);
    blobs.forEach(drawBlob);
  }

  function frame(now) {
    if (!running) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.033) : 1 / 60;
    lastTime = now;
    update(dt, now);
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
    clearSensorTimers();
    running = false;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    lastTime = 0;
    pointers.clear();
    holdActive = false;
    holdStart = 0;
    holdSignalStrength = 0;
    blobs.forEach((blob) => {
      blob.turnSoftness = 0;
      blob.jellyPulse = 0;
      blob.wobble = 0;
      blob.mouthActivity = 0;
    });
  }

  permissionButton.addEventListener("click", requestMotionPermission);
  playArea.addEventListener("pointerdown", onPointerDown);
  playArea.addEventListener("pointermove", onPointerMove);
  playArea.addEventListener("pointerup", endPointer);
  playArea.addEventListener("pointercancel", endPointer);
  playArea.addEventListener("lostpointercapture", endPointer);
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else { setupSensor(); start(); }
  });
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", () => { resize(); setupSensor(); start(); });
  reduceQuery.addEventListener("change", (event) => { reducedMotion = event.matches; });

  resize();
  setupSensor();
  start();

  window.__LIQUID_PLAY_DEBUG__ = Object.freeze({
    snapshot: () => ({
      blobCount: blobs.length,
      blobs: blobs.map(({ x, y, vx, vy, radius, contact, wallContact, shapeAngle, stretch, wobble, tailLag, turnSoftness, jellyPulse, faceTilt, mouthActivity, idleX, idleY, poolLean }) => ({
        x, y, vx, vy, radius, contact, wallContact, shapeAngle, stretch, wobble, tailLag, turnSoftness, jellyPulse, faceTilt, mouthActivity, idleX, idleY, poolLean
      })),
      force: { ...force },
      sensorState,
      sensorListenerAttached,
      sensorTimerCount: Number(Boolean(sensorProbeTimer)) + Number(Boolean(sensorFailureTimer)),
      permissionRequested,
      pointerCount: pointers.size,
      holdActive,
      holdSignal: {
        x: holdPoint.x,
        y: holdPoint.y,
        visualX: holdPoint.x,
        visualY: holdPoint.y - 10,
        strength: holdSignalStrength,
        innerRadius: reducedMotion ? 38 : 36,
        outerRadius: reducedMotion ? 54 : 68,
        ringCount: reducedMotion ? 1 : 2,
        innerAlphaScale: reducedMotion ? 0.27 : 0.34,
        outerAlphaScale: reducedMotion ? 0 : 0.197,
        innerLineWidth: reducedMotion ? 1.8 : 2.35,
        outerLineWidth: reducedMotion ? 0 : 1.598
      },
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
