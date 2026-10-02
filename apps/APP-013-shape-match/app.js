"use strict";

(() => {
  const board = document.getElementById("board");
  const status = document.getElementById("status");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const names = { circle: "まる", square: "しかく", triangle: "さんかく" };
  const pieces = Object.keys(names).map((shape) => ({
    shape,
    element: document.getElementById(`piece-${shape}`),
    target: document.getElementById(`target-${shape}`),
    start: { x: 0, y: 0 },
    center: { x: 0, y: 0 },
    destination: { x: 0, y: 0 },
    activePointerId: null,
    offset: { x: 0, y: 0 },
    placed: false,
    size: 0,
    radius: 0
  }));
  let bounds;
  let suspended = document.hidden;
  let complete = false;
  let resetTimer = null;

  function move(piece, point) {
    piece.center = { ...point };
    piece.element.style.transform = `translate3d(${point.x - piece.size / 2}px, ${point.y - piece.size / 2}px, 0)`;
  }

  function clearResetTimer() {
    if (resetTimer !== null) clearTimeout(resetTimer);
    resetTimer = null;
  }

  function release(piece) {
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
    board.classList.remove("is-complete");
    pieces.forEach((piece) => {
      piece.element.classList.remove("is-popping", "is-returning");
      piece.target.classList.remove("is-near");
    });
  }

  function resetRound() {
    clearResetTimer();
    complete = false;
    clearEffects();
    pieces.forEach((piece) => {
      release(piece);
      piece.placed = false;
      piece.element.classList.remove("is-placed");
      piece.element.setAttribute("aria-disabled", "false");
      piece.target.classList.remove("is-filled");
    });
    status.textContent = "";
    layout();
  }

  function layout() {
    // A resize during completion starts a stable new round, with no stale timer.
    if (complete) {
      resetRound();
      return;
    }
    bounds = board.getBoundingClientRect();
    board.classList.add("is-layout");
    clearEffects();
    pieces.forEach((piece, index) => {
      release(piece);
      piece.size = piece.element.offsetWidth;
      const targetSize = piece.target.offsetWidth;
      const x = bounds.width * (index + 0.5) / 3;
      const half = targetSize / 2 + 4;
      const y = Math.max(half, Math.min(bounds.height * 0.29, bounds.height - half));
      piece.start = { x, y: Math.max(half, Math.min(bounds.height * 0.75, bounds.height - half)) };
      piece.destination = { x, y };
      // Circular region extends 22px beyond the target's bounding box midpoint.
      piece.radius = targetSize / 2 + 22;
      piece.target.style.transform = `translate3d(${x - targetSize / 2}px, ${y - targetSize / 2}px, 0)`;
      move(piece, piece.placed ? piece.destination : piece.start);
    });
    // Flush only on layout changes so later user drops can transition normally.
    board.getBoundingClientRect();
    board.classList.remove("is-layout");
  }

  function isNear(piece) {
    const distance = Math.hypot(piece.center.x - piece.destination.x, piece.center.y - piece.destination.y);
    // Expanded regions can overlap. A closer, differently shaped target must
    // still return the piece home instead of snapping to the more distant one.
    return distance <= piece.radius && pieces.every((item) => item === piece ||
      Math.hypot(piece.center.x - item.destination.x, piece.center.y - item.destination.y) >= distance);
  }

  function follow(piece, event) {
    const half = piece.size * 1.035 / 2;
    move(piece, {
      x: Math.max(half, Math.min(bounds.width - half, event.clientX - bounds.left + piece.offset.x)),
      y: Math.max(half, Math.min(bounds.height - half, event.clientY - bounds.top + piece.offset.y))
    });
    piece.target.classList.toggle("is-near", isNear(piece));
  }

  function place(piece) {
    release(piece);
    piece.placed = true;
    piece.element.classList.remove("is-returning");
    piece.element.classList.add("is-placed");
    if (!motion.matches) piece.element.classList.add("is-popping");
    piece.element.setAttribute("aria-disabled", "true");
    piece.target.classList.add("is-filled");
    move(piece, piece.destination);
    status.textContent = `${names[piece.shape]}が入りました`;
    if (pieces.every((item) => item.placed)) {
      complete = true;
      board.classList.add("is-complete");
      status.textContent = "できた";
      clearResetTimer();
      resetTimer = setTimeout(resetRound, 1100);
    }
  }

  function returnHome(piece) {
    release(piece);
    piece.element.classList.add("is-returning");
    move(piece, piece.start);
  }

  pieces.forEach((piece) => {
    piece.element.addEventListener("pointerdown", (event) => {
      if (suspended || complete || piece.placed || piece.activePointerId !== null || event.button !== 0) return;
      // A pointer already owning another piece cannot acquire this one.
      if (pieces.some((item) => item.activePointerId === event.pointerId)) return;
      event.preventDefault();
      const rect = piece.element.getBoundingClientRect();
      piece.offset = {
        x: rect.left + rect.width / 2 - event.clientX,
        y: rect.top + rect.height / 2 - event.clientY - (motion.matches ? 0 : 6)
      };
      piece.activePointerId = event.pointerId;
      piece.element.classList.remove("is-returning", "is-popping");
      piece.element.classList.add("is-dragging");
      piece.element.setPointerCapture(event.pointerId);
      follow(piece, event);
    });
    piece.element.addEventListener("pointermove", (event) => {
      if (piece.activePointerId !== event.pointerId) return;
      event.preventDefault();
      follow(piece, event);
    });
    piece.element.addEventListener("pointerup", (event) => {
      if (piece.activePointerId !== event.pointerId) return;
      event.preventDefault();
      follow(piece, event);
      if (isNear(piece)) place(piece);
      else returnHome(piece);
    });
    ["pointercancel", "lostpointercapture"].forEach((type) => {
      piece.element.addEventListener(type, (event) => {
        if (piece.activePointerId === event.pointerId) returnHome(piece);
      });
    });
    piece.element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (!event.repeat && !suspended && !complete && !piece.placed && piece.activePointerId === null) place(piece);
    });
    // Supports assistive technology's button activation without turning taps into matches.
    piece.element.addEventListener("click", (event) => {
      if (event.detail === 0 && !suspended && !complete && !piece.placed && piece.activePointerId === null) place(piece);
    });
    piece.element.addEventListener("animationend", () => piece.element.classList.remove("is-popping"));
    piece.element.addEventListener("transitionend", (event) => {
      if (event.target === piece.element && event.propertyName === "transform") piece.element.classList.remove("is-returning");
    });
  });

  function suspend() {
    suspended = true;
    clearResetTimer();
    if (complete) resetRound();
    else layout();
  }

  function resume() {
    suspended = document.hidden;
    layout();
  }

  document.addEventListener("visibilitychange", () => document.hidden ? suspend() : resume());
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", resume);
  window.addEventListener("resize", layout);
  motion.addEventListener("change", () => {
    if (motion.matches) pieces.forEach((piece) => piece.element.classList.remove("is-popping"));
  });
  layout();
})();
