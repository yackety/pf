# Flow Steps Reference

Quick reference for all supported steps in `.yml` flow files.
Full details: [SPEC.md §3](./SPEC.md).

---

## App Lifecycle

| Step | YAML | Notes |
|------|------|-------|
| `launchApp` | `- launchApp` | Activates the app without resetting state |
| `restartApp` | `- restartApp` | Terminates then re-launches the app |
| `clearApp` | `- clearApp` | Clears app storage (Android only; iOS does terminate+relaunch) |
| `stopApp` | `- stopApp` | Terminates the app |

---

## Tapping

| Step | YAML | Notes |
|------|------|-------|
| `tapOn` (by text) | `- tapOn: "Submit"` | Finds element by visible text or accessibility label |
| `tapOn` (by testId) | `- tapOn: {testId: "submit-btn"}` | ✅ **Preferred** — maps to `accessibilityIdentifier` (iOS) / `android:id` (Android) |
| `tapOn` (by id) | `- tapOn: {id: "btn_login"}` | Resource-id (Android) or element name (iOS) |
| `tapOn` (by xpath) | `- tapOn: {xpath: "//XCUIElementTypeButton[@name='OK']"}` | ⚠️ Last resort — slow and brittle |
| `longPressOn` | `- longPressOn: "Delete"` | Long-press for 1500 ms |
| `doubleTapOn` | `- doubleTapOn: "Image"` | Double-tap gesture |

---

## Text Input

| Step | YAML | Notes |
|------|------|-------|
| `inputText` | `- inputText: "hello"` | Types into the currently focused field via `setValue` (single round-trip) |
| `clearText` | `- clearText` | Clears the currently focused field |
| `hideKeyboard` | `- hideKeyboard` | Dismisses the soft keyboard |

---

## Scrolling & Swiping

| Step | YAML | Notes |
|------|------|-------|
| `scroll` | `- scroll: down` | Scroll in a direction: `up` \| `down` \| `left` \| `right` |
| `scrollTo` | `- scrollTo: "Terms of Service"` | Scrolls until the named element is visible |
| `swipe` | `- swipe: {from: [500, 1400], to: [500, 400]}` | Pixel-coordinate swipe gesture |

---

## Assertions

| Step | YAML | Notes |
|------|------|-------|
| `assertVisible` | `- assertVisible: "Welcome"` | Fails if the element is not found within `timeout` |
| `assertNotVisible` | `- assertNotVisible: "Error"` | Fails if the element IS found |
| `assertChecked` | `- assertChecked: "Remember me"` | Fails if the toggle/checkbox is not checked |
| `assertEqual` | `- assertEqual: {id: "label", value: "OK"}` | Fails if the element's text does not equal `value` |

---

## Waiting

| Step | YAML | Notes |
|------|------|-------|
| `waitForVisible` | `- waitForVisible: "Dashboard"` | Blocks until element appears — does not fail; use as a sync point before dependent steps |
| `waitForNotVisible` | `- waitForNotVisible: "Loading..."` | Blocks until element disappears — **preferred over `wait`** |
| `wait` | `- wait: 1500` | ⚠️ Hard pause in ms — use only when there is no observable UI signal |

---

## Device & Host

| Step | YAML | Notes |
|------|------|-------|
| `back` | `- back` | Android BACK keycode / iOS native back gesture |
| `home` | `- home` | Presses the HOME button |
| `screenshot` | `- screenshot: after-login` | Jest: `e2e/screenshots/<runId>/after-login.png` · API: `artifacts/<runId>/screenshots/after-login.png` |
| `runScript` | `- runScript: scripts/seed.sh` | Runs a shell script on the host machine; stdout/stderr captured in step result |

---

## Variable Interpolation

Any string value in a step can reference a variable using `$VAR` or `${VAR}` syntax.
Variables are resolved in this order: `header.env` → `process.env`.

```yaml
env:
  USERNAME: testuser
  HOST: staging.example.com
---
- tapOn: "Username"
- inputText: "$USERNAME"
- tapOn: {testId: "url-input"}
- inputText: "https://${HOST}/login"
```

---

## Selector Priority (for text-based steps)

When a step uses a plain string (e.g. `tapOn: "Submit"`), the runner tries these strategies in order and stops at the first match:

| # | Strategy | Android | iOS |
|---|----------|---------|-----|
| 1 | Cached (self-healing) | last known winning selector | same |
| 2 | `testId` | `appId:id/testId` | `~testId` |
| 3 | `id` | `appId:id/resId` | `~name` |
| 4 | Accessibility label | `~text` | `~text` |
| 5 | UiSelector text | `-android uiautomator: new UiSelector().text("…")` | — |
| 6 | iOS predicate | — | `-ios predicate string: label == "…"` |
| 7 | XPath | `//*[@text='…' or @content-desc='…']` | `//*[@label='…']` |
| 8 | OCR fallback | screenshot → tesseract → tap centroid | same |

---

## Full Example

> **`udid` must not appear in committed flow files.**
> Supply it at runtime via: `DEVICE_UDID=<udid>` env var (Jest), `"udid": "..."` in the POST body (API),
> or omit it entirely to let the device pool allocate a free device by `platform` + `tags`.

```yaml
appId: com.example.app
platform: ios
name: Login Flow
tags: [ios17]       # pool selects a free iOS 17 device — no udid here
timeout: 10000
retries: 1
stepRetries: 2
video: true
env:
  USERNAME: testuser
  PASSWORD: password123
---
- launchApp
- waitForVisible: "Username"
- tapOn: "Username"
- inputText: "$USERNAME"
- tapOn: "Password"
- inputText: "$PASSWORD"
- tapOn: {testId: "submit-btn"}
- waitForNotVisible: "Logging in..."
- assertVisible: "Welcome"
- screenshot: logged-in
```
