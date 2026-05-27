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
  if (canvas) {
    ctx = canvas.getContext('2d');
    const resize = () => {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);
  }

  let pathPoints = [];
  let lastPlaneX = 0, lastPlaneY = 0;

  // === STARFIELD ===
  const stars = Array.from({ length: 140 }, () => ({
    x: Math.random(), y: Math.random(),
    size: Math.random() * 1.6 + 0.3,
    opacity: Math.random() * 0.75 + 0.25,
    twinklePhase: Math.random() * Math.PI * 2,
    twinkleSpeed: Math.random() * 2.5 + 0.5
  }));

  // === PARTICLE SYSTEMS ===
  const exhaustParticles = [];
  const crashParticles = [];

  const hexToRgb = hex => {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
  };

  const spawnExhaust = (px, py) => {
    const colors = ['#ff6600','#ff9500','#ffcc00','#ff4400','#ffdd44'];
    for (let i = 0; i < 4; i++) {
      exhaustParticles.push({
        x: px, y: py,
        vx: -(Math.random() * 3 + 1.5),
        vy: (Math.random() - 0.5) * 2,
        alpha: 0.85 + Math.random() * 0.15,
        size: Math.random() * 7 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        decay: Math.random() * 0.04 + 0.025
      });
      if (exhaustParticles.length > 240) exhaustParticles.shift();
    }
  };

  const triggerExplosion = (ex, ey) => {
    const colors = ['#ff3b30','#ff9500','#ffcc00','#ffffff','#ff6b00'];
    for (let i = 0; i < 70; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 9 + 2;
      crashParticles.push({
        x: ex, y: ey,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        size: Math.random() * 8 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        decay: Math.random() * 0.025 + 0.015
      });
    }
  };

  const drawPlane = (x, y, mult, angle) => {
    if (!ctx) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const s = 1 + (mult - 1) * 0.025;
    ctx.scale(s, s);

    // Engine flame glow behind jet
    const flameGrad = ctx.createRadialGradient(-46, 0, 0, -46, 0, 22);
    flameGrad.addColorStop(0, 'rgba(255,210,60,0.95)');
    flameGrad.addColorStop(0.35, 'rgba(255,110,20,0.75)');
    flameGrad.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.beginPath();
    ctx.ellipse(-50, 0, 28, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = flameGrad;
    ctx.fill();

    ctx.shadowBlur = 18;
    ctx.shadowColor = '#ff003c';

    // Main fuselage
    ctx.beginPath();
    ctx.moveTo(-40, -7);
    ctx.lineTo(28, -5);
    ctx.lineTo(46, 0);
    ctx.lineTo(28, 5);
    ctx.lineTo(-40, 7);
    ctx.closePath();
    const bodyGrad = ctx.createLinearGradient(-40, -7, -40, 7);
    bodyGrad.addColorStop(0, '#ff2255');
    bodyGrad.addColorStop(0.45, '#cc0033');
    bodyGrad.addColorStop(1, '#7a001e');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    ctx.shadowBlur = 0;

    // Swept main wing
    ctx.beginPath();
    ctx.moveTo(-8, -3);
    ctx.lineTo(-28, -30);
    ctx.lineTo(-14, -3);
    ctx.lineTo(-14, 3);
    ctx.lineTo(-28, 30);
    ctx.closePath();
    ctx.fillStyle = '#dd0038';
    ctx.fill();

    // Tail fin top
    ctx.beginPath();
    ctx.moveTo(-33, -4);
    ctx.lineTo(-44, -19);
    ctx.lineTo(-28, -5);
    ctx.closePath();
    ctx.fillStyle = '#aa0028';
    ctx.fill();

    // Tail fin bottom
    ctx.beginPath();
    ctx.moveTo(-33, 4);
    ctx.lineTo(-44, 19);
    ctx.lineTo(-28, 5);
    ctx.closePath();
    ctx.fillStyle = '#aa0028';
    ctx.fill();

    // Cockpit canopy
    ctx.beginPath();
    ctx.ellipse(20, -2, 11, 5, 0, 0, Math.PI * 2);
    const cockpitGrad = ctx.createRadialGradient(18, -4, 1, 20, -2, 11);
    cockpitGrad.addColorStop(0, 'rgba(180,240,255,0.9)');
    cockpitGrad.addColorStop(1, 'rgba(40,140,220,0.5)');
    ctx.fillStyle = cockpitGrad;
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#80eeff';
    ctx.fill();
    ctx.shadowBlur = 0;

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

    // === SPACE BACKGROUND ===
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#050810');
    bg.addColorStop(0.6, '#090c18');
    bg.addColorStop(1, '#0c0f1e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Nebula glow (subtle purple in bottom-left)
    const nebula = ctx.createRadialGradient(w * 0.1, h * 0.85, 0, w * 0.1, h * 0.85, w * 0.55);
    nebula.addColorStop(0, 'rgba(60,0,100,0.18)');
    nebula.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, w, h);

    // === PARALLAX STARS ===
    stars.forEach(star => {
      const sx = ((star.x * w - parallax * 0.25 * star.size) % w + w) % w;
      const sy = star.y * h;
      const twinkle = 0.6 + 0.4 * Math.sin(t * star.twinkleSpeed + star.twinklePhase);
      ctx.beginPath();
      ctx.arc(sx, sy, star.size * (0.85 + 0.15 * twinkle), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(210,225,255,${star.opacity * twinkle})`;
      ctx.fill();
    });

    // === FAINT GRID ===
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    const gs = 60;
    const ox = (parallax * 0.6) % gs;
    const oy = (parallax * 0.2) % gs;
    ctx.beginPath();
    for (let i = -ox; i < w; i += gs) { ctx.moveTo(i, 0); ctx.lineTo(i, h); }
    for (let j = oy; j < h; j += gs) { ctx.moveTo(0, j); ctx.lineTo(w, j); }
    ctx.stroke();

    // === EXHAUST PARTICLES ===
    for (let i = exhaustParticles.length - 1; i >= 0; i--) {
      const p = exhaustParticles[i];
      p.x += p.vx; p.y += p.vy;
      p.alpha -= p.decay;
      p.size *= 0.96;
      if (p.alpha <= 0 || p.size < 0.5) { exhaustParticles.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${hexToRgb(p.color)},${p.alpha})`;
      ctx.fill();
    }

    // === CRASH PARTICLES ===
    for (let i = crashParticles.length - 1; i >= 0; i--) {
      const p = crashParticles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.18; // gravity
      p.alpha -= p.decay;
      if (p.alpha <= 0) { crashParticles.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${hexToRgb(p.color)},${p.alpha})`;
      ctx.fill();
    }

    if (pathPoints.length < 2) {
      drawPlane(x, y, mult, -0.15);
      return;
    }

    // === PATH FILL ===
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++) ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    ctx.lineTo(x, h);
    ctx.lineTo(pathPoints[0].x, h);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, pathPoints[0].y, 0, h);
    fill.addColorStop(0, 'rgba(230,0,60,0.38)');
    fill.addColorStop(0.5, 'rgba(230,0,60,0.12)');
    fill.addColorStop(1, 'rgba(230,0,60,0.02)');
    ctx.fillStyle = fill;
    ctx.fill();

    // === PATH LINE — outer halo ===
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++) ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    ctx.strokeStyle = 'rgba(230,0,60,0.22)';
    ctx.lineWidth = 14;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // === PATH LINE — core bright ===
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++) ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    ctx.strokeStyle = '#ff1a50';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 22;
    ctx.shadowColor = '#ff003c';
    ctx.stroke();
    ctx.shadowBlur = 0;

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
      pill.title = `${val.toFixed(2)}x`;
      pill.style.background = getHistoryColor(val);
      // add text to pill
      pill.textContent = `${val.toFixed(2)}x`;
      pill.style.color = '#fff';
      pill.style.fontSize = '0.75rem';
      pill.style.padding = '2px 6px';
      pill.style.borderRadius = '10px';
      pill.style.fontWeight = 'bold';
      historyBar.appendChild(pill);
    });
  };

  const updatePlanePosition = mult => {
    // Position tracking for particle spawn (plane is now drawn on canvas)
    const maxBottom = 80;
    const bottom = Math.min(maxBottom, (mult - 1) * 20);
    const leftOffset = Math.min(80, (mult - 1) * 15);
    const leftPct = 10 + leftOffset;

    // Spawn exhaust particles from canvas plane position
    if (roundActive && mult > 1.05 && ctx) {
      const px = (leftPct / 100) * canvas.width;
      const py = canvas.height - (bottom / 100) * canvas.height;
      spawnExhaust(px - 42, py);
    }

    drawPath(leftPct, bottom, mult);
  };


  const startRound = () => {
    roundActive = true;
    pathPoints = [];
    exhaustParticles.length = 0;
    crashParticles.length = 0;
    if (ctx && canvas) {
      const bg = ctx.createLinearGradient(0,0,0,canvas.height);
      bg.addColorStop(0,'#050810'); bg.addColorStop(1,'#0c0f1e');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    multiplierDisplay.textContent = '1.00x';
    multiplierDisplay.style.color = 'var(--accent-green)';
    flewAwayDisplay.classList.add('hidden');
    
    // Activate waiting panels
    panels.forEach((p, idx) => {
      if (p.status === 'waiting') {
        p.status = 'active';
      }
      renderPanelBtn(idx);
    });

    const lambda = 0.5;
    crashPoint = Math.max(1.01, Math.round((Math.log(1 - Math.random()) * -1 / lambda) * 100) / 100);
    currentMult = 1.0;
    
    const step = () => {
      if (!ctx) return;
      
      if (roundActive) {
        currentMult = Math.round(currentMult * 100) / 100 + 0.01;
        multiplierDisplay.textContent = `${currentMult.toFixed(2)}x`;
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
      } else {
        // Just draw background and stars if waiting
        const w = canvas.width, h = canvas.height;
        const bg = ctx.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, '#050810'); bg.addColorStop(1, '#0c0f1e');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
        
        const t = Date.now() * 0.001;
        stars.forEach(star => {
          const sx = (star.x * w) % w;
          const twinkle = 0.6 + 0.4 * Math.sin(t * star.twinkleSpeed + star.twinklePhase);
          ctx.beginPath(); ctx.arc(sx, star.y*h, star.size*twinkle, 0, Math.PI*2);
          ctx.fillStyle = `rgba(210,225,255,${star.opacity})`; ctx.fill();
        });
      }

      if (roundActive && currentMult >= crashPoint) {
        roundActive = false;
        multiplierDisplay.style.color = 'var(--accent-red)';
        flewAwayDisplay.classList.remove('hidden');
        addHistory(crashPoint);
        // Crash explosion
        triggerExplosion(lastPlaneX, lastPlaneY);
        // Animate crash particles for a moment before stopping
        let explosionFrames = 0;
        const animateCrash = () => {
          if (explosionFrames++ > 60 || !ctx) return;
          if (!ctx) return;
          const w = canvas.width, h = canvas.height;
          const bg = ctx.createLinearGradient(0,0,0,h);
          bg.addColorStop(0,'#050810'); bg.addColorStop(1,'#0c0f1e');
          ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);
          stars.forEach(star => {
            const sx = (star.x * w) % w;
            ctx.beginPath(); ctx.arc(sx, star.y*h, star.size, 0, Math.PI*2);
            ctx.fillStyle = `rgba(210,225,255,${star.opacity})`; ctx.fill();
          });
          for (let i = crashParticles.length-1; i>=0; i--) {
            const p = crashParticles[i];
            p.x+=p.vx; p.y+=p.vy; p.vy+=0.18; p.alpha-=p.decay;
            if (p.alpha<=0){crashParticles.splice(i,1);continue;}
            ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
            ctx.fillStyle=`rgba(${hexToRgb(p.color)},${p.alpha})`; ctx.fill();
          }
          requestAnimationFrame(animateCrash);
        };
        requestAnimationFrame(animateCrash);

        
        // Dim lost fake bets
        fakeBets.forEach(bet => {
          if (!bet.cashedOut && bet.element) {
            bet.element.style.opacity = '0.3';
          }
        });
        
        // Resolve panels
        panels.forEach((p, idx) => {
          if (p.status === 'active' || p.status === 'cashed_out') {
            p.status = 'idle';
          }
          // Auto bet for next round
          if (p.autoBet && p.status === 'idle') {
            const betVal = parseFloat(betInputs[idx].value) || 0;
            if (betVal > 0 && balance >= betVal) {
              p.bet = betVal;
              balance -= p.bet;
              updateBalanceUI();
              p.status = 'waiting';
            }
          }
          renderPanelBtn(idx);
        });
        
        scheduleNextRound();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

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
      input.disabled = false;
    } else if (p.status === 'waiting') {
      mainSpan.textContent = 'CANCEL';
      subSpan.textContent = 'Waiting for next round';
      btn.style.background = '#e6003c';
      input.disabled = true;
    } else if (p.status === 'active') {
      mainSpan.textContent = 'CASH OUT';
      const win = (p.bet * currentMult).toFixed(2);
      subSpan.textContent = `${win} KES`;
      btn.style.background = '#ff9500';
      input.disabled = true;
    } else if (p.status === 'cashed_out') {
      mainSpan.textContent = 'CASHED OUT';
      subSpan.textContent = 'Won!';
      btn.style.background = '#28a745';
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

  updateBalanceUI();
  panels.forEach((_, idx) => renderPanelBtn(idx));
  scheduleNextRound(); // Start the infinite game loop

  // Bridges for auth.js
  window.addToBalance = (amount) => {
    balance += parseFloat(amount) || 0;
    updateBalanceUI();
  };
  // Called by auth.js after login / logout so balance reloads immediately
  window.refreshBalance = () => {
    balance = getGameBalance();
    updateBalanceUI();
  };
});
