# The Butler — phone app (Expo)

The Butler as a native phone app: tasks, categories, weekly calendar, finance with a PIN lock, and
alarms that ring even when the app is closed. Built with Expo SDK 58 / React Native.

It shares the task, date, money and alarm rules with the web app (`../src/lib/domain`), so both
apps behave the same.

## Try it on your phone with Expo Go

1. Install **Expo Go** from the App Store (iPhone) or Play Store (Android).
2. On the PC, in this folder:

   ```bash
   npm install
   npx expo start
   ```

3. Scan the QR code in the terminal: with the iPhone **Camera** app, or from inside Expo Go on
   Android. The phone and the PC must be on the same Wi-Fi.
4. Allow notifications when asked. Alarms need them.

If the phone can't connect (different network or a firewall), run `npx expo start --tunnel` instead.

To preview in a desktop browser: `npx expo start --web` (alarms and the keychain don't work there).

## What works where

| Feature | Expo Go | Installed app (later, via Sideloadly) |
| --- | --- | --- |
| Tasks, categories, calendar, finance | Yes | Yes |
| Data saved on the phone | Yes (inside Expo Go) | Yes |
| Alarm notifications at reminder time, app closed | Yes | Yes |
| Full-screen alarm card while the app is open | Yes | Yes |
| Finance PIN in the secure keychain, Face ID reset | Yes | Yes |
| Real ringing alarm screen (iOS 26 AlarmKit) | No | Planned |

## Where things live

| Path | What |
| --- | --- |
| `App.tsx` | App shell: header (bell + settings gear, top right), bottom nav, sheets |
| `src/screens/` | Home, Categories, Calendar |
| `src/finance/` | Finance dashboard, money sheets, PIN screen, keypad |
| `src/editors/` | Task editor (new, edit, repeat) and status editor |
| `src/shell/` | Settings and reminders sheets, on-screen alarm |
| `src/notifications.ts` | Schedules phone alarms for pending tasks |
| `src/pin.ts` | Finance PIN: salted hash in the keychain, Face ID / passcode check |
| `src/store.tsx` | App state, saved on the phone with AsyncStorage |

## Checks

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```
