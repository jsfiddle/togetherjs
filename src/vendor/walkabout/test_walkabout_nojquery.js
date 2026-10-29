jshint("walkabout.js", {evil: true, scripturl: true});
// => Script passed: .../walkabout.js

function getElement(id) {
  var el = document.getElementById(id);
  if (! el) {
    throw 'Element not found: #' + id;
  }
  return el;
}

function text(t) {
  return document.createTextNode(t);
}

function log(t) {
  console.log(t);
  if (window.print) {
    print(t);
  }
  getElement("log").appendChild(text(t + "\n"));
}

function logger(name) {
  return function (text) {
    log(name + ": " + text);
  };
}

var clickAction = function () {
  log("button click");
};
Walkabout.addEventListener(getElement("button"), "click", clickAction);

Walkabout.addEventListener(getElement("textinput"), "keypress", function (event) {
  console.log("got keypress", event.charCode, event.keyCode);
  if (event.keyCode == 13) {
    var value = Walkabout.value(getElement("textinput"));
    log("Entered text: " + value);
    getElement("textinput").value = "";
  }
});

location.hash = "";

Walkabout.addEventListener(window, "hashchange", function () {
  var hash = location.hash;
  if (! hash) {
    return;
  }
  log("Hash changed: " + hash);
  hash = parseInt(hash.substr(1), 10);
  getElement("link").href = "#" + (hash + 1);
});

Walkabout.addEventListener(getElement("fixture"), "click", function (event) {
  if (event.target.classList.contains("item")) {
    log("Clicked li: " + event.target.textContent);
  }
}, false, {selector: ".item"});

// =>

var actions = Walkabout.findActions(document);
print(actions);

// FIXME: sometimes there's a Back action, sometimes not
/* =>

[
  {element: <a href="#1" id="link">link</a>, options: {}, type: "click"},
  {
    element: <li class="item">an item 1</li>,
    handler: function ...,
    type: "click"
  },
  {
    element: <li class="item">an item 2</li>,
    handler: function ...,
    type: "click"
  },
  {
    element: <button id="button">A button</button>,
    handler: function ...,
    type: "click"
  },
  {
    element: <input data-walkabout-keypress="{which: 13}" id="textinput" type="text" />,
    handler: function ...,
    type: "keypress"
  }...
]

*/

Walkabout.random.setSeed(100);

actions.forEach(function (a) {
  a.run();
});
wait(100);

// I don't understand why "Hash change: #1" happens twice
/* =>

Clicked li: an item 1
Clicked li: an item 2
button click
Entered text: EzsmOGsiee
Hash changed: #1...
*/

getElement("textinput").setAttribute("data-walkabout-options", "['a', 'b']");
print(Walkabout.findActions(getElement("textinput"))[0]);
Walkabout.findActions(getElement("textinput"))[0].run();
Walkabout.findActions(getElement("textinput"))[0].run();
Walkabout.findActions(getElement("textinput"))[0].run();
Walkabout.findActions(getElement("textinput"))[0].run();
Walkabout.findActions(getElement("textinput"))[0].run();
Walkabout.findActions(getElement("textinput"))[0].run();

// FIXME: for some reason this isn't the same as in the jquery example
// it generates a different order
/* =>

{
  element: <input data-walkabout-keypress="{which: 13}" data-walkabout-options="['a', 'b']" id="textinput" type="text" />,
  handler: function ...,
  type: "keypress"
}
Entered text: a
Entered text: a
Entered text: a
Entered text: a
Entered text: b
Entered text: b

*/

print(Walkabout.findActions().length);
// => 6

Walkabout.removeEventListener(getElement("button"), "click", clickAction);
print(Walkabout.findActions().length);
// => 5


print(Walkabout.rewriteListeners("function foobar() {el.addEventListener('click', function (foo) {}, false);}"));
// => function foobar() {Walkabout.addEventListener(el, 'click', function (foo) {}, false);}

print(Walkabout.rewriteListeners("$('#test')[0].addEventListener('click', function (foo) {}, false);"));
// => Walkabout.addEventListener($('#test')[0], 'click', function (foo) {}, false);

print(Walkabout.rewriteListeners("foo().bar.value"));
// => Walkabout.value(foo().bar)

print(Walkabout.rewriteListeners("obj.removeEventListener('click', function foo() {})"));
// => Walkabout.removeEventListener(obj, 'click', function foo() {})

print(Walkabout.rewriteListeners("Walkabout.removeEventListener(obj, 'click', function foo() {})"));
// => Walkabout.removeEventListener(obj, 'click', function foo() {})

print(Walkabout.rewriteListeners("obj.value = 'foo'"));
// => obj.value = 'foo'
