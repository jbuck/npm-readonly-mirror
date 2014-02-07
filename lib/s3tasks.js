"use strict";

var crypto = require("crypto");
var EventEmitter = require("events").EventEmitter;
var hyperquest = require("hyperquest");

var S3Tasks = function(client) {
  this.client = client;
  EventEmitter.call(this);
};

S3Tasks.prototype = Object.create(EventEmitter.prototype);

S3Tasks.prototype.stream = function(url, path, callback) {
  var self = this;

  var http_req = hyperquest(url)
  .on("error", callback)
  .on("response", function(http_res) {
    self.emit("info", "GET " + url + " returned HTTP " + http_res.statusCode);

    if (http_res.statusCode !== 200) {
      var err = new Error("GET " + url + " returned HTTP " + http_res.statusCode);
      err.url = url;
      err.method = "GET";
      err.status_code = http_res.statusCode;
      return callback(err);
    }

    var headers = {
      "Content-Length": http_res.headers["content-length"],
      "Content-MD5": http_res.headers["content-md5"],
      "Content-Type": http_res.headers["content-type"]
    };

    var s3_req = self.client.put(path, headers)
    .on("error", callback)
    .on("response", function(s3_res) {
      self.emit("info", "PUT " + self.client.url(path) + " returned HTTP " + s3_res.statusCode);

      if (s3_res.statusCode !== 200) {
        var err = new Error("PUT " + self.client.url(path) + " returned HTTP " + s3_res.statusCode);
        err.url = self.client.url(path);
        err.method = "PUT";
        err.status_code = s3_res.statusCode;
        return callback(err);
      }

      callback();
    });

    http_req.pipe(s3_req);
  });

  return this;
};

S3Tasks.prototype.put_json = function(obj, path, callback) {
  if (!obj) {
    return process.nextTick(callback);
  }

  var self = this;

  var data = new Buffer(JSON.stringify(obj), "utf8");
  var headers = {
    "Content-Length": data.length,
    "Content-MD5": crypto.createHash("md5").update(data).digest("base64"),
    "Content-Type": "text/plain; charset=utf-8"
  };

  var s3_req = this.client.put(path, headers)
  .on("error", callback)
  .on("response", function(s3_res) {
    self.emit("info", "PUT " + self.client.url(path) + " returned HTTP " + s3_res.statusCode);

    if (s3_res.statusCode !== 200) {
      var err = new Error("PUT " + self.client.url(path) + " returned HTTP " + s3_res.statusCode);
      err.url = self.client.url(path);
      err.status_code = s3_res.statusCode;
      return callback(err);
    }

    callback();
  });

  s3_req.end(data);
};

module.exports = function(client) {
  return new S3Tasks(client);
};
