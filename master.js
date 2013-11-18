"use strict";

var config = require("./local");
var changes = require("./_changes");
var async = require("async");
var s3 = require("knox").createClient( config.target.s3 );
var fs = require("fs");
var worker = require("./lib/worker");
var url_module = require("url");

var q = async.queue(function(task, q_callback) {
  if (task.deleted) {
    return q_callback();
  }

  async.waterfall([
    function get_package_index(w_callback) {
      worker.get_package_index(task.id, config.source, w_callback);
    }, function clone_tarballs(package_index, w_callback) {
      var package_download = async.queue(function(dist, package_callback) {
        var url = url_module.parse(dist.tarball),
            path = url_module.parse(url).path;

        // Hack to work around broken package uploads
        url.host = "registry.npmjs.org";
        url.protocol = "http:";
        url = url.format();

        worker.get_tarball_stream(url, function(err, res) {
          if (err) {
            return package_callback(err);
          }

          console.log("GET " + url + " returned HTTP " + res.statusCode + " " + res.headers["content-length"]);

          // Who needs a tarball? Not us!
          if (res.statusCode === 404) {
            return package_callback();
          }

          if (res.statusCode !== 200) {
            return package_callback("GET " + url + " returned HTTP " + res.statusCode);
          }

          var headers = {
            "Content-MD5": res.headers["content-md5"],
            "Content-Length": res.headers["content-length"],
            "Content-Type": res.headers["content-type"]
          };

          s3.putStream(res, path, headers, function(err, s3_res) {
            if (err) {
              return package_callback(err);
            }

            console.log("PUT Object " + path + " returned HTTP " + s3_res.statusCode + " " + res.headers["content-length"]);

            if (s3_res.statusCode !== 200) {
              return package_callback("PUT Object " + path + " returned HTTP " + s3_res.statusCode);
            }

            package_callback();
          }).on("error", package_callback);

          res.on("error", package_callback);
        });
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
        package_download.push(pkg, function(err) {
          if (err) {
            w_callback(err);
          }
        });
      });

    }, function rewrite_index(package_index, w_callback) {
      worker.rewrite_package_dist(config.website, package_index);
      w_callback(null, package_index);
    }, function upload_index(package_index, w_callback) {
      var body = new Buffer(JSON.stringify(package_index));
      var path = "/" + task.id;
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
