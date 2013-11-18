"use strict";

var http = require("http");
http.globalAgent.maxSockets = Infinity;

var get_json = function get_json(url, callback) {
  http.get(url, function(res) {
    var bodyParts = [];
    var bytes = 0;

    res.on("data", function(c) {
      bodyParts.push(c);
      bytes += c.length;
    });
    res.on("end", function() {
      var body = Buffer.concat(bodyParts, bytes).toString("utf8");
      var changes;

      try {
        changes = JSON.parse(body);
      } catch (ex) {
        return callback(ex);
      }

      callback(null, changes);
    });
    res.on("error", callback);
  }).on("error", callback);
};

module.exports.get_changes = function get_changes(since, registry, callback) {
  if (typeof since === "string") {
    callback = registry;
    registry = since;
    since = null;
  }

  var url = registry + "_changes";

  if (since) {
    url += "?since=" + since;
  }

  get_json(url, callback);
};

module.exports.get_package_index = function get_package_index(name, registry, callback) {
  var url = registry + name;

  get_json(url, callback);
};

module.exports.get_tarball_stream = function get_tarball_stream(url, callback) {
  http.get(url, function(res) {
    callback(null, res);
  }).on("error", callback);
};
