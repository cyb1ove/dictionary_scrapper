const _ = require('lodash');
const UserAgent = require('user-agents');
const puppeteerXtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { setLocalCookie, getLocalCookie } = require('./cookie-storage');
const fetch = require('node-fetch');

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

  async parseDictionary() {
    await this.page.goto(process.env.DICTIONARY_PAGE, { waitUntil: ['domcontentloaded'] });
    
    const exportedWords = [];

    while (await this.page.$('.paginator-style-2__right')) {
      await this.page.waitForSelector('.paginator-style-2__right');
      
      const wordCards = await this.page.$$(".puzzle-card");
      
      wordCards.forEach(async (card) => {
        const wordObject = {};
        const wordNode = await card.$('.puzzle-card__eng-word-current');
        wordObject.word = await wordNode.evaluate((node) => node.innerText);
        const translationNode = await card.$(".puzzle-card__rus-word");
        wordObject.translation = await translationNode.evaluate((node) => node.innerText);
        
        exportedWords.push(wordObject);
      });

      const nextPage = await this.page.$('.paginator-style-2__right');
      await nextPage.click();
      await this.page.waitForTimeout(1000);
    }

    const promises = exportedWords.map(async (word) => {
      const response = await fetch(
        "https://puzzle-english.com/",
        {
          "headers": {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-requested-with": "XMLHttpRequest"
          },
          "referrer": "https://puzzle-english.com/dictionary",
          "referrerPolicy": "strict-origin-when-cross-origin",
          "body": `ajax_action=ajax_cards_getWordVideos&word=${word.word}&translation=${encodeURIComponent(word.translation)}`,
          "method": "POST",
          "mode": "cors",
          "credentials": "include"
        }
      );
      return response.json();
    });
    const videos = await Promise.all(promises);
  }
}

module.exports = new LoginManager();
