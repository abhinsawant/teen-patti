const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  
  // Create 5 separate contexts so they don't share localStorage (different players)
  const contexts = [];
  for (let i = 0; i < 5; i++) {
    contexts.push(await browser.createBrowserContext());
  }

  // Player 1 (Host)
  const page1 = await contexts[0].newPage();
  await page1.setViewport({ width: 390, height: 844, isMobile: true });
  await page1.goto('http://localhost:5173/');
  
  // Wait for name input and join
  await page1.waitForSelector('input[placeholder="Enter your name"]');
  await page1.type('input[placeholder="Enter your name"]', 'Host_P1');
  
  await page1.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const createBtn = btns.find(b => b.textContent.includes('Create Room') || b.textContent.includes('CREATE ROOM'));
    if (createBtn) createBtn.click();
  });

  await page1.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
  await page1.waitForSelector('.font-mono', { timeout: 5000 }).catch(() => {});
  
  const roomCode = await page1.evaluate(() => {
    const el = document.querySelector('.font-mono');
    return el ? el.textContent.trim() : null;
  });
  console.log('Room Code created:', roomCode);

  if (!roomCode) {
     console.log('Failed to create room');
     await browser.close();
     return;
  }

  // Players 2 to 5 join the room
  for (let i = 1; i < 5; i++) {
    const p = await contexts[i].newPage();
    await p.setViewport({ width: 390, height: 844, isMobile: true });
    await p.goto('http://localhost:5173/');
    await p.waitForSelector('input[placeholder="Enter your name"]');
    await p.type('input[placeholder="Enter your name"]', `Player_${i+1}`);
    
    // Type room code
    const inputs = await p.$$('input');
    // Usually name is first, room code is second
    if (inputs.length > 1) {
       await inputs[1].type(roomCode);
    }
    
    // Click join
    await p.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const joinBtn = btns.find(b => b.textContent.includes('Join Room') || b.textContent.includes('JOIN ROOM'));
      if (joinBtn) joinBtn.click();
    });
    
    await p.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));
  }

  // Start the game from Host (page1)
  await new Promise(r => setTimeout(r, 2000));
  await page1.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const startBtn = btns.find(b => b.textContent.includes('START GAME'));
    if (startBtn) startBtn.click();
  });

  await new Promise(r => setTimeout(r, 4000)); // Wait for dealing animation
  
  // Screenshot the 5-player layout on mobile!
  const screenshotPath = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\7f138852-9e03-4a89-8954-456027ffc619\\five_players_mobile.png';
  await page1.screenshot({ path: screenshotPath });
  console.log('Saved screenshot to:', screenshotPath);
  
  await browser.close();
})();
