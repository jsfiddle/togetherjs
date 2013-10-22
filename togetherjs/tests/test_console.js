/*global tjconsole */
var origConsole = window.console;
Test.require({tjconsole: "console"});
// => Loaded modules: console

tjconsole.warn("hey", {a: 1, b: 2});
tjconsole.log(1, 2, 3, {repr: function () {return (null).foo;}});
tjconsole.trace();
print(tjconsole.toString());

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
