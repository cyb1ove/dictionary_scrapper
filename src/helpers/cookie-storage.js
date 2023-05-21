const fs = require('fs').promises;

const getLocalCookie = async () => {
  try {
    const cookie = await fs.readFile('./cookies.json');
    return JSON.parse(cookie);
  } catch (e) {
    return null;
  }
};

const setLocalCookie = async (cookie) => {
  try {
    await fs.writeFile('./cookies.json', JSON.stringify(cookie, null, 2));
  } catch (e) {
    return null;
  }
};

module.exports = {
  setLocalCookie,
  getLocalCookie,
};
