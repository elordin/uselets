const USELET_MESSAGE_TYPE = 'uselet';

Object.defineProperty(Promise, 'of', {
  value: (val) => new Promise((resolve) => setTimeout(() => resolve(val), 200)),
  writable: false,
});

const AddrSource = new (function Source (prefix) {
  prefix = (prefix || '') + '/';

  let seed = 0;

  this.fresh = function () {
    return prefix + seed++;
  }

  this.childSource = (addr) => {
    return new Source(addr);
  }

  return this;
})();

function isChildAddrOf (child, parent) {
  return parent.length < child.length && child.startsWith(parent);
}

const Dispatcher = new (function () {
  let clients = { };

  Object.defineProperty(this, 'clients', {
    get: () => clients,
  });

  this.register = (addr, client) => {
    if (window.DEBUGGING) {
      window.dispatchEvent(new CustomEvent(USELET_REGISTERED_EVENT));
    }

    if (clients[addr]) {
      console.warn('Re-registering', addr);
    }
    clients[addr] = client;
  };

  this.deregisterChildren = (addr) => {
    Object.keys(clients).forEach(k => {
      if (isChildAddrOf(k, addr)) {
        delete clients[k];
      }
    })
  };

  function send (where, what) {
    setTimeout(() => where.send(what), 0);
  }

  this.broadcast = (msg) => {
    if (window.DEBUGGING) {
      console.info('BC %c%s', 'background-color: #00CC6A; color: #333; padding: .1rem', msg.type, msg);
      window.dispatchEvent(new CustomEvent(USELET_BROADCAST_EVENT, { detail: { message: msg } }));
    }


    Object.keys(clients).forEach(addr => send(clients[addr], msg));
  }

  this.send = (addr, msg) => {
    if (window.DEBUGGING) {
      console.info('DS %c%s > %s', 'background-color: #00B7C3; color: #333; padding: .1rem', msg.type, addr, msg);
      window.dispatchEvent(new CustomEvent(USELET_SEND_EVENT, { detail: { message: msg } }));
    }

    if (!clients[addr]) {
      console.warn('Unknown client', addr);
    } else {
      send(clients[addr], msg);
    }
  }
})();

function patch (children) {
  Array.prototype.forEach.call(children, (child) => {
    if (child instanceof Text) {
      IncrementalDOM.text(child.wholeText);
    } else if (child instanceof Element) {
      IncrementalDOM.elementOpen(
        child.tagName.toLowerCase(),
        child.getAttribute('key') || null,
        ...[].concat(Object.keys(child.attributes).map(k => [ child.attributes[k].name, child.attributes[k].value ])),
        // ...[].concat(Object.keys(children.attrs).map(name => [ name, children.attrs[name] ]))
      );
      patch(child.childNodes);
      IncrementalDOM.elementClose(child.tagName.toLowerCase());
    }
  });
}

function Uselet (name, model, update, view) {

  // if (!customElements.get(name)) {
  //   class AnonUselet extends HTMLElement {
  //     constructor () {
  //       super();
  //       const self = this;
  //       let currentModel = model;

  //       //TODO implement HTMLElement interface

  //       Object.defineProperty(this, 'addr', {
  //         value: AddrSource.fresh(),
  //         writable: false,
  //       });

  //       function patchDOM (newModel) {
  //         const childSource = AddrSource.childSource(self.addr);

  //         Dispatcher.deregisterChildren(self.addr);

  //         self.innerHTML = '';
  //         view(newModel)(childSource, null).xml.forEach(c => self.appendChild(c));

  //         // IncrementalDOM.patch(elem, () => patch(view(newModel)(childSource, Dispatcher, ctx).xml));
  //       }

  //       Object.defineProperty(this, 'send', {
  //         value: (msg) => {
  //           const newModel = update(currentModel, msg);
  //           if (currentModel !== newModel) {
  //             // console.info('TODO: Patch DOM in customelemnt');
  //             patchDOM(newModel);
  //           }
  //           currentModel = newModel;
  //         },
  //         writable: false,
  //       });

  //       if (window.DEBUGGING) {
  //         Object.defineProperty(this, 'model', {
  //           get: () => currentModel,
  //           set: (model) => {
  //             currentModel = model;
  //             patchDOM(model);
  //           }
  //         });
  //       }

  //       // this.setAttribute('id', this.addr);

  //       // TODO context

  //       const childSource = AddrSource.childSource(this.addr);

  //       // view(currentModel)(childSource, null).xml
  //       //   .forEach(c => this.appendChild(c));

  //       Dispatcher.register(this.addr, this);
  //     }

  //     connectedCallback () {

  //     }
  //   }

  //   customElements.define(name, AnonUselet);
  // }

  // @TODO customelements
  const self = this;

  const fn = function (addrSource, ctx) {
    const elem = document.createElement(name);
    const addr = addrSource.fresh();

    if (!fn.hasOwnProperty('addr')) {
      Object.defineProperty(fn, 'addr', {
        value: addr,
        writable: false,
        enumerable: true,
      });
    }

    Object.defineProperty(self, 'elem', {
      value: elem,
      writable: false,
      enumerable: true,
    });

    Object.defineProperty(elem, 'uselet', {
      value: self,
      writable: false,
      enumerable: true,
    });

    Object.defineProperty(fn, 'context', {
      value: ctx,
      writable: false,
      enumerable: true,
    });

    elem.setAttribute('id', addr);

    Dispatcher.register(addr, elem);
    let currentModel = model;

    function patchDOM (newModel) {
      const childSource = addrSource.childSource(addr);

      Dispatcher.deregisterChildren(addr);

      elem.innerHTML = '';
      view(newModel)(childSource, ctx).xml.forEach(c => elem.appendChild(c));

      // IncrementalDOM.patch(elem, () => patch(view(newModel)(childSource, Dispatcher, ctx).xml));
    }

    if (window.DEBUGGING) {
      Object.defineProperty(elem, 'model', {
        get: () => currentModel,
        set: (model) => {
          currentModel = model;
          patchDOM(model);
        }
      });
    }

    Object.defineProperty(elem, 'send', {
      value: (msg) => {
        const newModel = update(currentModel, msg);
        if (currentModel !== newModel) {
          patchDOM(newModel);
        }
        currentModel = newModel;
      },
      writable: false,
    });

    const childSource = addrSource.childSource(addr);
    view(currentModel)(childSource, ctx).xml
      .forEach(c => elem.appendChild(c));

    fn.xml = [ elem ]

    return {
      xml: [ elem ],
    };
  }

  return fn;

}

function TextUselet (str) {
  return (as, ctx) => {
    return {
      xml: [ document.createTextNode(str) ],
    };
  };
}

const EmptyUselet = (as, ctx) => ({ xml: [ ] });

function XmlUselet (xml, attributes) {
  if (typeof xml === 'string') {
    const tmp = document.createElement('div');
    tmp.innerHTML = xml;
    xml = tmp.childNodes[0]; // Array.prototype.map.call(tmp.childNodes, (a) => a);
  }

  if (attributes && xml instanceof Element) {
    Object.keys(attributes).forEach(name => {
      const val = attributes[name];
      if (typeof val === 'function') {
        xml.addEventListener(name, val);
      } else if (typeof val === 'object' && val.hasOwnProperty('msg')) {
        if (val.hasOwnProperty('to')) {
          xml.addEventListener(name, (e) => Dispatcher.send(val.to, val.msg));
        } else {
          xml.addEventListener(name, (e) => Dispatcher.broadcast(val.msg));
        }
      } else if (name === 'value') {
        xml.value = val;
      } else if (xml.hasOwnProperty(name)) {
        xml.setProperty(name, val);
      } else {
        xml.setAttribute(name, val);
      }
    });
  }

  return (as, ctx) => {
    const ret = {
      xml: [ xml ],
    };
    return ret;
  };
}

function asSiblings (...other) {
  return (addrSource, ctx) => {
    return { xml: other
      .map(u => {
        return u(addrSource, ctx).xml;
      })
      .reduce((a, b) => a.concat(b), [ ])
    };
  };
}

function childOf (node, u) {
  return (addrSource, ctx) => {
    u(addrSource, ctx).xml.forEach(x => node.appendChild(x));
    return { xml: [ node ] };
  };
}

class UseletApp {
  constructor (uselet, parent, context) {
    parent = parent || document.body;
    uselet(AddrSource, context).xml.forEach(x => parent.appendChild(x));
  }
}
