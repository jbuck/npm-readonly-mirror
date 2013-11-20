/* globals describe, it, before, after */

"use strict";

var should = require("should");
var server = require("./server");
var registry = require("../lib/registry");

var registry_url = "http://localhost:28080/registry/";

describe("lib/registry.js", function() {
  before(function(done) {
    server.listen(28080, done);
  });

  after(function(done) {
    server.close(done);
  });

  describe(".get_changes", function() {
    it("should download all changes", function(done) {
      var local = registry(registry_url);

      local.get_changes(function(err, res, changes) {
        should.not.exist(err);
        should.exist(res);
        res.statusCode.should.equal(200);
        should.exist(changes);
        changes.results.should.eql([
          {"seq": 1, "id": "asdf", "changes":[{"rev":"1-a"}]}
        ]);
        changes.last_seq.should.equal(1);
        done();
      });
    });
  });

  describe(".get_changes_since", function() {
    it("should download all changes", function(done) {
      var local = registry(registry_url);

      local.get_changes_since(1, function(err, res, changes) {
        should.not.exist(err);
        should.exist(res);
        res.statusCode.should.equal(200);
        should.exist(changes);
        changes.results.should.eql([
          {"seq": 2, "id": "ghjk", "changes":[{"rev":"1-b"}]}
        ]);
        changes.last_seq.should.equal(2);
        done();
      });
    });
  });

  describe(".get_package", function() {
    it("should download package metadata", function(done) {
      var local = registry(registry_url);

      local.get_package("asdf", function(err, res, package_index) {
        should.not.exist(err);
        should.exist(res);
        res.statusCode.should.equal(200);
        should.exist(package_index);
        package_index.should.be.an.instanceOf(Object);
        done();
      });
    });

    it("should add a stream attribute to versions.dist", function(done) {
      var local = registry(registry_url);
      var tarball = "http://localhost:28080/registry/ghjk/-/ghjk-0.0.0.tgz";

      local.get_package("asdf", function(err, res, package_index) {
        var dist = package_index.versions["0.0.0"].dist;
        dist.tarball.should.equal(tarball);

        var stream = dist.stream;
        should.exist(stream);
        stream.on("response", function(tarball_res) {
          should.exist(tarball_res);
          tarball_res.statusCode.should.equal(200);
        });
        stream.on("data", function() {});
        stream.on("end", function() { done(); });
      });
    });
  });

  describe(".get_status", function() {
    it("should download the index status", function(done) {
      var local = registry(registry_url);

      local.get_status(function(err, res, status) {
        should.not.exist(err);
        should.exist(res);
        res.statusCode.should.equal(200);
        should.exist(status);
        status.update_seq.should.equal(1);
        done();
      });
    });
  });
});
