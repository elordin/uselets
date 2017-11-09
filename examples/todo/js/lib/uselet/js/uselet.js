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


    Object.keys(clients).forEach(addr => {
      const client = clients[addr];

      if (client.accepts(msg)) {
        send(clients[addr], msg);
      }
    });
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

const SEND = 0x01;
const RECEIVE = 0x02;
const CHOICE = 0x04;

class Token { }
class LeftParenthesisToken extends Token { constructor () { super(); this.type = 'LPAR'; } }
class RightParenthesisToken extends Token { constructor () { super(); this.type = 'RPAR'; }}
class SequenceToken extends Token { constructor () { super(); this.type = 'SEQ'; }}
class ChoiceToken extends Token { constructor () { super(); this.type = 'CHOICE'; } }
class SendToken extends Token {
  constructor (name) {
    super();
    if (!/^[A-Za-z_]+$/.test(name)) {
      throw new Error('Invalid message type format. Must be [A-Za-z_]');
    }
    this.type = 'SEND';
    this.name = name;
  }
}
class ReceiveToken extends Token {
  constructor (name) {
    super();
    if (!/^[A-Za-z_]+$/.test(name)) {
      throw new Error('Invalid message type format. Must be [A-Za-z_]. In ' + name);
    }
    this.type = 'RECEIVE';
    this.name = name;
  }
}

function lexST (st) {
  function helper (str) {
    if (str[0] === '(') {
      return [ new LeftParenthesisToken(), str.slice(1) ];
    }
    if (str[0] === ')') {
      return [ new RightParenthesisToken(), str.slice(1) ];
    }
    if (str[0] === '.') {
      return [ new SequenceToken, str.slice(1) ];
    }
    if (str[0] === '|') {
      return [ new ChoiceToken(), str.slice(1) ];
    }
    if (str[0] === '?') {
      const name = str.slice(1).match(/^[A-Za-z_]+/)[0];
      return [ new SendToken(name), str.slice(name.length + 1) ];
    }
    if (str[0] === '!') {
      const name = str.slice(1).match(/^[A-Za-z_]+/)[0];
      return [ new ReceiveToken(name), str.slice(name.length + 1) ];
    }
    throw new Error('Parse Error: Cannot parse Session Type ' + st);
  }

  const ret = [ ];
  while (st.length > 0) {
    const [ token, tail ] = helper(st);
    st = tail;
    ret.push(token)
  }
  return ret;
}

function parseST (st) {
  const tokens = lexST(st).reverse();

  function parseParenthesized (toks) {

  }

  const type = [ ];
  while (tokens.length) {
    const tok = tokens.pop();
    if (tok instanceof ReceiveToken) {
      type.push(new ReceiveST(tok.name));
    } else if (tok instanceof SendToken) {
      type.push(new SendST(tok.name));
    } else {

    }
  }
  return type;
}

class ReceiveST {
  constructor (name) {
    this.value = name;
    this.type = RECEIVE;
  }
}

class SendST {
  constructor (name) {
    this.value = name;
    this.type = SEND;
  }
}

console.info(parseST('!C|(?B.!D).(?A.(!B|!C))'))

// Choice
//   Send C
//   Seq
//     Receive B
//     Send D
//     Receive A
//     Choice
//       Send B
//       Send C


function parseSessionType (str) {
  if (str[0] === '(') {

  } else {
    const elems = str.split('.');
    if (elems.length === 1) {
      const elem = elems[0];
      const choices = elem.split('|');
      if (choices.length === 1) {
        const choice = choices[0];
        if (choice[0] === '?') {
          return [ { type: RECEIVE, value: choice.slice(1) } ];
        } else if (choice[0] === '!') {
          return [ { type: SEND, value: choice.slice(1) } ];
        } else {
          throw new Error('Type Error: Invalid session type: ' + str);
        }
      } else {
        return [ { type: CHOICE, choices: choices.map((c) => new SessionType(c, false)) } ];
      }
    } else {
      return [].concat(...elems.map(parseSessionType));
    }
  }
}

function SessionType (str, repeating) {
  const originalType = parseSessionType(str);

  let currType = originalType;

  function nextType () {
    if (!currType.length && repeating) {
      return originalType[0];
    } else {
      return currType[0] || null;
    }
  }

  this.canSend = (msg) => {
    if (!nextType()) {
      return false;
    } else if (nextType().type === SEND) {
      return nextType().value === msg.type;
    } else if (nextType().type === RECEIVE) {
      return false;
    } else if (nextType().type === CHOICE) {
      return nextType().choices.some(choice => choice.canSend(msg))
    }
  };

  this.canReceive = (msg) => {
    if (!nextType()) {
      return false;
    } else if (nextType().type === SEND) {
      return false;
    } else if (nextType().type === RECEIVE) {
      return nextType().value === msg.type;
    } else if (nextType().type === CHOICE) {
      return nextType().choices.some(choice => choice.canReceive(msg))
    }
  };

  this.toString = () => {
    const tail = repeating ? originalType.slice(0, originalType.length - currType.length) : [];
    const full = currType.concat(tail);
    return full.map((t) => {
      if (t.type === SEND) {
        return `!${t.value}`;
      } else if (t.type === RECEIVE) {
        return `?${t.value}`;
      } else if (t.type === CHOICE) {
        return '(' + t.choices.map(c => c.toString()).join('|') + ')';
      }
    }).join('.');
  };

  this.pop = () => {
    if (!currType.length && repeating) {
      currType = originalType;
    }
    currType = currType.slice(1);
  }
}

function Uselet (name, model, update, view, sessionType) {
  function checkSessionType (msg, sending) {
    if (DEBUGGING) {
      console.group('Checking session type');
      console.info(sending ? 'Sending' : 'Receiving', 'message', msg);
      sending && console.info('Session can send', sessionType.canSend(msg));
      !sending && console.info('Session can receive', sessionType.canReceive(msg));
      console.info('Session expects', sessionType.toString());
      console.groupEnd();
    }

    if (sending) {
      if (!sessionType.canSend(msg)) {
        throw new Error('Type Error: Session type mismatch. Cannot send ' + msg.type);
      }
    } else {
      if (!sessionType.canReceive(msg)) {
        throw new Error('Type Error: Session type mismatch. Cannot receive ' + msg.type);
      }
    }

    sessionType.pop();
  }

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

    Object.defineProperty(self, 'addr', {
      value: addr,
      writable: false,
      enumerable: true,
    });

    Object.defineProperty(fn, 'context', {
      value: ctx,
      writable: false,
      enumerable: true,
    });

    Object.defineProperty(fn, 'sendToSelf', {
      value: (addr, msg) => {
        if (sessionType) {
          checkSessionType(msg, true);
        }
        Dispatcher.send(this.addr, msg);
      },
      writable: false,
      enumerable: true,
    });

    Object.defineProperty(fn, 'sendTo', {
      value: (addr, msg) => {
        if (sessionType) {
          checkSessionType(msg, true);
        }
        Dispatcher.send(addr, msg);
      },
      writable: false,
      enumerable: true,
    });

    Object.defineProperty(fn, 'broadcast', {
      value: (msg) => {
        if (sessionType) {
          checkSessionType(msg, true);
        }
        Dispatcher.broadcast(msg);
      },
      writable: false,
      enumerable: true,
    });

    function receive (msg, action) {
      if (sessionType) {
        checkSessionType(msg, false);
      }
      action(msg);
    }

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
      value: (msg) => receive(msg, (msg) =>  {
        const newModel = update(currentModel, msg);
        if (currentModel !== newModel) {
          patchDOM(newModel);
        }
        currentModel = newModel;
      }),
      writable: false,
    });

    Object.defineProperty(elem, 'accepts', {
      value: (msg) => {
        if (!sessionType) {
          return true;
        } else {
          return sessionType.canReceive(msg);
        }
      },
      writable: false,
    });



    const childSource = addrSource.childSource(addr);
    view(currentModel)(childSource, ctx).xml
      .forEach(c => elem.appendChild(c));

    fn.xml = [ elem ];

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
  if (typeof node === 'string') {
    node = document.createElement(node);
  }

  if (node instanceof Element) {
    return (addrSource, ctx) => {
      u(addrSource, ctx).xml.forEach(x => node.appendChild(x));
      return { xml: [ node ] };
    };
  } else {
    throw new Error('Invalid argument passed to childOf.');
  }
}

class UseletApp {
  constructor (uselet, parent, context) {
    parent = parent || document.body;
    uselet(AddrSource, context).xml.forEach(x => parent.appendChild(x));
  }
}
