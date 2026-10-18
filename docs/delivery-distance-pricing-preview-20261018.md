# Delivery pricing configuration — Preview

Adds a separate card in the existing delivery settings, using the existing owner
save RPC and existing shopDelivery JSON. No new locality, customer, stock or
order structures. All numeric pricing parameters are editable. Enabling pricing
is separate from opening the shop, global delivery activation and zone activation.
The exact origin and API/signing keys are never included in the PWA.

Confirmed defaults: Castelejo EUR 1; 16.3 kWh/100km; EUR 0.20/kWh; charging
factor 1.10; EUR 0.10/km wear; EUR 8/hour; five-minute stop. The displayed
route/fee ceilings are refusal safeguards for administrator review.

Browser component tests passed at 412 and 1280 pixels. They verify defaults,
manual edits, blank-field rejection, separate activation and no horizontal
scroll. JavaScript syntax passes. APP_VERSION, version.json and service worker
cache use 1.9.9-preview together; no local storage or IndexedDB clearing added.

Backend contract was installed with pricing still disabled and shop closed.
The companion shop branch verifies signed fees again inside existing SQL order
submission and preserves vouchers/idempotency. The old manual zone tariffs remain
stored and work while automatic mode is off.

This is a Preview change. Final release requires real exact-house geocoder
coverage and installed-device verification. Do not merge as a completed release
merely because this Preview builds.
