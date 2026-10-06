# Commercial device model resolution

The collection keeps the raw technical model identifier and resolves it server-side.

## Source

The application uses `@naverpay/device-info` 1.2.1. Its Android and iOS catalogs map device identifiers to user-friendly marketing names; the package documents weekly updates and MIT licensing. Android data is sourced from Google Play Supported Devices and iOS data from The Apple Wiki.

## Stored fields

- `device_model`: raw technical identifier collected by the browser.
- `device_model_name`: resolved commercial/marketing name when an exact catalog match exists.
- `device_model_confidence`: `exact`, `unknown`, or `unavailable`.

The raw identifier is never overwritten.

## Important browser limitation

Android Chromium can expose the model through User-Agent Client Hints, which allows identifiers such as `SM-S901B` to be resolved.

A normal iPhone browser does not expose the internal Apple identifier such as `iPhone15,4` through a standard web API. Therefore the Apple catalog is implemented as a resolver for cases where such an identifier is available, but the collector does not fabricate an iPhone model from screen dimensions or other ambiguous signals.

## Examples

- `SM-S901B` -> `Galaxy S22`
- `SM-G991B` -> `Galaxy S21 5G`
- `iPhone14,2` -> `iPhone 13 Pro` when that identifier is supplied.
