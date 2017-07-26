type UMessage = { type: string, data?: any };

const USELET_MESSAGE_TYPE = 'uselet';

abstract class IUselet<Model> {

  public abstract xml: Node[];

  /* Composition operations */
  public and<M> (that: IUselet<M>): IUselet<[Model, M]> {
    return this.andCombinator(this, that);
  }

  public in (that: Element): IUselet<Model> {
    return this.inCombinator(this, that);
  }


  private inCombinator (u: IUselet<any>, node: Element): IUselet<any> {
    const ret = {
      and: (that: IUselet<any>) => this.andCombinator(ret, that),
      in: (that: Element) => this.inCombinator(ret, that),
    };
    u.xml.forEach(x => node.appendChild(x));
    Object.defineProperty(ret, 'xml', {
      get: () => [ node ],
      enumerable: true,
    });
    return <IUselet<Model>> ret;
  }

  private andCombinator (u1: IUselet<any>, u2: IUselet<any>): IUselet<any> {
    if (!u2) {
      return u1;
    }

    const ret = {
      and: (other: IUselet<any>) => this.andCombinator(ret, other),
      in: (other: Element) => this.inCombinator(ret, other),
    };

    Object.defineProperty(ret, 'xml', {
      get: () => u1.xml.concat(u2.xml),
      enumerable: true,
    });
    return <IUselet<Model>> ret;
  }

}

/* Extend this class to define your own Uselets */
class Uselet<Model> extends IUselet<Model>  {

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
    private view: (mod: Model) => IUselet<any>,
  ) {
    super();

    this.root = document.createElement(name);
    Object.defineProperty(this.root, 'uselet', {
      get: () => this,
      enumerable: true,
    });

    let child = view(model);
    child.xml.forEach(x => this.root.appendChild(x));

    window.addEventListener(USELET_MESSAGE_TYPE, (e: CustomEvent) => {
      this.receive(e.detail);
    });

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
class TextUselet extends IUselet<any>  {

  constructor (private str: string) {
    super();
  }

  public get xml () {
    return [ document.createTextNode(this.str) ];
  }

}

/** Static XML/HTML */
class XmlUselet extends IUselet<any>  {

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
    child: IUselet<any>,
    parent?: Node,
  ) {
    child.xml.forEach(x => (parent || document.body).appendChild((x)));
  }

}

class UseletMessage extends CustomEvent {
  constructor (type: string, data?: any) {
    super(USELET_MESSAGE_TYPE, { detail: { type: type, data: data || null } });
  }
}

class RouterOutlet extends Uselet<string> {

  constructor (patterns: { path: RegExp, content: Uselet<any> | (() => Uselet<any>) }[]) {
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
    });
  }

}

Object.defineProperty(Node.prototype, 'addMessageEmitter', {
  value: function (eventType: string, messageType: string, data: any) {
    this.addEventListener(
      eventType,
      (e: Event) => window.dispatchEvent(new UseletMessage(messageType, data)),
    );
  },
  writable: false,
});
