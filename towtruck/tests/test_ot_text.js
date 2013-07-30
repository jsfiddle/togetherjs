// =SECTION Setup expand-on-failure

Test.require("ot", "util", "randomutil");
// => Loaded...

var generator = randomutil(1);
generator.defaultChars = "XYZ/_ ";

function run() {
  var base = "abcdefg";
  console.log("Start:", JSON.stringify(base) + "/" + base.length);
  var delta1 = ot.TextReplace.random(base, generator);
  var delta2 = ot.TextReplace.random(base, generator);
  console.log("Delta1:", delta1+"");
  console.log("Delta2:", delta2+"");
  var sub1 = delta1.transpose(delta2);
  console.log("Translated", delta1, "to", sub1[0]);
  var text1a = sub1[0].apply(delta2.apply(base));
  console.log("     trans", delta2, "to", sub1[1]);
  var text1b = sub1[1].apply(delta1.apply(base));
  console.log("first text:", JSON.stringify(text1a), JSON.stringify(text1b));
  if (text1a != text1b) {
    print("Not equal");
    throw new Error("Error; not equal");
  }
  var sub2 = delta2.transpose(delta1);
  console.log(" Translate", delta2, "to", sub2[0]);
  var text2a = sub2[0].apply(delta1.apply(base));
  console.log("     trans", delta1, "to", sub2[1]);
  var text2b = sub2[1].apply(delta2.apply(base));
  console.log("second text:", JSON.stringify(text2a), JSON.stringify(text2b));
  if (text2a != text2b) {
    print("Not equal");
    throw new Error("Error; not equal");
  }
  console.clear();
}

// =>

// =SECTION Simple Test Setup expand-on-failure

function r(start, length, text) {
  return ot.TextReplace(start, length, text);
}

function trans(text, d1, d2) {
  var sub = d1.transpose(d2);
  console.log(JSON.stringify(text), "+", d1+"", "->", JSON.stringify(d1.apply(text)));
  console.log(JSON.stringify(text), "+", d2+"", "->", JSON.stringify(d2.apply(text)));
  var d1prime = sub[0];
  var d2prime = sub[1];
  if (d1.equals(d1prime)) {
    print(d1, "stays same");
  } else {
    print(d1, "becomes", d1prime);
  }
  if (d2.equals(d2prime)) {
    print(d2, "stays same");
  } else {
    print(d2, "becomes", d2prime);
  }
  var text1 = d1prime.apply(d2.apply(text));
  var text2 = d2prime.apply(d1.apply(text));
  print(d2, "+", d1prime, "->", text1);
  print(d1, "+", d2prime, "->", text2);
  if (text1 != text2) {
    print("Error: text mismatch");
  }
}

// =SECTION Two insertions

var text = "abcdef";
var ins1 = r(0, 0, "X");
var ins2 = r(1, 0, "Y");

trans(text, ins1, ins2);
/* =>
[insert "X" @0] stays same
[insert "Y" @1] becomes [insert "Y" @2]
[insert "Y" @1] + [insert "X" @0] -> XaYbcdef
[insert "X" @0] + [insert "Y" @2] -> XaYbcdef
 */

trans(text, ins2, ins1);
/* =>
[insert "Y" @1] becomes [insert "Y" @2]
[insert "X" @0] stays same
[insert "X" @0] + [insert "Y" @2] -> XaYbcdef
[insert "Y" @1] + [insert "X" @0] -> XaYbcdef
 */

ins1 = r(0, 0, "X");
ins2 = r(0, 0, "Y");

trans(text, ins1, ins2);
/* =>
[insert "X" @0] becomes [insert "X" @1]
[insert "Y" @0] stays same
[insert "Y" @0] + [insert "X" @1] -> YXabcdef
[insert "X" @0] + [insert "Y" @0] -> YXabcdef
 */

// As we see in this example, precedence matters (YX vs XY):
trans(text, ins2, ins1);
/* =>
[insert "Y" @0] becomes [insert "Y" @1]
[insert "X" @0] stays same
[insert "X" @0] + [insert "Y" @1] -> XYabcdef
[insert "Y" @0] + [insert "X" @0] -> XYabcdef
 */


// =SECTION Two Deletions

text = "abcdef";
var del1 = r(0, 1, "");
var del2 = r(1, 1, "");

trans(text, del1, del2);
/* =>
[delete 1 chars @0] stays same
[delete 1 chars @1] becomes [delete 1 chars @0]
[delete 1 chars @1] + [delete 1 chars @0] -> cdef
[delete 1 chars @0] + [delete 1 chars @0] -> cdef
 */

trans(text, del2, del1);
/* =>
[delete 1 chars @1] becomes [delete 1 chars @0]
[delete 1 chars @0] stays same
[delete 1 chars @0] + [delete 1 chars @0] -> cdef
[delete 1 chars @1] + [delete 1 chars @0] -> cdef
 */

trans(text, r(0, 2, ""), r(0, 1, ""));
/* =>
[delete 2 chars @0] becomes [delete 1 chars @0]
[delete 1 chars @0] becomes [no-op]
[delete 1 chars @0] + [delete 1 chars @0] -> cdef
[delete 2 chars @0] + [no-op] -> cdef
 */

trans(text, r(0, 1, ""), r(1, 1, ""));
/* =>
[delete 1 chars @0] stays same
[delete 1 chars @1] becomes [delete 1 chars @0]
[delete 1 chars @1] + [delete 1 chars @0] -> cdef
[delete 1 chars @0] + [delete 1 chars @0] -> cdef
 */

trans(text, r(0, 4, ""), r(1, 1, ""));
/* =>
[delete 4 chars @0] becomes [delete 3 chars @0]
[delete 1 chars @1] becomes [no-op]
[delete 1 chars @1] + [delete 3 chars @0] -> ef
[delete 4 chars @0] + [no-op] -> ef
 */

trans(text, r(1, 1, ""), r(0, 4, ""));
/* =>
[delete 1 chars @1] becomes [no-op]
[delete 4 chars @0] becomes [delete 3 chars @0]
[delete 4 chars @0] + [no-op] -> ef
[delete 1 chars @1] + [delete 3 chars @0] -> ef
 */

trans(text, r(0, 3, ""), r(2, 4, ""));
/* =>
[delete 3 chars @0] becomes [delete 2 chars @0]
[delete 4 chars @2] becomes [delete 3 chars @0]
[delete 4 chars @2] + [delete 2 chars @0] ->
[delete 3 chars @0] + [delete 3 chars @0] ->
 */

trans(text, r(2, 4, ""), r(0, 3, ""));
/* =>
[delete 4 chars @2] becomes [delete 3 chars @0]
[delete 3 chars @0] becomes [delete 2 chars @0]
[delete 3 chars @0] + [delete 3 chars @0] ->
[delete 4 chars @2] + [delete 2 chars @0] ->
 */


// =SECTION Insertion and replacement

trans(text, r(0, 0, "X"), r(2, 2, "Y"));
/* =>
[insert "X" @0] stays same
[replace 2 chars with "Y" @2] becomes [replace 2 chars with "Y" @3]
[replace 2 chars with "Y" @2] + [insert "X" @0] -> XabYef
[insert "X" @0] + [replace 2 chars with "Y" @3] -> XabYef
*/

trans(text, r(2, 2, "Y"), r(0, 0, "X"));
/* =>
[replace 2 chars with "Y" @2] becomes [replace 2 chars with "Y" @3]
[insert "X" @0] stays same
[insert "X" @0] + [replace 2 chars with "Y" @3] -> XabYef
[replace 2 chars with "Y" @2] + [insert "X" @0] -> XabYef
*/

trans(text, r(2, 0, "X"), r(2, 2, "Y"));
/* =>
[insert "X" @2] stays same
[replace 2 chars with "Y" @2] becomes [replace 2 chars with "Y" @3]
[replace 2 chars with "Y" @2] + [insert "X" @2] -> abXYef
[insert "X" @2] + [replace 2 chars with "Y" @3] -> abXYef
*/

trans(text, r(2, 2, "Y"), r(2, 0, "X"));
/* =>
[replace 2 chars with "Y" @2] becomes [replace 2 chars with "Y" @3]
[insert "X" @2] stays same
[insert "X" @2] + [replace 2 chars with "Y" @3] -> abXYef
[replace 2 chars with "Y" @2] + [insert "X" @2] -> abXYef
*/

trans(text, r(1, 0, "X"), r(0, 3, "Y"));
/* =>
[insert "X" @1] stays same
[replace 3 chars with "Y" @0] becomes [replace 4 chars with "YX" @0]
[replace 3 chars with "Y" @0] + [insert "X" @1] -> YXdef
[insert "X" @1] + [replace 4 chars with "YX" @0] -> YXdef
*/

trans(text, r(0, 3, "Y"), r(1, 0, "X"));
/* =>
[replace 3 chars with "Y" @0] becomes [replace 4 chars with "XY" @0]
[insert "X" @1] becomes [insert "X" @0]
[insert "X" @1] + [replace 4 chars with "XY" @0] -> XYdef
[replace 3 chars with "Y" @0] + [insert "X" @0] -> XYdef
*/

trans(text, r(4, 0, "X"), r(2, 2, "Y"));
/* =>
[insert "X" @4] becomes [insert "X" @3]
[replace 2 chars with "Y" @2] stays same
[replace 2 chars with "Y" @2] + [insert "X" @3] -> abYXef
[insert "X" @4] + [replace 2 chars with "Y" @2] -> abYXef
*/

trans(text, r(2, 2, "Y"), r(4, 0, "X"));
/* =>
[replace 2 chars with "Y" @2] stays same
[insert "X" @4] becomes [insert "X" @3]
[insert "X" @4] + [replace 2 chars with "Y" @2] -> abYXef
[replace 2 chars with "Y" @2] + [insert "X" @3] -> abYXef
*/

trans(text, r(0, 0, "X"), r(2, 2, "Y"));
/* =>
[insert "X" @0] stays same
[replace 2 chars with "Y" @2] becomes [replace 2 chars with "Y" @3]
[replace 2 chars with "Y" @2] + [insert "X" @0] -> XabYef
[insert "X" @0] + [replace 2 chars with "Y" @3] -> XabYef
*/

// =SECTION Test (TP1)

for (var i=0; i<1000; i++) {
  console.log("Run", i);
  run();
}
print("done.");

// => done.

// =SECTION Test (TP2 attempt)


function runTp2() {
  var base = "abcdefg";
  console.log("Start:", JSON.stringify(base) + "/" + base.length);
  var deltaFirst = ot.TextReplace.random(base, generator);
  var delta1 = ot.TextReplace.random(base, generator);
  var delta2 = ot.TextReplace.random(base, generator);
  console.log("Delta First:", deltaFirst+"");
  console.log("Delta1:", delta1+"");
  console.log("Delta2:", delta2+"");
  // Now we'll try two orderings:
  // first + 1 + 2
  // first + 2 + 1
  var delta1Trans = delta1.transpose(deltaFirst)[0];
  console.log("Translate:", deltaFirst, "+ (", delta1, "becomes", delta1Trans, ")");
  var delta2Trans = delta2.transpose(deltaFirst)[0];
  console.log("Translate:", deltaFirst, "+ (", delta2, "becomes", delta2Trans, ")");
  var delta1Trans_a = delta1Trans.transpose(delta2Trans)[0];
  console.log("Translate:", delta2Trans, "+ (", delta1Trans, "becomes", delta1Trans_a, ")");
  var delta2Trans_a = delta1Trans.transpose(delta2Trans)[1];
  console.log("Translate:", delta1Trans, "+ (", delta2Trans, "becomes", delta2Trans_a, ")");
  var text1 = delta1Trans_a.apply(delta2Trans.apply(deltaFirst.apply(base)));
  console.log("text1:", JSON.stringify(base), "->", JSON.stringify(text1));
  console.log(" ", deltaFirst, deltaFirst.apply(base));
  console.log(" ", delta2Trans, delta2Trans.apply(deltaFirst.apply(base)));
  console.log(" ", delta1Trans_a, text1);
  var text2 = delta2Trans_a.apply(delta1Trans.apply(deltaFirst.apply(base)));
  console.log("text2:", JSON.stringify(base), "->", JSON.stringify(text2));
  console.log(" ", deltaFirst, deltaFirst.apply(base));
  console.log(" ", delta1Trans, delta1Trans.apply(deltaFirst.apply(base)));
  console.log(" ", delta2Trans_a, text2);
  if (text1 != text2) {
    print("Not equal");
    throw new Error("Error; not equal");
  }
}

for (var i=0; i<1000; i++) {
  console.clear();
  console.log("Run", i);
  runTp2();
}
print("done.");

// => done.
