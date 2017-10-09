class ListUselet extends Uselet {
  constructor (items, options) {
    const itemView = (options && options.itemView) || ((i) => TextUselet(i));
    const ulClass = (options && options.class) || null;
    const liClass = (options && options.itemClass) || null;

    super(
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
        if (ulClass) {
          if (Array.isArray(ulClass)) {
            ulClass.forEach(c => ul.classList.add(c));
          } else {
            ul.classList.add(ulClass);
          }
        }

        return mod.length ?
          childOf(
            ul,
            mod
              .map(i => {
                const li = document.createElement('li');
                if (liClass) {
                  if (Array.isArray(liClass)) {
                    liClass.forEach(c => li.classList.add(c));
                  } else {
                    li.classList.add(liClass);
                  }
                }

                return childOf(li, itemView(i));
              })
              .reduce((a, b) => asSiblings(a, b), EmptyUselet)
          ) :
          new XmlUselet('<div class="warn">No items</div>');
      },
    );
  }
}

class DraggableListUselet extends Uselet {
  constructor (items, options) {
    const itemView = (options && options.itemView) || ((i) => TextUselet(i));
    const ulClass = (options && options.class) || null;
    const liClass = (options && options.itemClass) || null;

    super(
      'draggable-list',
      items,
      (mod, msg) => {
        switch (msg.type) {
          case 'SWAP':
            const source = mod[msg.data[0]];
            const target = mod[msg.data[1]];
            return mod.map((item, i) => (i === msg.data[1]) ? source : (i === msg.data[0]) ? target : item);
          default:
            return mod;
        }
      },
      (mod) => {
        const ul = document.createElement('ul');
        if (ulClass) {
          if (Array.isArray(ulClass)) {
            ulClass.forEach(c => ul.classList.add(c));
          } else {
            ul.classList.add(ulClass);
          }
        }


        return mod.length ?
          childOf(
            ul,
            asSiblings(...mod.map((item, index) => {
              const li = document.createElement('li');
              if (liClass) {
                if (Array.isArray(liClass)) {
                  liClass.forEach(c => li.classList.add(c));
                } else {
                  li.classList.add(liClass);
                }
              }
              li.draggable = true;

              li.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('self', index);
                li.classList.add('drag-target');
              });
              li.addEventListener('dragenter', (e) => {
                e.preventDefault();
              });
              li.addEventListener('dragover', (e) => {
                e.preventDefault();
              });
              li.addEventListener('dragstop', (e) => {
                e.preventDefault();
                li.classList.remove('drag-target');
              });
              li.addEventListener('drop', (e) => {
                e.preventDefault();
                if (e.dataTransfer.getData('self')) {
                  Dispatcher.send(this.addr, { type: 'SWAP', data: [ index, parseInt(e.dataTransfer.getData('self')) ] });
                }
              });
              return childOf(li, itemView(item));
            }))
          ) :
          new XmlUselet('<div class="warn">No items</div>');
      }
    );
  }
}

class RouterOutlet extends Uselet {
  constructor (patterns, options) {
    window.addEventListener('popstate', (e) => {
      Dispatcher.broadcast({
        type: 'NAVIGATE',
        data: {
          url: (options && options.useHash) ? location.hash.slice(1) : location.pathname,
        },
      });
    });

    super(
      'router-outlet',
      (options && options.useHash) ? location.hash.slice(1) : location.pathname,
      (model, msg) => {
        switch (msg.type) {
          case 'NAVIGATE':
            history.pushState({ }, '', `${(options && options.useHash) ? '#' : ''}${msg.data.url}`);
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
}

class LazyLoadUselet extends Uselet {
  constructor (promise, options) {
    const dataView = (options && options.view) || ((data) => new TextUselet(JSON.stringify(data)));
    const errorView = (options && options.errorView) || ((err) => new TextUselet(err));
    const loadingView = (options && options.loadingView) || new TextUselet('Loading');

    super(
      'lazy-loader',
      { loading: true, error: null, data: null },
      (mod, msg) => {
        switch (msg.type) {
          case 'LAZYLOAD_SUCCESS':
            return { loading: false, error: null, data: msg.data };
          case 'LAZYLOAD_FAIL':
            return { loading: false, error: msg.data.error, data: null };
          default:
            return mod;
        }
      },
      (mod) => {
        if (mod.loading) {
          return loadingView;
        } else if (mod.error) {
          return errorView(mod.error);
        } else {
          return dataView(mod.data);
        }
      }
    )


    // FIXME This is ugly!
    if (!window.DEBUGGING || !window.debugger.stopAsync[this.addr]) {
      if (window.DEBUGGING) {
        window.debugger.stopAsync[this.addr] = true;
      }

      promise
        .then(data => Dispatcher.send(this.addr, { type: 'LAZYLOAD_SUCCESS', data: data }))
        .catch(err => Dispatcher.send(this.addr, { type: 'LAZYLOAD_FAIL', data: { error: err } }));
    }
  }
}

class BoardOverviewUselet extends ListUselet {
  constructor () {
    const boards = Object.keys(BOARDS).map(k => BOARDS[k]);

    super(boards, {
      itemView: (board) => new XmlUselet(`<a>${board.name}</a>`, {
        click: { msg: { type: 'NAVIGATE', data: { url: `/boards/${board.id}` } } },
      }),
      class: 'board-overview',
    });
  }
}

class BoardUselet extends LazyLoadUselet {
  constructor (boardId) {
    super(Promise.of(BOARDS[boardId]), {
      view: (board) => asSiblings(
        new XmlUselet(`<h1>${board.name}</h1>`),
        new Uselet(
          'kanban-board',
          board,
          (mod, msg) => mod,
          (mod) => new ListUselet(mod.columns, {
            itemView: (col) => new ColumnUselet(col)
          }),
        ),
      ),
    });
  }
}

class ColumnUselet extends Uselet {
  constructor (col) {
    super(
      'kanban-board-column',
      col,
      (mod, msg) => mod,
      (mod) => {
        const modal = new ModalUselet(new FormUselet({
          fields: [
            {
              name: 'head',
              label: 'Head',
              type: 'text',
              value: 'Head here',
              attributes: { class: 'my-input-class' },
              validators: [ ],
            },
          ],
        }));
        return asSiblings(
          new XmlUselet(`<h3 class="col-title">${col.title}</h3>`),
          new DraggableListUselet(
            mod.cards,
            {
              itemView: (card) => new InPlaceEditUselet(card, {
                view: (card) => asSiblings(
                  new XmlUselet(`<span class="card-head">${card.head || ''}</span>`),
                  new XmlUselet(`<span class="card-body">${card.body || ''}</span>`)
                )
              }),
              class: 'card-wrapper',
              itemClass: 'kanban-card',
            }
          ),
          modal,
          new XmlUselet('<button class="ghost-btn">+</button>', {
            click: { to: modal.addr, msg: { type: 'OPEN' } },
          })
        );
      }
    );
  }
}

class InPlaceEditUselet extends Uselet {
  constructor (obj, options) {
    const displayView = (options && options.view) || ((any) => new TextUselet(any));
    const onChangeCallback = options.onChange || null;
    const onCommitCallback = options.onCommit || null;

    super(
      'in-place-edit',
      { edit: false, data: obj },
      (mod, msg) => {
        switch (msg.type) {
          case 'TOGGLE_EDIT':
            if (mod.edit && onCommitCallback) {
              onCommitCallback(mod.data);
            }
            return { edit: !mod.edit, data: mod.data };
          case 'VALUE_CHANGED':
            // Clumsy but necessary since objects equality is reference equality
            const copy = JSON.parse(JSON.stringify(mod.data));
            copy[msg.data.field] = msg.data.value;
            if (onChangeCallback) {
              onChangeCallback(copy, mod.data);
            }
            return { edit: mod.edit, data: copy };
          default:
            return mod;
        }
      },
      (mod) => {
        const toggleButton = document.createElement('button');
        toggleButton.addEventListener('click', (e) => {
          Dispatcher.send(this.addr, { type: 'TOGGLE_EDIT' });
        });
        toggleButton.innerText = mod.edit ? 'Finish' : 'Edit';

        return asSiblings(
          mod.edit ? childOf(
            document.createElement('form'),
            asSiblings(...Object.keys(mod.data).map(name =>
              childOf(document.createElement('label'),
                asSiblings(
                  new TextUselet(name),
                  new XmlUselet(document.createElement('input'), {
                    value: mod.data[name],
                    blur: (e) => Dispatcher.send(this.addr, {
                      type: 'VALUE_CHANGED',
                      data: {
                        field: name,
                        value: e.target.value,
                      }
                    }),
                  })
                ),
              )
            ))
          ) : displayView(mod.data),
          new XmlUselet(toggleButton),
        );
      },
    );
  }
}

class ModalUselet extends Uselet {
  constructor (content, startOpen) {
    super(
      'x-modal',
      { open: Boolean(startOpen) },
      (mod, msg) => {
        switch (msg.type) {
          case 'OPEN':
            return { open: true };
          case 'CLOSE':
            return { open: false };
          case 'TOGGLE':
            return { open: !mod.open };
          default:
            return mod;
        }
      },
      (mod) => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('modal-wrapper');

        const overlay = document.createElement('overlay');
        overlay.classList.add('modal-overlay');

        return mod.open ? asSiblings(
          new XmlUselet(overlay),
          childOf(wrapper, content),
          new XmlUselet(`<button class="modal-close-button">Close</button>`, {
            click: { to: this.addr, msg: { type: 'CLOSE' } },
          }),
        ) : EmptyUselet;
      }
    );
  }
}

class CrossDragBoard extends Uselet {
  constructor (board) {
    super(
      'kanban-board',
      board,
      (mod, msg) => {
        let copy;
        switch (msg.type) {
          case 'MOVE':
            copy = JSON.parse(JSON.stringify(mod));
            const card = copy.columns[msg.data.from.columnIndex].cards[msg.data.from.cardIndex];
            copy.columns[msg.data.from.columnIndex].cards.splice(msg.data.from.cardIndex, 1);
            copy.columns[msg.data.to.columnIndex].cards.splice(msg.data.to.cardIndex, 0, card);
            return copy;
          case 'UPDATE_CARD':
            copy = JSON.parse(JSON.stringify(mod));
            copy.columns[msg.data.columnIndex].cards[msg.data.cardIndex] = msg.data.card;
            return copy;
          case 'NEW_CARD':
            copy = JSON.parse(JSON.stringify(mod));
            copy.columns[msg.data.column].cards.push({ head: msg.data.head, body: msg.data.body });
            return copy;
          default:
            return mod;
        }
      },
      (mod) => asSiblings(
        new XmlUselet(`<h1>${mod.name}</h1>`),
        childOf(document.createElement('ul'), asSiblings(...mod.columns.map((col, colIndex) => {
          const li = document.createElement('li');
          li.classList.add('board-column');
          const cardList = document.createElement('ul');
          cardList.classList.add('card-wrapper');
          cardList.addEventListener('dragover', (e) => e.preventDefault());
          cardList.addEventListener('dragenter', (e) => e.preventDefault());
          cardList.addEventListener('drop', (e) => Dispatcher.send(this.addr, {
            type: 'MOVE',
            data: {
              from: {
                columnIndex: parseInt(e.dataTransfer.getData('column')),
                cardIndex: parseInt(e.dataTransfer.getData('card')),
              },
              to: {
                columnIndex: colIndex,
                cardIndex: col.cards.length,
              }
            }
          }));

          const modal = new ModalUselet(new FormUselet({
            fields: [
              {
                name: 'head',
                label: 'Head',
                type: 'text',
                attributes: {
                  class: 'my-input-class',
                  placeholder: 'Card-header',
                },
                validators: [ ],
              },
              {
                name: 'body',
                label: 'Body',
                type: 'text',
                attributes: {
                  class: 'my-input-class',
                  placeholder: 'Card-body',
                },
              },
              {
                name: 'column',
                type: 'hidden',
                value: colIndex,
              }
            ],
            submit: {
              callback: (val, form) => {
                Dispatcher.send(this.addr, { type: 'NEW_CARD', data: val });
                Dispatcher.send(form.addr, { type: 'RESET' });
                Dispatcher.send(modal.addr, { type: 'CLOSE' });
              },
              caption: 'Create',
            },
          }));

          return asSiblings(
            childOf(li, asSiblings(
              new XmlUselet(`<h3 class="col-title">${col.title}</h3>`),
              childOf(cardList, asSiblings(
                ...col.cards.map((card, cardIndex) => {
                  const li = document.createElement('li');
                  li.classList.add('kanban-card');
                  li.draggable = true;
                  li.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('column', colIndex);
                    e.dataTransfer.setData('card', cardIndex);
                  });
                  li.addEventListener('dragover', (e) => e.preventDefault());
                  li.addEventListener('dragenter', (e) => e.preventDefault());
                  li.addEventListener('drop', (e) => {
                    e.stopPropagation();
                    Dispatcher.send(this.addr, {
                      type: 'MOVE',
                      data: {
                        from: {
                          columnIndex: parseInt(e.dataTransfer.getData('column')),
                          cardIndex: parseInt(e.dataTransfer.getData('card')),
                        },
                        to: {
                          columnIndex: colIndex,
                          cardIndex: cardIndex,
                        }
                      }
                    });
                  });

                  return childOf(li, new InPlaceEditUselet(card, {
                    view: (card) => asSiblings(
                      new XmlUselet(`<span class="card-head">${card.head || ''}</span>`),
                      new XmlUselet(`<span class="card-body">${card.body || ''}</span>`)
                    ),
                    onCommit: (newVal) => {
                      Dispatcher.send(
                        this.addr,
                        {
                          type: 'UPDATE_CARD',
                          data: { columnIndex: colIndex, cardIndex: cardIndex, card: newVal }
                        }
                      );
                    },
                  }));
                }),
                new XmlUselet('<button class="ghost-btn">+</button>', {
                  click: (e) => Dispatcher.send(modal.addr,{ type: 'OPEN' }),
                }),
              )),
            )),
            modal,
          );
        })))
      ),
    )
  }
}

class FormUselet extends Uselet {
  constructor (options) {
    const fields = options.fields;
    const onSubmit = options.submit.callback;

    if (!fields || !Array.isArray(fields)) {
      throw new Error('FormUselet expects an Array in options.fields');
    }

    let form;
    super(
      'x-form',
      fields,
      (mod, msg) => {
        switch (msg.type) {
          case 'RESET':
            return fields;
          case 'SUBMIT':
            let val = { };
            if (!form) {
              throw new Error('Form not found');
            }
            mod.forEach(f => val[f.name] = form.querySelector(`[name="${f.name}"]`).value);
            onSubmit(val, this);
            return mod;
          default:
            return mod;
        }
      },
      (mod) => {
        form = document.createElement('form');
        if (options.class) {
          if (!Array.isArray(options.class)) {
            options.class = [ options.class ];
          }
          options.class.forEach(c => {
            if (typeof c !== 'string') {
              throw new Error('Invalid format for FormUselet.options.class');
            }
            form.classList.add(c);
          });
        }
        form.onsubmit = (e) => {
          e.preventDefault();
          Dispatcher.send(this.addr, { type: 'SUBMIT' })
        };

        return childOf(form, asSiblings(
          ...mod.map(f => {
            const input = document.createElement('input');
            if (f.attributes && typeof f.attributes === 'object') {
              Object.keys(f.attributes).forEach(attr => input.setAttribute(attr, f.attributes[attr]));
            }
            if (f.value !== undefined) {
              input.value = f.value;
            }
            input.type = f.type || 'text';
            input.name = f.name;
            if (f.label) {
              return asSiblings(
                new XmlUselet(`<label for="${input.name}">${f.label}</label>`),
                new XmlUselet(input),
              )
            } else {
              return new XmlUselet(input);
            }
          }),
          new XmlUselet(`<button>${options.submit.caption || 'Submit'}</button>`),
        ));
      },
    );
  }
}