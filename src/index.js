import {initSentry} from './sentry.js';

import './style/index.css';

import Auth from './auth.js';

import './ngm-app.js';

Auth.initialize();

initSentry();
