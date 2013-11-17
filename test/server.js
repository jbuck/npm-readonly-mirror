var fs = require("fs");
var http = require("http");

var server = http.createServer();
server.on("request", function(req, res) {
  switch (req.url) {
  case "/registry/_changes":
    fs.readFile(__dirname + "/fixtures/_changes", function(err, data) {
      res.writeHead(200, {
        "Content-Length": data.length,
        "Content-Type": "text/plain; charset=utf-8"
      });
      res.write(data);
      res.end();
    });
    break;
  case "/registry/_changes?since=1":
    fs.readFile(__dirname + "/fixtures/_changes?since=1", function(err, data) {
      res.writeHead(200, {
        "Content-Length": data.length,
        "Content-Type": "text/plain; charset=utf-8"
      });
      res.write(data);
      res.end();
    });
    break;
  default:
    res.writeHead(404);
    res.end();
    break;
  }
});

module.exports = server;
