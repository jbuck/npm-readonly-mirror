"use strict";

var crypto = require("crypto");
var fs = require("fs");
var http = require("http");

var server = http.createServer();
server.on("request", function(req, res) {
  if (req.url === "/registry/") {
    req.url = "/registry/_index";
  }

  fs.readFile(__dirname + "/fixtures" + req.url, function(err, data) {
    if (err) {
      res.writeHead(404);
      res.end(JSON.stringify({"error":"not_found","reason":"missing"}));
      return;
    }

    res.writeHead(200, {
      "Content-Length": data.length,
      "Content-MD5": crypto.createHash("md5").update(data).digest("base64"),
      "Content-Type": "application/octet-stream"
    });
    res.write(data);
    res.end();
  });
});

module.exports = server;
