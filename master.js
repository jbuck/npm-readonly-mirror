"use strict";

var config = require("./local");

var registry = config.source;
var changes = require("./_changes");

var async = require("async");
var http = require("http");
http.globalAgent.maxSockets = Infinity;

var s3 = require("knox").createClient( config.target.s3 );

var url_module = require("url");

var target = url_module.parse(config.website);

var fs = require("fs");

var worker = require("./lib/worker");

var input_bytes = 0;
var output_bytes = 0;

var q = async.queue(function(task, q_callback) {
  if (task.deleted) {
    return q_callback();
  }

  async.waterfall([
    function get_package_index(w_callback) {
      worker.get_package_index(task.id, registry, w_callback);
    }, function clone_tarballs(package_index, w_callback) {
      var package_download = async.queue(function(dist, package_callback) {
        var url = dist.tarball,
            path = require("url").parse(url).path;

        http.get(url, function(res) {
          if (res.statusCode !== 200) {
            return package_callback("GET " + url + " returned HTTP " + res.statusCode);
          }
          console.log("GET " + url + " returned HTTP " + res.statusCode + " " + res.headers["content-length"]);

          input_bytes += parseInt(res.headers["content-length"], 10);

          var headers = {
            "Content-MD5": res.headers["content-md5"],
            "Content-Length": res.headers["content-length"],
            "Content-Type": res.headers["content-type"]
          };

          s3.putStream(res, path, headers, function(err, s3_res) {
            if (err) {
              return package_callback(err);
            }

            if (s3_res.statusCode !== 200) {
              return package_callback("PUT Object " + path + " returned HTTP " + s3_res.statusCode);
            }
            console.log("PUT Object " + path + " returned HTTP " + s3_res.statusCode + " " + res.headers["content-length"]);

            output_bytes += parseInt(res.headers["content-length"], 10);

            package_callback();
          });

          res.on("error", package_callback);
        }).on("error", package_callback);
      }, 4);

      package_download.drain = function() {
        w_callback(null, package_index);
      };

      if (!package_index.versions || Object.keys(package_index.versions).length === 0) {
        return w_callback(null, package_index);
      }

      Object.keys(package_index.versions).forEach(function(version) {
        var pkg = package_index.versions[version].dist;
        pkg.version = version;
        package_download.push(pkg);
      });

    }, function rewrite_index(package_index, w_callback) {
      if (!package_index.versions) {
        return w_callback(null, package_index);
      }

      Object.keys(package_index.versions).forEach(function(version) {
        var orig_url = url_module.parse(package_index.versions[version].dist.tarball);
        orig_url.protocol = target.protocol;
        orig_url.host = target.host;

        package_index.versions[version].dist.tarball = orig_url.format();
      });

      w_callback(null, package_index);
    }, function upload_index(package_index, w_callback) {
      var body = new Buffer(JSON.stringify(package_index));
      var path = "/" + task.id + "/index.json";
      var headers = {
        "Content-Length": body.length,
        "Content-Type": "application/json; charset=utf-8"
      };

      s3.putBuffer(body, path, headers, function(err, s3_res) {
        if (err) {
          return w_callback(err);
        }

        if (s3_res.statusCode !== 200) {
          return w_callback("PUT Object " + path + " returned HTTP " + s3_res.statusCode);
        }
        console.log("PUT Object " + path + " returned HTTP " + s3_res.statusCode + " " + body.length);

        output_bytes += parseInt(body.length, 10);

        w_callback();
      });
    }
  ], function(err) {
    if (err) {
      throw err;
    }

    console.log("completed processing %j", task);
    config.last_seq = task.seq;
    var body = new Buffer(JSON.stringify(config, null, 2));
    fs.writeFile("local.json", body, function(err) {
      if (err) {
        return q_callback(err);
      }

      console.log("checkpointed last_seq %d", config.last_seq);
      q_callback();
    });
  });
}, 1);

q.drain = function() {
  console.log("completed syncing");
  console.log("input %d MB", input_bytes / 1024 / 1024);
  console.log("output %d MB", output_bytes / 1024 / 1024);
  process.exit(0);
};

var cur = 0, max = 10000;
for (var i = 0; i < changes.results.length && cur < max; i += 1) {
  if (changes.results[i].seq <= config.last_seq) {
    continue;
  }
  cur += 1;
  q.push(changes.results[i]);
}
