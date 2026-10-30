/* The audio/video mesh.
 *
 * Chromium runs with --use-fake-device-for-media-capture and
 * --use-fake-ui-for-media-stream (see playwright.config.js), so getUserMedia
 * resolves with a synthetic camera and microphone and no permission prompt.
 * That makes the whole negotiation testable headlessly.
 *
 * The tests assert on getStats() rather than only on connectionState: ICE
 * completing does not prove media is flowing. Nor, it turns out, does
 * getStats() prove anyone can hear it -- see "remote audio reaches an element
 * that can play it" below.
 */

import { test, expect, openClient, startSession, peerCount } from "./fixtures.js";

/** Join the call from this page. */
function joinAudio(page) {
  return page.evaluate(() => window.TogetherJSTestSpy.rtc.startAudio());
}

/* The audio tracks actually attached to the <audio> sinks on this page.
   Packets arriving at the transport and packets reaching a sink are two
   different things, and only the second one is audible. */
function attachedAudioTracks(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("audio[data-togetherjs-peer]")).reduce(
      (total, el) => total + (el.srcObject ? el.srcObject.getAudioTracks().length : 0),
      0,
    ),
  );
}

function meshSize(page) {
  return page.evaluate(() => window.TogetherJSTestSpy.rtc.mesh.size());
}

/** True once every connection this page holds reports "connected". */
function allConnected(page) {
  return page.evaluate(() => {
    const mesh = window.TogetherJSTestSpy.rtc.mesh;
    const ids = mesh.peerIds();
    if (!ids.length) return false;
    return ids.every((id) => {
      const conn = mesh._connectionFor(id);
      return conn && conn.connectionState === "connected";
    });
  });
}

/** Total inbound RTP packets across every connection — proof media flows. */
function inboundPackets(page) {
  return page.evaluate(async () => {
    const mesh = window.TogetherJSTestSpy.rtc.mesh;
    let total = 0;
    for (const id of mesh.peerIds()) {
      const conn = mesh._connectionFor(id);
      if (!conn) continue;
      const stats = await conn.pc.getStats();
      stats.forEach((report) => {
        if (report.type === "inbound-rtp" && typeof report.packetsReceived === "number") {
          total += report.packetsReceived;
        }
      });
    }
    return total;
  });
}

async function twoPeerCall(browser, hub) {
  const a = await openClient(browser, hub);
  const shareUrl = await startSession(a);
  const b = await openClient(browser, hub, { url: shareUrl });
  await b.waitForFunction(() => window.TogetherJS.running);
  await expect.poll(() => peerCount(a)).toBe(1);
  return { a, b };
}

test("two peers connect and audio flows both ways", async ({ browser, hub, statics }) => {
  const { a, b } = await twoPeerCall(browser, hub);

  await joinAudio(a);
  await joinAudio(b);

  await expect.poll(() => meshSize(a), { timeout: 20000 }).toBe(1);
  await expect.poll(() => meshSize(b), { timeout: 20000 }).toBe(1);
  await expect.poll(() => allConnected(a), { timeout: 20000 }).toBe(true);
  await expect.poll(() => allConnected(b), { timeout: 20000 }).toBe(true);

  // ICE completing is not the same as media arriving.
  await expect.poll(() => inboundPackets(a), { timeout: 20000 }).toBeGreaterThan(0);
  await expect.poll(() => inboundPackets(b), { timeout: 20000 }).toBeGreaterThan(0);

  await a.context().close();
  await b.context().close();
});

test("remote audio reaches an element that can play it", async ({ browser, hub, statics }) => {
  /* The call was silent for a while and these tests did not notice. Both
     sides create their transceivers up front and fill them with
     replaceTrack() later, and a track attached that way belongs to no
     MediaStream -- so `event.streams[0]` in ontrack was undefined and went
     into `el.srcObject` as undefined. RTP kept arriving, packetsReceived kept
     climbing, and nothing came out of the speakers.

     So: assert on the sink, not only on the transport. */
  const { a, b } = await twoPeerCall(browser, hub);

  await joinAudio(a);
  await joinAudio(b);
  await expect.poll(() => allConnected(a), { timeout: 20000 }).toBe(true);

  await expect.poll(() => attachedAudioTracks(a), { timeout: 20000 }).toBe(1);
  await expect.poll(() => attachedAudioTracks(b), { timeout: 20000 }).toBe(1);

  // ...and the track is live, not an ended leftover.
  const live = await a.evaluate(() => {
    const el = document.querySelector("audio[data-togetherjs-peer]");
    return el.srcObject.getAudioTracks().every((t) => t.readyState === "live");
  });
  expect(live).toBe(true);

  await a.context().close();
  await b.context().close();
});

test("three peers form a full mesh", async ({ browser, hub, statics }) => {
  // The case the previous implementation could not handle at all: it held one
  // connection for the whole room and broadcast its offers to everyone.
  const a = await openClient(browser, hub);
  const shareUrl = await startSession(a);
  const b = await openClient(browser, hub, { url: shareUrl });
  const c = await openClient(browser, hub, { url: shareUrl });
  await b.waitForFunction(() => window.TogetherJS.running);
  await c.waitForFunction(() => window.TogetherJS.running);
  await expect.poll(() => peerCount(a)).toBe(2);

  await joinAudio(a);
  await joinAudio(b);
  await joinAudio(c);

  for (const page of [a, b, c]) {
    await expect.poll(() => meshSize(page), { timeout: 25000 }).toBe(2);
    await expect.poll(() => allConnected(page), { timeout: 25000 }).toBe(true);
  }

  await a.context().close();
  await b.context().close();
  await c.context().close();
});

test("simultaneous joins still converge (offer glare)", async ({ browser, hub, statics }) => {
  const { a, b } = await twoPeerCall(browser, hub);

  // Both sides start negotiating in the same tick. Without perfect
  // negotiation the two offers collide and the old rtc-abort logic thrashes;
  // here the impolite peer ignores the incoming offer and the polite one
  // rolls back.
  await Promise.all([joinAudio(a), joinAudio(b)]);

  await expect.poll(() => allConnected(a), { timeout: 25000 }).toBe(true);
  await expect.poll(() => allConnected(b), { timeout: 25000 }).toBe(true);

  await a.context().close();
  await b.context().close();
});

test("enabling video mid-call does not drop the connection", async ({ browser, hub, statics }) => {
  const { a, b } = await twoPeerCall(browser, hub);
  await joinAudio(a);
  await joinAudio(b);
  await expect.poll(() => allConnected(a), { timeout: 20000 }).toBe(true);

  await a.evaluate(() => window.TogetherJSTestSpy.rtc.startVideo());

  // B should receive a video track and render a tile for A...
  await expect.poll(() => b.locator(".togetherjs-video-tile[data-togetherjs-peer]").count(), {
    timeout: 20000,
  }).toBeGreaterThan(0);

  // ...without the audio connection being torn down and rebuilt.
  expect(await allConnected(a)).toBe(true);
  expect(await allConnected(b)).toBe(true);

  await a.context().close();
  await b.context().close();
});

test("muting is visible to the other peer and keeps the connection", async ({
  browser,
  hub,
  statics,
}) => {
  const { a, b } = await twoPeerCall(browser, hub);
  await joinAudio(a);
  await joinAudio(b);
  await expect.poll(() => allConnected(b), { timeout: 20000 }).toBe(true);

  await a.evaluate(() => window.TogetherJSTestSpy.rtc.toggleMute());

  await expect
    .poll(() => b.evaluate(() => {
      const mesh = window.TogetherJSTestSpy.rtc.mesh;
      const id = mesh.peerIds()[0];
      const state = mesh.stateFor(id);
      return state ? state.audio : null;
    }), { timeout: 15000 })
    .toBe(false);

  // Muting flips track.enabled; it must not renegotiate or drop the call.
  expect(await allConnected(b)).toBe(true);

  await a.context().close();
  await b.context().close();
});

test("a peer leaving is torn down without disturbing the others", async ({
  browser,
  hub,
  statics,
}) => {
  const a = await openClient(browser, hub);
  const shareUrl = await startSession(a);
  const b = await openClient(browser, hub, { url: shareUrl });
  const c = await openClient(browser, hub, { url: shareUrl });
  await b.waitForFunction(() => window.TogetherJS.running);
  await c.waitForFunction(() => window.TogetherJS.running);
  await expect.poll(() => peerCount(a)).toBe(2);

  await joinAudio(a);
  await joinAudio(b);
  await joinAudio(c);
  await expect.poll(() => meshSize(a), { timeout: 25000 }).toBe(2);

  await c.evaluate(() => window.TogetherJS());

  await expect.poll(() => meshSize(a), { timeout: 20000 }).toBe(1);
  await expect.poll(() => meshSize(b), { timeout: 20000 }).toBe(1);
  await expect.poll(() => allConnected(a), { timeout: 20000 }).toBe(true);

  await a.context().close();
  await b.context().close();
});

test("hanging up closes every connection and releases the devices", async ({
  browser,
  hub,
  statics,
}) => {
  const { a, b } = await twoPeerCall(browser, hub);
  await joinAudio(a);
  await joinAudio(b);
  await expect.poll(() => allConnected(a), { timeout: 20000 }).toBe(true);

  await a.evaluate(() => window.TogetherJSTestSpy.rtc.hangup());

  expect(await meshSize(a)).toBe(0);
  expect(
    await a.evaluate(() => window.TogetherJSTestSpy.rtc.media.hasAudio()),
  ).toBe(false);

  await a.context().close();
  await b.context().close();
});
