/* globals describe, it, before, after */

"use strict";

var should = require("should");
var server = require("./server");
var worker = require("../lib/worker");

var registry = "http://localhost:28080/registry/";
var tarball = registry + "ghjk/-/ghjk-0.0.0.tgz";
var pkg_index = {
  versions: {
    "0.0.0": {
      dist: {
        tarball: "http://localhost:8080/asdf/-/asdf-0.0.0.tgz"
      }
    },
    "0.0.1": {
      dist: {
        tarball: "http://localhost:8080/asdf/-/asdf-0.0.1.tgz"
      }
    }
  }
};
var new_target = "http://localhost:28080";

describe("npm-readonly-mirror", function() {
  before(function(done) {
    server.listen(28080, done);
  });

  after(function() {
    server.close();
  });

  describe(".get_json", function() {
    it("should download some json", function(done) {
      worker.get_json(registry + "_mirror_status", function(err, json) {
        should.not.exist(err);
        should.exist(json);
        json.should.eql({last_seq:1});
        done();
      });
    });
  });

  describe(".get_changes", function() {
    it("should download all changes", function(done) {
      worker.get_changes(registry, function(err, changes) {
        should.not.exist(err);
        should.exist(changes);
        changes.results.should.eql([
          {"seq": 1, "id": "asdf", "changes":[{"rev":"1-a"}]}
        ]);
        changes.last_seq.should.equal(1);
        done();
      });
    });

    it("should download changes since last_seq", function(done) {
      worker.get_changes(1, registry, function(err, changes) {
        should.not.exist(err);
        should.exist(changes);
        changes.results.should.eql([
          {"seq": 2, "id": "ghjk", "changes":[{"rev":"1-b"}]}
        ]);
        changes.last_seq.should.equal(2);
        done();
      });
    });
  });

  describe(".get_package_index", function() {
    it("should download package index", function(done) {
      worker.get_package_index("asdf", registry, function(err, package_index) {
        should.not.exist(err);
        should.exist(package_index);
        package_index.should.be.an.instanceOf(Object);
        done();
      });
    });
  });

  describe(".get_tarball_stream", function() {
    it("should stream tarball", function(done) {
      worker.get_tarball_stream(tarball, function(err, res) {
        should.not.exist(err);
        should.exist(res);
        res.headers["content-length"].should.equal("5");
        res.headers["content-md5"].should.equal("KwAEL3SBx7BWxLQQ0o8zzw==");
        res.headers["content-type"].should.equal("application/octet-stream");
        res.on("data", function() {});
        res.on("end", function() { done(); });
      });
    });
  });

  describe(".rewrite_package_dist", function() {
    it("should rewrite dist url", function() {
      var new_pkg = JSON.parse(JSON.stringify(pkg_index));
      worker.rewrite_package_dist(new_target, new_pkg);
      new_pkg.versions["0.0.0"].dist.tarball.should.equal("http://localhost:28080/asdf/-/asdf-0.0.0.tgz");
      new_pkg.versions["0.0.1"].dist.tarball.should.equal("http://localhost:28080/asdf/-/asdf-0.0.1.tgz");
    });
  });

  describe(".filter_package_files", function() {
    it("should return all package files for column", function() {
      var s3_list = require("./fixtures/s3_list_column");

      worker.filter_package_files(s3_list).should.eql([
        "column"
      ]);

    });

    it("should return all package files for columnize", function() {
      var s3_list = require("./fixtures/s3_list_column");
      s3_list.Prefix = "columnize";

      worker.filter_package_files(s3_list).should.eql([
        "columnize",
        "columnize/-/columnize-0.0.0.tgz",
        "columnize/0.0.0",
        "columnize/latest"
      ]);
    });
  });
});
