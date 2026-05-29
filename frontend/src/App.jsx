import { useEffect, useRef, useState } from 'react';
import './App.css';
import './aviator.css';


function App() {
  // Refs
  const canvasRef = useRef(null);
  const planeRef = useRef(null);
  const multiplierDisplayRef = useRef(null);

  // Game state variables
  const [balance, setBalance] = useState(17055.29);
  const [currentBet, setCurrentBet] = useState(0);
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(false);
  const [autoCashoutTarget, setAutoCashoutTarget] = useState(1.5);
  const [roundActive, setRoundActive] = useState(false);
  const [crashPoint, setCrashPoint] = useState(0);
  const [history, setHistory] = useState([]);
  const [cashoutOccurred, setCashoutOccurred] = useState(false);
  const [multiplierAtCashout, setMultiplierAtCashout] = useState(0);

  // Helper: format numbers
  const fmt = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Initialize static canvas background
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
    setCurrentBet((b) => b); // keep bet

    // Generate crash point
    const lambda = 0.5;
    const cp = Math.max(1.01, Math.round((Math.log(1 - Math.random()) * -1 / lambda) * 100) / 100);
    setCrashPoint(cp);

    let mult = 1.0;
    const step = () => {
      if (!roundActive) return;
      mult = Math.round((mult * 100) + 1) / 100;

      // Update UI refs
      if (multiplierDisplayRef.current) {
        multiplierDisplayRef.current.textContent = `${mult.toFixed(2)}x`;
      }
      updatePlanePosition(mult);

      // Auto cashout
      if (autoCashoutEnabled && mult >= autoCashoutTarget) {
        cashout(mult);
        return;
      }

      // Crash
      if (mult >= cp) {
        endRound(cp);
        return;
      }

      requestAnimationFrame(step);
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
  };

  const scheduleNextRound = () => {
    setTimeout(() => {
      setCashoutOccurred(false);
      setMultiplierAtCashout(0);
      startRound();
    }, 3000);
  };

  // Betting UI handlers (simplified)
  const placeBet = (panelIdx) => {
    if (roundActive) return;
    const betVal = parseFloat(document.getElementById(`betInput${panelIdx}`).value) || 0;
    if (betVal <= 0) return;

    setCurrentBet(betVal);

    setAutoCashoutEnabled(document.getElementById(`autoCashoutToggle${panelIdx}`).checked);
    setAutoCashoutTarget(parseFloat(document.getElementById(`autoCashoutInput${panelIdx}`).value) || 1.5);

    // start the round
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
            Balance: <span className="currency">$</span>
            {fmt(balance)}
          </div>
          <div className="history-bar">
            {history.map((v, i) => (
              <div
                key={i}
                className="pill"
                style={{ background: cashoutOccurred && multiplierAtCashout >= v ? '#1dbb4d' : '#ff4d4f' }}
              />
            ))}
          </div>
        </section>

        <section className="game-view">
          <canvas id="gameCanvas" ref={canvasRef} />
          <div className="multiplier-center" ref={multiplierDisplayRef}>
            1.00x
          </div>
          <div id="flewAwayDisplay" className="hidden">
            🚀 Crashed!
          </div>
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
                  <input id={`autoBetToggle${panel}`} type="checkbox" disabled />
                </div>
                <div className="auto-row">
                  <label>Auto‑cashout</label>
                  <input id={`autoCashoutToggle${panel}`} type="checkbox" />
                  <input
                    id={`autoCashoutInput${panel}`}
                    type="number"
                    defaultValue="1.5"
                    step="0.1"
                    style={{ width: '60px' }}
                  />
                </div>
              </div>

              <button className="action-btn" onClick={() => placeBet(panel)}>
                {roundActive ? 'Cashout' : 'Bet'}
              </button>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

export default App;

