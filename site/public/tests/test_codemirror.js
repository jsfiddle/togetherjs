// =SECTION Setup

$("#fixture").empty();
$("#other").remove();
$("#output-container").remove();
var cmSrc = "../example/codemirror/codemirror.js";
var script = $("<script>").attr("onload", Spy("cmLoad", {wait: true})).attr("src", cmSrc);
$(document.head).append(script);

// => <script />.cmLoad(0)

print(CodeMirror);

// => function CodeMirror(place, options) {...}

var div = $('<div><pre id="cm-editor" style="width: 200px; height: 200px; position: absolute; bottom: 10px; left: 10px;"></pre></div>');
$("#fixture").append(div);
wait();
// =>

print($("#cm-editor")[0]);
var editor = CodeMirror($("#cm-editor")[0], {
  mode: "javascript"
});
editor.setValue("function square(x) {\n  return x * x;\n}\n");

getRequire("forms", "session", "ui");
/* =>
<pre...
Loaded modules: ...
*/

viewSend();
waitMessage("hello");
TowTruck.startup._launch = true;
TowTruck();
setTimeout(function () {
  ui.hideWindow("#towtruck-about");
}, 1000);

/* =>
send: hello
...
*/

session.clientId = "me";
print(editor.getValue());

// => function square...

// =SECTION Setup peer

var incoming = session._getChannel().onmessage;

incoming({
  type: "hello",
  clientId: "faker",
  url: location.href.replace(/\#.*/, ""),
  urlHash: "",
  name: "Faker",
  avatar: "about:blank",
  color: "#ff0000",
  title: document.title,
  rtcSupported: false
});
wait(100);

/* =>

send: hello-back
  avatar: "...",
  clientId: "me",
  color: "...",
  name: "...",
  rtcSupported: ?,
  starting: ?,
  title: "TowTruck tests",
  url: ".../tests/...",
  urlHash: ""
send: form-init
  clientId: "me",
  pageAge: ?,
  updates: [
    {
      element: "#cm-editor:nth-child(1)",
      tracker: "CodeMirrorEditor",
      value: "function square(x) {\n  return x * x;\n}\n"
    }
  ]
*/

// =SECTION Editing

editor.replaceRange("Some more text", {line: 0, ch: 0});
wait(100);

/* =>
send: form-update
  change: {from: {ch: 0, line: 0}, text: ["Some more text"], to: {ch: 0, line: 0}},
  clientId: "me",
  element: "#cm-editor:nth-child(1)",
  tracker: "CodeMirrorEditor"
*/

incoming({
  type: "form-update",
  clientId: "faker",
  element: "#cm-editor:nth-child(1)",
  tracker: "CodeMirrorEditor",
  change: {
    text: "Hey ",
    from: {ch: 0, line: 0},
    to: {ch: 0, line: 0}
  }
});
print(editor.getValue());

/* =>
Hey Some more textfunction square(x) {
  return x * x;
}
*/

// FIXME: need to test (and do) cursor adjustments.  Unless they work out automatically.
