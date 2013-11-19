"use strict";

var http = require("http");
http.globalAgent.maxSockets = Infinity;

var url = require("url");

var get_json_from_res = module.exports.get_json_from_res = function get_json_from_res(res, callback) {
  var bodyParts = [];
  var bytes = 0;

  res.on("data", function(c) {
    bodyParts.push(c);
    bytes += c.length;
  });
  res.on("end", function() {
    var body = Buffer.concat(bodyParts, bytes).toString("utf8");
    var json;

    try {
      json = JSON.parse(body);
    } catch (ex) {
      return callback(ex);
    }

    callback(null, json);
  });
  res.on("error", callback);
};

var get_json = module.exports.get_json = function get_json(url, callback) {
  http.get(url, function(res) {
    get_json_from_res(res, callback);
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

module.exports.rewrite_package_dist = function rewrite_package_dist(target_url, package_index) {
  if (!package_index.versions) {
    return;
  }

  var target = url.parse(target_url);

  Object.keys(package_index.versions).forEach(function(version) {
    var orig_url = url.parse(package_index.versions[version].dist.tarball);
    orig_url.protocol = target.protocol;
    orig_url.host = target.host;

    package_index.versions[version].dist.tarball = orig_url.format();
  });
};
