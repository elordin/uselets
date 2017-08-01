const DEBUGGING = window.location.search.indexOf('debug') > -1;

const DEBUG_HISTORY_EVENT = 'debug-history-update';
const USELET_REGISTERED_EVENT = 'uselet-registered';
const USELET_BROADCAST_EVENT = 'uselet-broadcast';
const USELET_SEND_EVENT = 'uselet-send';

function DebugHistory () {
  let history = [ ];
  let currentIndex = -1;

  Object.defineProperty(this, 'states', {
    get: () => history,
  });

  Object.defineProperty(this, 'index', {
    get: () => currentIndex,
  });

  function update () {
    const target = history[currentIndex];
    if (!target) {
      throw new Error('Unknown history state');
    }

    Object.keys(target.models).sort((a, b) => {
      return a.match(/\//g).length < b.match(/\//g).length ?
      -1 :
      a.match(/\//g).length > b.match(/\//g).length ?
      1 :
      0
    }).forEach(k => {
      const elem = document.getElementById(k);
      if (!elem) {
        console.warn('No element found', k);
        return;
      }
      if (elem.hasOwnProperty('model')) {
        elem.model = target.models[k];
      }
    });

    window.dispatchEvent(new Event(DEBUG_HISTORY_EVENT));
  }

  function pushState (state) {
    if (currentIndex !== history.length - 1) {
      history = history.slice(0, currentIndex + 1);
    }
    history.push(state);
    currentIndex++;
    update();
  }

  this.go = (index) => {
    currentIndex = index;
    update();
  }

  this.forward = () => {
    if (currentIndex < history.length - 1) {
      currentIndex++;
      update();
    }
  }

  this.back = () => {
    if (currentIndex > 0) {
      currentIndex--;
      update();
    }
  }

  function collectState () {
    const ret = { };
    Object.keys(Dispatcher.clients).forEach(k => {
      ret[k] = Dispatcher.clients[k].model;
    });
    return ret;
  }

  window.addEventListener(USELET_BROADCAST_EVENT, (e) => {
    setTimeout(() => {
      const state = collectState();
      pushState({ name: e.detail.message.type, models: state });
    }, 100);
  });

  setTimeout(() => {
    const state = collectState();
    pushState({ name: 'init', models: state });
  }, 100);


  return this;
}

class Debugger {
  constructor () {
    document.body.classList.add('debug');

    const debugBar = document.createElement('div');
    debugBar.classList.add('debug-bar');
    document.body.insertBefore(debugBar, document.body.firstChild);

    // Stats

    const stats = document.createElement('div');
    stats.classList.add('debug-stats');
    function updateStats () {
      stats.innerHTML = `Active Uselets: ${Object.keys(Dispatcher.clients).length}`;
    };
    setTimeout(updateStats, 100);
    window.addEventListener(USELET_REGISTERED_EVENT, (e) => updateStats());
    debugBar.appendChild(stats);

    // History

    const history = new DebugHistory();

    const historyBar = document.createElement('div');
    historyBar.classList.add('history-bar');
    debugBar.appendChild(historyBar);

    const historyBackButton = document.createElement('button');
    const historyBackButtonImg = document.createElement('img');
    historyBackButtonImg.setAttribute('src', 'img/back.svg');
    historyBackButton.appendChild(historyBackButtonImg);
    historyBackButton.addEventListener('click', (e) => history.back());
    historyBar.appendChild(historyBackButton);

    const historyLabel = document.createElement('span');
    historyLabel.innerText = '10/10';
    historyBar.appendChild(historyLabel);

    const historyForwardButton = document.createElement('button');
    const historyForwardButtonImg = document.createElement('img');
    historyForwardButtonImg.setAttribute('src', 'img/fwd.svg');
    historyForwardButton.appendChild(historyForwardButtonImg);
    historyForwardButton.addEventListener('click', (e) => history.forward());
    historyBar.appendChild(historyForwardButton);

    const historyList = document.createElement('ul');
    historyList.classList.add('history-list');
    function updateHistoryList () {
      historyList.innerHTML = '';
      const index = history.index;
      history.states.forEach((state, i) => {
        const li = document.createElement('li');
        li.innerText = state.name;
        if (i === index) {
          li.classList.add('active');
        }
        li.addEventListener('click', (e) => {
          history.go(i);
        });
        historyList.appendChild(li);
      });
    }
    window.addEventListener(DEBUG_HISTORY_EVENT, updateHistoryList);
    historyBar.appendChild(historyList);
    updateHistoryList();

    let historyOpen = false;
    historyLabel.addEventListener('click', (e) => {
      historyOpen = !historyOpen;
      if (historyOpen) {
        historyList.style.maxHeight = '25vh';
      } else {
        historyList.style.maxHeight = '0';
      }
    });

  }

}

if (DEBUGGING) {
  window.addEventListener('load', (e) => new Debugger());
}
