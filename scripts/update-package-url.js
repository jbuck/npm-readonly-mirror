"use strict";

var config = require("../local");
var s3 = require("knox").createClient( config.s3 );
var S3Lister = require("s3-lister");
var async = require("async");
var worker = require("../lib/worker");

var q = async.queue(function(task, q_callback) {
  async.waterfall([
    function(w_callback) {
      s3.getFile(task, function(err, s3_res) {
        if (err) {
          return w_callback(err);
        }

        console.log("GET %s %d", task, s3_res.statusCode);

        if (s3_res.statusCode !== 200) {
          return w_callback(s3_res.statusCode);
        }

        var bodyParts = [];
        s3_res.on("data", function(c) { bodyParts.push(c); });
        s3_res.on("end", function() {
          try {
            var json = JSON.parse(Buffer.concat(bodyParts).toString("utf8"));
          } catch (ex) {
            return w_callback(ex);
          }

          w_callback(null, json);
        });
        s3_res.on("error", w_callback);

      }).on("error", function(err) {
        w_callback(err);
      });
    },
    function(json, w_callback) {
      var copy = JSON.parse(JSON.stringify(json));

      worker.rewrite_package_dist(config.sink.package_host, json);

      w_callback(null, copy, json);
    },
    function(original, modified, w_callback) {
      if (JSON.stringify(original) === JSON.stringify(modified)) {
        console.log("%s does not need to be updated", task);
        return w_callback();
      }

      var data = new Buffer(JSON.stringify(modified), "utf8");
      var headers = {
        "Content-Length": data.length,
        "Content-MD5": require("crypto").createHash("md5").update(data).digest("base64"),
        "Content-Type": "text/plain; charset=utf-8"
      };

      s3.putBuffer(data, task, headers, function(err, s3_res) {
        if (err) {
          return w_callback(err);
        }

        console.log("PUT %s %d", task, s3_res.statusCode);

        if (s3_res.statusCode !== 200) {
          return w_callback(s3_res.statusCode);
        }

        w_callback();

        s3_res.on("error", function(err) {
          w_callback(err);
        })
      }).on("error", function(err) {
        w_callback(err);
      });
    }
  ], q_callback);
}, 4);

var lister_opts = {};
if (process.argv[2]) {
  lister_opts.prefix = process.argv[2];
}

var lister = new S3Lister(s3, lister_opts);

lister.on("data", function(data) {
  if (data.Key.indexOf(".tgz") !== -1) {
    return;
  }

  q.push(data.Key, function(err) {
    if (err) {
      console.log("Failed to process %s with error %s, retrying", data.Key, err);
      q.unshift(data.Key);
    }
  });
});

lister.on("error", function(err) {
  throw err;
});

lister.on("end", function() {
  console.log("done streaming!");
});


q.drain = function() {
  console.log("queue all processed!");
};
