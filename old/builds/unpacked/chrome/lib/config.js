'use strict';

var app = app || require('./firefox/firefox');
var config = typeof exports === 'undefined' ? {} : exports;

config.welcome = {
  get version () {
    return app.storage.read('version');
  },
  set version (val) {
    app.storage.write('version', val);
  },
  timeout: 3
};
