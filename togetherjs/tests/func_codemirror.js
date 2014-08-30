// =SECTION Setup

var cmSrc = "./codemirror4.js";
var script = $("<script>").attr("onload", Spy("cmLoad", {wait: true})).attr("src", cmSrc);
$(document.head).append(script);

// => <script />.cmLoad(0)

print(CodeMirror);

// => function ...

var div = $('<div><pre id="cm-editor" style="width: 200px; height: 200px; position: absolute; bottom: 10px; left: 10px;"></pre></div>');
$("#fixture").append(div);
wait();
// =>

print($("#cm-editor")[0]);
var editor = CodeMirror($("#cm-editor")[0], {
  mode: "javascript"
});
editor.setValue("function square(x) {\n  return x * x;\n}\n");

Test.require("forms", "session", "ui", "templates-en-US");
/* =>
<pre...
Loaded modules: ...
*/

Test.normalStartup();
// => ...

print(editor.getValue());

// => function square...

// =SECTION Setup peer

Test.waitMessage("form-init");
Test.incoming({
  type: "hello",
  clientId: "faker",
  url: location.href.replace(/\#.*/, ""),
  urlHash: "",
  name: "Faker",
  avatar: TogetherJS.baseUrl + "/togetherjs/images/robot-avatar.png",
  color: "#ff0000",
  title: document.title,
  rtcSupported: false
});

/* =>

send: hello-back...
send: form-init
  clientId: "me",
  pageAge: ?,
  updates: [
    {
      basis: 1,
      element: "#cm-editor:nth-child(1)",
      tracker: "CodeMirrorEditor",
      value: "function square(x) {\n  return x * x;\n}\n"
    }
  ]
*/

// =SECTION Editing

Test.waitMessage("form-update");
$("#cm-editor").focus();
editor.replaceRange("Some more text", {line: 0, ch: 0});

/* =>
send: form-update
  clientId: "me",
  element: "#cm-editor:nth-child(1)",
  replace: {
    basis: 1,
    delta: {
      del: 0,
      start: 0,
      text: "Some more text"
    },
    id: "..."
  },
  "server-echo": true,
  tracker: "CodeMirrorEditor"
*/

var current = editor.getValue();
wait(function() { return editor.getValue() !== current; });

Test.incoming({
  type: "form-update",
  clientId: "faker",
  element: "#cm-editor:nth-child(1)",
  tracker: "CodeMirrorEditor",
  replace: {
    basis: 2,
    delta: {
      del: 0,
      start: 5,
      text: "Hey "
    },
    id: "faker.2"
  },
  "server-echo": true
});

// =>

print(editor.getValue());

/* =>
Some Hey more textfunction square(x) {
  return x * x;
}
*/

// FIXME: need to test (and do) cursor adjustments.  Unless they work out automatically.
