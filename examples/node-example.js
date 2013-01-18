var doctest = require('../doctest.js');

var runner = new doctest.Runner({Reporter: doctest.ConsoleReporter});
var parser = new doctest.TextParser.fromFile(runner, './examples-2.js');
parser.parse();
runner.run();
var reporter = runner.reporter;
console.log('Successes:', reporter.successes);
console.log('Failures:', reporter.failures);
if ((! reporter.successes) || reporter.failures) {
  process.exit(1);
}
