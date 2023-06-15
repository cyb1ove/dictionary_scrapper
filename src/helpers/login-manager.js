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
        wordObject.word = wordObject.word.replace(/\b(a|an|to)\b/gi, '').trim();

        const translationNode = await card.$(".puzzle-card__rus-word");
        wordObject.translation = await translationNode.evaluate((node) => node.innerText);

        const postId = await card.evaluate((node) => node.getAttribute('data-post_id'));
        const pieceIndex = await card.evaluate((node) => node.getAttribute('data-piece_index'));

        const responseForVideos = await fetch(
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
            "body": `ajax_action=ajax_cards_getWordVideos&word=${wordObject.word}&translation=${encodeURIComponent(wordObject.translation)}`,
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
          }
        );
        wordObject.videos = await responseForVideos.json();

        const responseForAdditionalInformation = await fetch(
          "https://puzzle-english.com/",
          {
            "credentials": "include",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0",
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.5",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-origin"
            },
            "referrer": "https://puzzle-english.com/dictionary?view=cards&item=word",
            "body": `location=https%3A%2F%2Fpuzzle-english.com%2Fdictionary%3Fview%3Dcards%26item%3Dword&ajax_action=ajax_balloon_Show&post_id=${postId}&piece_index=${pieceIndex}&translation=${encodeURIComponent(wordObject.translation)}&word=${wordObject.word}&parent_expression=&expression_form=&is_word_with_type_search=0&with_video=0`,
            "method": "POST",
            "mode": "cors"
          }
        )
        wordObject.info = await responseForAdditionalInformation.json();

        const transcriptionBritishNode = await card.$(".british_transcription");
        const transcriptionAmericanNode = await card.$(".american_transcription");
        const transcriptionAllNode = await card.$(".j-sameTranscriptions");
        const isPhraseNode = await card.$(".dict__video__list-table__word__type");

        if (isPhraseNode) {
          wordObject.isPhrase = true;
        } else if (transcriptionAllNode) {
          wordObject.british_transcription = await transcriptionAllNode.evaluate((node) => node.innerText);
          wordObject.american_transcription = await transcriptionAllNode.evaluate((node) => node.innerText);
          wordObject.british_transcription = wordObject.british_transcription.trim();
          wordObject.american_transcription = wordObject.american_transcription.trim();
        } else {
          wordObject.british_transcription = await transcriptionBritishNode.evaluate((node) => node.innerText);
          wordObject.american_transcription = await transcriptionAmericanNode.evaluate((node) => node.innerText);
          wordObject.british_transcription = wordObject.british_transcription.trim();
          wordObject.american_transcription = wordObject.american_transcription.trim();
        }
        
        exportedWords.push(wordObject);
      });

      const nextPage = await this.page.$('.paginator-style-2__right');
      await nextPage.click();
      await this.page.waitForTimeout(2000);
    }

    console.log(exportedWords);
  }
}

module.exports = new LoginManager();
