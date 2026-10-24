# Manager & Pal: how it works

## Two modes: User mode and Manager mode
Every account can use both modes, and nobody is locked into a role.
- **User mode** is the normal app: your own tasks.
- **Manager mode** shows the people you manage.

To switch, use the **User mode / Manager mode** buttons at the top of the menu. The app remembers the last mode you used and opens in it next time.

## Private and Public tasks
Every task is either **Public** or **Private**. You choose under **Visible to** in the task's details.
- **Public** (the default for new tasks): your managers and pals can see the task.
- **Private**: only you can see it. Private tasks never show up for managers or pals in any way. They aren't listed or counted as overdue, and nobody can ping you about them. Private tasks have a small "Private" label in your list.

## Manager links
**Creating one.** Open **Manager & Pals → Manager**, type what you call the person (for example "Mom"), and tap **Create link**. Then share the link. The full link only shows on the phone that made it. If you lose it, tap **New link**. That makes a fresh link and the old one stops working.

**Opening the link (the manager's side).** The link opens straight onto your task list. From there the manager has two options:
- **Just use the link.** They don't need an account. The first time, they're asked "What should we call you?", and that's all.
- **Sign in to connect** (optional). They sign in with Apple or Google. If they're new to CleanNote, they go through the normal welcome and setup like anyone else. When they finish, they're automatically connected as your manager and land on your tasks. From then on you're in their **Manager mode**, and they don't need the link again.

**What a manager sees:** your **Public** tasks for the week, with overdue tasks at the top, then to-do, then done. They can't add, change or delete anything.

**What a manager can do:**
- Tap **Ping** or **Remind** on a task. It's one tap, and it shows "Sent ✓" right away.
- Tap **Send encouragement**.
- Send you messages. Quick-message buttons are there too.

## Manager mode home
The home screen in Manager mode lists everyone you manage, by name. Each person shows how many tasks are **overdue** and how many of their messages are **new**. People with overdue tasks come first. Tap a name to open their tasks and your chat with them, and tap **‹ Everyone you manage** to go back. If the list is empty, it tells you how to get invited: ask the person to send you their manager link from **Manager & Pals → Manager**, open the link, and tap **Sign in to connect**.

## Your side: pings, messages and managers
Pings and messages from your managers appear in **Manager & Pals** with a red badge on the menu, plus a notification where notifications are turned on. You can reply from the same screen, and there are quick-reply buttons. Opening the Manager tab marks everything as read.

The **Connected managers** card lists everyone who signed in and connected to you, by name. Tap **Disconnect** to remove someone, and they won't see your tasks anymore. **Turn off** stops the shared link from working for anyone who uses it without signing in.

## Pals (both ways)
1. One person opens **Manager & Pals → Pals** and taps **Get invite code**. The 8-character code works once and lasts 7 days.
2. They send the code to a friend, who enters it under **Have a code?** and taps **Connect**.
3. Now you're pals. Each of you sees the other's **Public** tasks, and the list refreshes every few seconds. You can chat, and messages arrive instantly. Pals never see Private tasks.
4. Either of you can tap **Remove pal** at any time. That disconnects you both and deletes your chat.

## Block & Report (App Store guideline 1.2)

Every message you *receive* has a small **Report** link under it: manager nudges/messages in your Manager tab, your pal's messages in pal chat, and (for managers) the person's replies in the manager view.

- **Report** opens a short sheet: pick a reason (Harassment, Inappropriate, Spam, Something else) and tap Report. The report is stored server-side (`reports/{id}`, with a snapshot of the message text, who sent it, and the reason) for review within 24 hours. The confirmation offers an optional "Email support" link to musclecrabs@gmail.com. Reporting the same message twice just updates the reason.
- **Also block**: tick it on the report sheet to report and block in one step.

**Block**
- *Pal*: pal screen → **Block**. The pal is removed, the chat is deleted, and neither of you can pair again with a code.
- *Connected manager*: Manager tab → Connected managers → **Block**. They're disconnected, your current manager link is turned off (they had it), and they can't reconnect with any future link. Make a new link for anyone else.
- *No-account (link) manager*: they have no account to block, so blocking them turns the link off (same as **Turn off**).
- *Manager side*: in Manager mode, open the person → **Block {name}** at the bottom. You're disconnected and they can't invite you again.

Blocks live in `blocks/{blocker}_{blocked}` (written only by the server; readable only by the blocker). Connecting by link or code is refused (403) when a block exists in either direction. There's no unblock button yet. Removing a block means deleting that doc by hand (ask support).

## Scheduled & recurring tasks (feat/ios-capacitor, local)
- The manager and pal views include Public scheduled tasks: today's materialized occurrences carry `scheduled: {date, time, repeat}`. Upcoming Public one-time entries and series occurrences for the next 7 days come from `users/{uid}.scheduledTasks`, flagged `upcoming: true`.
- Overdue is set once date+time passes (or the day ends when there is no time). Private entries and templates never leave the server. Managers stay read-only.
- Fix: the function now reads the day docs the app actually writes (`weeklyRoutines/{uid}_Mon..Sun`, from `src/data.json`), with `_Monday`-style ids as a fallback. Before, it read only full-name ids, so real users' tasks would not have appeared.
- See docs/scheduling-guide.md.
