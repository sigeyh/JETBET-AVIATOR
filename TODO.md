# TODO (JetBet: Aviator + Auth + PayHero Deposit)

- [ ] Add backend Express server scaffold under `backend/` (JWT auth, user model, balance storage).
- [ ] Implement `POST /api/auth/register` and `POST /api/auth/login`.
- [ ] Implement `POST /api/deposits/stkpush` to call PayHero using Basic Auth and required fields (amount, phone_number, channel_id, provider, external_reference, customer_name, callback_url).
- [ ] Implement `POST /api/deposits/payhero/callback` to credit balance only if `paymentSuccess === true`.
- [ ] Fix/prepare React frontend to call backend with JWT (`Authorization: Bearer ...`).
- [ ] Update React UI: show Login/Register modal/screen only when user clicks Deposit (or wants real play if unauthenticated).
- [ ] Update React UI: Deposit modal (amount + phone) and calls backend `/api/deposits/stkpush`.
- [ ] Persist auth token in localStorage and restore on page load.
- [ ] Quick mobile testing pass: layout, modal usability, button tap sizes.

