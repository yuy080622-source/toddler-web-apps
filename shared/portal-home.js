(() => {
  "use strict";
  const HOLD_DURATION = 2000;
  document.querySelectorAll("[data-portal-home]").forEach((button) => {
    let activePointerId = null;
    let startedAt = 0;
    let animationFrameId = null;
    let completed = false;
    const reset = () => {
      const pointerId = activePointerId;
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      activePointerId = null;
      startedAt = 0;
      completed = false;
      button.classList.remove("is-holding");
      button.style.removeProperty("--hold-progress");
      button.style.removeProperty("--hold-ratio");
      button.setAttribute("aria-label", "ホームへ戻る（2秒長押し）");
      if (pointerId !== null && button.hasPointerCapture?.(pointerId)) button.releasePointerCapture(pointerId);
    };
    const finish = () => {
      if (completed) return;
      completed = true;
      button.setAttribute("aria-label", "ホームへ戻ります");
      window.location.assign(button.dataset.portalHome || "../../");
    };
    const update = (time) => {
      if (activePointerId === null || completed) return;
      const ratio = Math.min(1, (time - startedAt) / HOLD_DURATION);
      button.style.setProperty("--hold-progress", `${ratio * 360}deg`);
      button.style.setProperty("--hold-ratio", String(ratio));
      if (ratio >= 1) finish();
      else animationFrameId = window.requestAnimationFrame(update);
    };
    button.addEventListener("pointerdown", (event) => {
      if (activePointerId !== null || event.button > 0) return;
      event.preventDefault();
      event.stopPropagation();
      activePointerId = event.pointerId;
      startedAt = performance.now();
      button.classList.add("is-holding");
      button.setAttribute("aria-label", "そのまま押し続けるとホームへ戻ります");
      button.setPointerCapture?.(event.pointerId);
      animationFrameId = window.requestAnimationFrame(update);
    });
    button.addEventListener("pointermove", (event) => {
      if (event.pointerId !== activePointerId) return;
      const rect = button.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) reset();
    });
    ["pointerup", "pointercancel", "lostpointercapture", "pointerleave"].forEach((type) => {
      button.addEventListener(type, (event) => {
        if (event.pointerId === activePointerId && !completed) reset();
      });
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener("contextmenu", (event) => event.preventDefault());
  });
})();
