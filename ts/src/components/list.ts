class List extends Uselet<{ value: string, items: string[] }> {
  constructor (itemUselet) {
    super(
      { value: '', items: [ ] },
      (model, message) => {
        switch (message.type) {
          case MESSAGE_TYPES.ADD:
            if (!model.value) {
              Dispatcher.broadcast({ type: MESSAGE_TYPES.ERROR, value: 'Cannot add empty item.' });
              return model;
            }
            const items = model.items.slice();
            items.push(model.value);
            return { value: '', items: items }
          case MESSAGE_TYPES.VALUE_CHANGED:
            return { value: message.value, items: model.items };
          default:
            return model;
        }
      },
      (model) => {
        const input = document.createElement('input');
        input.value = model.value;
        input.addEventListener('keyup', (e) => {
          Dispatcher.broadcast({ type: MESSAGE_TYPES.VALUE_CHANGED, value: input.value });
        })
        const btn = document.createElement('button');
        btn.innerText = 'Add';
        btn.addEventListener('click', (e) => {
          Dispatcher.broadcast({ type: MESSAGE_TYPES.ADD });
        })
        const list = document.createElement('ul');
        model.items.forEach((item) => {

          const li = document.createElement('li');
          const childUselet = new itemUselet(item);
          li.appendChild(childUselet.element);
          list.appendChild(li);
        });

        return [ input, btn, list ];
      },
      ''
    )
  }
}
