"use strict";

var config = require("../local");

var registry = require("../lib/registry");
var source = registry(config.source.registry, config.source.package_host),
    sink = registry(config.sink.registry, config.sink.package_host);

var s3_client = require("knox").createClient( config.s3 );
var tasks = require("../lib/tasks");
var q = tasks.change_queue(source, sink, s3_client);

// See https://github.com/isaacs/npm/issues/4190
var MULTI_MASTER_COMPENSATION_FACTOR = 550;

tasks.fetch_changes(source, sink, function(err, changes) {
  if (err) {
    throw err;
  }

  changes.results.forEach(function(change) {
    // Amazon S3 has a bug where you can't GET a url named '/soap'
    // Who uses SOAP anyways? Really.
    if (change.id === "soap") {
      return console.log("can't update soap");
    }

    change.retry_count = 0;

    q.push(change, function err_handler(err) {
      if (err && err.toString() === "Error: not_found") {
        console.log("retrying %j", change);
        change.retry_count += 1;
        q.unshift(change, err_handler);
      }

      if (err) {
        throw err;
      }

      console.log("processed %j", change);
    });
  });

  q.drain = function() {
    console.log("finished processing up to seq %d", changes.last_seq);
    var s3tasks = require("../lib/s3tasks")(s3_client);
    s3tasks.put_json({"update_seq":changes.last_seq - MULTI_MASTER_COMPENSATION_FACTOR}, "_index", function(err) {
      if (err) {
        throw err;
      }

      console.log("updated s3 mirror with seq %d", changes.last_seq);
      console.log("shutting down...");
      process.exit(0);
    });
  };

  if (changes.results.length === 0) {
    console.log("finished processing up to seq %d", changes.last_seq);
  }
});
