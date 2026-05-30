// Updated script with plane animation and cashout tracking
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const multiplierDisplay = document.getElementById('multiplierDisplay');
  const flewAwayDisplay = document.getElementById('flewAwayDisplay');
  const waitingNextRound = document.getElementById('waitingNextRound');
  const waitingProgressBar = document.getElementById('waitingProgressBar');
  const progressFill = document.getElementById('progressFill');
  const balanceEl = document.getElementById('balance');
  const historyBar = document.getElementById('historyBar');
  const plane = document.getElementById('plane');

  // Bonus Banner Logic
  const bonusBanner = document.getElementById('bonusBanner');
  if (bonusBanner) {
    bonusBanner.classList.remove('hidden');
    setTimeout(() => {
      bonusBanner.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
      bonusBanner.style.opacity = '0';
      bonusBanner.style.transform = 'translateY(-20px)';
      setTimeout(() => bonusBanner.classList.add('hidden'), 500);
    }, 3000);
  }

  // State variables
  // Dark mode toggle setup
  const darkModeToggle = document.getElementById('darkModeToggle');
  const savedMode = localStorage.getItem('darkMode') || 'dark';
  if (savedMode === 'light') {
    document.body.classList.add('light-mode');
    if (darkModeToggle) darkModeToggle.checked = true;
  } else {
    document.body.classList.remove('light-mode');
    if (darkModeToggle) darkModeToggle.checked = false;
  }
  darkModeToggle?.addEventListener('change', () => {
    if (document.body.classList.toggle('light-mode')) {
      localStorage.setItem('darkMode', 'light');
    } else {
      localStorage.setItem('darkMode', 'dark');
    }
  });

  // Read balance from logged-in user's account, or fallback to demo
  const DEMO_BALANCE = 17055.29;
  const getGameBalance = () => {
    const session = JSON.parse(localStorage.getItem('jetbet_session') || 'null');
    if (session) {
      const users = JSON.parse(localStorage.getItem('jetbet_users') || '[]');
      const user = users.find(u => u.phone === session.phone);
      return user ? (parseFloat(user.balance) || 0) : 0;
    }
    return DEMO_BALANCE;
  };
  let balance = getGameBalance();
  let crashPoint = 0;
  let roundActive = false;
  let currentMult = 1.0;
  const history = [];

  // Fake Multiplayer Data
  const fakeNames = ["JohnD", "Mike88", "CryptoKing", "LuckyStar", "Alex_99", "BetMaster", "SkyHigh", "Pilot22", "Guest34", "Guest89", "Winner", "KenyanBoy", "NairobiFlyer", "Ochieng", "Kipchoge", "MpesaUser"];
  let fakeBets = [];
  const allBetsList = document.getElementById('allBetsList');

  const generateFakeBets = () => {
    fakeBets = [];
    const numBets = Math.floor(Math.random() * 20) + 15; // 15-35 fake bets
    for (let i = 0; i < numBets; i++) {
      const name = fakeNames[Math.floor(Math.random() * fakeNames.length)] + Math.floor(Math.random() * 999);
      const amount = (Math.random() * 1000 + 10).toFixed(2);
      // Generate a random cashout target (exponential-ish distribution)
      const target = Math.max(1.01, Math.round((Math.log(1 - Math.random()) * -0.5 + 1.0) * 100) / 100); 
      fakeBets.push({ name, amount, target, cashedOut: false, element: null });
    }
    fakeBets.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
    renderFakeBets();
  };

  const renderFakeBets = () => {
    if (!allBetsList) return;
    allBetsList.innerHTML = '';
    fakeBets.forEach(bet => {
      const row = document.createElement('div');
      row.className = 'bet-row';
      const initial = bet.name.charAt(0).toUpperCase();
      row.innerHTML = `
        <div class="user-info">
          <div class="avatar">${initial}</div>
          <div class="username">${bet.name}</div>
        </div>
        <div class="bet-amount">${bet.amount}</div>
        <div class="cashout-info"></div>
      `;
      bet.element = row;
      allBetsList.appendChild(row);
    });
  };

  const processFakeCashouts = (currentMult) => {
    fakeBets.forEach(bet => {
      if (!bet.cashedOut && currentMult >= bet.target) {
        bet.cashedOut = true;
        bet.element.classList.add('cashed-out');
        const win = (parseFloat(bet.amount) * currentMult).toFixed(2);
        const info = bet.element.querySelector('.cashout-info');
        if (info) {
          info.innerHTML = `<span class="cashout-mult">${currentMult.toFixed(2)}x</span><span class="win-amt">${win}</span>`;
        }
      }
    });
  };

  // Canvas and path drawing
  let ctx = null;
  const resize = () => {
    if (!canvas) return;
    canvas.width = canvas.parentElement.clientWidth || 800;
    canvas.height = canvas.parentElement.clientHeight || 500;
  };
  if (canvas) {
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  let pathPoints = [];
  let lastPlaneX = 0, lastPlaneY = 0;
  const crashParticles = [];
  const exhaustParticles = []; // Kept for extension if needed

  const hexToRgb = hex => {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
  };

  // === GRID & BACKGROUND ===
  const drawBackground = () => {
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    
    // Solid dark background
    ctx.fillStyle = '#141518';
    ctx.fillRect(0, 0, w, h);

    // Subtle Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    
    ctx.beginPath();
    for (let x = 0; x <= w; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  };

  const triggerExplosion = (ex, ey) => {
    const colors = ['#ff3b30','#ff9500','#ffcc00','#ffffff','#ff6b00'];
    // Powerful shockwave effect
    ctx.save();
    const grad = ctx.createRadialGradient(ex, ey, 0, ex, ey, 100);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(0.2, 'rgba(255, 150, 0, 0.4)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ex, ey, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 12 + 4;
      crashParticles.push({
        x: ex, y: ey,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        size: Math.random() * 10 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        decay: Math.random() * 0.02 + 0.01
      });
    }
  };

  const drawPlane = (x, y, mult, angle) => {
    if (!ctx) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    // Scale slightly with multiplier
    const s = 0.85 + Math.min(0.2, (mult - 1) * 0.015);
    ctx.scale(s, s);

    const planeColor = '#e11d48';

    // Propeller spinning effect (brighter)
    const propAngle = (Date.now() / 35) % (Math.PI * 2);
    ctx.save();
    ctx.translate(48, 0);
    ctx.rotate(propAngle);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(-1, -20, 2, 40);
    ctx.restore();

    // Wings (more curved)
    ctx.beginPath();
    ctx.moveTo(10, -3);
    ctx.lineTo(-12, -35); // top wing
    ctx.lineTo(20, -3);
    ctx.lineTo(20, 3);
    ctx.lineTo(-12, 35); // bottom wing
    ctx.lineTo(10, 3);
    ctx.closePath();
    ctx.fillStyle = planeColor;
    ctx.fill();

    // Fuselage
    ctx.beginPath();
    ctx.moveTo(-35, -5);
    ctx.lineTo(35, -9);
    ctx.lineTo(48, 0); // nose
    ctx.lineTo(35, 9);
    ctx.lineTo(-35, 5);
    ctx.closePath();
    ctx.fillStyle = planeColor;
    ctx.fill();

    // Add a cockpit highlight!
    ctx.beginPath();
    ctx.ellipse(22, -2, 10, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-52, -18);
    ctx.lineTo(-52, 18);
    ctx.closePath();
    ctx.fillStyle = planeColor;
    ctx.fill();

    ctx.restore();
  };

  const drawPath = (leftPct, bottomPct, mult) => {
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const x = (leftPct / 100) * w;
    const y = h - (bottomPct / 100) * h;
    pathPoints.push({x, y});
    lastPlaneX = x;
    lastPlaneY = y;

    const t = Date.now() * 0.001;
    const parallax = (mult - 1) * 55;

    // === BACKGROUND ===
    drawBackground();

    // === PATH FILL ===
    if (pathPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(pathPoints[0].x, h);
      for (let i = 0; i < pathPoints.length; i++) ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
      ctx.lineTo(x, h);
      ctx.closePath();
      
      const fill = ctx.createLinearGradient(0, h * 0.5, 0, h);
      fill.addColorStop(0, 'rgba(225, 29, 72, 0.25)');
      fill.addColorStop(1, 'rgba(225, 29, 72, 0.05)');
      ctx.fillStyle = fill;
      ctx.fill();

      // === PATH LINE ===
      ctx.beginPath();
      ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
      for (let i = 1; i < pathPoints.length; i++) ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // === PLANE ANGLE (from last few points) ===
    const pLen = pathPoints.length;
    const lookback = Math.min(8, pLen - 1);
    const dx = pathPoints[pLen-1].x - pathPoints[pLen-1-lookback].x;
    const dy = pathPoints[pLen-1].y - pathPoints[pLen-1-lookback].y;
    const angle = Math.atan2(dy, dx);
    drawPlane(x, y, mult, angle);
  };


  const fmt = n => n.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const updateBalanceUI = () => {
    balanceEl.textContent = fmt(balance);
    // Persist balance to user account if logged in, else to demo key
    const session = JSON.parse(localStorage.getItem('jetbet_session') || 'null');
    if (session) {
      const users = JSON.parse(localStorage.getItem('jetbet_users') || '[]');
      const idx = users.findIndex(u => u.phone === session.phone);
      if (idx > -1) {
        users[idx].balance = balance;
        localStorage.setItem('jetbet_users', JSON.stringify(users));
      }
    } else {
      localStorage.setItem('balance', balance.toString());
    }
  };

  const getHistoryColor = mult => {
    if (mult < 2.0) return '#34b4ff'; // Blue
    if (mult < 10.0) return '#913fe2'; // Purple
    return '#c21b5f'; // Pink/Red
  };

  const addHistory = crash => {
    history.unshift(crash);
    if (history.length > 20) history.pop();
    historyBar.innerHTML = '';
    history.forEach((val) => {
      const pill = document.createElement('div');
      pill.className = 'pill';
      pill.textContent = `${val.toFixed(2)}x`;
      pill.style.background = getHistoryColor(val);
      historyBar.appendChild(pill);
    });
  };

  const updatePlanePosition = mult => {
    // Position tracking for particle spawn (plane is now drawn on canvas)
    const maxBottom = 75;
    const bottom = Math.min(maxBottom, (mult - 1) * 25);
    const leftOffset = Math.min(75, (mult - 1) * 18);
    const leftPct = 12 + leftOffset;

    drawPath(leftPct, bottom, mult);
  };


  const step = () => {
    if (!ctx) return;
    
    if (roundActive) {
      // Scale multiplier speed with time (logarithmic-ish)
      const inc = 0.001 + (currentMult / 150); 
      currentMult += inc;
      
      multiplierDisplay.textContent = `${currentMult.toFixed(2)}x`;
      if (currentMult >= 10.0) {
        multiplierDisplay.classList.add('high-mult');
      } else {
        multiplierDisplay.classList.remove('high-mult');
      }
      updatePlanePosition(currentMult);
      
      // Auto cashouts
      panels.forEach((p, idx) => {
        if (p.status === 'active') {
          renderPanelBtn(idx);
          if (p.autoCashout && currentMult >= p.target) {
            cashoutPanel(idx, p.target);
          }
        }
      });
      processFakeCashouts(currentMult);

      if (currentMult >= crashPoint) {
        roundActive = false;
        multiplierDisplay.style.color = 'var(--accent-red)';
        flewAwayDisplay.classList.remove('hidden');
        addHistory(crashPoint);
        triggerExplosion(lastPlaneX, lastPlaneY);
        
        // Resolve panels
        fakeBets.forEach(bet => { if (!bet.cashedOut && bet.element) bet.element.style.opacity = '0.3'; });
        panels.forEach((p, idx) => {
          if (p.status === 'active' || p.status === 'cashed_out') p.status = 'idle';
          if (p.autoBet && p.status === 'idle') {
            const betVal = parseFloat(betInputs[idx].value) || 0;
            if (betVal > 0 && balance >= betVal) {
              p.bet = betVal; balance -= p.bet; updateBalanceUI(); p.status = 'waiting';
            }
          }
          renderPanelBtn(idx);
        });
        
        scheduleNextRound();
      }
    } else {
      // Waiting/Countdown state - draw static background or crash particles
      drawBackground();
      if (!flewAwayDisplay.classList.contains('hidden')) {
        // Plane already crashed - draw particles if still alive
        for (let i = crashParticles.length-1; i>=0; i--) {
          const p = crashParticles[i];
          p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; p.alpha-=p.decay;
          if (p.alpha<=0){crashParticles.splice(i,1);continue;}
          ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
          ctx.fillStyle=`rgba(${hexToRgb(p.color)},${p.alpha})`; ctx.fill();
        }
      }
    }
    requestAnimationFrame(step);
  };

  const startRound = () => {
    roundActive = true;
    pathPoints = [];
    exhaustParticles.length = 0;
    crashParticles.length = 0;
    
    drawBackground();
    multiplierDisplay.textContent = '1.00x';
    multiplierDisplay.style.color = 'var(--accent-green)';
    flewAwayDisplay.classList.add('hidden');
    
    // Activate waiting panels
    panels.forEach((p, idx) => {
      if (p.status === 'waiting') p.status = 'active';
      renderPanelBtn(idx);
    });

    const r = Math.random();
    if (r < 0.40) {
      // 40% chance: Between 2.30 and 5.00
      crashPoint = 2.30 + Math.random() * 2.70;
    } else if (r < 0.90) {
      // 50% chance: Between 5.00 and 10.00 (making 60% total >= 5.0)
      crashPoint = 5.00 + Math.random() * 5.00;
    } else {
      // 10% chance: 10.00 and above
      crashPoint = 10.00 + (Math.log(1 - Math.random()) * -5.0); // Exponential tail for high wins
    }
    crashPoint = Math.round(crashPoint * 100) / 100;
    currentMult = 1.0;
  };

  // Start the main loop ONCE
  requestAnimationFrame(step);

  const cashoutPanel = (idx, mult) => {
    const p = panels[idx];
    if (p.status !== 'active') return;
    p.status = 'cashed_out';
    const win = p.bet * mult;
    balance += win;
    updateBalanceUI();
    renderPanelBtn(idx);
  };

  const scheduleNextRound = () => {
    waitingNextRound.classList.remove('hidden');
    waitingProgressBar.classList.remove('hidden');
    generateFakeBets();
    let elapsed = 0;
    const waitTime = 5000; // 5 seconds
    const tick = () => {
      elapsed += 100;
      const pct = Math.min(1, elapsed / waitTime);
      progressFill.style.width = `${pct * 100}%`;
      if (elapsed < waitTime) {
        setTimeout(tick, 100);
      } else {
        waitingNextRound.classList.add('hidden');
        waitingProgressBar.classList.add('hidden');
        progressFill.style.width = '0%';
        startRound();
      }
    };
    tick();
  };

  const betButtons = [document.getElementById('actionBtn1'), document.getElementById('actionBtn2')];
  const betInputs = [document.getElementById('betInput1'), document.getElementById('betInput2')];
  const autoBetToggles = [document.getElementById('autoBetToggle1'), document.getElementById('autoBetToggle2')];
  const autoCashoutToggles = [document.getElementById('autoCashoutToggle1'), document.getElementById('autoCashoutToggle2')];
  const autoCashoutInputs = [document.getElementById('autoCashoutInput1'), document.getElementById('autoCashoutInput2')];

  const panels = [
    { status: 'idle', bet: 0, autoBet: false, autoCashout: false, target: 1.5 },
    { status: 'idle', bet: 0, autoBet: false, autoCashout: false, target: 1.5 }
  ];

  const renderPanelBtn = (idx) => {
    const p = panels[idx];
    const btn = betButtons[idx];
    const input = betInputs[idx];
    
    if (btn.children.length < 2) {
      btn.innerHTML = `<span></span><span class="btn-subtext"></span>`;
    }
    const mainSpan = btn.children[0];
    const subSpan = btn.children[1];
    
    if (p.status === 'idle') {
      mainSpan.textContent = 'BET';
      subSpan.textContent = `${input.value} KES`;
      btn.style.background = 'var(--accent-green)'; 
      btn.classList.remove('cashout');
      input.disabled = false;
    } else if (p.status === 'waiting') {
      mainSpan.textContent = 'CANCEL';
      subSpan.textContent = 'Waiting...';
      btn.style.background = '#e6003c';
      btn.classList.remove('cashout');
      input.disabled = true;
    } else if (p.status === 'active') {
      mainSpan.textContent = 'CASH OUT';
      const win = (p.bet * currentMult).toFixed(2);
      subSpan.textContent = `${win} KES`;
      btn.classList.add('cashout');
      btn.style.background = 'var(--accent-orange)';
      input.disabled = true;
    } else if (p.status === 'cashed_out') {
      mainSpan.textContent = 'WON';
      subSpan.textContent = 'Cashed Out!';
      btn.classList.remove('cashout');
      btn.style.background = '#28a745'; // Keep dark green for success
      input.disabled = true;
    }
  };

  betInputs.forEach((input, idx) => {
    input.addEventListener('input', () => renderPanelBtn(idx));
  });

  betButtons.forEach((btn, idx) => {
    btn?.addEventListener('click', () => {
      const p = panels[idx];
      if (p.status === 'idle') {
        const betVal = parseFloat(betInputs[idx].value) || 0;
        if (betVal <= 0 || balance < betVal) return;
        p.bet = betVal;
        balance -= p.bet;
        updateBalanceUI();
        p.autoBet = autoBetToggles[idx]?.checked || false;
        p.autoCashout = autoCashoutToggles[idx]?.checked || false;
        p.target = parseFloat(autoCashoutInputs[idx]?.value) || 1.5;
        p.status = 'waiting';
        renderPanelBtn(idx);
      } else if (p.status === 'waiting') {
        balance += p.bet;
        updateBalanceUI();
        p.status = 'idle';
        p.bet = 0;
        renderPanelBtn(idx);
      } else if (p.status === 'active') {
        cashoutPanel(idx, currentMult);
      }
    });
  });

  // Real Play toggle logic
  const realPlayToggle = document.getElementById('realPlayToggle');
  realPlayToggle?.addEventListener('change', () => {
    const session = JSON.parse(localStorage.getItem('jetbet_session') || 'null');
    if (realPlayToggle.checked && !session) {
      // Prompt for login
      realPlayToggle.checked = false;
      const loginBtn = document.getElementById('loginBtn');
      if (loginBtn) {
        loginBtn.click();
      } else {
        alert('Please login to use Real Play mode.');
      }
    } else {
      // Toggle balance between demo and real
      window.refreshBalance();
    }
  });

  updateBalanceUI();
  panels.forEach((_, idx) => renderPanelBtn(idx));
  scheduleNextRound(); // Start the infinite game loop

  // Bridges for auth.js
  window.addToBalance = (amount) => {
    balance += parseFloat(amount) || 0;
    updateBalanceUI();
  };
  // Called by auth.js after login / logout so balance reloads immediately
  window.refreshBalance = async () => {
    const session = JSON.parse(localStorage.getItem('jetbet_session') || 'null');
    const jwt = localStorage.getItem('jetbet_jwt');
    
    if (session && jwt) {
      try {
        const API_BASE = window.JETBET_API_BASE || (window.location.port === '5500' ? 'http://localhost:4000' : window.location.origin);
        const resp = await fetch(`${API_BASE}/api/me/balance`, {
          headers: { 'Authorization': `Bearer ${jwt}` }
        });
        const data = await resp.json();
        if (resp.ok && typeof data.balance === 'number') {
           balance = data.balance;
           updateBalanceUI();
           return;
        }
      } catch (e) {
        console.warn('Failed to sync backend balance', e);
      }
    }
    
    balance = getGameBalance();
    updateBalanceUI();
  };

  // Initial sync
  window.refreshBalance();
});
