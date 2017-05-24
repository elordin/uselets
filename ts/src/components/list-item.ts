class ListItem extends Uselet<string> {
  constructor (value) {
    super(
      value,
      (model, message) => model,
      (model) => [ document.createTextNode(model) ],
      ':host { display: block; padding: 1rem; }'
    )
  }
}
