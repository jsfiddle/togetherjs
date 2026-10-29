/* The parts of the interface that were silently dead before the rebuild.

   Each of these covers something that looked wired up but was not: the drag
   handle pointed at an element that does not exist, the colour swatches threw
   on every click, and the chat invite link called a function off the wrong
   object. None of them would have failed a test, because there were none. */

import { test, expect, openClient, startSession } from "./fixtures.js";

/* Presses the pointer on `from` and drags it to (x, y) in viewport
   coordinates. Playwright's mouse emits pointer events, which is what the
   dock listens for. */
async function dragTo(page, selector, x, y) {
  const box = await page.locator(selector).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // Two moves: the first starts the drag, the second lands it. A single move
  // can be coalesced with the press on some platforms.
  await page.mouse.move(x, y, { steps: 10 });
  await page.mouse.move(x, y);
  await page.mouse.up();
}

const dockEdge = (page) =>
  page.evaluate(() => {
    const dock = document.querySelector("#togetherjs-dock");
    return ["left", "right", "top", "bottom"].find((edge) =>
      dock.classList.contains("togetherjs-dock-" + edge),
    );
  });

test("the dock can be dragged to another edge", async ({ browser, hub, statics }) => {
  const page = await openClient(browser, hub);
  await startSession(page);

  expect(await dockEdge(page)).toBe("right");

  // Drag the handle to the far left; release should snap to that edge.
  await dragTo(page, "#togetherjs-dock-anchor", 40, 300);
  await expect
    .poll(() => dockEdge(page), { message: "dock should snap to the nearest edge" })
    .toBe("left");

  const box = await page.locator("#togetherjs-dock").boundingBox();
  expect(box.x).toBeLessThan(200);

  expect(page.errors).toEqual([]);
  await page.context().close();
});

test("a dragged dock is still there after a reload", async ({ browser, hub, statics }) => {
  // The 2013 dock snapped to an edge but never saved it, so it reset to the
  // right on every page load.
  const page = await openClient(browser, hub);
  await startSession(page);
  await dragTo(page, "#togetherjs-dock-anchor", 40, 300);
  await expect.poll(() => dockEdge(page)).toBe("left");

  await page.reload();
  await page.waitForFunction(() => window.TogetherJS && window.TogetherJS.running);
  await page.waitForSelector("#togetherjs-dock");

  await expect.poll(() => dockEdge(page)).toBe("left");
  await page.context().close();
});

test("the dock can be moved from the keyboard", async ({ browser, hub, statics }) => {
  const page = await openClient(browser, hub);
  await startSession(page);

  await page.focus("#togetherjs-dock-anchor");
  // Enough presses to cross the viewport: the snap picks the nearest edge
  // measured from the dock's centre, so a half-hearted nudge from the right
  // edge of a wide-but-short window lands on "top", not "left".
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("ArrowLeft");
  }
  await expect.poll(() => dockEdge(page)).toBe("left");

  expect(page.errors).toEqual([]);
  await page.context().close();
});

test("panels follow the dock to its new edge", async ({ browser, hub, statics }) => {
  // windowing.js used to hardcode `var ifacePos = "right"` with the real
  // lookup commented out, so a dock on the left grew its panels off-screen.
  const page = await openClient(browser, hub);
  await startSession(page);

  await dragTo(page, "#togetherjs-dock-anchor", 40, 300);
  await expect.poll(() => dockEdge(page)).toBe("left");

  await page.click("#togetherjs-chat-button");
  await expect(page.locator("#togetherjs-chat")).toBeVisible();

  const dock = await page.locator("#togetherjs-dock").boundingBox();
  const chat = await page.locator("#togetherjs-chat").boundingBox();
  const viewport = page.viewportSize();

  expect(chat.x).toBeGreaterThanOrEqual(0);
  expect(chat.x + chat.width).toBeLessThanOrEqual(viewport.width);
  // On a left-hand dock the panel opens to its right.
  expect(chat.x).toBeGreaterThan(dock.x);

  await page.context().close();
});

const selfColor = (page) => page.evaluate(() => window.TogetherJS._internals.registry.need("peers").Self.color);

async function openColorPicker(page) {
  await page.click("#togetherjs-profile-button");
  await page.click("#togetherjs-menu-update-color");
  await expect(page.locator("#togetherjs-pick-color")).toBeVisible();
}

test("clicking a swatch changes your colour", async ({ browser, hub, statics }) => {
  // The swatch handler used jQuery's `.click(selector, fn)` delegation form,
  // which dom.js does not accept: the callback was dropped and every click
  // threw, while a second handler closed the popup -- so the picker looked
  // like it simply ignored you.
  const page = await openClient(browser, hub);
  await startSession(page);
  const before = await selfColor(page);

  await openColorPicker(page);
  const swatches = page.locator("#togetherjs-swatches .togetherjs-swatch");
  await expect(swatches).not.toHaveCount(0);

  // Pick a swatch that is not the current colour.
  const target = await page.evaluate((current) => {
    const all = Array.from(document.querySelectorAll("#togetherjs-swatches .togetherjs-swatch"));
    const el = all.find((s) => s.getAttribute("data-color") !== current);
    return el.getAttribute("data-color");
  }, before);

  await page.click(`#togetherjs-swatches .togetherjs-swatch[data-color="${target}"]`);
  await expect.poll(() => selfColor(page)).toBe(target);

  // ...and the chosen swatch is marked, which never happened before either:
  // the palette was uppercase and the stored colour lowercase.
  await expect(
    page.locator(`#togetherjs-swatches .togetherjs-swatch[data-color="${target}"]`),
  ).toHaveAttribute("aria-checked", "true");

  expect(page.errors).toEqual([]);
  await page.context().close();
});

test("the swatch grid is usable from the keyboard", async ({ browser, hub, statics }) => {
  const page = await openClient(browser, hub);
  await startSession(page);

  await openColorPicker(page);
  const before = await selfColor(page);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => selfColor(page)).not.toBe(before);

  expect(page.errors).toEqual([]);
  await page.context().close();
});

test("a colour change reaches the other peer", async ({ browser, hub, statics }) => {
  const a = await openClient(browser, hub);
  const shareUrl = await startSession(a);
  const b = await openClient(browser, hub, { url: shareUrl });
  await b.waitForFunction(() => window.TogetherJS && window.TogetherJS.running);
  await a.waitForFunction(() => window.TogetherJS._internals.registry.need("peers").getAllPeers().length === 1);

  await openColorPicker(a);
  const target = await a.evaluate(() => {
    const all = Array.from(document.querySelectorAll("#togetherjs-swatches .togetherjs-swatch"));
    const current = window.TogetherJS._internals.registry.need("peers").Self.color;
    return all.find((s) => s.getAttribute("data-color") !== current).getAttribute("data-color");
  });
  await a.click(`#togetherjs-swatches .togetherjs-swatch[data-color="${target}"]`);

  await expect
    .poll(() => b.evaluate(() => window.TogetherJS._internals.registry.need("peers").getAllPeers()[0].color))
    .toBe(target);

  await a.context().close();
  await b.context().close();
});

test("an invalid colour from a peer is ignored", async ({ browser, hub, statics }) => {
  // A peer's colour used to go straight into a style property unchecked;
  // peers.js carried a FIXME saying as much.
  const a = await openClient(browser, hub);
  const shareUrl = await startSession(a);
  const b = await openClient(browser, hub, { url: shareUrl });
  await b.waitForFunction(() => window.TogetherJS && window.TogetherJS.running);
  await a.waitForFunction(() => window.TogetherJS._internals.registry.need("peers").getAllPeers().length === 1);

  const before = await a.evaluate(() => window.TogetherJS._internals.registry.need("peers").getAllPeers()[0].color);
  await b.evaluate(() =>
    window.TogetherJS._internals.registry.need("peers").Self.update({ color: "url(javascript:alert(1))" }),
  );
  await a.waitForTimeout(300);
  expect(await a.evaluate(() => window.TogetherJS._internals.registry.need("peers").getAllPeers()[0].color)).toBe(before);

  await a.context().close();
  await b.context().close();
});

test("modal dialogs trap focus and give it back", async ({ browser, hub, statics }) => {
  const page = await openClient(browser, hub);
  await startSession(page);

  await page.click("#togetherjs-profile-button");
  await page.click("#togetherjs-menu-end");
  await expect(page.locator("#togetherjs-confirm-end")).toBeVisible();

  // Tab all the way round: focus must stay inside the dialog.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() =>
      document.querySelector("#togetherjs-confirm-end").contains(document.activeElement),
    );
    expect(inside, `focus escaped the dialog on tab ${i + 1}`).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(page.locator("#togetherjs-confirm-end")).toBeHidden();

  expect(page.errors).toEqual([]);
  await page.context().close();
});

test("the UI carries no PNG icons and loads no images", async ({ browser, hub, statics }) => {
  // 22 single-colour PNG masks became inline SVG. Nothing in the dock should
  // be fetching an image any more; the only asset left is the notification
  // sound, which is not loaded until it plays.
  const page = await openClient(browser, hub);
  await startSession(page);

  const requested = [];
  page.on("request", (r) => {
    if (r.resourceType() === "image") requested.push(r.url());
  });
  await page.click("#togetherjs-chat-button");
  await page.click("#togetherjs-share-button");
  await page.waitForTimeout(300);

  expect(requested).toEqual([]);
  expect(
    await page.evaluate(() => document.querySelectorAll("#togetherjs-container img").length),
  ).toBe(0);
  expect(
    await page.evaluate(() => document.querySelectorAll("#togetherjs-container svg").length),
  ).toBeGreaterThan(5);

  await page.context().close();
});

test("the theme can be forced to dark", async ({ browser, hub, statics }) => {
  const page = await openClient(browser, hub, {
    config: { TogetherJSConfig_theme: "dark" },
  });
  await startSession(page);

  await expect(page.locator("#togetherjs-container")).toHaveAttribute("data-tj-theme", "dark");
  // The token actually resolves, rather than just the attribute being set.
  const surface = await page.evaluate(() =>
    getComputedStyle(document.querySelector("#togetherjs-container"))
      .getPropertyValue("--tj-surface")
      .trim(),
  );
  expect(surface).toBe("#1c1f24");

  await page.context().close();
});

test("TogetherJS does not restyle the host page", async ({ browser, hub, statics }) => {
  // The old stylesheet set `font-size: 16px !important` on every input on the
  // page, faded every disabled button, and turned them blue on hover.
  const page = await openClient(browser, hub);

  const before = await page.evaluate(() => {
    const input = document.querySelector("#name");
    const cs = getComputedStyle(input);
    return { fontSize: cs.fontSize, padding: cs.padding };
  });

  await startSession(page);

  const after = await page.evaluate(() => {
    const input = document.querySelector("#name");
    const cs = getComputedStyle(input);
    return { fontSize: cs.fontSize, padding: cs.padding };
  });

  expect(after).toEqual(before);
  await page.context().close();
});
