// =SECTION Setup

$("#fixture").empty();
$("#other").remove();
$("#output-container").remove();
var aceSrc = "./ace.js";
var script = $("<script>").attr("onload", Spy("aceLoad", {wait: true})).attr("src", aceSrc);
$(document.head).append(script);

// => <script />.aceLoad(0)

// Not sure why I have to additionally wait:
wait(function () {return typeof ace != "undefined";});

// =>

print(ace);

// => {...}

var div = $('<div><pre id="ace-editor" style="width: 200px; height: 200px; position: absolute; bottom: 10px; left: 10px;"></pre></div>');
div.find("pre").text("function square(x) {\n  return x * x;\n}\n");
$("#fixture").append(div);
wait();
// =>

print($("#ace-editor")[0]);
var editor = ace.edit("ace-editor");
editor.setTheme("ace/theme/textmate");
editor.getSession().setMode("ace/mode/javascript");

getRequire("forms", "session", "ui");
/* =>
<pre...</pre>
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
      element: "#ace-editor",
      tracker: "AceEditor",
      value: "function square(x) {\n  return x * x;\n}\n"
   }
  ]
*/

// =SECTION Editing

editor.insert("Some more text");
wait(100);

/* =>
send: form-update
  clientId: "me",
  delta: {
    action: "insertText",
    range: {end: {column: 14, row: 0}, start: {column: 0, row: 0}},
    text: "Some more text"
  },
  element: "#ace-editor",
  tracker: "AceEditor"
*/

incoming({
  type: "form-update",
  clientId: "faker",
  element: "#ace-editor",
  tracker: "AceEditor",
  delta: {
    action: "insertText",
    text: "Hey ",
    range: {
      start: {column: 0, row: 0}, end: {column: 4, row: 0},
    }
  }
});
print(editor.getValue());

/* =>
Hey Some more textfunction square(x) {
  return x * x;
}
*/

// FIXME: need to test (and do) cursor adjustments.  Unless they work out automatically.
