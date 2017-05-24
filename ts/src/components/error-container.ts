class ErrorContainer extends Uselet<{ error: string }> {
  constructor () {
    super(
      { error: '' },
      (model, message) => {
        switch (message.type) {
          case MESSAGE_TYPES.ERROR:
            return { error: message.value };
          case MESSAGE_TYPES.VALUE_CHANGED:
            return { error: '' };
          default:
            return model;
        }
      },
      (model) => {
        if (!model.error) {
          return [ ];
        }
        const container = document.createElement('div');
        container.classList.add('error');
        container.innerText = model.error;
        return [ container ];
      },
      '.error { color: #c00; border: thin solid #c00; background: rgba(255, 0, 0, .25); padding: .25rem;',
    )
  }
}
