'use strict';

// Load Firefox based resources
var self          = require('sdk/self'),
    data          = self.data,
    sp            = require('sdk/simple-prefs'),
    prefs         = sp.prefs,
    pageMod       = require('sdk/page-mod'),
    tabs          = require('sdk/tabs'),
    timers        = require('sdk/timers'),
    loader        = require('@loader/options'),
    contextMenu   = require('sdk/context-menu'),
    array         = require('sdk/util/array'),
    {Cc, Ci, Cu}  = require('chrome'),
    mm            = require('./mm');

Cu.import('resource://gre/modules/Promise.jsm');

exports.inject = (function () {
  var workers = [], content_script_arr = [];
  pageMod.PageMod({
    include: ['http://*', 'https://*'],
    contentScriptFile: [data.url('./content_script/inject.js')],
    contentScriptWhen: 'start',
    contentStyleFile : data.url('./content_script/inject.css'),
    attachTo: ['top', 'existing'],
    contentScriptOptions: {
      base: loader.prefixURI + loader.name + '/'
    },
    onAttach: function (worker) {
      array.add(workers, worker);
      worker.on('pageshow', function () { array.add(workers, this); });
      worker.on('pagehide', function () { array.remove(workers, this); });
      worker.on('detach', function () { array.remove(workers, this); });
      content_script_arr.forEach(function (arr) {
        worker.port.on(arr[0], arr[1]);
      });
    }
  });
  return {
    send: function (id, data, global) {
      if (global === true) {
        workers.forEach(function (worker) {
          worker.port.emit(id, data);
        });
      }
      else if ('emit' in this) {
        this.emit(id, data);
      }
      else {
        workers.forEach(function (worker) {
          if (worker.tab !== tabs.activeTab) {
            return;
          }
          worker.port.emit(id, data);
        });
      }
    },
    receive: function (id, callback) {
      content_script_arr.push([id, callback]);
      workers.forEach(function (worker) {
        worker.port.on(id, callback);
      });
    }
  };
})();

exports.storage = {
  read: function (id) {
    return (prefs[id] || prefs[id] + '' === 'false') ? (prefs[id] + '') : null;
  },
  write: function (id, data) {
    data = data + '';
    if (data === 'true' || data === 'false') {
      prefs[id] = data === 'true' ? true : false;
    }
    else if (parseInt(data) + '' === data) {
      prefs[id] = parseInt(data);
    }
    else {
      prefs[id] = data + '';
    }
  }
};

exports.tab = {
  open: function (url, inBackground, inCurrent) {
    if (inCurrent) {
      tabs.activeTab.url = url;
    }
    else {
      tabs.open({
        url: url,
        inBackground: typeof inBackground === 'undefined' ? false : inBackground
      });
    }
  }
};

exports.context_menu = {
  create: function (title, img, type, callback) {
    contextMenu.Item({
      label: title,
      image: data.url(img),
      context: type === 'img' ? contextMenu.SelectorContext('img') : contextMenu.PredicateContext(function (context) {
        return context.documentURL.indexOf('http') !== -1 && context.targetName !== 'img';
      }),
      contentScript: 'self.on("click", function (node) {self.postMessage(node.src);});',
      onMessage: function (src) {
        callback(src);
      }
    });
  }
};

exports.version = function () {
  return self.version;
};

exports.timer = timers;

exports.screenshot = (function (d) {
  mm.init('firefox/chrome.js');
  mm.connect(function (blob) {
    if (d) {
      d.resolve(blob);
    }
  });
  return function (left, top, width, height) {
    d = Promise.defer();
    mm.emit('screenshot', {left, top, width, height});
    return d.promise;
  };
})();

exports.FormData = function () {
  return Cc['@mozilla.org/files/formdata;1']
    .createInstance(Ci.nsIDOMFormData);
};

exports.XMLHttpRequest = function () {
  return Cc['@mozilla.org/xmlextras/xmlhttprequest;1']
    .createInstance(Ci.nsIXMLHttpRequest);
};
