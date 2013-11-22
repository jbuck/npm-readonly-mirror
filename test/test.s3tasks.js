/* globals describe, it, before, after */

"use strict";

var should = require("should");
var server = require("./server");
var s3tasks = require("../lib/s3tasks");
var s3 = require("knox").createClient({
  bucket: "doesntexist",
  key: "doesntexist",
  secret: "doesntexist",
  endpoint: "localhost",
  port: "28080",
  style: "path"
});

describe("lib/tasks.js", function() {
  before(function(done) {
    server.listen(28080, done);
  });

  after(function() {
    server.close();
  });

  describe(".stream", function() {
    it("should stream a url to s3", function(done) {
      var t = s3tasks(s3);

      t.stream("http://localhost:28080/registry/ghjk/-/ghjk-0.0.0.tgz", "/ghjk", function(err) {
        should.not.exist(err);
        done();
      });
    });
  });

  describe(".put_json", function() {
    it("should upload some json to a path", function(done) {
      var t = s3tasks(s3);

      t.put_json({a:"b"}, "asdf", function(err) {
        should.not.exist(err);
        done();
      });
    });
  });
});
