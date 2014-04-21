"use strict";

var config = {
  "source": {
    "registry": process.env.SOURCE_REGISTRY,
    "package_host": process.env.SOURCE_PACKAGE_HOST
  },
  "sink": {
    "registry": process.env.SINK_REGISTRY,
    "package_host": process.env.SINK_PACKAGE_HOST
  },
  "s3": {
    "bucket": process.env.S3_BUCKET,
    "key": process.env.S3_KEY,
    "secret": process.env.S3_SECRET
  }
};

var registry = require("../lib/registry");
var source = registry(config.source.registry, config.source.package_host),
    sink = registry(config.sink.registry, config.sink.package_host);

var s3_client = require("knox").createClient( config.s3 );
var s3tasks = require("../lib/s3tasks")(s3_client);
var tasks = require("../lib/tasks");
var q = tasks.change_queue(source, sink, s3_client);

var follow = require("follow");

sink.get_status(function(err, status) {
  if (err) {
    throw err;
  }

  follow({
    db: config.source.registry,
    since: status.update_seq
  }, function(err, change) {
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
        return;
      }

      if (err) {
        throw err;
      }

      console.log("processed %j", change);
      s3tasks.put_json({"update_seq": change.seq}, "_index", function() {
        console.log("updated s3 mirror with seq %d", change.seq);
      });
    });
  });
});
