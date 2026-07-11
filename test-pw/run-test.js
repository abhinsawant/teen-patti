const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  async function testResolution(name, width, height) {
    console.log(`Testing ${name} (${width}x${height})...`);
    // Pass user agent for mobile
    const context = await browser.newContext({
      viewport: { width, height },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Mobile Safari/537.36',
      isMobile: true,
      hasTouch: true
    });
    
    const page = await context.newPage();
    
    // Go to the local dev server
    await page.goto('http://localhost:5173/');
    
    // Wait for the UI to load
    await page.waitForSelector('input');
    
    // Type name
    await page.fill('input', 'TestUser');
    
    // Click Create Game
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text && text.includes('Create New Room')) {
        await btn.click();
        break;
      }
    }
    
    // Wait for Game Room
    await page.waitForFunction(() => document.body.innerText.includes('START GAME') || document.body.innerText.includes('ROOM CODE'), {timeout: 5000});
    
    // Wait a little extra for animations
    await new Promise(r => setTimeout(r, 1000));
    
    // Measure bounding box of the footer
    const footer = await page.$('footer');
    if (footer) {
      const box = await footer.boundingBox();
      console.log(`${name} footer box:`, box);
      // Check if it's within the viewport
      if (box && box.y + box.height > height) {
         console.log(`WARNING: ${name} footer is cut off! (y: ${box.y}, height: ${box.height}, viewport: ${height})`);
      } else {
         console.log(`SUCCESS: ${name} footer is fully visible.`);
      }
    } else {
      console.log(`ERROR: ${name} footer not found!`);
    }

    // Screenshot
    await page.screenshot({ path: `C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\7f138852-9e03-4a89-8954-456027ffc619\\pw_screenshot_${name}.png` });
    console.log(`Saved pw_screenshot_${name}.png`);
    await context.close();
  }

  try {
    await testResolution('iPhone_12', 390, 844);
    await testResolution('Pixel_Pro', 412, 915);
    await testResolution('iPhone_SE', 375, 667);
  } catch(e) {
    console.error(e);
  }
  
  await browser.close();
})();
