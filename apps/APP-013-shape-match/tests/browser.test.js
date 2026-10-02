"use strict";

// Verification dependency only; the application itself has no dependencies.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
const base = process.env.APP013_BASE_URL || "http://127.0.0.1:8000/apps/APP-013-shape-match/";
const longSeconds = Number(process.env.APP013_LONG_SECONDS || 0);
const output = process.env.APP013_ARTIFACT_DIR || "/tmp/app013-verification";
fs.mkdirSync(output, { recursive: true });

async function inspect(page) {
  return page.evaluate(() => ({
    dom: document.querySelectorAll("*").length,
    placed: document.querySelectorAll(".is-placed").length,
    dragging: document.querySelectorAll(".is-dragging").length,
    near: document.querySelectorAll(".is-near").length,
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

async function drag(page, shape, destination) {
  const from = await point(page, `#piece-${shape}`);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(destination.x, destination.y, { steps: 5 });
  await page.mouse.up();
}

async function waitPlaced(page, count) {
  await page.waitForFunction((value) => document.querySelectorAll(".is-placed").length === value, count);
}

async function touch(cdp, type, points) {
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p) => ({ ...p, radiusX: 5, radiusY: 5, force: 1 })) });
}

async function multiDrag(page, cdp) {
  const shapes = ["circle", "square", "triangle"];
  const starts = await Promise.all(shapes.map((s, id) => point(page, `#piece-${s}`).then((p) => ({ ...p, id }))));
  const ends = await Promise.all(shapes.map((s, id) => point(page, `#target-${s}`).then((p) => ({ ...p, id }))));
  await touch(cdp, "touchStart", starts);
  await touch(cdp, "touchMove", ends);
  await touch(cdp, "touchEnd", []);
}

(async () => {
  const launch = {
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
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
    const errors = [];
    const requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (["error", "warning"].includes(message.type())) errors.push(message.text()); });
    page.on("request", (request) => requests.push(request.url()));
    const cdp = await context.newCDPSession(page);
    const sizes = [[390, 844], [844, 390], [1024, 768]];
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.goto(base);
      const initial = await inspect(page);
      assert.deepEqual(initial.scroll, [false, false]);
      assert.equal(await page.locator(".piece").count(), 3);
      assert.equal(await page.locator(".target").count(), 3);
      const rects = await page.locator(".piece, .target").evaluateAll((elements) => elements.map((e) => e.getBoundingClientRect().toJSON()));
      rects.forEach((r) => {
        assert.ok(r.left >= 9 && r.top >= 9 && r.right <= width - 9 && r.bottom <= height - 9, "all shapes inside safe content area");
        assert.ok(r.width >= 88, "large drag and target area");
      });
      rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => {
        assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, "initial shapes do not overlap");
      }));
      await page.screenshot({ path: `${output}/${width}x${height}.png` });
      const home = await point(page, "#piece-circle");
      await drag(page, "circle", await point(page, "#target-square"));
      await page.waitForTimeout(320);
      assert.equal((await inspect(page)).placed, 0);
      const returned = await point(page, "#piece-circle");
      assert.ok(Math.hypot(returned.x - home.x, returned.y - home.y) < 1);
      await drag(page, "circle", { x: width / 2, y: height - 12 });
      await page.waitForTimeout(320);
      assert.equal((await inspect(page)).placed, 0);
      const near = await point(page, "#target-circle");
      if (width === 390) {
        await drag(page, "circle", { x: near.x + 70, y: near.y });
        await page.waitForTimeout(320);
        assert.equal((await inspect(page)).placed, 0, "overlapping region over a nearer wrong target returns home");
      }
      await drag(page, "circle", { x: near.x, y: near.y + 70 });
      await waitPlaced(page, 1);
      await drag(page, "square", await point(page, "#target-square"));
      await drag(page, "triangle", await point(page, "#target-triangle"));
      await waitPlaced(page, 3);
      assert.equal((await inspect(page)).timers, 1);
      await waitPlaced(page, 0);
      assert.equal((await inspect(page)).dom, initial.dom);
      console.log(`PASS ${width}x${height}: layout, wide match, wrong/outside return, all shapes, reset; DOM ${initial.dom}`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await multiDrag(page, cdp);
    await waitPlaced(page, 3);
    await waitPlaced(page, 0);
    console.log("PASS trusted browser touch: three simultaneous fingers");

    const from = await point(page, "#piece-circle");
    await touch(cdp, "touchStart", [{ ...from, id: 1 }, { x: from.x + 5, y: from.y, id: 2 }]);
    assert.equal((await inspect(page)).dragging, 1);
    const target = await point(page, "#target-circle");
    await touch(cdp, "touchMove", [{ ...target, id: 1 }, { x: from.x + 5, y: from.y, id: 2 }]);
    await touch(cdp, "touchEnd", [{ x: from.x + 5, y: from.y, id: 2 }]);
    assert.equal((await inspect(page)).placed, 0, "second finger cannot place owner's piece");
    await touch(cdp, "touchEnd", []);
    await waitPlaced(page, 1);

    const square = await point(page, "#piece-square");
    await touch(cdp, "touchStart", [{ ...square, id: 3 }]);
    await touch(cdp, "touchMove", [{ ...await point(page, "#target-square"), id: 3 }]);
    await touch(cdp, "touchCancel", []);
    assert.equal((await inspect(page)).dragging, 0);
    assert.equal((await inspect(page)).placed, 1);
    await page.waitForTimeout(320);
    const squareHome = await point(page, "#piece-square");
    const squareTarget = await point(page, "#target-square");
    await page.mouse.move(squareHome.x, squareHome.y);
    await page.mouse.down();
    await page.mouse.move(squareTarget.x, squareTarget.y);
    await page.evaluate(() => {
      document.querySelector("#piece-square").releasePointerCapture(window.__verification.lastPointerId);
    });
    await page.mouse.move(squareTarget.x + 1, squareTarget.y);
    await page.mouse.up();
    assert.equal((await inspect(page)).dragging, 0);
    assert.equal((await inspect(page)).placed, 1, "lost capture returns without placing");
    await page.setViewportSize({ width: 844, height: 390 });
    const placed = await point(page, "#piece-circle");
    const rotated = await point(page, "#target-circle");
    assert.ok(Math.hypot(placed.x - rotated.x, placed.y - rotated.y) < 1);
    console.log("PASS same-piece ownership, pointercancel, lostpointercapture, placed shape follows rotation");

    // Simulated visibilitychange complements the actual pagehide/BFCache check below.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert.equal((await inspect(page)).dragging, 0);
    assert.equal((await inspect(page)).timers, 0);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Leave during completion, then return through the browser history.
    await page.reload();
    await multiDrag(page, cdp);
    await waitPlaced(page, 3);
    await page.goto(new URL("README.md", base).href);
    await page.goBack({ waitUntil: "commit" });
    await page.waitForFunction(() => Boolean(document.querySelector("#board")));
    const back = await inspect(page);
    assert.equal(back.dragging, 0);
    assert.equal(back.timers, 0);
    assert.equal(back.placed, 0);
    const bfcache = back.lifecycle.some((event) => event.type === "pageshow" && event.persisted);
    assert.ok(bfcache, "browser history restores the actual BFCache document");
    console.log("PASS actual BFCache: pageshow.persisted=true, completion timer cleared, stable return");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await multiDrag(page, cdp);
    await waitPlaced(page, 3);
    const reduced = await page.locator("#piece-circle").evaluate((e) => ({
      duration: getComputedStyle(e).transitionDuration,
      animation: getComputedStyle(e.firstElementChild).animationName,
      complete: getComputedStyle(document.querySelector(".target svg")).animationName
    }));
    assert.deepEqual(reduced, { duration: "0.06s", animation: "none", complete: "none" });
    await waitPlaced(page, 0);
    await page.locator("#piece-circle").focus();
    await page.keyboard.press("Enter");
    await waitPlaced(page, 1);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    await waitPlaced(page, 2);
    console.log("PASS reduced motion: 60ms movements, no bounce; keyboard/ARIA");

    if (longSeconds > 0) {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.reload();
      const initial = await inspect(page);
      const started = Date.now();
      let rounds = 0;
      while (Date.now() - started < longSeconds * 1000) {
        await multiDrag(page, cdp);
        await waitPlaced(page, 3);
        const active = await inspect(page);
        assert.equal(active.dom, initial.dom);
        assert.equal(active.timers, 1);
        await waitPlaced(page, 0);
        const idle = await inspect(page);
        assert.equal(idle.dom, initial.dom);
        assert.equal(idle.timers, 0);
        rounds++;
        if (rounds % 20 === 0) console.log(`Long run ${Math.round((Date.now() - started) / 1000)}s: ${rounds} rounds / ${rounds * 3} drags, DOM ${idle.dom}, max timer ${idle.maxTimers}`);
      }
      const result = { seconds: (Date.now() - started) / 1000, rounds, drags: rounds * 3, ...await inspect(page) };
      assert.equal(result.maxTimers, 1);
      fs.writeFileSync(`${output}/long-run.json`, JSON.stringify(result, null, 2));
      console.log(`PASS real-time long run: ${result.seconds}s / ${result.drags} drags, DOM ${result.dom}, max timer 1`);
    }
    assert.deepEqual(errors, [], "no console errors or warnings");
    assert.ok(requests.every((url) => url.startsWith(new URL(base).origin)), "no external requests");
    console.log("APP-013 browser regression: PASS; no external requests, console errors or warnings");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
