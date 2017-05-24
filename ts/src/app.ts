class MyApp extends App {
  constructor () {
    super([
      new ErrorContainer(),
      new List(ListItem),
      new List(ListItem),
    ])
  }
}
