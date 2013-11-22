"use strict";

var hyperquest = require("hyperquest");

var Registry = function Registry(registry_url) {
  this.registry_url = registry_url;
};

function _parse_json(callback) {
  return function (err, res) {
    if (err) {
      return callback(err);
    }

    var bodyParts = [];
    var bytes = 0;
    res.on("data", function(c) {
      bodyParts.push(c);
      bytes += c.length;
    });
    res.on("end", function() {
      var json;

      try {
        json = JSON.parse(Buffer.concat(bodyParts, bytes).toString("utf8"));
      } catch (ex) {
        return callback(ex);
      }

      callback(null, json);
    });
    res.on("error", callback);
  };
}

Registry.prototype.get_changes = function(callback) {
  var changes_url = this.registry_url + "_changes";

  hyperquest.get(changes_url, _parse_json(callback));
};

Registry.prototype.get_changes_since = function(since, callback) {
  var changes_url = this.registry_url + "_changes?since=" + since;

  hyperquest.get(changes_url, _parse_json(callback));
};

Registry.prototype.get_package = function(name, callback) {
  var index_url = this.registry_url + name;

  hyperquest.get(index_url, _parse_json(callback));
};

Registry.prototype.get_status = function(callback) {
  hyperquest.get(this.registry_url, _parse_json(callback));
};

module.exports = function(registry_url) {
  return new Registry(registry_url);
};
