# Backoffice PWA audit — 17 October 2026

## Evidence
Production deployment dpl_E55fm2KYrPLYZEGVM3T4LnYmqiCk was READY, assigned to art-essencia.vercel.app, commit 3d724034ca867e053a354893addb00f83e27e560.
Downloaded index.html, app.js, sw.js, version.json and manifest.webmanifest matched that Git revision byte-for-byte. index.html SHA256: f968fe5e5e3d3797645057c930b7dcc0ff05736c0f8192740d3f75fdd140af76.

The main HTML is a self-contained application. It does not load app.js or views.js. Its APP_VERSION was 1.9.5 while version.json announced 1.9.6. The last main-interface revision before the four investigated commits is e7d6a1a. This identifies the preserved code baseline, not proof that every function worked on the user's devices.

| Commit | Effect | Relevance to installed entrypoint |
| --- | --- | --- |
| cedeb3bc | Zones editor in views.js; Cloud RPC wrappers | Editor not loaded by main HTML |
| 7dd4c6d3 | Service-worker cache revision and message handler | Worker changes deployed, but no new editor in HTML |
| 2199f55e | version.json 1.9.6 | Did not change running interface/version label |
| 3d724034 | Reload guard in app.js | app.js not loaded by installed entrypoint |

Thus the missing editor/update behavior is demonstrably an integration failure, not evidence of a failed GitHub→Vercel release. Device-specific stale pages cannot be ruled out until tested on both devices. Existing HTML also deleted almost all Cache Storage entries at startup; worker fallback could serve HTML for failed image requests.

## Correction
Keep the main interface, storage keys, authentication and modules. Integrate zones using the existing authenticated owner RPC contract. Preserve all postal restrictions and inactive zones. Failed reads or unconfirmed saves block further writes until refresh. No API/schema/Cloud configuration change.
Load pwa-update.js from the actual HTML. Register update listener before registration; check release on reconnect, visibility and periodically. Offer an explicit reload button for newer versions instead of reloading unsaved forms. Align HTML and release version at 1.9.7. Keep manifest identity, scope, start URL and icons; remove duplicate manifest link.
Limit worker cache cleanup to known Backoffice caches. Failed precache prevents successful installation. Navigation fetch bypasses HTTP cache. Only navigation can fall back to cached HTML. Keep push/notification handlers.

## Validation
- JavaScript syntax: main inline scripts, updater, worker.
- node scripts/test_pwa_update.cjs: entrypoint/version, existing module anchors, zone read/edit, postal restriction preservation, inactive zone preservation, invalid fees, failed read blocking, cache cleanup scope, offline navigation/resource fallback, retained push handlers.
- node scripts/test_pwa_update_banner.cjs: newer-release notice, no duplicate banner, reconnect check, no automatic reload, button reload.
- scripts/test_backoffice_browser.cjs with Playwright/Chromium: isolated local fixture, all external requests blocked; startup and nine module navigations, mocked zones read/write/error, zero page errors. Tablet 800×1100 and phone 412×915 screenshots inspected.
- DOM execution also exercised startup and those nine modules without errors.
- No real data, orders, zones, shop state or backend were modified by tests.

These checks do not authenticate to the user's Cloud, test real-device passkeys, or prove every workflow. Final acceptance remains pending on Honor Pad 9 and Honor Magic 8 Pro.

## Final device test
Complete/save any work, close the installed app fully, reopen its existing icon online. Do not uninstall, clear storage or reset sessions. Confirm V1.9.7, the familiar interface, clients/orders/stock, and Entregas → Zonas de Entrega da Loja Online. Verify existing zones and tariffs without saving merely for testing. Keep shop closed. Confirm passkey login and visual catalog access. Reopen offline and verify application shell; Cloud functions require connectivity. If a later update notice appears, save work before pressing Carregar atualização.

A pre-existing open page cannot acquire newly added page listeners until navigation/reopening. The existing worker's network-first navigation allows the corrected HTML to load without reinstalling. If reopening does not reach 1.9.7, capture the displayed version and URL before any further intervention.
