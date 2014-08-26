// =SECTION Setup

$("#fixture").empty();
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

Test.require("forms", "session", "ui", "templates-en-US");
/* =>
<pre...</pre>
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
      element: "#ace-editor",
      tracker: "AceEditor",
      value: "function square(x) {\n  return x * x;\n}\n"
   }
  ]
*/

// =SECTION Editing

Test.waitMessage("form-update");
$("#ace-editor").focus();
editor.insert("Some more text");

/* =>
send: form-update
  clientId: "me",
  element: "#ace-editor",
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
  tracker: "AceEditor"
*/

var current = editor.getValue();
wait(function() { return editor.getValue() !== current; });

Test.incoming({
  type: "form-update",
  clientId: "faker",
  element: "#ace-editor",
  tracker: "AceEditor",
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
