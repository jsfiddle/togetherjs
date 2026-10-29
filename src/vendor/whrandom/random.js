/* Wichmann-Hill pseudo-random generator.
 *
 * Seedable, unlike Math.random(), which is the whole point: the OT
 * convergence tests replay a fixed sequence of random edits, so a failure can
 * be reproduced from its seed.
 *
 * Originally from https://github.com/ianb/whrandom (UMD; the AMD and global
 * branches are gone now that the client is a single ES-module bundle).
 */

export default function RandomStream(seed) {
  if (!seed) {
    seed = Date.now();
  }
  if (typeof seed != "number") {
    seed = parseInt(seed, 10);
  }
  if (!seed || isNaN(seed)) {
    throw new Error("Bad seed");
  }
  var x = (seed % 30268) + 1;
  seed = (seed - (seed % 30268)) / 30268;
  var y = (seed % 30306) + 1;
  seed = (seed - (seed % 30306)) / 30306;
  var z = (seed % 30322) + 1;
  seed = (seed - (seed % 30322)) / 30322;
  return function random() {
    x = (171 * x) % 30269;
    y = (172 * y) % 30307;
    z = (170 * z) % 30323;
    return (x / 30269.0 + y / 30307.0 + z / 30323.0) % 1.0;
  };
}
