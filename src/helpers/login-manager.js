const _ = require('lodash');
const UserAgent = require('user-agents');
const puppeteerXtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { setLocalCookie, getLocalCookie } = require('./cookie-storage');

puppeteerXtra.use(StealthPlugin());

class LoginManager {
  constructor() {
    this.browser = null;
    this.page = null;
    this.cookie = null;
  }

  async init() {
    const cookies = await getLocalCookie();
    
    this.browser = await puppeteerXtra.launch({
      args: ['--window-size=1920,1080'],
      headless: process.env.NODE_ENV === 'PROD',
    });
    this.page = await this.browser.newPage();

    await this.page.setUserAgent((new UserAgent()).toString());
    if (cookies) {
      this.page.setCookie(...cookies);
    }

    await this.page.goto(process.env.LOGIN_PAGE, { waitUntil: ['domcontentloaded'] });

    if (!cookies) {
      await this.page.waitForSelector('.top-bar__auth [href*="signin"]', { timeout: 5000 });
      await this.page.click('.top-bar__auth [href*="signin"]');
      await this.page.waitForTimeout(1000);

      await this.page.type('input[name="email"]', process.env.EMAIL);
      await this.page.waitForTimeout(1000);
      await this.page.type('input[name="password"]', process.env.PASSWORD);
      await this.page.waitForTimeout(1000);
      await this.page.click('button[data-action="signin"]');
      await this.page.waitForTimeout(3000);
      await this.page.waitForFunction('current_user !== null', { timeout: 5000 });

      setLocalCookie(await this.page.cookies());
    }
  }

}

module.exports = new LoginManager();
