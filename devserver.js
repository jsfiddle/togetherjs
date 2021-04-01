var
    http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    port = process.argv[2] || process.env['PORT'] || 8080;

mimeTypes = {
    "html": "text/html",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "png": "image/png",
    "svg": "image/svg+xml",
    "json": "application/json",
    "js": "text/javascript",
    "css": "text/css"
};

http.createServer(function(request, response) {

    var uri = url.parse(request.url).pathname
    var filename = path.join(process.cwd(), 'build', uri);
    console.log(filename);

    fs.exists(filename, function(exists) {
        if(!exists) {
            filename += ".js";
            console.log("    rewrite to", filename);
        }
        fs.exists(filename, function(exists) {
            if(!exists) {
                response.writeHead(404, {"Content-Type": "text/plain"});
                response.write("404 Not Found\n");
                response.end();
                return;
            }

            if(fs.statSync(filename).isDirectory()) {
                filename += '/index.html';
            }

            var mimeType = mimeTypes[filename.split('.').pop()];
            if(!mimeType) {
                mimeType = 'text/plain';
            }

            fs.readFile(filename, "binary", function(err, file) {
                if(err) {
                    response.writeHead(500, {"Content-Type": "text/plain"});
                    response.write(err + "\n");
                    response.end();
                    return;
                }

                response.writeHead(200, {"Content-Type": mimeType});
                response.write(file, "binary");
                response.end();
            });
        });
    });
}).listen(parseInt(port, 10));

console.log("Static file server running at\n  => http://localhost:" + port + "/\nCTRL + C to shutdown");
