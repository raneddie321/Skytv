# TV remote & keyboard mapping

All input is normalised by `src/navigation/keymap.ts` into semantic actions, then handled by the spatial focus
manager (`src/navigation/FocusManager.ts`). The app is fully usable without a mouse.

## Actions

| Action | Browser / keyboard | Android TV (WebView) | Samsung Tizen | LG webOS |
|---|---|---|---|---|
| Up / Down / Left / Right | Arrow keys | D-pad (keyCode 19–22 → arrows 38/40/37/39) | 38 / 40 / 37 / 39 | 38 / 40 / 37 / 39 |
| OK / Enter | Enter | DPAD_CENTER (23), Enter (13) | 13 | 13 |
| Back | Escape, Backspace¹ | KEYCODE_BACK (4) or `tvback` event² | Return 10009 | Back 461 |
| Play/Pause | MediaPlayPause, Space | 85 / 179 | 10252 | — |
| Play | MediaPlay | 126 | 415 | 415 |
| Pause | MediaPause | 127 | 19 | 19 |
| Stop | MediaStop | 86 | 413 | 413 |
| Rewind / Fast-forward | MediaRewind / MediaFastForward | 89 / 90 | 412 / 417 | 412 / 417 |
| Next | MediaTrackNext | — | — | — |
| Channel up / down | PageUp / PageDown, ChannelUp / ChannelDown | 166 / 167 | 427 / 428 | 33 / 34 |
| Digits 0–9 | 0–9 | 7–16 → '0'–'9' | 48–57 | 48–57 |
| Info | Info | — | 457 | 457 |
| Colour keys | — | — | 403–406 | 403–406 |

¹ Backspace acts as Back only when the current screen doesn't consume it (search and name entry use it to delete).
² `KEYCODE_BACK` is delivered to the Android Activity, not the WebView. The native wrapper must forward it, e.g.
`webView.evaluateJavascript("window.dispatchEvent(new Event('tvback'))", null)` in `onBackPressed`, and only call
`finish()` when the app reports it is on the profile screen.

Platform detection (`detectPlatform`) uses the user agent (`Tizen`, `Web0S`/`webOS`, Android + TV markers).
On Tizen, media/colour/number keys are delivered only after registration — `registerPlatformKeys('tizen')` calls
`tizen.tvinputdevice.registerKeyBatch` at start-up (requires the `http://tizen.org/privilege/tv.inputdevice`
privilege in `config.xml`).

## Behaviour

- **Focus model**: real DOM focus (`tabIndex=-1`) plus `data-focused="true"` for styling. White focus ring / white pill.
- **Movement**: geometric nearest neighbour in the pressed direction. Vertical moves land on the item under the
  current item's centre (this also gives correct EPG behaviour across programmes of different lengths).
- **Sections** (rows, grids, toolbars) remember their last focused item; re-entering a row restores it.
- **Navigation bar** returns focus to where you came from and never traps focus.
- **Layers** (dialogs, PIN pad, subtitle menu) confine focus and restore the previous focus when closed.
- **Screen memory**: the last focused element per screen is restored on Back, together with scroll position.
- **Scrolling** follows focus: rows scroll horizontally (`data-scroll-x`), the page scrolls vertically so the whole
  row (title + cards) is visible (`data-scroll-anchor`).
- **Key repeat** is throttled (70 ms) to stay smooth on low-power hardware.
- **Pointer remotes** (LG Magic Remote, mice) move focus only on real pointer movement; click selects.
- **Focus recovery**: if the focused element disappears (data reload, season switch) focus moves to the nearest
  remaining element — focus never disappears.

## Back behaviour

1. Open dialogs/menus close first (layer back handlers).
2. Player: hides the "Up next" card, otherwise exits to the previous screen (progress saved).
3. Top-level screens (Home, Live TV, TV Shows, Movies, Originals, Apps, Search): content → navigation bar →
   Home → profile selection.
4. Kids top-level screens: content → Kids navigation → Kids Home. Leaving Kids requires the parent PIN.
5. Other screens (details, My List, Settings): history back, or Home if there is no history.

## Screen-specific keys

| Screen | Key | Effect |
|---|---|---|
| Hero billboard | Left on first button / Right on last button | Previous / next featured title |
| Live TV | Digits | Direct channel entry (e.g. `1 0 2`) |
| Player | OK | Play/pause; when controls are hidden the first key only reveals them (OK toggles, ←/→ seek ±10 s) |
| Player seek bar | ← / → | Seek ±10 s (±30 s while held) |
| Player | Rewind / Fast-forward | ∓30 s |
| Live player | Channel up/down | Next / previous channel |
| Search, profile name | Letters/digits/Backspace | Type directly with a physical keyboard |
| Settings option rows | ← / → | Change value |
