# Native closed-beta QA

Record platform, OS version, device model, app version/build number, API environment, tester, date and result for every run. A JavaScript export is not a device pass.

## Installation and identity

- [ ] Install the development or preview build on a physical Android device.
- [ ] Install the development or preview build on a physical iOS device.
- [ ] Confirm app name, icon, splash, portrait orientation and dark/light launch appearance.
- [ ] Create an account with email/password and complete any configured email confirmation.
- [ ] Complete onboarding; confirm profile, garden and notification preference provisioning.
- [ ] Log out, verify private drafts and session are cleared, then log in again.
- [ ] Force token refresh/expiry and confirm the app refreshes or asks for login without looping.

## Product flows

- [ ] Save a mood check-in, including optional tags and note.
- [ ] Create a conversation in listen, understand and think modes.
- [ ] Simulate a lost chat response and retry without editing; confirm one user message and one assistant message.
- [ ] Approve a pending memory, edit it, verify later retrieval and delete it.
- [ ] Create, edit, search and delete a journal entry.
- [ ] Enter a journal draft, kill/restart the app and confirm the complete draft returns.
- [ ] Enter a chat draft, kill/restart the app and confirm the complete draft returns.
- [ ] Generate a journal draft from a conversation; confirm nothing is saved until Save is selected.
- [ ] Start, pause/resume and complete self-care activities; test breathing with reduced motion.
- [ ] Confirm garden growth is idempotent and missing a day causes no penalty copy.
- [ ] Enable weekly reflection, create one and confirm a repeated completion does not double-award.
- [ ] Enable a local notification only after permission; verify time and timezone behavior.
- [ ] Export privacy data; inspect the JSON/share result and confirm embeddings/internal safety metadata are absent.
- [ ] Delete all conversations and confirm messages disappear.
- [ ] Delete all memories and confirm retrieval no longer uses them.
- [ ] Delete the account; confirm server data, local session, drafts, reminders and caches are cleared.

## Keyboard and input

- [ ] Type Vietnamese with diacritics using a Vietnamese keyboard.
- [ ] Type English, emoji and mixed-language text.
- [ ] Enter and edit multiline chat and journal content.
- [ ] Confirm the keyboard never covers the active chat input or primary action.
- [ ] Dismiss the keyboard by scrolling/back gesture without losing text.

## Lifecycle and storage

- [ ] Background and foreground during chat, journal editing and activity timers.
- [ ] Kill and restart while authenticated; confirm session restoration.
- [ ] Kill during a draft write; confirm the last complete committed draft survives.
- [ ] Log out and confirm SecureStore session and registered drafts are removed.
- [ ] Delete the account and confirm the same cleanup plus reminder cancellation.
- [ ] Simulate SecureStore/AsyncStorage read and write failures; confirm a clear error and no false success.

## Network and retry

- [ ] Launch offline; confirm clear retry UI and retained drafts.
- [ ] Send on a slow connection; confirm pending state prevents duplicate taps.
- [ ] Trigger API timeout/unavailability; confirm friendly error and manual retry.
- [ ] Trigger LLM unavailability on a normal message; confirm friendly retry behavior.
- [ ] Trigger safety-classifier unavailability; confirm fail-closed elevated response.
- [ ] Trigger output-review unavailability; confirm safe fallback.
- [ ] Restore network and retry the same `client_id`; confirm no duplicate exchange.
- [ ] Retry mood and journal saves with the same `client_id`; confirm no duplicate record.

## Safety

- [ ] Run the documented Vietnamese and English crisis phrases against staging.
- [ ] Confirm crisis/elevated paths skip normal companion generation, memory extraction and self-care suggestions.
- [ ] Confirm only enabled, manually verified crisis resources are shown.
- [ ] Confirm an empty resource directory shows generic local emergency guidance without an invented number.
- [ ] Confirm no diagnostic, medication-dose, exclusive/romantic dependency or unsupported-memory output appears.

## Accessibility and presentation

- [ ] Test the largest supported system font size on every core screen.
- [ ] Navigate onboarding, tabs, chat, journal, notifications and privacy controls with TalkBack.
- [ ] Repeat the same flow with VoiceOver.
- [ ] Confirm focus order, role, selected/disabled state and live status announcements.
- [ ] Verify light mode, dark mode and system-theme switching.
- [ ] Enable reduced motion and confirm breathing/garden motion remains usable.
- [ ] Check text/background and control contrast in both themes.
- [ ] Inspect Vietnamese diacritics for clipping or fallback-font changes.

## Platform release checks

- [ ] Android preview APK installs and launches on the minimum supported API and a current API.
- [ ] Android production AAB is created but not automatically submitted.
- [ ] iOS internal build installs through the selected beta distribution path.
- [ ] iOS production archive is created but not automatically submitted.
- [ ] Review generated Android permissions and iOS usage descriptions; microphone, camera, contacts and location must be absent.
- [ ] Confirm notification permission appears only when the user enables reminders.
- [ ] Confirm preview/production bundles contain no localhost URL, service-role key or LLM key.
