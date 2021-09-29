import Express from "express";

import {ArtController} from './controllers/ArtController'

const APP_PORT = 3000
const App = Express()

new ArtController(App)

App.listen(APP_PORT, () => console.log(`App listening on ${APP_PORT}`))