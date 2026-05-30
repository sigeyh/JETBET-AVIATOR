/* =============================================
   AUTH & DEPOSIT LOGIC — JETBET
   auth.js loads AFTER script.js
   ============================================= */

(function () {
  'use strict';

  /* ===== UTILS ===== */
  const $ = id => document.getElementById(id);
  const show = el => el && el.classList.remove('hidden');
  const hide = el => el && el.classList.add('hidden');
  const setError = (el, msg) => {
    if (!el) return;
    if (typeof msg === 'object') msg = msg.error || msg.message || JSON.stringify(msg);
    el.textContent = msg;
    el.classList.toggle('hidden', !msg);
  };
  const sleep = ms => new Promise(res => setTimeout(res, ms));

  /* ===== USER STORE (localStorage) ===== */
  const USERS_KEY = 'jetbet_users';
  const SESSION_KEY = 'jetbet_session';

  const getUsers = () => JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  const saveUsers = users => localStorage.setItem(USERS_KEY, JSON.stringify(users));
  const getSession = () => JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  const saveSession = user => localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  const clearSession = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('jetbet_jwt');
  };

  /* ===== MODALS ===== */
  const authModal = $('authModal');
  const depositModal = $('depositModal');
  const headerRight = $('headerRight');

  const openModal = modal => modal && modal.classList.add('active');
  const closeModal = modal => modal && modal.classList.remove('active');

  // Close on overlay click
  [authModal, depositModal].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal(modal);
    });
  });

  /* ===== HEADER STATE ===== */
  const renderHeader = () => {
    const user = getSession();
    // backend JWT token storage
    const jwt = localStorage.getItem('jetbet_jwt');

    if (!headerRight) return;
    if (user) {
      const initial = (user.name || user.phone || '?').charAt(0).toUpperCase();
      headerRight.innerHTML = `
        <div class="user-chip">
          <div class="chip-avatar">${initial}</div>
        </div>
        <button class="header-btn btn-deposit-header" id="depositHeaderBtn">💳 Deposit</button>
        <button class="header-btn btn-logout" id="logoutBtn">Logout</button>
      `;
      $('depositHeaderBtn')?.addEventListener('click', () => openDepositModal());
      $('logoutBtn')?.addEventListener('click', () => {
        clearSession();
        renderHeader();
        // Switch back to demo balance
        if (typeof window.refreshBalance === 'function') window.refreshBalance();
      });
    } else {
      headerRight.innerHTML = `
        <button class="header-btn btn-login" id="loginBtn">Login</button>
        <button class="header-btn btn-register" id="registerBtn">Register</button>
      `;
      $('loginBtn')?.addEventListener('click', () => {
        showAuthTab('login');
        openModal(authModal);
      });
      $('registerBtn')?.addEventListener('click', () => {
        showAuthTab('register');
        openModal(authModal);
      });
    }
  };

  /* ===== AUTH TABS ===== */
  const loginForm = $('loginForm');
  const registerForm = $('registerForm');
  const tabLogin = $('tabLogin');
  const tabRegister = $('tabRegister');

  const showAuthTab = tab => {
    if (tab === 'login') {
      show(loginForm); hide(registerForm);
      tabLogin?.classList.add('active');
      tabRegister?.classList.remove('active');
    } else {
      hide(loginForm); show(registerForm);
      tabRegister?.classList.add('active');
      tabLogin?.classList.remove('active');
    }
  };

  tabLogin?.addEventListener('click', () => showAuthTab('login'));
  tabRegister?.addEventListener('click', () => showAuthTab('register'));

  $('switchToRegister')?.addEventListener('click', e => { e.preventDefault(); showAuthTab('register'); });
  $('switchToLogin')?.addEventListener('click', e => { e.preventDefault(); showAuthTab('login'); });

  /* ===== CLOSE BUTTONS ===== */
  $('closeAuthModal')?.addEventListener('click', () => closeModal(authModal));
  $('closeDepositModal')?.addEventListener('click', () => closeModal(depositModal));

  /* ===== PASSWORD VISIBILITY ===== */
  document.querySelectorAll('.show-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = $(btn.dataset.target);
      if (!target) return;
      const isText = target.type === 'text';
      target.type = isText ? 'password' : 'text';
      btn.textContent = isText ? '👁' : '🙈';
    });
  });

  /* ===== REGISTER ===== */
  $('registerSubmit')?.addEventListener('click', async () => {
    const name = $('regName')?.value.trim();
    const phone = $('regPhone')?.value.trim().replace(/\s+/g, '');
    const password = $('regPassword')?.value;
    const confirm = $('regConfirm')?.value;
    const terms = $('regTerms')?.checked;
    const errEl = $('regError');

    setError(errEl, '');

    if (!name) return setError(errEl, 'Please enter your full name.');
    if (!phone || phone.length < 9) return setError(errEl, 'Enter a valid phone number.');
    if (!password || password.length < 6) return setError(errEl, 'Password must be at least 6 characters.');
    if (password !== confirm) return setError(errEl, 'Passwords do not match.');
    if (!terms) return setError(errEl, 'You must accept the Terms & Conditions.');

    const users = getUsers();
    if (users.find(u => u.phone === phone)) return setError(errEl, 'This phone number is already registered.');

    const btn = $('registerSubmit');
    btn.classList.add('loading');
    btn.textContent = 'Creating Account…';

    try {
      const API_BASE = window.JETBET_API_BASE || (window.location.port === '5500' ? 'http://localhost:4000' : window.location.origin);
      
      const resp = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: phone, password }) // Using phone as username for backend
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Registration failed');

      console.log('[auth] Register success, received token:', !!data.token);

      // Save locally (Legacy sync)
      const user = { name, phone, password, balance: 0, createdAt: Date.now() };
      users.push(user);
      saveUsers(users);
      saveSession({ name, phone });

      if (data.token) {
        localStorage.setItem('jetbet_jwt', data.token);
      }

      btn.classList.remove('loading');
      btn.textContent = 'Create Account';
      closeModal(authModal);
      renderHeader();
      if (typeof window.refreshBalance === 'function') window.refreshBalance();
    } catch (e) {
      btn.classList.remove('loading');
      btn.textContent = 'Create Account';
      return setError(errEl, e.message);
    }
  });

  /* ===== LOGIN ===== */
  $('loginSubmit')?.addEventListener('click', async () => {
    const identifier = $('loginPhone')?.value.trim();
    const password = $('loginPassword')?.value;
    const errEl = $('loginError');


    setError(errEl, '');

    if (!identifier) return setError(errEl, 'Enter your phone or email.');
    if (!password) return setError(errEl, 'Enter your password.');

    const btn = $('loginSubmit');
    btn.classList.add('loading');
    btn.textContent = 'Logging in…';
    await sleep(800);

    const users = getUsers();
    const user = users.find(u => (u.phone === identifier || u.email === identifier) && u.password === password);

    btn.classList.remove('loading');
    btn.textContent = 'Login';

    if (!user) return setError(errEl, 'Invalid credentials. Please try again.');

    saveSession({ name: user.name, phone: user.phone });

    // backend JWT token (used for deposits)
    try {
      const API_BASE = window.JETBET_API_BASE || (window.location.port === '5500' ? 'http://localhost:4000' : window.location.origin);

      const resp = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.phone, password })
      });

      const data = await resp.json().catch(() => ({}));
      console.log('[auth] Backend login response:', data);
      if (resp.ok && data?.token) {
        localStorage.setItem('jetbet_jwt', data.token);
        console.log('[auth] JWT token saved.');
      } else {
        console.error('[auth] Login succeeded locally but backend failed:', data);
      }
    } catch (e) {
      console.warn('Backend login failed, payments might be unavailable', e);
    }

    closeModal(authModal);
    renderHeader();
    if (typeof window.refreshBalance === 'function') window.refreshBalance();
  });





  /* ===== DEPOSIT ===== */
  const openDepositModal = () => {
    // Pre-fill phone from session
    const user = getSession();
    if (user?.phone) {
      const dpPhone = $('depositPhone');
      if (dpPhone) dpPhone.value = user.phone;
    }
    resetDepositUI();
    openModal(depositModal);
  };

  const resetDepositUI = () => {
    hide($('stkPending'));
    hide($('depositSuccess'));
    show($('depositSubmit'));
    show($('depositQuickAmounts'));
    const form = depositModal?.querySelectorAll('.form-group');
    form?.forEach(fg => show(fg));
    show(depositModal?.querySelector('.mpesa-logo'));
    setError($('depositError'), '');
    // clear selected
    document.querySelectorAll('.d-amt-btn').forEach(b => b.classList.remove('selected'));
    if ($('depositAmount')) $('depositAmount').value = '';
  };

  // Quick amount buttons
  document.querySelectorAll('.d-amt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.d-amt-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const amtInput = $('depositAmount');
      if (amtInput) amtInput.value = btn.dataset.amount;
    });
  });

  $('depositSubmit')?.addEventListener('click', async () => {
    const amount = parseFloat($('depositAmount')?.value);
    const phone = $('depositPhone')?.value.trim().replace(/\s+/g, '');
    const errEl = $('depositError');

    setError(errEl, '');

    // Gate: only proceed if the M-Pesa number is filled.
    // This prevents the flow from reaching the payments/JWT checks
    // when the phone field is empty.
    if (!phone || typeof phone !== 'string' || phone.length < 9) {
      return setError(errEl, 'Enter your M-Pesa number.');
    }

    if (!Number.isFinite(amount) || amount < 50) {
      return setError(errEl, 'Minimum deposit is KES 50.');
    }


    const session = getSession();
    const jwt = localStorage.getItem('jetbet_jwt');

    console.log('[deposit] session?', !!session, 'jwt?', !!jwt, 'origin:', window.location.origin);

    if (!session) {
      return setError(errEl, 'Please login to continue.');
    }
    if (!jwt) {
      return setError(errEl, 'Payment token missing. Please log out and log in again.');
    }



    // Send real PayHero STK Push request
    const btn = $('depositSubmit');
    btn.classList.add('loading');
    btn.textContent = 'Sending STK Push…';

    // Convert input like 0723010578 -> 254723010578 (MSISDN) because PayHero typically expects country prefix.
    const normalizedPhone = phone.startsWith('0') ? `254${phone.slice(1)}` : phone;

    const payload = {
      amount,
      phone: normalizedPhone,
      customerName: session.name || session.phone,
      // Explicitly send channel/provider so backend request matches the working manual test
      channelId: Number(localStorage.getItem('jetbet_payhero_channel_id') || 6770),
      provider: 'm-pesa'
    };

    try {
      // Determine backend URL (handle port mismatch)
      const API_BASE = window.JETBET_API_BASE || (window.location.port === '5500' ? 'http://localhost:4000' : window.location.origin);
      
      const resp = await fetch(`${API_BASE}/api/deposits/stkpush`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify(payload)
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || data?.message || 'STK Push failed');
      }

      // Persist reference for optional manual polling/UX
      if (data?.reference) {
        localStorage.setItem('jetbet_last_deposit_reference', data.reference);
      }

      btn.classList.remove('loading');
      btn.textContent = 'Deposit via M-Pesa';

      // Show STK pending UI
      hide($('depositSubmit'));
      const form = depositModal?.querySelectorAll('.form-group');
      form?.forEach(fg => hide(fg));
      hide($('depositQuickAmounts'));
      hide(depositModal?.querySelector('.mpesa-logo'));
      show($('stkPending'));
    } catch (e) {
      btn.classList.remove('loading');
      btn.textContent = 'Deposit via M-Pesa';
      return setError(errEl, e?.message || 'Failed to send STK Push');
    }
  });

  $('stkConfirm')?.addEventListener('click', async () => {
    const amount = parseFloat($('depositAmount')?.value);
    const btn = $('stkConfirm');
    btn.classList.add('loading');
    btn.textContent = 'Verifying…';
    await sleep(1500);
    btn.classList.remove('loading');
    btn.textContent = 'Confirm Payment';

    // Update balance in localStorage for the user
    const session = getSession();
    if (session) {
      const users = getUsers();
      const idx = users.findIndex(u => u.phone === session.phone);
      if (idx > -1) {
        users[idx].balance = (users[idx].balance || 0) + amount;
        saveUsers(users);
      }
      // Update game balance via global variable (script.js exposes it on window)
      if (typeof window.addToBalance === 'function') {
        window.addToBalance(amount);
      } else {
        // fallback: update localStorage balance directly
        const current = parseFloat(localStorage.getItem('balance')) || 0;
        localStorage.setItem('balance', (current + amount).toString());
        // Also update the DOM balance display directly
        const balEl = document.getElementById('balance');
        if (balEl) {
          const newBal = current + amount;
          balEl.textContent = newBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
      }
    }

    // Show success
    hide($('stkPending'));
    const successMsg = $('successMsg');
    if (successMsg) successMsg.textContent = `KES ${amount.toLocaleString()} has been added to your balance.`;
    show($('depositSuccess'));
  });

  $('stkCancel')?.addEventListener('click', () => resetDepositUI());

  $('depositDone')?.addEventListener('click', () => {
    closeModal(depositModal);
    resetDepositUI();
  });

  /* ===== WITHDRAWAL ===== */
  const withdrawModal = $('withdrawModal');

  const openWithdrawModal = () => {
    // Pre-fill phone from session
    const user = getSession();
    if (user?.phone) {
      const wdPhone = $('withdrawPhone');
      if (wdPhone) wdPhone.value = user.phone;
    }
    resetWithdrawUI();
    openModal(withdrawModal);
  };

  const resetWithdrawUI = () => {
    hide($('withdrawPending'));
    hide($('withdrawSuccess'));
    show($('withdrawSubmit'));
    const form = withdrawModal?.querySelectorAll('.form-group');
    form?.forEach(fg => show(fg));
    show(withdrawModal?.querySelector('.mpesa-logo'));
    setError($('withdrawError'), '');
    if ($('withdrawAmount')) $('withdrawAmount').value = '';
  };

  $('withdrawSubmit')?.addEventListener('click', async () => {
    const amount = parseFloat($('withdrawAmount')?.value);
    const phone = $('withdrawPhone')?.value.trim().replace(/\s+/g, '');
    const errEl = $('withdrawError');

    setError(errEl, '');

    if (!phone || phone.length < 9) {
      return setError(errEl, 'Enter your M-Pesa number.');
    }

    if (!Number.isFinite(amount) || amount < 200) {
      return setError(errEl, 'Minimum withdrawal is KES 200.');
    }

    const session = getSession();
    if (!session) {
      return setError(errEl, 'Please login to continue.');
    }

    // Check user balance
    const users = getUsers();
    const userIdx = users.findIndex(u => u.phone === session.phone);
    const currentBalance = userIdx > -1 ? (users[userIdx].balance || 0) : 0;

    if (amount > currentBalance) {
      return setError(errEl, `Insufficient balance. Your balance is KES ${currentBalance.toLocaleString()}.`);
    }

    const btn = $('withdrawSubmit');
    btn.classList.add('loading');
    btn.textContent = 'Processing...';

    // Simulate backend processing
    hide($('withdrawSubmit'));
    const form = withdrawModal?.querySelectorAll('.form-group');
    form?.forEach(fg => hide(fg));
    hide(withdrawModal?.querySelector('.mpesa-logo'));
    show($('withdrawPending'));

    await sleep(2500);

    // Update balance
    if (userIdx > -1) {
      users[userIdx].balance -= amount;
      saveUsers(users);
    }
    
    // Update game balance via global variable
    if (typeof window.addToBalance === 'function') {
      window.addToBalance(-amount);
    }

    hide($('withdrawPending'));
    const successMsg = $('withdrawSuccessMsg');
    if (successMsg) successMsg.textContent = `KES ${amount.toLocaleString()} has been sent to ${phone}. Transaction successful!`;
    show($('withdrawSuccess'));
  });

  $('withdrawDone')?.addEventListener('click', () => {
    closeModal(withdrawModal);
    resetWithdrawUI();
  });

  $('closeWithdrawModal')?.addEventListener('click', () => closeModal(withdrawModal));

  // Add event listener to modal overlay for closing
  withdrawModal?.addEventListener('click', e => {
    if (e.target === withdrawModal) closeModal(withdrawModal);
  });

  // Expose openWithdrawModal to window so script.js can call it
  window.openWithdrawModal = openWithdrawModal;

  /* ===== INIT ===== */
  renderHeader();

})();
