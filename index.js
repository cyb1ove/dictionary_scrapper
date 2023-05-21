require('dotenv').config();

const loginManager = require('./src/helpers/login-manager');

(async () => {
  await loginManager.init();
})();
