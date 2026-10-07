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
- [ ] Complete a Guided Journal; confirm answers stay in the intended draft and saved journal only.
- [ ] Complete Morning and Evening Rituals; verify retry creates no duplicate completion or growth.
- [ ] Open First Aid choices; verify danger uses the crisis path and ordinary choices remain non-persistent.
- [ ] Create a future Letter, edit its draft, verify list metadata hides content, and open it only when eligible.
- [ ] Create and complete a Soft Goal; verify one growth award and one Path Stones unlock after retry.
- [ ] Confirm Personal Milestones appear once and use gentle, non-punitive copy.
- [ ] Enter a journal draft, kill/restart the app and confirm the complete draft returns.
- [ ] Enter a chat draft, kill/restart the app and confirm the complete draft returns.
- [ ] Repeat kill/restart recovery for Guided Journal, Letter and any persisted Ritual draft.
- [ ] Generate a journal draft from a conversation; confirm nothing is saved until Save is selected.
- [ ] Start, pause/resume and complete self-care activities; test breathing with reduced motion.
- [ ] Confirm garden growth is idempotent and missing a day causes no penalty copy.
- [ ] Enable weekly reflection, create one and confirm a repeated completion does not double-award.
- [ ] Enable a local notification only after permission; verify time and timezone behavior.
- [ ] Export privacy data; inspect the JSON/share result and confirm embeddings/internal safety metadata are absent.
- [ ] Delete all conversations and confirm messages disappear.
- [ ] Delete all memories and confirm retrieval no longer uses them.
- [ ] Delete the account; confirm server data, local session, drafts, reminders and caches are cleared.

## Private Conversation on device

- [ ] Start a Private Conversation, send messages, background and foreground the app, then leave without saving.
- [ ] Confirm normal conversation history, memories, timeline and Garden progress are unchanged.
- [ ] Kill and reopen the app; confirm the discarded private conversation is absent.
- [ ] Start another private conversation and choose Save; confirm normal history contains it exactly once.
- [ ] Interrupt the Save request and retry; confirm one conversation and one copy of each message.

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
- [ ] Retry Soft Goal creation/completion and Private Conversation conversion with the same client IDs; confirm no duplicate rows or growth.

## Garden 2.0 touch targets

- [ ] Open Letter Tree, Reflection Lake, Memory Garden, Quiet Cottage, Path Stones and every other unlocked area.
- [ ] Repeat on a small screen, 200% font size, dark mode, reduced motion and TalkBack.
- [ ] Confirm every hotspot has a usable touch target, spoken label and visible focus; no action depends on a tiny decorative target.

## Notifications

- [ ] Verify permission denied and allowed flows for weekly reflection, Morning Ritual and Evening Ritual reminders.
- [ ] If the current build schedules future-letter delivery, verify its time and tap destination; otherwise record it as not implemented rather than passed.
- [ ] Change timezone, reboot/reopen where practical and verify schedules update without duplicate or guilt-based copy.

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
