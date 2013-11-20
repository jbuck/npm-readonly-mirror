"use strict";

var request = require("request");

var Registry = function Registry(registry_url) {
  this.registry_url = registry_url;
};

function _parse_json(err, res, body, callback) {
  if (err) {
    return callback(err, res);
  }

  var json;

  try {
    json = JSON.parse(body);
  } catch (ex) {
    callback(ex, res);
  }

  callback(err, res, json);
}

function _add_stream_prop(version) {
  Object.defineProperty(version.dist, "stream", {
    get: function() {
      return request.get(version.dist.tarball);
    },
    enumerable: false
  });

  return version;
}

Registry.prototype.get_changes = function(callback) {
  var changes_url = this.registry_url + "_changes";

  request.get(changes_url, function(err, res, body) {
    _parse_json(err, res, body, callback);
  });
};

Registry.prototype.get_changes_since = function(since, callback) {
  var changes_url = this.registry_url + "_changes?since=" + since;

  request.get(changes_url, function(err, res, body) {
    _parse_json(err, res, body, callback);
  });
};

Registry.prototype.get_package = function(name, callback) {
  var index_url = this.registry_url + "/" + name;

  request.get(index_url, function(err, res, body) {
    _parse_json(err, res, body, function(err, res, json) {
      if (err || !json) {
        callback(err, res, body);
      }

      if (json.versions) {
        Object.keys(json.versions).forEach(function(v) {
          json.versions[v] = _add_stream_prop(json.versions[v]);
        });
      }

      callback(null, res, json);
    });
  });
};

Registry.prototype.get_status = function(callback) {
  request.get(this.registry_url, function(err, res, body) {
    _parse_json(err, res, body, callback);
  });
};

module.exports = function(registry_url) {
  return new Registry(registry_url);
};
