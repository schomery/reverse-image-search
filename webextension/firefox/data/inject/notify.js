'use strict';

var notify = (function () {
  let box = document.querySelector('.itrisearch-notification');
  return {
    install: function () {
      box = document.createElement('div');
      box.setAttribute('class', 'itrisearch-notification');
      const span = document.createElement('span');
      const button = document.createElement('button');
      button.setAttribute('type', 'close');
      button.addEventListener('click', function () {
        notify.hide();
      });
      box.appendChild(span);
      box.appendChild(button);
      document.body.appendChild(box);
    },
    display: function (msg) {
      if (!document.querySelector('.itrisearch-notification')) {
        this.install();
      }
      box.style.display = 'block';
      box.querySelector('span').textContent = msg;
    },
    hide: function () {
      box.style.display = 'none';
    },
    remove: function () {
      if (box && box.parentNode) {
        box.parentNode.removeChild(box);
        box = null;
      }
    }
  };
})();
