"use strict";

(() => {
  const board = document.getElementById("board");
  const status = document.getElementById("status");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const stages = [
    { shape: "circle", animal: "turtle", name: "かめ", label: "まるをかめの甲羅へ", targetLabel: "かめのまるい甲羅の型" },
    { shape: "square", animal: "dog", name: "いぬ", label: "しかくをいぬの胴体へ", targetLabel: "いぬのしかくい胴体の型" },
    { shape: "triangle", animal: "fox", name: "きつね", label: "さんかくをきつねの顔へ", targetLabel: "きつねのさんかくの顔の型" }
  ];
  const piece = {
    element: document.getElementById("piece"),
    target: document.getElementById("target"),
    start: { x: 0, y: 0 },
    center: { x: 0, y: 0 },
    destination: { x: 0, y: 0 },
    activePointerId: null,
    offset: { x: 0, y: 0 },
    size: 0,
    radius: 0
  };
  const visuals = stages.map((stage) => ({
    shape: document.getElementById(`shape-${stage.shape}`),
    animal: document.getElementById(`animal-${stage.animal}`)
  }));
  let stageIndex = 0;
  let state = "idle";
  let bounds;
  let suspended = document.hidden;
  let stageTimer = null;
  let timerVersion = 0;

  function setState(next) {
    state = next;
    board.dataset.state = next;
  }

  function move(point) {
    piece.center = { ...point };
    piece.element.style.transform = `translate3d(${point.x - piece.size / 2}px, ${point.y - piece.size / 2}px, 0)`;
  }

  function clearStageTimer() {
    timerVersion += 1;
    if (stageTimer !== null) clearTimeout(stageTimer);
    stageTimer = null;
  }

  // Snap, reward, and fade reuse one slot. Stale callbacks cannot advance a stage.
  function schedule(callback, delay) {
    clearStageTimer();
    const version = timerVersion;
    stageTimer = setTimeout(() => {
      if (version !== timerVersion || suspended) return;
      stageTimer = null;
      callback();
    }, delay);
  }

  function release() {
    const pointerId = piece.activePointerId;
    // Clear ownership before releasePointerCapture can dispatch lostpointercapture.
    piece.activePointerId = null;
    piece.element.classList.remove("is-dragging");
    piece.target.classList.remove("is-near");
    if (pointerId !== null && piece.element.hasPointerCapture(pointerId)) {
      piece.element.releasePointerCapture(pointerId);
    }
  }

  function clearEffects() {
    board.classList.remove("is-complete", "is-transitioning", "is-entering");
    piece.element.classList.remove("is-returning", "is-placed");
    piece.target.classList.remove("is-near");
  }

  function applyStage() {
    const currentStage = stages[stageIndex];
    board.dataset.shape = currentStage.shape;
    board.dataset.animal = currentStage.animal;
    visuals.forEach((visual, index) => {
      visual.shape.toggleAttribute("hidden", index !== stageIndex);
      visual.animal.toggleAttribute("hidden", index !== stageIndex);
    });
    piece.element.setAttribute("aria-label", currentStage.label);
    piece.element.setAttribute("aria-disabled", "false");
    piece.target.setAttribute("aria-label", currentStage.targetLabel);
    status.textContent = "";
  }

  function layout() {
    bounds = board.getBoundingClientRect();
    piece.size = piece.element.offsetWidth;
    const targetWidth = piece.target.offsetWidth;
    const targetHeight = piece.target.offsetHeight;
    const x = bounds.width / 2;
    const y = Math.max(targetHeight / 2 + 4, bounds.height * 0.30);
    piece.destination = { x, y };
    piece.start = { x, y: Math.min(bounds.height * 0.80, bounds.height - piece.size / 2 - 4) };
    const socketSize = targetWidth / 2;
    // The wide circular region follows the rendered socket and piece sizes.
    // Leave 30px between it and the starting center so a touch alone won't match.
    piece.radius = Math.min(socketSize / 2 + piece.size * 0.60, piece.start.y - y - 30);
    piece.target.style.transform = `translate3d(${x - targetWidth / 2}px, ${y - targetHeight / 2}px, 0)`;
    move(piece.start);
  }

  function resetCurrentStage() {
    clearStageTimer();
    board.classList.add("is-layout");
    release();
    clearEffects();
    setState("idle");
    applyStage();
    layout();
    // Flush only on layout changes so later user snaps/returns can transition.
    board.getBoundingClientRect();
    board.classList.remove("is-layout");
  }

  function nextStage() {
    stageIndex = (stageIndex + 1) % stages.length;
    resetCurrentStage();
    board.classList.add("is-entering");
  }

  function finishSnap() {
    board.classList.add("is-complete");
    piece.target.setAttribute("aria-label", `${stages[stageIndex].name}ができた`);
    status.textContent = `${stages[stageIndex].name}ができた`;
    schedule(() => {
      setState("transitioning");
      board.classList.add("is-transitioning");
      schedule(nextStage, motion.matches ? 120 : 220);
    }, 1400);
  }

  function snap() {
    if (suspended || (state !== "idle" && state !== "dragging")) return;
    setState("completing");
    release();
    piece.element.classList.remove("is-returning");
    piece.element.classList.add("is-placed");
    piece.element.setAttribute("aria-disabled", "true");
    move(piece.destination);
    schedule(finishSnap, motion.matches ? 60 : 180);
  }

  function follow(event) {
    const half = piece.size * 1.025 / 2;
    move({
      x: Math.max(half, Math.min(bounds.width - half, event.clientX - bounds.left + piece.offset.x)),
      y: Math.max(half, Math.min(bounds.height - half, event.clientY - bounds.top + piece.offset.y))
    });
    const distance = Math.hypot(piece.center.x - piece.destination.x, piece.center.y - piece.destination.y);
    piece.target.classList.toggle("is-near", distance <= piece.radius + piece.size * 0.12);
    if (distance <= piece.radius) snap();
  }

  function returnHome() {
    release();
    setState("idle");
    piece.element.classList.add("is-returning");
    move(piece.start);
  }

  piece.element.addEventListener("pointerdown", (event) => {
    if (suspended || state !== "idle" || piece.activePointerId !== null || event.button !== 0) return;
    event.preventDefault();
    const rect = piece.element.getBoundingClientRect();
    piece.offset = {
      x: rect.left + rect.width / 2 - event.clientX,
      y: rect.top + rect.height / 2 - event.clientY - (motion.matches ? 0 : 10)
    };
    piece.activePointerId = event.pointerId;
    setState("dragging");
    piece.element.classList.remove("is-returning");
    piece.element.classList.add("is-dragging");
    piece.element.setPointerCapture(event.pointerId);
    follow(event);
  });
  piece.element.addEventListener("pointermove", (event) => {
    if (piece.activePointerId !== event.pointerId) return;
    event.preventDefault();
    follow(event);
  });
  piece.element.addEventListener("pointerup", (event) => {
    if (piece.activePointerId !== event.pointerId) return;
    event.preventDefault();
    follow(event);
    if (state === "dragging") returnHome();
  });
  ["pointercancel", "lostpointercapture"].forEach((type) => {
    piece.element.addEventListener(type, (event) => {
      if (piece.activePointerId === event.pointerId) returnHome();
    });
  });
  piece.element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (!event.repeat && state === "idle") snap();
  });
  piece.element.addEventListener("click", (event) => {
    if (event.detail === 0 && state === "idle") snap();
  });
  piece.element.addEventListener("transitionend", (event) => {
    if (event.target === piece.element && event.propertyName === "transform") piece.element.classList.remove("is-returning");
  });
  piece.target.addEventListener("animationend", (event) => {
    if (event.animationName === "stage-in") board.classList.remove("is-entering");
  });

  function suspend() {
    suspended = true;
    resetCurrentStage();
  }

  function resume() {
    suspended = document.hidden;
    resetCurrentStage();
  }

  document.addEventListener("visibilitychange", () => document.hidden ? suspend() : resume());
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", resume);
  window.addEventListener("resize", resetCurrentStage);
  // CSS applies the new motion preference immediately; reset any partial reward.
  motion.addEventListener("change", resetCurrentStage);
  resetCurrentStage();
})();
