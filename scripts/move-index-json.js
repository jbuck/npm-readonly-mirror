var http = require("http");
http.globalAgent.maxSockets = Infinity;
var config = require("../local");
var s3 = require("knox").createClient( config.target.s3 );
var S3Lister = require("s3-lister");
var list_opts = {};
if (process.argv[2]) {
  list_opts.prefix = process.argv[2];
}
var lister = new S3Lister(s3, list_opts);

var async = require("async");
var q = async.queue(function(task, q_cb) {
  async.waterfall([
    function get_file_names(w_cb) {
      var old_key = task;
      var index = old_key.lastIndexOf("/index.json");
      var new_key = "/" + old_key.substring(0, index);

      w_cb(null, old_key, new_key);
    },
    function copy_file(old_key, new_key, w_cb) {
      s3.copy(old_key, new_key)
      .on("response", function(copy_res) {
        console.log("COPY %s => %s HTTP %d", old_key, new_key, copy_res.statusCode);

        if (copy_res.statusCode !== 200 && copy_res.statusCode !== 404) {
          return w_cb(new Error("COPY failed with HTTP " + copy_res.statusCode));
        }

        w_cb(null, old_key);
      })
      .on("error", w_cb)
      .end();
    },
    function del_file(old_key, w_cb) {
      s3.del(old_key)
      .on("response", function(del_res) {
        if (del_res.statusCode !== 204) {
          return w_cb(new Error("DELETE failed with HTTP " + del_res.statusCode));
        }

        console.log("DELETE %s HTTP %d", old_key, del_res.statusCode);
        w_cb();
      })
      .on("error", w_cb)
      .end();
    }
  ], q_cb);
}, 4);

q.drain = function() {
  console.log("done processing queue!");
};

lister.on("data", function(data) {
  var index = data.Key.lastIndexOf("/index.json");

  if (index !== -1) {
    q.push(data.Key, function(err) {
      if (err) {
        console.log("Failed to process %s", data.Key);
        throw err;
      }
    });
  }
});

lister.on("end", function() {
  console.log("done streaming! starting queue");
});
