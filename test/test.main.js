"use strict";

var should = require("should");
var server = require("./server");
var worker = require("../lib/worker");

var registry = "http://localhost:28080/registry/";

describe("npm-readonly-mirror", function() {
  before(function(done) {
    server.listen(28080, done);
  });

  after(function(done) {
    server.close(done);
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
});
