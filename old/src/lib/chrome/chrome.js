'use strict';

var app = {};

if (!Promise.defer) {
  Promise.defer = function () {
    var deferred = {};
    var promise = new Promise(function (resolve, reject) {
      deferred.resolve = resolve;
      deferred.reject  = reject;
    });
    deferred.promise = promise;
    return deferred;
  };
}
app.Promise = Promise;

app.storage = {
  read: function (id) {
    return localStorage[id] || null;
  },
  write: function (id, data) {
    localStorage[id] = data + '';
  }
};

app.inject = {
  send: function (id, data, global) {
    if (global) {
      chrome.tabs.query({}, function (tabs) {
        tabs.forEach(function (tab) {
          chrome.tabs.sendMessage(tab.id, {method: id, data: data}, function () {});
        });
      });
    }
    else if ('id' in this && 'windowId' in this) {
      chrome.tabs.sendMessage(this.id, {method: id, data: data}, function () {});
    }
    else {
      chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        tabs.forEach(function (tab) {
          chrome.tabs.sendMessage(tab.id, {method: id, data: data}, function () {});
        });
      });
    }
  },
  receive: function (id, callback) {
    chrome.runtime.onMessage.addListener(function (message, sender) {
      if (message.method === id && sender.tab && sender.tab.url.indexOf('http') === 0) {
        callback.call(sender.tab, message.data);
      }
    });
  }
};

app.tab = {
  open: function (url) {
    chrome.tabs.create({
      url: url
    });
  }
};

app.context_menu = {
  create: function (title, img, type, callback) {
    chrome.contextMenus.create({
      'type': 'normal',
      'title': title,
      'contexts': [type === 'img' ? 'image' : 'page'],
      'onclick': function (info) {
        callback(info.srcUrl);
      }
    });
  }
};

app.version = function () {
  return chrome[chrome.runtime && chrome.runtime.getManifest ? 'runtime' : 'extension'].getManifest().version;
};

app.timer = window;

app.screenshot = function (left, top, width, height, devicePixelRatio) {
  var d = Promise.defer();
  left = left  * devicePixelRatio;
  top = top  * devicePixelRatio;
  width = width  * devicePixelRatio;
  height = height  * devicePixelRatio;

  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, function (tab) {
    chrome.tabs.captureVisibleTab(tab.windowId, {format: 'png'}, function (dataUrl) {
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      var img = new Image();
      img.onload = function () {
        canvas.width = width || img.width;
        canvas.height = height || img.height;
        if (width && height) {
          ctx.drawImage(img, left, top, width, height, 0, 0, width, height);
        }
        else {
          ctx.drawImage(img, 0, 0);
        }
        canvas.toBlob(function (blob) {
          d.resolve(blob);
        });
      };
      img.src = dataUrl;
    });
  });
  return d.promise;
};

app.FormData = window.FormData;
app.XMLHttpRequest = window.XMLHttpRequest;
