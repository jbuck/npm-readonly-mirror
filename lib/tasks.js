"use strict";

var async = require("async");
var worker = require("./worker");
var url = require("url");
var utils = require("./utils");

module.exports.fetch_changes = function fetch_changes(source, sink, f_callback) {
  async.waterfall([
    function(w_callback) {
      sink.get_status(w_callback);
    },
    function(json, w_callback) {
      if (json.update_seq) {
        return source.get_changes_since(json.update_seq, w_callback);
      }

      source.get_changes(w_callback);
    }
  ], f_callback);
};

function delete_multiple_files(s3, files, callback) {
  s3.deleteMultiple(files, function(err, res) {
    if (err) {
      return callback(err);
    }

    console.log("DELETE %j %d", files, res.statusCode);

    if (res.statusCode !== 200) {
      return callback("DELETE " + files + " " + res.statusCode);
    }

    callback();
  });
}

function delete_package(package_name, s3, d_callback) {
  async.waterfall([
    function(w_callback) {
      s3.list({ prefix: package_name }, w_callback);
    },
    function(files, w_callback) {
      var files_to_delete = worker.filter_package_files(files);
      w_callback(null, files_to_delete);
    },
    function(files_to_delete, w_callback) {
      if (files_to_delete.length === 0) {
        return w_callback();
      }

      delete_multiple_files(s3, files_to_delete, w_callback);
    }
  ], d_callback);
}

module.exports.change_queue = function(source, sink, s3) {
  return async.queue(function(task, q_callback) {
    if (task.deleted) {
      return delete_package(task.id, s3, q_callback);
    }

    async.waterfall([
      function(w_callback) {
        source.get_package(task.id, w_callback);
      },
      function(source_pkg, w_callback) {
        // If the package has been deleted, then we can just pass an error
        // and retry this package. Then the deleted codepath will delete it
        if (source_pkg.error && source_pkg.error === "not_found") {
          task.deleted = true;
          var err = new Error("not_found");
          return w_callback(err);
        }

        w_callback(null, source_pkg);
      },
      function(source_pkg, w_callback) {
        sink.get_package(task.id, function(err, sink_pkg) {
          if (err) {
            return w_callback(err);
          }

          w_callback(null, source_pkg, sink_pkg);
        });
      },
      function(source_pkg, sink_pkg, w_callback) {
        var todo = utils.diff_package(source_pkg, sink_pkg);

        console.log({ id: task.id, add: todo.add, remove: todo.remove});

        if (todo.add.length === 0 && todo.remove.length === 0) {
          return w_callback(null, source_pkg);
        }

        var s_q = async.queue(function(task, q_callback) {
          var path = url.parse(task.url).path;

          if (task.deleted) {
            return delete_multiple_files(s3, [path], q_callback);
          }

          var s3tasks = require("./s3tasks")(s3);
          s3tasks.stream(task.url, path, function(err) {
            if (err && err.url === task.url && err.method === "GET" && err.status_code === 404) {
              // if we get a 404 on the npmjs registry, we'll never be able to mirror the
              // tarball so we basically just go "lol this is fine to not mirror"
              return q_callback();
            }

            q_callback(err);
          }).on("info", console.log);
        }, 4);

        todo.remove.forEach(function(remove) {
          s_q.push({url: remove, deleted: true}, function(err) {
            if (err) {
              w_callback(err);
            }
          });
        });
        todo.add.forEach(function(add) {
          s_q.push({url: add}, function(err) {
            if (err) {
              w_callback(err);
            }
          });
        });

        s_q.drain = function() {
          w_callback(null, source_pkg);
        };
      },
      function(source_pkg, w_callback) {
        worker.rewrite_package_dist(sink.package_host, source_pkg);

        var s_q = async.queue(function(task, q_callback) {
          var s3tasks = require("./s3tasks")(s3).on("info", console.log);
          s3tasks.put_json(task.json, task.path, q_callback);
        }, 4);

        s_q.push({json: source_pkg, path: task.id}, function(err) {
          if (err) {
            w_callback(err);
          }
        });

        if (source_pkg.versions) {
          Object.keys(source_pkg.versions).forEach(function(v) {
            s_q.push({json: source_pkg.versions[v], path: task.id + "/" + v}, function(err) {
              if (err) {
                w_callback(err);
              }
            });
          });
        }

        s_q.drain = w_callback;
      }
    ], q_callback);
  });
};
