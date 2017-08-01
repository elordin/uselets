const USELET_MESSAGE_TYPE = 'uselet';

function Component () {
  function inComb (u, node) {
    const ret = {
      and: (that) => andComb(ret, that),
      in: (that) => inComb(ret, that),
    };

    u.xml.forEach(x => node.appendChild(x));
    Object.defineProperty(ret, 'xml', {
      get: () => [ node ],
      enumerable: true,
    });
    return ret;
  }

  function andComb (u1, u2) {
    if (!u2) {
      return u1;
    }

    const ret = {
      and: (other) => andComb(ret, other),
      in: (other) => inComb(ret, other),
    };

    Object.defineProperty(ret, 'xml', {
      get: () => u1.xml.concat(u2.xml),
      enumerable: true,
    });
    return ret;
  }

  this.and = (that) => {
    andComb(this, that);
  }

  this.in = (that) => {
    inCom(this, that)
  }
  return this;
}

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
    if (DEBUGGING) {
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
    if (DEBUGGING) {
      window.dispatchEvent(new CustomEvent(USELET_BROADCAST_EVENT, { detail: { message: msg } }));
    }

    Object.keys(clients).forEach(addr => send(clients[addr], msg));
  }

  this.send = (addr, msg) => {
    if (DEBUGGING) {
      window.dispatchEvent(new CustomEvent(USELET_SEND_EVENT, { detail: { message: msg } }));
    }

    if (!clients[addr]) {
      console.warn('Unknown client', addr);
    } else {
      send(clients[addr], msg);
    }
  }
})();

function Uselet (name, model, update, view) {
  // @TODO customelements

  return function (addrSource, dispatcher, ctx) {
    const elem = document.createElement(name);
    const addr = addrSource.fresh();

    elem.setAttribute('id', addr);

    dispatcher.register(addr, elem);
    let currentModel = model;

    function patchDOM (newModel) {
      const childSource = addrSource.childSource(addr);

      Dispatcher.deregisterChildren(addr);

      elem.innerHTML = '';
      view(newModel)(childSource, dispatcher, ctx).xml
        .forEach(c => elem.appendChild(c));
    }

    if (DEBUGGING) {
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
    view(currentModel)(childSource, dispatcher, ctx).xml
      .forEach(c => elem.appendChild(c));

    this.xml = [ elem ]

    return this;
  }
}

function TextUselet (str) {
  return (as, disp, ctx) => {
    const ret = {
      xml: [ document.createTextNode(str) ],
    };
    return ret;
  }
}

const EmptyUselet = TextUselet('');

function XmlUselet (xml) {
  if (typeof xml === 'string') {
    const tmp = document.createElement('div');
    tmp.innerHTML = xml;
    xml = Array.prototype.map.call(tmp.childNodes, (a) => a);
  }

  return (as, disp, ctx) => {
    const ret = {
      xml: xml,
    };
    return ret;
  }
}

function asSiblings (...other) {
  return (addrSource, dispatcher, ctx) => {
    return { xml: other
      .map(u => {
        return u(addrSource, dispatcher, ctx).xml;
      })
      .reduce((a, b) => a.concat(b), [ ])
    };
  }
}

function childOf (node, u) {
  return (addrSource, dispatcher, ctx) => {
    u(addrSource, dispatcher, ctx).xml.forEach(x => node.appendChild(x));
    return { xml: [ node ] };
  }
}

class UseletApp {
  constructor (uselet, parent) {
    parent = parent || document.body;
    uselet(AddrSource, Dispatcher, null).xml.forEach(x => parent.appendChild(x));
  }
}
