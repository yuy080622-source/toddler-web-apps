"use strict";

(() => {
  const board = document.getElementById("board");
  const status = document.getElementById("status");
  const features = document.getElementById("features");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const stages = [
    { shape: "circle", animal: "turtle", name: "かめ", box: [104, 104], label: "まるをかめの甲羅へ", targetLabel: "かめのまるい甲羅の型" },
    { shape: "rectangle", animal: "dog", name: "いぬ", box: [144, 92], label: "ながしかくをいぬの胴体へ", targetLabel: "いぬの横長の胴体の型" },
    { shape: "egg", animal: "chick", name: "ひよこ", box: [100, 120], label: "たまご形をひよこの胴体へ", targetLabel: "ひよこのたまご形の胴体の型" },
    { shape: "triangle", animal: "fox", name: "きつね", box: [112, 112], label: "さんかくをきつねの顔へ", targetLabel: "きつねのまるいさんかくの顔の型" },
    { shape: "diamond", animal: "fish", name: "さかな", box: [124, 100], label: "ひし形をさかなの胴体へ", targetLabel: "さかなのまるいひし形の胴体の型" }
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
    height: 0,
    radius: 0
  };
  const visuals = stages.map((stage) => ({
    shape: document.getElementById(`shape-${stage.shape}`),
    details: document.getElementById(`details-${stage.animal}`),
    animal: document.getElementById(`animal-${stage.animal}`)
  }));
  let stageIndex = 0;
  let state = "idle";
  let bounds;
  let suspended = document.hidden;
  let stageTimer = null;
  let timerVersion = 0;
  const snapDuration = () => motion.matches ? 60 : 1000;

  function setState(next) {
    state = next;
    board.dataset.state = next;
  }

  function move(point) {
    piece.center = { ...point };
    piece.element.style.transform = `translate3d(${point.x - piece.size / 2}px, ${point.y - piece.height / 2}px, 0)`;
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
    const [width, height] = currentStage.box;
    document.getElementById("piece-svg").setAttribute("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`);
    visuals.forEach((visual, index) => {
      visual.shape.toggleAttribute("hidden", index !== stageIndex);
      visual.details.toggleAttribute("hidden", index !== stageIndex);
      visual.animal.toggleAttribute("hidden", index !== stageIndex);
    });
    piece.element.setAttribute("aria-label", currentStage.label);
    piece.element.setAttribute("aria-disabled", "false");
    piece.target.setAttribute("aria-label", currentStage.targetLabel);
    status.textContent = "";
  }

  function layout() {
    bounds = board.getBoundingClientRect();
    const [width, height] = stages[stageIndex].box;
    // Every SVG user unit has the same CSS size in the piece and animal.
    // A short landscape screen reserves room for both without changing their ratio.
    const unit = Math.min(1.5, Math.max(1.2, Math.min(bounds.width + 24, bounds.height + 24) * 0.0036),
      bounds.width / 248, bounds.height / (156 + height + 24));
    piece.element.style.width = `${width * unit}px`;
    piece.element.style.height = `${height * unit}px`;
    piece.target.style.width = `${240 * unit}px`;
    piece.target.style.height = `${156 * unit}px`;
    features.style.width = piece.target.style.width;
    features.style.height = piece.target.style.height;
    piece.size = width * unit;
    piece.height = height * unit;
    const targetWidth = 240 * unit;
    const targetHeight = 156 * unit;
    const x = bounds.width / 2;
    const y = Math.max(targetHeight / 2 + 4, bounds.height * 0.30);
    piece.destination = { x, y };
    piece.start = { x, y: Math.min(bounds.height * 0.80, bounds.height - piece.height / 2 - 4) };
    const socketSize = Math.max(piece.size, piece.height);
    // The wide circular region follows the rendered socket and piece sizes.
    // Leave 30px between it and the starting center so a touch alone won't match.
    piece.radius = Math.min(socketSize * 1.1, piece.start.y - y - 30);
    piece.target.style.transform = `translate3d(${x - targetWidth / 2}px, ${y - targetHeight / 2}px, 0)`;
    features.style.transform = piece.target.style.transform;
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
    if (suspended || state !== "completing" || board.classList.contains("is-complete")) return;
    board.classList.add("is-complete");
    piece.target.setAttribute("aria-label", `${stages[stageIndex].name}ができた`);
    status.textContent = `${stages[stageIndex].name}ができた`;
    schedule(() => {
      setState("transitioning");
      board.classList.add("is-transitioning");
      schedule(nextStage, motion.matches ? 120 : 220);
    }, 1800);
  }

  function snap() {
    if (suspended || (state !== "idle" && state !== "dragging")) return;
    // Commit the latest dragged position before enabling the snap transition.
    // Otherwise one pointermove can coalesce the drag and snap into a position jump.
    piece.element.getBoundingClientRect();
    setState("completing");
    release();
    piece.element.classList.remove("is-returning");
    piece.element.classList.add("is-placed");
    piece.element.setAttribute("aria-disabled", "true");
    move(piece.destination);
    // The transition end marks actual arrival. One fallback reuses the same timer
    // slot for zero-distance moves or a browser that omits transitionend.
    schedule(finishSnap, snapDuration() + 80);
  }

  function follow(event) {
    const half = piece.size / 2;
    const halfHeight = piece.height / 2;
    move({
      x: Math.max(half, Math.min(bounds.width - half, event.clientX - bounds.left + piece.offset.x)),
      y: Math.max(halfHeight, Math.min(bounds.height - halfHeight, event.clientY - bounds.top + piece.offset.y))
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
    if (event.target !== piece.element || event.propertyName !== "transform") return;
    piece.element.classList.remove("is-returning");
    // Ignore a late return transition event; it cannot finish a new snap early.
    if (Math.abs(event.elapsedTime * 1000 - snapDuration()) < 25) finishSnap();
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
