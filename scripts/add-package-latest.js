"use strict";

var config = require("../local");
var s3 = require("knox").createClient( config.s3 );
var S3Lister = require("s3-lister");
var s3tasks = require("../lib/s3tasks")(s3).on("info", console.log);
var async = require("async");
var sink = require("../lib/registry")(config.sink.registry, config.sink.package_host);

var lister_opts = {};
if (process.argv[2]) {
  lister_opts.prefix = process.argv[2];
}

var lister = new S3Lister(s3, lister_opts);

var l_q = async.queue(function(task, lq_callback) {
  async.waterfall([
    function(w_callback) {
      sink.get_package(task, w_callback);
    },
    function(pkg, w_callback) {
      if (!pkg["dist-tags"] || !pkg["dist-tags"].latest) {
        w_callback();
        return;
      }

      s3tasks.put_json(pkg.versions[pkg["dist-tags"].latest], task + "/latest", w_callback);
    }
  ], lq_callback);
});

lister.on("data", function(data) {
  var k = data.Key;

  if (k.indexOf("/") !== -1) {
    return;
  }

  l_q.push(k, function err_handler(err) {
    if (err) {
      console.log("Failed to process %s with error %s, retrying", k, err);
      l_q.unshift(k, err_handler);
    }
  });
});

lister.on("error", function(err) {
  throw err;
});

lister.on("end", function() {
  console.log("done streaming!");
});

l_q.drain = function() {
  console.log("queue all processed!");
};
