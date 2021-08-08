'use strict';

{
  const once = () => {
    chrome.contextMenus.create({
      'id': 'search-link-google',
      'title': 'Google Images (Image URL)',
      'contexts': ['image']
    });
    chrome.contextMenus.create({
      'id': 'search-link-tineye',
      'title': 'Tineye (Image URL)',
      'contexts': ['image']
    });
    chrome.contextMenus.create({
      'id': 'capture-google',
      'title': 'Google Images (Capture)',
      'contexts': ['page']
    });
    // chrome.contextMenus.create({
    //   'id': 'capture-tineye',
    //   'title': 'TinEye (Capture)',
    //   'contexts': ['page']
    // });
    chrome.contextMenus.create({
      'id': 'preview',
      'title': 'Usage Preview',
      'contexts': ['action']
    });
  };
  chrome.runtime.onInstalled.addListener(once);
  chrome.runtime.onStartup.addListener(once);
}

const notify = async (tabId, msg = '') => {
  await chrome.scripting.insertCSS({
    target: {tabId},
    files: ['data/inject/notify.css']
  });
  await chrome.scripting.executeScript({
    target: {tabId},
    files: ['data/inject/notify.js']
  });
  chrome.scripting.executeScript({
    target: {tabId},
    func: msg => {
      if (msg) {
        notify.display(msg);
      }
      else {
        notify.hide();
      }
    },
    args: [msg]
  });
};

const ports = {};
const onClick = async (info, tab) => {
  if (info.menuItemId === 'preview') {
    chrome.tabs.create({
      url: 'https://www.youtube.com/watch?v=KiBNYb3yuSo'
    });
  }
  else if (info.menuItemId.startsWith('capture-')) {
    await chrome.scripting.insertCSS({
      target: {tabId: tab.id},
      files: ['data/inject/inject.css']
    });
    await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      func: service => {
        window.service = service;
      },
      args: [info.menuItemId.endsWith('tineye') ? 'TinEye' : 'Google']
    });
    chrome.scripting.executeScript({
      target: {tabId: tab.id},
      files: ['data/inject/inject.js']
    });
  }
  else if (info.menuItemId.startsWith('search-link-')) {
    const tineye = info.menuItemId.endsWith('tineye');

    if (tineye) {
      chrome.tabs.create({
        url: 'https://tineye.com/search/?pluginver=chrome-1.3.0&url=' + encodeURIComponent(info.srcUrl)
      });
    }
    else {
      chrome.tabs.create({
        url: 'https://www.google.com/searchbyimage?image_url=' + encodeURIComponent(info.srcUrl)
      });
    }
  }
};

// keep bg active until file is sent to the server
chrome.runtime.onConnect.addListener(port => {
  ports[port.name] = port;
});

chrome.contextMenus.onClicked.addListener(onClick);
chrome.action.onClicked.addListener(tab => {
  onClick({
    menuItemId: 'capture-google'
  }, tab);
});

function capture(request, sender) {
  const {devicePixelRatio, service = 'TinEye'} = request;

  let {left, top, width, height, name} = request;
  left *= devicePixelRatio;
  top *= devicePixelRatio;
  width *= devicePixelRatio;
  height *= devicePixelRatio;

  notify(sender.tab.id, `Uploading image to ${service}. Please wait ...`);

  chrome.tabs.captureVisibleTab(sender.tab.windowId, {format: 'png'}, async href => {
    const img = await createImageBitmap(await fetch(href).then(r => r.blob()));

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (width && height) {
      ctx.drawImage(img, left, top, width, height, 0, 0, width, height);
    }
    else {
      ctx.drawImage(img, 0, 0);
    }

    const blob = await canvas.convertToBlob({
      type: 'image/png',
      quality: 1.00
    });

    const body = new FormData();
    body.processData = false;
    body.contentType = false;

    let response;
    try {
      if (service === 'Google') {
        body.append('encoded_image', blob, 'screenshot.png');
        response = await fetch('https://www.google.com/searchbyimage/upload', {
          method: 'POST',
          body
        });
      }
      else {
        body.append('image', blob, 'screenshot.png');
        response = await fetch('https://tineye.com/result_json/?token=', {
          method: 'POST',
          body
        });
      }
      chrome.tabs.create({
        url: response.url
      });
      notify(sender.tab.id);
    }
    catch (e) {
      console.warn(e);
      notify(sender.tab.id, 'Failed! ' + (e.message || e));
    }
    // disconnect port
    const p = ports[name];
    if (p) {
      delete ports[name];
      console.log(p, name);
      p.disconnect();
    }
  });
}

chrome.runtime.onMessage.addListener(capture);

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
