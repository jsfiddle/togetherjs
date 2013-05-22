// = SECTION First
var done = false;
function foo() {
    window.setTimeout(function() {
        done = true;
        some_var = true;
    }, 2000);
    wait(function(){return done;});
}
foo();
print(done);
// => false

// = SECTION check output 1
print(done);
// => true
print(some_var);
// => true

// = SECTION Second
done = false;
function foo2() {
    window.setTimeout(function() {
        done = true;
        another_var = true;
    }, 2000);
    wait(function(){return done;});
}
foo2();
print(done);
// => false

// = SECTION check output 2
print(done);
// => true
print(another_var);
// => true
print(some_var);
// => true
