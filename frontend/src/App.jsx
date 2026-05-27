import { useState, useEffect, useRef } from 'react';
import './style.css';
import './aviator.css';


function App() {
  // Refs
  const canvasRef = useRef(null);
  const planeRef = useRef(null);
  const multiplierDisplayRef = useRef(null);

  // Game state variables
  const [balance, setBalance] = useState(17055.29);
  const [currentBet, setCurrentBet] = useState(0);
  const [autoBetEnabled, setAutoBetEnabled] = useState(false);
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(false);
  const [autoCashoutTarget, setAutoCashoutTarget] = useState(1.5);
  const [roundActive, setRoundActive] = useState(false);
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(0);
  const [history, setHistory] = useState([]);
  const [cashoutOccurred, setCashoutOccurred] = useState(false);
  const [multiplierAtCashout, setMultiplierAtCashout] = useState(0);

  // Helper: format numbers
  const fmt = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Initialize static canvas background (same as original script)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
      ctx.fillStyle = '#1a1c21';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Plane position updater – mirrors original updatePlanePosition
  const updatePlanePosition = (mult) => {
    const plane = planeRef.current;
    if (!plane) return;
    const maxBottom = 80; // percent
    const bottom = Math.min(maxBottom, (mult - 1) * 20);
    plane.style.bottom = `${bottom}%`;
  };

  // Game loop – called when a round starts
  const startRound = () => {
    setRoundActive(true);
    setCurrentBet(0);
    setMultiplier(1.0);
    setCashoutOccurred(false);
    setMultiplierAtCashout(0);
    // Generate exponential crash point
    const lambda = 0.5;
    const cp = Math.max(1.01, Math.round((Math.log(1 - Math.random()) * -1 / lambda) * 100) / 100);
    setCrashPoint(cp);
    // Kick off animation
    const step = () => {
      if (!roundActive) return;
      setMultiplier((prev) => {
        const next = Math.round(prev * 100) / 100 + 0.01;
        // Update UI refs
        if (multiplierDisplayRef.current) {
          multiplierDisplayRef.current.textContent = `${next.toFixed(2)}x`;
        }
        updatePlanePosition(next);
        // Auto cashout
        if (autoCashoutEnabled && next >= autoCashoutTarget) {
          cashout(next);
          return next;
        }
        // Crash
        if (next >= cp) {
          endRound(cp);
          return next;
        }
        requestAnimationFrame(step);
        return next;
      });
    };
    requestAnimationFrame(step);
  };

  const cashout = (mult) => {
    if (!roundActive) return;
    setRoundActive(false);
    const win = currentBet * mult;
    setBalance((b) => b + win);
    setCashoutOccurred(true);
    setMultiplierAtCashout(mult);
    // Record history and schedule next round
    addHistory(crashPoint);
    scheduleNextRound();
  };

  const endRound = (cp) => {
    setRoundActive(false);
    // Lose bet if placed
    if (currentBet > 0) {
      setBalance((b) => b - currentBet);
    }
    addHistory(cp);
    scheduleNextRound();
  };

  const addHistory = (crash) => {
    setHistory((h) => {
      const newHist = [crash, ...h];
      return newHist.slice(0, 10);
    });
    // UI re‑enable handled by scheduleNextRound below
  };

  const scheduleNextRound = () => {
    // Simple 3‑second wait before starting next round
    setTimeout(() => {
      startRound();
    }, 3000);
  };

  // Betting UI handlers (simplified)
  const placeBet = (panelIdx) => {
    if (roundActive) return;
    const betVal = parseFloat(document.getElementById(`betInput${panelIdx}`).value) || 0;
    if (betVal <= 0) return;
    setCurrentBet(betVal);
    // Auto settings (checkboxes)
    setAutoBetEnabled(document.getElementById(`autoBetToggle${panelIdx}`).checked);
    setAutoCashoutEnabled(document.getElementById(`autoCashoutToggle${panelIdx}`).checked);
    setAutoCashoutTarget(parseFloat(document.getElementById(`autoCashoutInput${panelIdx}`).value) || 1.5);
    startRound();
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">Aviator</div>
      </header>
      <main className="aviator-main">
        <section className="aviator-header">
          <div className="balance-display">
            Balance: <span className="currency">$</span>{fmt(balance)}
          </div>
          <div className="history-bar">
            {history.map((v, i) => (
              <div key={i} className="pill" style={{ background: cashoutOccurred && multiplierAtCashout >= v ? '#1dbb4d' : '#ff4d4f' }} />
            ))}
          </div>
        </section>
        <section className="game-view">
          <canvas id="gameCanvas" ref={canvasRef} />
          <div className="multiplier-center" ref={multiplierDisplayRef}>1.00x</div>
          <div id="flewAwayDisplay" className="hidden">🚀 Crashed!</div>
          <div id="plane" className="plane" ref={planeRef} />
        </section>
        <section className="controls-area">
          {[1, 2].map((panel) => (
            <div key={panel} className="bet-panel">
              <div className="bet-input-row">
                <label>Bet $</label>
                <input id={`betInput${panel}`} type="number" className="bet-amount" defaultValue="0" />
              </div>
              <div className="auto-settings">
                <div className="auto-row">
                  <label>Auto‑bet</label>
                  <input id={`autoBetToggle${panel}`} type="checkbox" />
                </div>
                <div className="auto-row">
                  <label>Auto‑cashout</label>
                  <input id={`autoCashoutToggle${panel}`} type="checkbox" />
                  <input id={`autoCashoutInput${panel}`} type="number" defaultValue="1.5" step="0.1" style={{ width: '60px' }} />
                </div>
              </div>
              <button className="action-btn" onClick={() => placeBet(panel)}>{roundActive ? 'Cashout' : 'Bet'}</button>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

export default App;

import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.jsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <button
          type="button"
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
