//==SECTION WHRandom

jshint("random.js");
// => Script passed: ...

var random = WHRandomStream(1);
random.logState = true;

print(random());

// => 0.02258025041320865

random = WHRandomStream(61731 + (24903<<32) + (614<<64) + (42143<<96));
for (var i=0; i<1990; i++) {
  // Throw away the first 1990 results
  random();
}
for (var i=0; i<10; i++) {
  print(random());
}

/* =>
0.509619534765086
0.46840731249967416
0.6477464858997404
0.7262869907208884
0.26678101301184265
0.8506177950611828
0.807989512174746
0.34070112203493075
0.3237063277558945
0.9579732082997315
*/

random = WHRandomStream(61731 + (24903<<32) + (614<<64) + (42143<<96));
for (var i=0; i<1990; i++) {
  // Throw away the first 1990 results
  random();
}
for (var i=0; i<10; i++) {
  print(random());
}

/* =>
0.509619534765086
0.46840731249967416
0.6477464858997404
0.7262869907208884
0.26678101301184265
0.8506177950611828
0.807989512174746
0.34070112203493075
0.3237063277558945
0.9579732082997315
*/

var random1 = WHRandomStream();
wait(10);
// =>
var random2 = WHRandomStream();
print(random1() == random2());

// => false

//==SECTION Mersenne Twister

random = MersenneRandomStream(61731 + (24903<<32) + (614<<64) + (42143<<96));
for (var i=0; i<1990; i++) {
  // Throw away the first 1990 results
  random();
}
for (var i=0; i<10; i++) {
  print(random());
}

/* =>
0.36614991538226604
0.7007313468493521
0.053458782844245434
0.7753883530385792
0.27555248513817787
0.16756457393057644
0.8208331714849919
0.014290706953033805
0.8880474304314703
0.9676008424721658
*/

var random1 = MersenneRandomStream();
wait(10);
// =>
var random2 = MersenneRandomStream();
print(random1() == random2());

// => false
