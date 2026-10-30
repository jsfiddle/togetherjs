/* The remote cursor: the pointer, its name bubble, and the mark beside the
   name that says whether that peer is typing or talking. */

import { test, expect, openClient, startSession, peerCount } from "./fixtures.js";

/** The live cursor for the other peer. The template copy lives inside
    #togetherjs-container; the real ones are appended to <body>. */
function cursorState(page) {
  return page.evaluate(() => {
    const cursor = Array.from(document.querySelectorAll(".togetherjs-cursor")).find(
      (el) => !el.closest("#togetherjs-container"),
    );
    if (!cursor) return null;
    const bubble = cursor.querySelector(".togetherjs-cursor-name");
    const visible = (sel) => {
      const el = cursor.querySelector(sel);
      return !!el && getComputedStyle(el).display !== "none";
    };
    const style = getComputedStyle(bubble);
    return {
      name: cursor.querySelector(".togetherjs-cursor-label").textContent,
      typing: visible(".togetherjs-cursor-typing"),
      speaking: visible(".togetherjs-cursor-speaking"),
      background: style.backgroundColor,
      color: style.color,
      borderWidth: style.borderTopWidth,
    };
  });
}

/** Two peers in a session, with the second one's cursor on the first's page. */
async function twoPeers(browser, hub, { color = "#c74c3d", name = "Grace" } = {}) {
  const a = await openClient(browser, hub);
  const shareUrl = await startSession(a);
  const b = await openClient(browser, hub, { url: shareUrl });
  await b.waitForFunction(() => window.TogetherJS && window.TogetherJS.running);
  await expect.poll(() => peerCount(a)).toBe(1);
  await b.evaluate(
    ([n, c]) => window.TogetherJS._internals.registry.need("peers").Self.update({ name: n, color: c }),
    [name, color],
  );
  // Move b's pointer so a has a cursor to look at.
  await b.mouse.move(300, 300, { steps: 4 });
  await expect.poll(() => cursorState(a)).not.toBeNull();
  return { a, b };
}

test("the name bubble is filled with the peer's colour and has no border", async ({
  browser,
  hub,
  statics,
}) => {
  const { a, b } = await twoPeers(browser, hub, { color: "#c74c3d" });

  await expect.poll(() => cursorState(a).then((s) => s.name)).toBe("Grace");
  const state = await cursorState(a);
  expect(state.background).toBe("rgb(199, 76, 61)"); // #c74c3d
  expect(state.borderWidth).toBe("0px");
  // Text is black or white, whichever reads against that colour.
  expect(["rgb(255, 255, 255)", "rgb(17, 17, 17)"]).toContain(state.color);

  await a.context().close();
  await b.context().close();
});

test("the bubble's text flips to stay legible on a pale colour", async ({
  browser,
  hub,
  statics,
}) => {
  // The swatches are all one lightness, but the picker also offers the
  // platform colour input, so any colour can arrive here.
  const { a, b } = await twoPeers(browser, hub, { color: "#ffe066" });

  await expect.poll(() => cursorState(a).then((s) => s.background)).toBe("rgb(255, 224, 102)");
  expect((await cursorState(a)).color).toBe("rgb(17, 17, 17)");

  await a.context().close();
  await b.context().close();
});

test("typing shows the dots beside the name, and they clear", async ({ browser, hub, statics }) => {
  const { a, b } = await twoPeers(browser, hub);

  expect((await cursorState(a)).typing).toBe(false);

  await b.focus("#name");
  await b.keyboard.type("hello", { delay: 60 });
  await expect.poll(() => cursorState(a).then((s) => s.typing)).toBe(true);
  expect((await cursorState(a)).speaking).toBe(false);

  // KEYDOWN_WAIT_TIME is 2s.
  await expect.poll(() => cursorState(a).then((s) => s.typing), { timeout: 6000 }).toBe(false);

  await a.context().close();
  await b.context().close();
});

test("speaking shows a microphone beside the name, and it clears", async ({
  browser,
  hub,
  statics,
}) => {
  const { a, b } = await twoPeers(browser, hub);

  expect((await cursorState(a)).speaking).toBe(false);

  await a.evaluate(() => window.TogetherJSTestSpy.rtc.startAudio());
  await b.evaluate(() => window.TogetherJSTestSpy.rtc.startAudio());

  // The synthetic microphone is a steady tone, which reads as speech.
  await expect.poll(() => cursorState(a).then((s) => s.speaking), { timeout: 20000 }).toBe(true);

  // Silence b, and the mark goes away after the hold-off.
  await b.evaluate(() => {
    window.__togetherjsTestGain.gain.value = 0;
  });
  await expect.poll(() => cursorState(a).then((s) => s.speaking), { timeout: 10000 }).toBe(false);

  await a.context().close();
  await b.context().close();
});

test("speaking takes precedence over typing", async ({ browser, hub, statics }) => {
  const { a, b } = await twoPeers(browser, hub);

  await a.evaluate(() => window.TogetherJSTestSpy.rtc.startAudio());
  await b.evaluate(() => window.TogetherJSTestSpy.rtc.startAudio());
  await expect.poll(() => cursorState(a).then((s) => s.speaking), { timeout: 20000 }).toBe(true);

  await b.focus("#name");
  await b.keyboard.type("talking and typing", { delay: 30 });

  // Both are true of the peer; only one mark fits beside the name.
  const state = await cursorState(a);
  expect(state.speaking).toBe(true);
  expect(state.typing).toBe(false);

  await a.context().close();
  await b.context().close();
});
