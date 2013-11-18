var fs = require("fs");
var http = require("http");

var server = http.createServer();
server.on("request", function(req, res) {
  fs.readFile(__dirname + "/fixtures" + req.url, function(err, data) {
    if (err) {
      res.writeHead(404);
      res.end();
      return;
    }

    res.writeHead(200, {
      "Content-Length": data.length,
      "Content-Type": "text/plain; charset=utf-8"
    });
    res.write(data);
    res.end();
  });
});

module.exports = server;
