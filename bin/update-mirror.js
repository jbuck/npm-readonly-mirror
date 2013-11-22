"use strict";

var config = require("../local");

var registry = require("../lib/registry");
var source = registry(config.source.registry, config.source.package_host),
    sink = registry(config.sink.registry, config.sink.package_host);

var s3_client = require("knox").createClient( config.s3 );
var tasks = require("../lib/tasks");
var q = tasks.change_queue(source, sink, s3_client);

tasks.fetch_changes(source, sink, function(err, changes) {
  if (err) {
    throw err;
  }

  changes.results.forEach(function(change) {
    change.retry_count = 0;

    q.push(change, function(err) {
      if (err) {
        throw err;
      }

      console.log("processed %j", change);
    });
  });

  q.drain = function() {
    console.log(changes.last_seq);
  };
});
