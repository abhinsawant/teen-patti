const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  
  async function testResolution(name, width, height) {
    console.log(`Testing ${name} (${width}x${height})...`);
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    
    // Go to the local dev server
    await page.goto('http://localhost:5173/');
    
    // Wait for the UI to load
    await page.waitForSelector('input');
    
    // Type name
    await page.type('input', 'TestUser');
    
    // Click Create Game
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('Create New Room')) {
        await btn.click();
        break;
      }
    }
    
    // Wait for Game Room
    await page.waitForFunction(() => document.body.innerText.includes('START GAME') || document.body.innerText.includes('ROOM CODE'), {timeout: 5000});
    
    // Wait a little extra for animations
    await new Promise(r => setTimeout(r, 1000));
    
    // Screenshot
    await page.screenshot({ path: `C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\7f138852-9e03-4a89-8954-456027ffc619\\screenshot_${name}.png` });
    console.log(`Saved screenshot_${name}.png`);
    await page.close();
  }

  try {
    await testResolution('iPhone_12', 390, 844);
    await testResolution('Pixel_8_Pro', 412, 915);
    await testResolution('iPhone_SE', 375, 667);
  } catch(e) {
    console.error(e);
  }
  
  await browser.close();
})();
