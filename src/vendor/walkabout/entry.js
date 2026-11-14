/* Separate bundle entry for the Walkabout fuzz tester.
 *
 * Walkabout is only reachable through the `/test` chat command, and it drags
 * in a vendored esprima + falafel. Bundling that into the main client would
 * cost every page load for a developer-only feature, so it is built as its own
 * artifact (dist/togetherjs/walkabout.js) and loaded on demand by ui/chat.js.
 */

// walkabout.js populates `exports` rather than assigning module.exports, so
// the whole namespace is the module.
import * as Walkabout from "./walkabout.js";

window.TogetherJSWalkabout = Walkabout;

export default Walkabout;
