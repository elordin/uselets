class ListUselet extends Uselet {
  constructor (items, itemView) {
    super(
      'x-list',
      items,
      (model, msg) => {
        switch (msg.type) {
          case 'CLEAR':
            return [ ]
          case 'ADD':
            model.push(msg.data);
            return model;
          case 'REVERSE':
            return model.reverse()
          case 'REPLACE':
            return msg.data;
          default:
            return model;
        }
      },
      (items) => {
        const ul = document.createElement('ul');
        ul.classList.add('overview-ul');
        return items.length ?
          items
            .map(i => {
              const li = document.createElement('li');
              li.classList.add('overview-li');
              itemView(i).xml.forEach(x => li.appendChild(x));
              return new XmlUselet([ li ]);
            })
            .reduce(IUselet.and)
            .in(ul) :
          new TextUselet('No items');
      },
    );
  }
}

class FormUselet extends Uselet {
  constructor (data) {
    super(
      'u-form',
      data,
      (model, msg) => {
        switch (msg.type) {
          case 'UPDATE':
            model[msg.data.who] = msg.data.val;
            return model;
          default:
            return model;
        }
      },
      (data) => Object.keys(data)
        .map(k => {
          const val = data[k];
          if (typeof val === 'string') {
            const input = document.createElement('input');
            input.setAttribute('type', 'text');
            input.setAttribute('name', k);
            input.value = val;
            input.addEventListener('change', (e) =>
              this.receive({ type: 'UPDATE', data: { who: k, val: e.target.value }})
            );
            return new XmlUselet([ input ]);
          } else if (typeof val === 'number') {
            const input = document.createElement('input');
            input.setAttribute('type', 'number');
            input.setAttribute('name', k);
            input.value = val;
            input.addEventListener('change', (e) =>
              this.receive({ type: 'UPDATE', data: { who: k, val: parseFloat(e.target.value) }})
            );
            return new XmlUselet([ input ]);
          } else if (typeof val === 'boolean') {
            const input = document.createElement('input');
            input.setAttribute('type', 'checkbox');
            input.setAttribute('name', k);
            if (val) {
              input.setAttribute('checked', '');
            } else if (input.hasAttribute('checked')) {
              input.removeAttribute('checked');
            }
            input.addEventListener('change', (e) =>
              this.receive({ type: 'UPDATE', data: { who: k, val: e.target.checked }})
            );
            return new XmlUselet([ input ]);
          } else if (typeof val === 'object') {
            if (!val.hasOwnProperty('type') || !val.hasOwnProperty('value')) {
              throw new Error('Form data object must have type and value field')
            }
            const input = document.createElement('input');
            input.setAttribute('type', val.type);
            input.setAttribute('name', k);
            input.value = val.value;
            // @TODO
            return new XmlUselet([ input ]);
          } else {
            throw new Error('Unknow type');
          }
        })
        .reduce(IUselet.and),
    );
  }
}

class InPlaceEditUselet extends Uselet {
  constructor (data) {
    super(
      'u-in-place-edit',
      {
        edit: false,
        data: Array.isArray(data) ? data : [ data ]
      },
      (model, msg) => {
        switch (msg.type) {
          case 'TOGGLE_EDIT':
            model.edit = !model.edit;
            return model;
          case 'VALUE_CHANGED':
            return {
              edit: model.edit,
              data: model.data.map(field =>
                field === msg.data.which ?
                { label: field.label, type: field.type, value: msg.data.value, class: field.class } :
                field
              ),
            };
          default:
            return model;
        }
      },
      (model) => {
        const toggleBtn = document.createElement('button');
        toggleBtn.innerText = 'Toggle edit';
        toggleBtn.setAttribute('type', 'button');
        toggleBtn.addEventListener('click', (e) => {
          this.receive({ type: 'TOGGLE_EDIT' });
          broadcast('GET_SOME');
        });

        if (model.edit) {
          return model.data
            .map(field => {
              const input = document.createElement('input');
              input.setAttribute('type', field.type);
              input.value = field.value;
              input.addEventListener('change', (e) => {
                this.receive({ type: 'VALUE_CHANGED', data: { which: field, value: e.target.value } });
              });
              const label = document.createElement('label');
              if (field.label) {
                label.appendChild(document.createTextNode(field.label));
              }

              return (new XmlUselet([ input ])).in(label);
            })
            .reduce((a, b) => a.and(b), new TextUselet(''))
            .and(new XmlUselet([ toggleBtn ]));
        } else {
          return model.data
            .map(field => new XmlUselet(`<span class="${field.class}">${field.value || ''}</span>`))
            .reduce(IUselet.and)
            .and(new XmlUselet([ toggleBtn ]));
        }
      }
    )
  }
}

class BoardUselet extends Uselet {
  constructor (board) {
    super(
      'kanban-board',
      { board: typeof board === 'object' ? board : null },
      (mod, msg) => {
        switch (msg.type) {
          case 'BOARD_LOADED':
            return { board: msg.data };
          default:
            return mod;
        }
      },
      (mod) => mod.board ?
        new XmlUselet(`<h3>${mod.board.title}</h3>`).and(
          mod.board.columns
            .map(col => new ColumnUselet(col))
            .reduce(IUselet.and)
            .in(document.createElement('div'))
        ) :
        new TextUselet('loading...'),
    );

    if (typeof board !== 'object') {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'http://localhost:8000/');
      xhr.onreadystatechange = (e) => {
        if (xhr.readyState === 4 && xhr.status === 200) {
          this.receive({ type: 'BOARD_LOADED', data: {
              title: 'MyBoard',
              id: board,
              columns: [
                { id: 0, index: 0, title: 'Col1', cards: [ { head: 'Hello', body: 'World' }, { head: 'A', body: 'B' } ] },
                { id: 1, index: 1, title: 'Col2', cards: [ { head: 'Hello', body: 'World' } ] },
                { id: 2, index: 2, title: 'Col3', cards: [ ] },
              ],
            }
          });
        }
      };
      xhr.send();
    }
  }
}

class ColumnUselet extends Uselet {
  constructor (column) {
    super(
      'kanban-col',
      typeof column === 'object' ? column : null,
      (mod, msg) => mod,
      (mod) => {
        const wrapper = document.createElement('div');
        wrapper.setAttribute('class', 'board-col-body');

        return new XmlUselet(`<h4 class="board-col-head">${mod.title}</h4>`)
          .and((new ListUselet(
            mod.cards,
            (card) => {
              const wrapper = document.createElement('div');
              wrapper.setAttribute('class', 'kanban-card');
              return (new InPlaceEditUselet([
                { value: card.head, class: 'card-head', label: 'Head' },
                { value: card.body, class: 'card-body', label: 'Body' },
              ]))
                .in(wrapper);
            }
          )).in(wrapper))
            .and(new XmlUselet(`<button type="button">Add Card</button>`))
      }
    );
  }
}
