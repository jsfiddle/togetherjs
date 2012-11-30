jshint("walkabout.js", {evil: true});
// => Script passed: .../walkabout.js

function log(text) {
  console.log(text);
  if (window.print) {
    print(text);
  }
  $("#log").text($("#log").text() + text + "\n");
}

function logger(name) {
  return function (text) {
    log(name + ": " + text);
  };
}

$("#button").click(function () {
  log("button click");
});

$("#textinput").bindKey({which: 13}, function () {
  log("Entered text: " + $("#textinput").val());
  $("#textinput").val("");
});

location.hash = "";

$(window).on("hashchange", function () {
  var hash = location.hash;
  if (! hash) {
    return;
  }
  log("Hash changed: " + hash);
  hash = parseInt(hash.substr(1), 10);
  $("#link").attr("href", "#" + (hash + 1));
});

$("#fixture").on("click", ".item", function () {
  log("Clicked li: " + $(this).text());
});

// =>

var actions = $(document).findActions();
print(actions);

/* =>

[
  {element: [<a href="#1" id="link">link</a>]},
  {
    event: {
      element: <li class="item">an item 1</li>,
      handler: {
        ...
        selector: ".item",
        type: "click"
      },
      type: "click"
    }
  },
  {
    event: {
      element: <li class="item">an item 2</li>,
      handler: {
        ...
        selector: ".item",
        type: "click"
      },
      type: "click"
    }
  },
  {
    event: {
      element: <button id="button">A button</button>,
      handler: {
        ...
        type: "click"
      },
      type: "click"
    }
  },
  {
    event: {
      element: <input id="textinput" type="text" />,
      handler: {
        ...
        type: "keypress"
      },
      type: "keypress"
    }
  }
]

*/

Walkabout.random.setSeed(100);
jQuery.fn.val.patch();

actions.forEach(function (a) {
  a.run();
});
wait();

// I don't understand why "Hash change: #1" happens twice
/* =>

Clicked li: an item 1
Clicked li: an item 2
button click
Entered text: EzsmOGsiee
Hash changed: #1
*/

// Here we demonstrate that the random numbers are repeatable
// (and hopefully portable):
var rand = Walkabout.RandomStream(1);
for (var i=0; i<10; i++) {
  print(rand());
}

/* =>

0.0225802504...
0.8612917717...
0.3039651696...
0.8526061845...
0.2648052292...
0.5323929718...
0.9003424612...
0.0378481761...
0.7294780843...
0.4245760307...

*/

$("#textinput").attr("data-mock-options", '["a", "b"]');
print($("#textinput").findActions()[0]);
$("#textinput").findActions()[0].run();
$("#textinput").findActions()[0].run();
$("#textinput").findActions()[0].run();

/* =>

{
  event: {
    element: <input data-mock-options="[&quot;a", "b"]" id="textinput" type="text" />,
    handler: {
      ...
      type: "keypress"
    },
    type: "keypress"
  }
}
Entered text: b
Entered text: a
Entered text: b

*/
