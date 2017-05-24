interface Message {
  type: string;
}

type Address = number;

class AddressSource {
  private static curr: number = 0;
  public static get next (): number {
    return AddressSource.curr++;
  }
}


class Dispatcher {
  private static uselets: Object = { };

  public static register (address, uselet) {
    if (!Dispatcher.uselets[address]) {
      Dispatcher.uselets[address] = uselet;
      console.info(`Registered ${address}`);
    } else {
      throw new Error('Can\'t register. Already registered.');
    }
  }

  public static deregister (address) {
    if (!Dispatcher.uselets[address]) {
      throw new Error('Can\'t deregister. Not registered.');
    } else {
      delete Dispatcher.uselets[address];
    }
  }

  public static send (message, to) {
    if (!Dispatcher.uselets[to]) {
      throw new Error('Unknown recipient');
    } else {
      Dispatcher.uselets[to].messageCallback(message)
    }
  }

  public static broadcast (message) {
    Object.keys(Dispatcher.uselets).forEach((addr) => Dispatcher.uselets[addr].messageCallback(message));
  }
}


class Services {
  public static register (name, service) {
    if (!Services.hasOwnProperty(name)) {
      Object.defineProperty(Services, name, {
        enumerable: true,
        get: () => service
      });
    } else {
      throw new Error(`Service ${name} already registered.`);
    }
  }
}


abstract class Uselet<Model> {

  public element: HTMLElement = null;
  private addr: Address = AddressSource.next
  private id: string = '_render_node_' + this.addr;
  protected shadow: ShadowRoot = null;
  protected name: string;

  constructor (
    protected model: Model,
    protected update: (Model, Message) => Model,
    protected view: (Model) => Node[],
    private css: String,
  ) {
    this.name = 'uselet-' + this.constructor.name;
    try {
      document.registerElement(this.name)
    } catch (err) {
      // Already registered? w/e
    }

    this.element = document.createElement(this.name);
    this.element.setAttribute('id', this.id);

    this.shadow = this.element.attachShadow({ mode: 'open' });

    Dispatcher.register(this.addr, this);
    this.render();
  }

  protected get address (): Address {
    return this.addr;
  }

  protected render () {
    while (this.shadow.firstChild) {
      this.shadow.removeChild(this.shadow.firstChild);
    }

    if (this.css) {
      this.shadow.innerHTML = `<style>${this.css}</style>`;
    }

    const children = this.view(this.model);
    children.forEach((child) => this.shadow.appendChild(child));
  }

  public messageCallback (message) {
    this.model = this.update(this.model, message);
    this.render();
  }
}


class App extends Uselet<void> {
  constructor (
    private children: Uselet<any>[],
  ) {
    super(
      undefined,
      (model, message) => model,
      (model) => children.map(uselet => uselet.element),
      ''
    );
  }
}
