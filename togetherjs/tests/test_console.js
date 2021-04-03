/*global tjconsole */
console.log("test_console");
var origConsole = window.console;
Test.require({tjconsole: "console"});
// => Loaded modules: console
tjconsole.appConsole.warn("hey", {a: 1, b: 2});
tjconsole.appConsole.log(1, 2, 3, {repr: function () {return (null).foo;}});
tjconsole.appConsole.trace();
print(tjconsole.appConsole.toString());

/* =>
TogetherJS base URL: ...
User Agent: ...
Page loaded: 20...Z
Age: ... minutes
URL: ...
------+------+----------------------------------------------
  ...  warn   hey {"a":1,"b":2}
  ...  log    1 2 3 {}
  ...         ...

 */
