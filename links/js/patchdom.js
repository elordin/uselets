/**
 * Patches a DOM node to look like a target state
 *
 * @param {Node} domNode
 * @param {XmlRepresentation} targetState
 */
function _patchDomManual (domNode, targetState) {
  function resolveDomDiff (source, target) {
    const type = target.type;
    switch (type) {
      case 'TEXT':
        const text = target.text;
        if (source instanceof Text) {
          if (source.textContent !== text) {
            source.textContent = text;
          }
        } else {
          const node = document.createTextNode(text);
          source.replaceWith(node);
        }
        break;
      case 'ELEMENT':
        const tagName = target.tagName;
        const attributes = target.attrs;
        const children = target.children;
        if (_isElementNode(source) && (tagName.toLowerCase() === source.tagName.toLowerCase())) {

          // Detach old event handlers
          const oldKey = source.getAttribute('key');
          const oldHandlers = _eventHandlers[oldKey];

          if (oldHandlers) {
            Object.keys(oldHandlers || { }).forEach(function (e) {
              DEBUG.debug('Removing', e);
              source.removeEventListener(e, oldHandlers[e]);
            });

            // Manual cleanup to remove unused event-handler functions
            //   One might double check with ```if (!document.querySelector(`[key="${oldKey}"]`))```
            // after updating the node, but DOM access is slow =/
            delete _eventHandlers[oldKey];
          }

          // Update attributes
          Object.keys(attributes).forEach(function (k) {
            const curr = source.getAttribute(k);
            const val = attributes[k];
            if (curr !== val) {
              source.setAttribute(k, val);
            }
          });

          // Update child nodes
          const stepCount = Math.max(source.childNodes.length, children.length);

          for (let i = 0; i < stepCount; i++) {
            if (source.childNodes[i] && children[i]) {
              resolveDomDiff(source.childNodes[i], children[i]);
            } else if (source.childNodes[i] && !children[i]) {
              source.removeChild(source.childNodes[i]);
            } else if (children[i] && !source.childNodes[i]) {
              source.appendChild(LINKS.singleXmlToDomNodes(children[i]));
            }
          }

          // Attach event-handlers
          const key = source.getAttribute('key');
          if (key) {
            const handlers = _eventHandlers[key];
            Object.keys(handlers || { }).forEach(function (e) {
              DEBUG.debug('Attaching', e, source);
              source.addEventListener(e, function (event) {
                event.preventDefault();
                event.stopPropagation();
                handlers[e]();
              }, false);
            });
          }

        } else {
          const node = document.createElement(tagName);
          Object.keys(attributes).forEach(function (k) {
            node.setAttribute(k, attributes[k]);
          });
          children.forEach(function (c) { node.appendChild(LINKS.singleXmlToDomNodes(c)); });
          LINKS.activateHandlers(node);
          source.replaceWith(node);
        }
        break;
      default:
        source.parentElement.removeChild(source);
    }
  }

  resolveDomDiff(domNode, targetState);
}

const patchDomManual = LINKS.kify(_patchDomManual);

function _patchDomIncremental (domNode, targetState) {
  IncrementalDOM.notifications.nodesCreated = function (nodes) {
    console.log('Attaching to ', nodes);
    nodes.forEach(function (node) { LINKS.activateHandlers(node) });
  };

  function render (xml) {
    switch (xml.type) {
      case 'ELEMENT':
        IncrementalDOM.elementOpen(
          xml.tagName,
          xml.attrs['key'] || null,
          [].concat(...Object.keys(xml.attrs).map(function (k) { return [ k, xml.attrs[k] ]; }))
        );
        (xml.children || [ ]).forEach(function (c) { render(c) });
        IncrementalDOM.elementClose(xml.tagName);
        break;
      case 'TEXT':
        IncrementalDOM.text(xml.text || '');
        break;
      default:
        throw new Error('Unknown node type in xml');
    }
  }

  IncrementalDOM.patch(domNode, () => render(targetState));
}

const patchDomIncremental = LINKS.kify(_patchDomIncremental);

const _patchDom = _patchDomIncremental;
const patchDom = patchDomIncremental;

/**
 * Asynchronously executions an action
 *
 * @param {() => void} action
 * @returns {void}
 */
function _async (action) {
  if (typeof action !== 'function') {
    throw new Error(`async expects function, ${action}: ${typeof action} given`);
  }
  setTimeout(action, 0);
}

const async = LINKS.kify(_async);
