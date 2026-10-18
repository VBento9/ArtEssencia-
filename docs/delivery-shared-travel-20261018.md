# Delivery contributions for grouped routes

The exclusive-trip model charged each order the entire outbound and return journey. This overstates each customer's contribution when deliveries are grouped.

An optional administrator field routeShareCount (integer 1–20) now splits energy, wear and driving-time cost; the delivery stop remains per order. One final upward cent rounding is applied. Castelejo remains fixed at EUR 1. Actual building coordinates and both road legs are still verified; this is not a flat locality tariff.

The input is a business estimate, NOT a count of confirmed orders, a route optimizer or automatic same-building grouping. Every checkout receives a fixed quote using current settings. With fewer orders than estimated, the merchant absorbs the difference; with more orders, contributions may exceed the allocated travel cost. No promise of exact cost recovery is made. No retroactive price changes.

Preview new-configuration hypothesis: 3 deliveries per departure, editable. Older saved configurations without the field keep factor 1; older Backoffice editors preserve an existing sharing factor. Disabled settings remain disabled.

For the verified Fundão building route (17423 metres, 1394 driving seconds), previously agreed cost parameters produce EUR 6.14 at factor 1, EUR 3.40 at factor 2, EUR 2.49 at factor 3. The EUR 2.49 scenario is not an activated production tariff.

Validation: 70 automated checks passed, plus Backoffice and checkout browser scenarios at widths 412 and 1280. SQL independently recomputes the shared fee, rejects factor changes against signed quotes, validates integer bounds and preserves settings saved from an older editor.

Applied database change: delivery_shared_travel_optional_factor_preserve_settings. Replaced two existing private helpers and the existing owner settings-save RPC; no new table or public RPC. Verified live pure-validator accepts factor 3, private fee function remains inaccessible to anon, voucher order-v2 hash unchanged. Before/after full shop-settings hash is identical. BO orders 7, clients 13; shop orders/customers 0. Shop and fulfillment remain disabled. No real records, zone data or tariff settings were written.

Frontends remain on draft branches, pending final production release and installed-device checks. Release and rollback scripts are provided beside the existing SQL contract; the upgrade has reviewed-function hashes and shop-closure guards. Rollback restores the previous helper/save definitions and also requires a closed shop.
