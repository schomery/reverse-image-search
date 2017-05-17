'use strict';

if (!HTMLCanvasElement.prototype.toBlob) {
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    value: function (callback, type, quality) {

      const binStr = atob(this.toDataURL(type, quality).split(',')[1]),
        len = binStr.length,
        arr = new Uint8Array(len);

      for (let i = 0; i < len; i++) {
        arr[i] = binStr.charCodeAt(i);
      }

      callback(new Blob([arr], {type: type || 'image/png'}));
    }
  });
}

chrome.contextMenus.create({
  'id': 'search-link-google',
  'type': 'normal',
  'title': 'Image URL (Google Image)',
  'contexts': ['image']
});
chrome.contextMenus.create({
  'id': 'search-link-tineye',
  'type': 'normal',
  'title': 'Image URL (Tineye)',
  'contexts': ['image']
});
chrome.contextMenus.create({
  'id': 'capture-google',
  'type': 'normal',
  'title': 'Capture (Google Image)',
  'contexts': ['page']
});
chrome.contextMenus.create({
  'id': 'capture-tineye',
  'type': 'normal',
  'title': 'Capture (TinEye)',
  'contexts': ['page']
});

function notify (id, msg) {
  chrome.tabs.insertCSS(id, {
    file: 'data/inject/notify.css'
  }, () => {
    chrome.tabs.executeScript(id, {
      file: 'data/inject/notify.js'
    }, () => {
      chrome.tabs.executeScript(id, {
        code: msg ? `notify.display('${msg}');` : `notify.hide();`
      });
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId.startsWith('capture-')) {
    chrome.tabs.insertCSS(tab.id, {
      file: 'data/inject/inject.css'
    }, () => {
      chrome.tabs.executeScript(tab.id, {
        code: `window.service = '${info.menuItemId.endsWith('tineye') ? 'TinEye' : 'Google'}';`
      }, () => {
        chrome.tabs.executeScript(tab.id, {
          file: 'data/inject/inject.js'
        });
      });
    });
  }
  else if (info.menuItemId.startsWith('search-link-')) {
    const tineye = info.menuItemId.endsWith('tineye');

    if (tineye) {
      notify(tab.id, `Uploading image to TinEye. Please wait ...`);
      const formData = new window.FormData();
      formData.processData = false;
      formData.contentType = false;
      formData.append('url', info.srcUrl);
      const req = new window.XMLHttpRequest();
      req.onload = () => {
        chrome.tabs.create({
          url: req.responseURL
        });
        notify(tab.id, '');
      };
      req.onerror = (e) => notify(tab.id, 'Failed! ' + (e.message || e));
      req.open('POST', 'https://www.tineye.com/search', true);
      req.send(formData);
    }
    else {
      chrome.tabs.create({
        url: 'https://www.google.com/searchbyimage?image_url=' + encodeURIComponent(info.srcUrl)
      });
    }
  }
});

function capture (request, sender) {
  const {width, height, left, top, service = 'TinEye'} = request;
  notify(sender.tab.id, `Uploading image to ${service}. Please wait ...`);

  chrome.tabs.captureVisibleTab(sender.tab.windowId, {format: 'png'}, (dataUrl) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = width || img.width;
      canvas.height = height || img.height;
      if (width && height) {
        ctx.drawImage(img, left, top, width, height, 0, 0, width, height);
      }
      else {
        ctx.drawImage(img, 0, 0);
      }
      canvas.toBlob((blob) => {
        const formData = new window.FormData();
        formData.processData = false;
        formData.contentType = false;
        if (service === 'Google') {
          formData.append('encoded_image', blob, 'screenshot.png');
        }
        else {
          formData.append('image', blob, 'screenshot.png');
        }

        const req = new window.XMLHttpRequest();

        req.onload = () => {
          chrome.tabs.create({
            url: req.responseURL
          });
          notify(sender.tab.id);
        };
        req.onerror = (e) => notify(sender.tab.id, 'Failed! ' + (e.message || e));
        if (service === 'Google') {
          req.open('POST', 'https://www.google.com/searchbyimage/upload', true);
        }
        else {
          req.open('POST', 'https://www.tineye.com/search', true);
        }
        req.send(formData);
      });
    };
    img.src = dataUrl;
  });
}

chrome.runtime.onMessage.addListener(capture);

//
chrome.storage.local.get('version', prefs => {
  let version = chrome.runtime.getManifest().version;
  let isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;
  if (isFirefox ? !prefs.version : prefs.version !== version) {
    chrome.storage.local.set({version}, () => {
      chrome.tabs.create({
        url: 'http://mybrowseraddon.com/tineye.html?version=' + version +
          '&type=' + (prefs.version ? ('upgrade&p=' + prefs.version) : 'install')
      });
    });
  }
});
(function () {
  let {version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL('http://mybrowseraddon.com/tineye.html?type=uninstall' + '&v=' + version);
})();
