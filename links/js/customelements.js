function _defineCustomElement (name, connectedCallback, disconnectedCallback) {
  if (!customElements.get(name)) {
    class Anon extends HTMLElement {
      constructor () {
        super();
        console.info('Created Custom Element:', name);
        // const shadow = this.attachShadow({ mode: 'open' });
        this.name = name;
        if (connectedCallback) {
          this.connectedCallback = () => {
            console.info(name, 'ConnectedCallback');
            connectedCallback(this);
          };
        }

        if (connectedCallback) {
          this.disconnectedCallback = () => {
            console.info(name, 'ConnectedCallback');
            disconnectedCallback(this);
          };
        }
      }
    }

    customElements.define(name, Anon);
  }
}

const defineCustomElement = LINKS.kify(_defineCustomElement);

function _historyPushState (state, title, url) {
  return history.pushState(state, title, url);
}

const historyPushState = LINKS.kify(_historyPushState);
