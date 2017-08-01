const ListUselet = function (items, itemView) {
  itemView = itemView || ((i) => TextUselet(i));

  return Uselet(
    'x-list',
    items,
    (model, msg) => {
      switch (msg.type) {
        case 'CLEAR':
          return [ ]
        case 'ADD':
          const copy = model.slice();
          copy.push(msg.data);
          return copy;
        case 'REVERSE':
          return model.reverse()
        case 'REPLACE':
          return msg.data;
        default:
          return model;
      }
    },
    (mod) => {

      const ul = document.createElement('ul');
      ul.classList.add('overview-ul');

      return mod.length ?
        childOf(
          ul,
          mod
            .map(i => {
              const li = document.createElement('li');
              li.classList.add('overview-li');
              return childOf(li, itemView(i));
            })
            .reduce((a, b) => asSiblings(a, b), EmptyUselet)
        ) :
        XmlUselet('<div class="warn">No items</div>');
    },
  );
}

const RouterOutlet = function (patterns) {
  window.addEventListener('popstate', (e) => {
    Dispatcher.broadcast({ type: 'NAVIGATE', data: { url: location.pathname } });
  });

  return Uselet(
    'router-outlet',
    window.location.pathname,
    (model, msg) => {
      switch (msg.type) {
        case 'NAVIGATE':
          history.pushState({ }, '', msg.data.url);
          return msg.data.url;
        default:
          return model;
      }
    },
    (path) => {
      for (let i = 0; i < patterns.length; i++) {
        if (patterns[i].path.test(path.slice(1))) {
          const content = patterns[i].content;
          const args = path.slice(1).match(patterns[i].path);
          return args ? content(...args) : content();
        }
      }
      throw new Error('Not path match found for ' + path);
    },
  );
}
