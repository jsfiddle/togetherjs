var fs = require('fs');
var ug = require('uglify-js');
var jsp = ug.parser;
var pro = ug.uglify;

fs.readFile('lib/whiskers.js', 'utf8', function(err, data) {
  if (err) throw err;
  var ast = jsp.parse(data);
  var code = pro.gen_code(pro.ast_squeeze(pro.ast_mangle(ast)));
  fs.readFile('package.json', 'utf8', function(err, data) {
    if (err) throw err;
    var pkg = JSON.parse(data);
    code = '// whiskers.js templating library v'+pkg.version+'\n'+code+'\n';
    fs.writeFile('dist/whiskers.min.js', code);
  });
});
