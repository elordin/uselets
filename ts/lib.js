function inCombinator (u, node) {
  const ret = {
    and: (other) => andCombinator(ret, other),
    in: (other) => inCombinator(ret, other),
  };
  u.xml.forEach(x => node.appendChild(x));
  Object.defineProperty(ret, 'xml', {
    get: () => [ node ],
    enumerable: true,
  })
  return ret;
}

function andCombinator (u1, u2) {
  if (!u2) {
    return u1;
  }

  const ret = {
    and: (other) => andCombinator(ret, other),
    in: (other) => inCombinator(ret, other),
  };

  Object.defineProperty(ret, 'xml', {
    get: () => u1.xml.concat(u2.xml),
    enumerable: true,
  });
  return ret;
}

class Uselet {

  /**
   * Creates an instance of Uselet.
   * @param {string} name
   * @param {Model} model
   * @param {(mod: Model, msg: Message) => Model} update
   * @param {(mod: Model) => Uselet[]} view
   * @memberof Uselet
   */
  constructor (
    name,
    model,
    update,
    view,
  ) {
    const root = document.createElement(name);
    Object.defineProperty(root, 'uselet', {
      get: () => this,
      enumerable: true,
    });
    // const shadow = root.attachShadow({ mode: 'open' });

    let child = view(model);
    child.xml.forEach(x => root.appendChild(x));

    Object.defineProperty(this, 'xml', {
      value: [ root ],
      writable: false,
      enumerable: true,
    });

    this.receive = (msg) => {
      if (!msg.type) {
        throw new Error('Untyped message received');
      }

      const oldModel = JSON.parse(JSON.stringify(model));
      model = update(model, msg);

      // if (model !== oldModel) {

        root.innerHTML = '';
        child = view(model);
        child.xml.forEach(x => root.appendChild(x));

      // }
    };

    this.and = (that) => andCombinator(this, that);
    this.in = (that) => inCombinator(this, that);
  }
}

class XmlUselet {
  /**
   * Creates an instance of XmlUselet.
   * @param {Node[] | string} xml
   * @memberof XmlUselet
   */
  constructor (xml) {
    if (typeof xml === 'string') {
      const dummy = document.createElement('div');
      dummy.innerHTML = xml;
      xml = Array.prototype.map.call(dummy.childNodes, a => a);
    }

    const ros = Array.prototype.map.call(document.querySelectorAll('router-outlet'), a => a);
    xml.forEach(x => {
      Array.prototype.forEach.call(x.querySelectorAll('[uref]'), (node) => {
        const url = node.getAttribute('uref');
        if (url) {
          node.addEventListener('click', (e) => {
            e.preventDefault();
            ros.forEach(ro => ro.uselet.receive({ type: 'NAVIGATE', data: { url: url } }))
          });
        }
      });
    });

    Object.defineProperty(this, 'xml', {
      value: xml,
      writable: false,
      enumerable: true,
    });
    this.and = (that) => andCombinator(this, that);
    this.in = (that) => inCombinator(this, that);
    this.kill = () => null;
  }
}

class TextUselet {
  constructor (str) {
    Object.defineProperty(this, 'xml', {
      value: [ document.createTextNode(str) ],
      writable: false,
      enumerable: true,
    })
    this.and = (that) => andCombinator(this, that);
    this.in = (that) => inCombinator(this, that);
    this.kill = () => null;
  }
}

class UseletApp {
  constructor (child, parent) {
    child.xml.forEach(x => (parent || document.body).appendChild((x)));
  }
}

class RouterOutlet extends Uselet {
  constructor (patterns) {
    super(
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
            const cont = patterns[i].content;
            if (typeof cont === 'function') {
              return cont(path.slice(1).match(patterns[i].path));
            } else {
              return cont;
            }
          }
        }
        throw new Error('Not path match found for ' + path);
      },
    );

    window.addEventListener('popstate', (e) => {
      this.receive({ type: 'NAVIGATE', data: { url: location.pathname } });
    })
  }
}
