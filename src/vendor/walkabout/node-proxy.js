const dns = require("dns");
const http = require("http");
const fs = require("fs");
const walkabout = require("./walkabout.js");
const parseUrl = require("url").parse;

var IPs = {
  localhost: ["127.0.0.1"]
};

var PortAliases = {};

function loadEtcHosts(callback) {
  fs.readFile("/etc/hosts", "UTF-8", function (error, text) {
    if (error) {
      console.log("Error reading /etc/hosts:", error);
      return;
    }
    var lines = text.split(/\n/g);
    lines.forEach(function (l) {
      l = l.replace(/^\s*/, "");
      if (! l) {
        // empty line
        return;
      }
      if (l.search(/^\#/) != -1) {
        // comment
        return;
      }
      var parts = l.split(/\s+/g);
      if (parts[0] == "255.255.255.255" || parts[0].indexOf(":") != -1 ||
          parts[0] == "127.0.0.1") {
        return;
      }
      for (var i=1; i<parts.length; i++) {
        if (! parts[i]) {
          continue;
        }
        if (parts[i] in IPs) {
          if (IPs[parts[i]].indexOf(parts[0]) == -1) {
            IPs[parts[i]].push(parts[0]);
          }
        } else {
          IPs[parts[i]] = [parts[0]];
        }
      }
    });
    if (callback) {
      callback();
    }
  });
}

loadEtcHosts();

var server = http.createServer(function(request, response) {
  var host = request.headers["host"];
  var port = 80;
  if (parseUrl(request.url).pathname == "/__walkabout__.js") {
    fs.readFile(__dirname + "/walkabout.js", function (error, code) {
      if (error) {
        write500(error, response);
        return;
      }
      response.writeHead(200, {"Content-Type": "text/javascript"});
      response.end(code);
    });
    return;
  }
  if (host.indexOf(":") != -1) {
    port = host.substr(host.indexOf(":") + 1);
    port = parseInt(port, 10);
    host = host.replace(/\:.*$/, "");
  }
  if (host in PortAliases) {
    port = PortAliases[host];
  }
  if (! IPs[host]) {
    request.pause();
    dns.resolve4(host, function (error, addresses) {
      console.log("Resolved host", host, "to", addresses);
      if (error) {
        write500(error, response);
        return;
      }
      IPs[host] = addresses;
      request.resume();
      forwardRequest(addresses, port, request, response);
    });
  } else {
    forwardRequest(IPs[host], port, request, response);
  }
});

var preamble = (
  '<script>_Walkabout_start_UI = true;_Walkabout_sitewide = true;</script>' +
  '<script src="/__walkabout__.js"></script>'
);

var seenForwards = {};

function forwardRequest(addresses, port, request, response) {
  var address = addresses[Math.floor(Math.random() * addresses.length)];
  if (! seenForwards[address]) {
    seenForwards[address] = true;
    console.log("Forwarding", request.headers.host, "to", address + ":" + port);
  }
  // Avoid gzipped responses:
  delete request.headers["accept-encoding"];
  delete request.headers["if-modified-since"];
  delete request.headers["if-not-matches"];
  delete request.headers["connection"];
  request.headers["connection"] = "close";
  var origHost = request.headers.host;
  request.headers.host = request.headers.host.replace(/:\d+$/, "") + ":" + port;
  var clientRequest = http.request({
    hostname: address,
    port: port,
    method: request.method,
    path: request.url,
    headers: request.headers
  });
  clientRequest.on("response", function (clientResponse) {
    var contentType = clientResponse.headers["content-type"] || "";
    var isHtml = contentType.indexOf("text/html") != -1;
    var isJavascript = contentType.indexOf("javascript") != -1;
    var location = clientResponse.headers["location"];
    if (location) {
      clientResponse.location = location.replace(
        request.headers.host.replace(/:80$/, ""), origHost.replace(/:80$/, ""));
    }
    if (isHtml) {
      var contentLength = clientResponse.headers["content-length"];
      if (contentLength) {
        contentLength = parseInt(contentLength, 10);
        contentLength += preamble.length;
        clientResponse.headers["content-length"] = contentLength + "";
      }
    } else if (isJavascript) {
      delete clientResponse.headers["content-length"];
    }
    response.writeHead(clientResponse.statusCode, clientResponse.headers);
    var s;
    if ((! isHtml) && ! isJavascript) {
      clientResponse.on("data", function (chunk) {
        response.write(chunk);
      });
    } else {
      s = "";
      clientResponse.on("data", function (chunk) {
        s += chunk;
      });
    }
    clientResponse.on("end", function () {
      if (isHtml) {
        if (s.search(/^</) == -1) {
          // Doesn't really look like HTML
          response.write(s);
        } else {
          response.write(translateHtml(s));
        }
      } else if (isJavascript) {
        response.write(translateJavascript(s));
      }
      response.end();
    });
  });
  clientRequest.on("error", function (error) {
    error.stage = "clientRequest";
    error.headers = clientRequest._headers;
    write500(error, response);
  });
  request.on("data", function (chunk) {
    clientRequest.write(chunk);
  });
  if (! request.ended) {
    request.on("end", function () {
      clientRequest.end();
    });
  } else {
    clientRequest.end();
  }
}

function translateHtml(s) {
  var pos = s.search(/<head>/i);
  if (pos == -1) {
    return preamble + s;
  } else {
    return s.substr(0, pos+6) + preamble + s.substr(pos+6);
  }
}

function translateJavascript(s) {
  return walkabout.rewriteListeners(s) + "";
}

function write500(error, response) {
  console.warn("Error:", error);
  response.writeHead(500, {"Content-Type": "text/plain"});
  if (typeof error != "string") {
    error = "\n" + JSON.stringify(error, null, "  ");
  }
  response.end("Error: " + error);
}

var PORT = parseInt(process.env.PORT || 80, 10);
var BIND = process.env.BIND || "127.0.0.1";

if (process.env.PORT_ALIASES) {
  process.env.PORT_ALIASES.split(/;/g).forEach(function (part) {
    part = part.split(/:/);
    PortAliases[part[0]] = part[1];
  });
}

console.log("Serving on", "http://"+BIND+":"+PORT);
server.listen(PORT, BIND, function () {
});
