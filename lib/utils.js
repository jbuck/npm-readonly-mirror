"use strict";

module.exports.diff_package = function(source, sink) {
  var rv = { add: [], remove: [] };

  if (source.versions) {
    rv.add = Object.keys(source.versions).filter(function(v) {
      return (sink.error && sink.error === "not_found") ||
        (!sink.versions[v]) ||
        (source.versions[v].dist.shasum !== sink.versions[v].dist.shasum);
    }).map(function(v) {
      return source.versions[v].dist.tarball;
    });
  }

  if (source.versions && sink.versions) {
    rv.remove = Object.keys(sink.versions).filter(function(v) {
      return !source.versions[v];
    }).map(function(v) {
      return sink.versions[v].dist.tarball;
    });
  }

  return rv;
};
