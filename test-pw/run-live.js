const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  async function testResolution(name, width, height) {
    console.log(`Testing Live URL on ${name} (${width}x${height})...`);
    const context = await browser.newContext({
      viewport: { width, height },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Mobile Safari/537.36',
      isMobile: true,
      hasTouch: true
    });
    
    const page = await context.newPage();
    
    await page.goto('https://tion-b27f.up.railway.app');
    
    // Wait for the UI to load
    await page.waitForSelector('input');
    await page.fill('input', 'TestUser');
    
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text && text.includes('Create New Room')) {
        await btn.click();
        break;
      }
    }
    
    await page.waitForFunction(() => document.body.innerText.includes('START GAME') || document.body.innerText.includes('ROOM CODE'), {timeout: 5000});
    await new Promise(r => setTimeout(r, 2000));
    
    const footer = await page.$('footer');
    if (footer) {
      const box = await footer.boundingBox();
      console.log(`${name} footer box:`, box);
    } else {
      console.log(`ERROR: ${name} footer not found!`);
    }

    await page.screenshot({ path: `C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\7f138852-9e03-4a89-8954-456027ffc619\\pw_live_${name}.png` });
    console.log(`Saved pw_live_${name}.png`);
    await context.close();
  }

  try {
    await testResolution('Pixel_Pro', 412, 915);
  } catch(e) {
    console.error(e);
  }
  
  await browser.close();
})();
