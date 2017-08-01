type UMessage = { type: string, data?: any };

const USELET_MESSAGE_TYPE = 'uselet';

abstract class Component<Model> extends HTMLElement {

  public abstract xml: Node[];

  /* Composition operations */
  public and<M> (that: Component<M>): Component<[Model, M]> {
    return Component.and(this, that);
  }

  public in (that: Element): Component<Model> {
    return Component.in(this, that);
  }


  private static in<M, N> (u: Component<M>, node: Element): Component<M> {
    const ret: Component<M> = <Component<M>> {
      and: function (that: Component<N>): Component<[M, N]> {
        return Component.and(ret, that);
      },
      in: function (that: Element): Component<M> { return Component.in(ret, that); },
    };
    u.xml.forEach(x => node.appendChild(x));
    Object.defineProperty(ret, 'xml', {
      get: () => [ node ],
      enumerable: true,
    });
    return <Component<M>> ret;
  }

  private static and<M, N, O> (u1: Component<M>, u2: Component<N>): Component<[ M, N ]> {
    if (!u2) {
      return u1;
    }

    const ret: Component<[ M, N ]> = <Component<[ M, N ]>> {
      and: function (other: Component<O>): Component<[ [ M, N ], O ]> {
        return Component.and(ret, other);
      },
      in: function (other: Element): Component<[ M, N ]> {
        return Component.in(ret, other);
      },
    };

    Object.defineProperty(ret, 'xml', {
      get: () => u1.xml.concat(u2.xml),
      enumerable: true,
    });
    return <Component<[ M, N ]>> ret;
  }

}

const freshAddress = function () {
  let seed = 0;

  return function (): string {
    return `a${seed++}`;
  };
}();

interface Actor {
  address: string;
  receive: (msg: UMessage) => void;
}

/* Extend this class to define your own Uselets */
class Uselet<Model> extends Component<Model> implements Actor  {

  public address = freshAddress();

  private root: HTMLElement;

  /**
   * @param name   Name of the uselet
   * @param model  (Initial) Internal state
   * @param update Update function. Returns a new
   *               state based on the old and an
   *               incoming message.
   * @param view   Renders the model to what the
   *               Uselet should look like.
   */
  constructor (
    private name: string,
    private model: Model,
    private update: (mod: Model, msg: UMessage) => Model,
    private view: (mod: Model) => Component<any>,
  ) {
    super();

    // if (!customElements.get(name)) {
    //   customElements.define(name, this.constructor);
    // }

    this.root = document.createElement(name);
    Object.defineProperty(this.root, 'uselet', {
      get: () => this,
      enumerable: true,
    });

    let child = view(model);
    child.xml.forEach(x => this.root.appendChild(x));

    this.root.addEventListener(USELET_MESSAGE_TYPE, (e: CustomEvent) => {
      this.receive(e.detail);
    }, true);

  }

  public receive (msg: UMessage) {
    if (!msg.type) {
      throw new Error('Untyped message received');
    }

    const oldModel = JSON.parse(JSON.stringify(this.model));
    this.model = this.update(this.model, msg);

    // if (changed) {
      this.root.innerHTML = '';
      const child = this.view(this.model);
      child.xml.forEach(x => this.root.appendChild(x));

    // }
  }

  public get xml () {
    return [ this.root ];
  }
}

/** Static text */
class TextUselet extends Component<any>  {

  constructor (private str: string) {
    super();
  }

  public get xml () {
    return [ document.createTextNode(this.str) ];
  }

}

/** Static XML/HTML */
class XmlUselet extends Component<any>  {

  private children: Node[];

  constructor (input: Node[] | string) {
    super();
    if (typeof input === 'string') {
      const dummy = document.createElement('div');
      dummy.innerHTML = input;
      this.children = Array.prototype.map.call(dummy.childNodes, (a: any) => a);
    } else {
      this.children = input;
    }


    const ros = Array.prototype.map.call(document.querySelectorAll('router-outlet'), (a: any) => a);
    this.children.forEach(x => {
      if (x instanceof HTMLElement) {
        Array.prototype.forEach.call(
          (<HTMLElement> x).querySelectorAll('[uref]'),
          (node: Element) => {
            const url = node.getAttribute('uref');
            if (url) {
              node.addEventListener('click', (e: MouseEvent) => {
                e.preventDefault();
                ros.forEach(
                  (ro: any) => ro.uselet.receive({ type: 'NAVIGATE', data: { url: url } }),
                );
              });
            }
          },
        );
      }
    });
  }

  public get xml () {
    return this.children;
  }
}

/** Binds the Uselets to the actual DOM */
class UseletApp {

  constructor (
    child: Component<any>,
    parent?: Node,
  ) {
    child.xml.forEach(x => (parent || document.body).appendChild((x)));
  }

}


class ApiService implements Actor {

  public address = 'API';

  private http = new Http();

  constructor () {
    window.addEventListener(USELET_MESSAGE_TYPE, (e: CustomEvent) => {
      this.receive(e.detail);
    });
  }

  public receive (msg: UMessage): void {
    switch (msg.type) {
      case 'GET_SOME':
        this.getSomething()
          .then(something => broadcast('GOT_SOME', something))
          .catch(fail => broadcast('GET_FAILED'));
        break;
      default:
    }
  }

  private getSomething () {
    return this.http.get('http://localhost:8000/');
  }

}

class RouterOutlet extends Uselet<string> {

  constructor (
    patterns: { path: RegExp, content: Uselet<any> | ((...args: string[]) => Uselet<any>) }[],
  ) {
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
              const args = path.slice(1).match(patterns[i].path);
              return args ? cont(...args) : cont();
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
    });
  }

}


function broadcast (messageType: string, data?: any): void {
  window.dispatchEvent(
    new CustomEvent(USELET_MESSAGE_TYPE, { detail: { type: messageType, data: data || null } }),
  );
}


Object.defineProperty(Node.prototype, 'addMessageEmitter', {
  value: function (eventType: string, messageType: string, data?: any) {
    this.addEventListener(
      eventType,
      (e: Event) => broadcast(messageType, data),
    );
  },
  writable: false,
});

window.addEventListener(
  USELET_MESSAGE_TYPE,
  (e: CustomEvent) => console.info('BC', e.detail),
  true,
);
