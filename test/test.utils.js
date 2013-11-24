/* globals describe, it */

"use strict";

var should = require("should");
var utils = require("../lib/utils");

var v0 = {
  name: "asdf",
  versions: {
    "0.0.0": {
      dist: {
        tarball: "http://localhost/registry/asdf/-/asdf-0.0.0.tgz",
        shasum: "asdf"
      }
    }
  }
};
var v1 = {
  name: "asdf",
  versions: {
    "0.0.1": {
      dist: {
        tarball: "http://localhost/registry/asdf/-/asdf-0.0.1.tgz",
        shasum: "ghjk"
      }
    }
  }
};
var v1_new_sha = {
  name: "asdf",
  versions: {
    "0.0.1": {
      dist: {
        tarball: "http://localhost/registry/asdf/-/asdf-0.0.1.tgz",
        shasum: "poiu"
      }
    }
  }
};
var v0_and_v1 = {
  name: "asdf",
  versions: {
    "0.0.0": {
      dist: {
        tarball: "http://localhost/registry/asdf/-/asdf-0.0.0.tgz",
        shasum: "asdf"
      }
    },
    "0.0.1": {
      dist: {
        tarball: "http://localhost/registry/asdf/-/asdf-0.0.1.tgz",
        shasum: "ghjk"
      }
    }
  }
};
var not_found = {
  error: "not_found",
  reason: "missing"
};
var no_versions = {
  versions: {}
};

describe("lib/utils.js", function() {
  describe(".diff_package", function() {
    it("should add new published packages", function() {
      var expected = {
        add: ["http://localhost/registry/asdf/-/asdf-0.0.1.tgz"],
        remove: []
      };

      var output = utils.diff_package(v0_and_v1, v0);
      should.exist(output);
      output.should.eql(expected);
    });

    it("should add brand new packages", function() {
      var expected = {
        add: ["http://localhost/registry/asdf/-/asdf-0.0.0.tgz"],
        remove: []
      };

      var output = utils.diff_package(v0, not_found);
      should.exist(output);
      output.should.eql(expected);
    });

    it("should remove unpublished packages", function() {
      var expected = {
        add: [],
        remove: ["http://localhost/registry/asdf/-/asdf-0.0.0.tgz",
                 "http://localhost/registry/asdf/0.0.0"]
      };

      var output = utils.diff_package(v1, v0_and_v1);
      should.exist(output);
      output.should.eql(expected);
    });

    it("should handle an error document", function() {
      var expected = {
        add: [],
        remove: []
      };

      var output = utils.diff_package(not_found, not_found);
      should.exist(output);
      output.should.eql(expected);
    });

    it("should handle no published versions", function() {
      var expected = {
        add: [],
        remove: []
      };

      var output = utils.diff_package(no_versions, no_versions);
      should.exist(output);
      output.should.eql(expected);
    });

    it("should add packages from no published versions", function() {
      var expected = {
        add: ["http://localhost/registry/asdf/-/asdf-0.0.1.tgz"],
        remove: []
      };

      var output = utils.diff_package(v1, no_versions);
      should.exist(output);
      output.should.eql(expected);
    });

    it("should add a tarball with a changed shasum", function() {
      var expected = {
        add: ["http://localhost/registry/asdf/-/asdf-0.0.1.tgz"],
        remove: []
      };

      var output = utils.diff_package(v1_new_sha, v1);
      should.exist(output);
      output.should.eql(expected);
    });
  });
});
