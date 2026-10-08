"use strict";

// Verification-only dependency; the application itself has no dependencies.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
const base = process.env.APP013_BASE_URL || "http://127.0.0.1:8000/apps/APP-013-shape-match/";
const longSeconds = Number(process.env.APP013_LONG_SECONDS || 0);
const output = process.env.APP013_ARTIFACT_DIR || "/tmp/app013-verification";
fs.mkdirSync(output, { recursive: true });
const animals = ["turtle", "dog", "fox"];
const shapes = ["circle", "square", "triangle"];
const animationPart = [".turtle-head", ".dog-tail", ".fox-ear-left"];

async function inspect(page) {
  return page.evaluate(() => ({
    dom: document.querySelectorAll("*").length,
    state: document.querySelector("#board").dataset.state,
    animal: document.querySelector("#board").dataset.animal,
    shape: document.querySelector("#board").dataset.shape,
    placed: document.querySelectorAll(".is-placed").length,
    dragging: document.querySelectorAll(".is-dragging").length,
    complete: document.querySelector("#board").classList.contains("is-complete"),
    timers: window.__verification.timers.size,
    maxTimers: window.__verification.maxTimers,
    lifecycle: window.__verification.lifecycle,
    scroll: [document.documentElement.scrollWidth > innerWidth, document.documentElement.scrollHeight > innerHeight]
  }));
}
async function point(page, selector) {
  const rect = await page.locator(selector).boundingBox();
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}
async function waitIdle(page, animal) {
  await page.waitForFunction((value) => {
    const b = document.querySelector("#board");
    return b.dataset.state === "idle" && b.dataset.animal === value;
  }, animal);
}
async function autoSnap(page, dx = 0) {
  const from = await point(page, "#piece");
  const to = await point(page, "#target");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x + dx, to.y + 10);
  const snapped = await inspect(page);
  assert.equal(snapped.state, "completing", "snap before pointerup");
  assert.equal(snapped.placed, 1);
  assert.equal(snapped.dragging, 0, "auto snap immediately releases ownership");
  await page.mouse.up();
}
async function touch(cdp, type, points) {
  await cdp.send("Input.dispatchTouchEvent", {
    type, touchPoints: points.map((p) => ({ ...p, radiusX: 5, radiusY: 5, force: 1 }))
  });
}
async function checkLayout(page, width, height) {
  assert.deepEqual((await inspect(page)).scroll, [false, false]);
  assert.equal(await page.locator(".piece").count(), 1);
  assert.equal(await page.locator(".target").count(), 1);
  assert.equal(await page.locator(".animal-scene:not([hidden])").count(), 1);
  assert.equal(await page.locator(".piece svg > :not([hidden])").count(), 1);
  const rects = await page.locator(".piece, .target").evaluateAll((es) => es.map((e) => e.getBoundingClientRect().toJSON()));
  rects.forEach((r) => assert.ok(r.left >= 11 && r.top >= 11 && r.right <= width - 11 && r.bottom <= height - 11, "inside safe content area"));
  const [target, piece] = rects;
  assert.ok(piece.width >= 120 && piece.width <= 150, "large 120–150px piece");
  assert.ok(target.bottom < piece.top, "animal and piece do not overlap");
  return piece.width;
}

(async () => {
  const launch = {
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true, args: ["--no-sandbox"],
    ignoreDefaultArgs: ["--disable-back-forward-cache"]
  };
  if (!base.includes("127.0.0.1") && process.env.HTTPS_PROXY) launch.proxy = { server: process.env.HTTPS_PROXY };
  const browser = await chromium.launch(launch);
  try {
    const context = await browser.newContext({ hasTouch: true });
    await context.addInitScript(() => {
      const state = { timers: new Set(), maxTimers: 0, lifecycle: [], lastPointerId: null };
      window.__verification = state;
      const originalSet = window.setTimeout;
      const originalClear = window.clearTimeout;
      window.setTimeout = (callback, delay, ...args) => {
        const id = originalSet(() => { state.timers.delete(id); callback(...args); }, delay);
        state.timers.add(id);
        state.maxTimers = Math.max(state.maxTimers, state.timers.size);
        return id;
      };
      window.clearTimeout = (id) => { state.timers.delete(id); originalClear(id); };
      window.addEventListener("pointerdown", (event) => { state.lastPointerId = event.pointerId; }, true);
      window.addEventListener("pageshow", (event) => state.lifecycle.push({ type: "pageshow", persisted: event.persisted }));
      window.addEventListener("pagehide", (event) => state.lifecycle.push({ type: "pagehide", persisted: event.persisted }));
    });
    const page = await context.newPage();
    const errors = [], requests = [], sizes = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (["error", "warning"].includes(message.type())) errors.push(message.text()); });
    page.on("request", (request) => requests.push(request.url()));
    const cdp = await context.newCDPSession(page);
    for (const [width, height] of [[390, 844], [844, 390], [1024, 768]]) {
      await page.setViewportSize({ width, height });
      await page.goto(base);
      const initial = await inspect(page);
      const pieceSize = await checkLayout(page, width, height);
      assert.equal(initial.animal, "turtle");
      const home = await point(page, "#piece");
      await page.mouse.move(home.x, home.y);
      await page.mouse.down();
      await page.mouse.up();
      assert.equal((await inspect(page)).placed, 0, "a tap alone cannot complete");
      await page.waitForTimeout(300);
      await page.mouse.move(home.x, home.y);
      await page.mouse.down();
      await page.mouse.move(home.x + 20, home.y - 20);
      await page.mouse.up();
      const duration = await page.locator("#piece").evaluate((e) => getComputedStyle(e).transitionDuration);
      assert.equal(duration, "0.28s");
      await page.waitForTimeout(300);
      const returned = await point(page, "#piece");
      assert.ok(Math.hypot(returned.x - home.x, returned.y - home.y) < 1, "outside magnet returns home");
      for (let i = 0; i < 3; i++) {
        assert.equal((await inspect(page)).animal, animals[i]);
        assert.equal((await inspect(page)).shape, shapes[i]);
        await checkLayout(page, width, height);
        await page.screenshot({ path: output + "/" + width + "x" + height + "-" + animals[i] + "-before.png" });
        // 130px is outside the visible hole and inside the broad responsive magnet.
        await autoSnap(page, 130);
        await page.waitForFunction(() => document.querySelector("#board").classList.contains("is-complete"));
        const completed = await page.locator("#animal-" + animals[i]).evaluate((e) => ({
          surround: getComputedStyle(e.querySelector(".animal-surround")).opacity,
          animation: getComputedStyle(e.querySelector(".turtle-head, .dog-tail, .fox-ear-left")).animationName,
          iterations: getComputedStyle(e.querySelector(".turtle-head, .dog-tail, .fox-ear-left")).animationIterationCount
        }));
        await page.waitForTimeout(380);
        assert.equal(await page.locator("#animal-" + animals[i] + " .animal-surround").evaluate((e) => getComputedStyle(e).opacity), "1");
        assert.notEqual(completed.animation, "none");
        assert.equal(completed.iterations, "1");
        const transform = await page.locator(animationPart[i]).evaluate((e) => getComputedStyle(e).transform);
        assert.notEqual(transform, "none", "completed animal actually moves");
        assert.notEqual(transform, "matrix(1, 0, 0, 1, 0, 0)");
        await page.screenshot({ path: output + "/" + width + "x" + height + "-" + animals[i] + "-complete.png" });
        assert.equal((await inspect(page)).timers, 1);
        await page.waitForFunction(() => document.querySelector("#board").dataset.state === "transitioning");
        await waitIdle(page, animals[(i + 1) % 3]);
        assert.equal((await inspect(page)).dom, initial.dom);
        assert.equal((await inspect(page)).timers, 0);
      }
      sizes.push({ width, height, pieceSize, dom: initial.dom, scroll: initial.scroll });
      console.log("PASS " + width + "x" + height + ": one shape/animal, broad auto snap, 3 rewards, fades, cycle; DOM " + initial.dom);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    let home = await point(page, "#piece");
    const owner = { ...home, id: 1 }, other = { x: home.x + 5, y: home.y, id: 2 };
    await touch(cdp, "touchStart", [owner, other]);
    const before = await point(page, "#piece");
    const to = await point(page, "#target");
    await touch(cdp, "touchMove", [owner, { ...to, id: 2 }]);
    const after = await point(page, "#piece");
    assert.ok(Math.hypot(before.x - after.x, before.y - after.y) < 1, "additional finger cannot move owner's piece");
    assert.equal((await inspect(page)).state, "dragging");
    await touch(cdp, "touchEnd", [{ ...to, id: 2 }]);
    assert.equal((await inspect(page)).state, "dragging");
    await touch(cdp, "touchMove", [{ x: to.x + 130, y: to.y + 10, id: 1 }]);
    await page.waitForFunction(() => document.querySelector("#board").dataset.state === "completing");
    assert.equal((await inspect(page)).state, "completing", "trusted touch snaps before lift");
    await touch(cdp, "touchEnd", []);
    await page.evaluate(() => {
      const p = document.querySelector("#piece");
      for (let i = 0; i < 100; i++) {
        for (const type of ["pointerdown", "pointerup", "pointercancel", "lostpointercapture"]) {
          p.dispatchEvent(new PointerEvent(type, { pointerId: i + 20, button: 0, bubbles: true }));
        }
        p.dispatchEvent(new MouseEvent("click", { detail: 0 }));
      }
    });
    assert.equal((await inspect(page)).timers, 1);
    await waitIdle(page, "dog");
    assert.equal((await inspect(page)).animal, "dog", "rapid completion inputs advance once");
    await page.waitForTimeout(1900);
    assert.equal((await inspect(page)).animal, "dog");
    assert.equal((await inspect(page)).timers, 0);

    home = await point(page, "#piece");
    await touch(cdp, "touchStart", [{ ...home, id: 3 }]);
    await touch(cdp, "touchMove", [{ x: home.x + 10, y: home.y - 20, id: 3 }]);
    await touch(cdp, "touchCancel", []);
    await waitIdle(page, "dog");
    assert.equal((await inspect(page)).state, "idle");
    assert.equal((await inspect(page)).placed, 0);
    await page.waitForTimeout(300);
    home = await point(page, "#piece");
    await page.mouse.move(home.x, home.y);
    await page.mouse.down();
    await page.mouse.move(home.x + 10, home.y - 20);
    await page.evaluate(() => document.querySelector("#piece").releasePointerCapture(window.__verification.lastPointerId));
    await page.mouse.move(home.x + 11, home.y - 20);
    await page.mouse.up();
    assert.equal((await inspect(page)).state, "idle");
    assert.equal((await inspect(page)).placed, 0);
    console.log("PASS trusted multi-touch, owner-only, pointercancel, lost capture, rapid/completion input, no double advance");

    await autoSnap(page);
    await page.waitForFunction(() => document.querySelector("#board").classList.contains("is-complete"));
    await page.setViewportSize({ width: 844, height: 390 });
    await checkLayout(page, 844, 390);
    assert.equal((await inspect(page)).animal, "dog");
    assert.equal((await inspect(page)).state, "idle");
    assert.equal((await inspect(page)).complete, false);
    assert.equal((await inspect(page)).timers, 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await checkLayout(page, 390, 844);
    await autoSnap(page);
    // Simulated hidden-state event; real pagehide/pageshow are tested with BFCache below.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert.equal((await inspect(page)).state, "idle");
    assert.equal((await inspect(page)).timers, 0);
    assert.equal((await inspect(page)).complete, false);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert.equal((await inspect(page)).animal, "dog");
    console.log("PASS resize/rotation and visibilitychange: current animal resets to stable uncompleted state");

    for (const phase of ["completing", "transitioning"]) {
      await autoSnap(page);
      await page.waitForFunction((value) => document.querySelector("#board").dataset.state === value, phase);
      // A second document of this app keeps the BFCache check self-contained.
      // Navigating to plain Markdown can request the site's unrelated favicon.
      await page.goto(new URL("?bfcache-check=away", base).href);
      await page.goBack({ waitUntil: "commit" });
      await page.waitForFunction(() => Boolean(document.querySelector("#board")));
      const back = await inspect(page);
      assert.equal(back.state, "idle");
      assert.equal(back.animal, "dog");
      assert.equal(back.timers, 0);
      assert.equal(back.placed, 0);
      assert.equal(back.complete, false);
      assert.deepEqual(back.lifecycle.at(-1), { type: "pageshow", persisted: true }, "actual BFCache restores document");
    }
    console.log("PASS actual BFCache during snap and fade: pageshow.persisted=true, timers/partial completion cleared");

    await page.emulateMedia({ reducedMotion: "reduce" });
    for (let i = 0; i < 3; i++) {
      const animal = (await inspect(page)).animal;
      await autoSnap(page);
      await page.waitForFunction(() => document.querySelector("#board").classList.contains("is-complete"));
      const reduced = await page.locator("#animal-" + animal).evaluate((e) => ({
        animation: getComputedStyle(e.querySelector(".turtle-head, .dog-tail, .fox-ear-left")).animationName,
        snap: getComputedStyle(document.querySelector("#piece")).transitionDuration,
        fade: getComputedStyle(document.querySelector("#target")).transitionDuration
      }));
      assert.deepEqual(reduced, { animation: "none", snap: "0.06s", fade: "0.12s" });
      await waitIdle(page, animals[(animals.indexOf(animal) + 1) % 3]);
    }
    await page.locator("#piece").focus();
    await page.keyboard.press("Enter");
    await waitIdle(page, "fox");
    await page.locator("#piece").focus();
    await page.keyboard.press("Space");
    await waitIdle(page, "turtle");
    console.log("PASS reduced motion: all animal motions off, 60ms snap/return, 120ms fade; completion/cycle and keyboard retained");

    let longRun = null;
    if (longSeconds > 0) {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.reload();
      const initial = await inspect(page);
      const started = Date.now();
      let stages = 0;
      while (Date.now() - started < longSeconds * 1000) {
        const from = await point(page, "#piece");
        const destination = await point(page, "#target");
        await touch(cdp, "touchStart", [{ ...from, id: 1 }]);
        await touch(cdp, "touchMove", [{ ...destination, id: 1 }]);
        await page.waitForFunction(() => document.querySelector("#board").dataset.state === "completing");
        const active = await inspect(page);
        assert.equal(active.state, "completing");
        assert.equal(active.dom, initial.dom);
        assert.equal(active.timers, 1);
        await touch(cdp, "touchEnd", []);
        await waitIdle(page, animals[(stages + 1) % 3]);
        const idle = await inspect(page);
        assert.equal(idle.dom, initial.dom);
        assert.equal(idle.timers, 0);
        stages++;
        if (stages % 20 === 0) console.log("Long run " + Math.round((Date.now() - started) / 1000) + "s: " + stages + " stages, DOM " + idle.dom + ", max timer " + idle.maxTimers);
      }
      longRun = { seconds: (Date.now() - started) / 1000, stages, ...await inspect(page) };
      assert.equal(longRun.maxTimers, 1);
      fs.writeFileSync(output + "/long-run.json", JSON.stringify(longRun, null, 2));
      console.log("PASS real-time long run: " + longRun.seconds + "s / " + stages + " stages, DOM " + longRun.dom + ", max timer 1");
    }
    assert.deepEqual(errors, [], "no console errors or warnings");
    assert.ok(requests.every((url) => url.startsWith(new URL(base).origin)), "no external requests");
    fs.writeFileSync(output + "/browser-results.json", JSON.stringify({ base, sizes, longRun, errors, externalRequests: [], bfcache: true }, null, 2));
    console.log("APP-013 browser regression: PASS; no external requests, console errors or warnings");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
