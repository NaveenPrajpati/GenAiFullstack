# Learning Assistant

Try it: **https://ai-agents--ai-apps.expo.app/learning**

A tutor that doesn't just answer questions. You tell it what you want to learn, and
it builds you a roadmap, teaches one topic at a time in small daily instalments,
checks that you actually read them, and won't let you tick a topic off until you
can recall it without looking.

Most study apps let you mark your own homework. This one doesn't.

---

## Day one — "teach me Rust"

Open the tutor and say what you want to learn. Three things happen in one
conversation:

**It asks you two questions.** Your level, and how you like things explained —
worked examples first, step by step, straight to the point, or by being asked
questions. Skippable, and skipping is remembered so you're not asked again.

**It proposes a roadmap.** Stages, topics in order, what each one covers, what you
need before it, and a time estimate. This is a *proposal* — nothing is saved until
you approve it. Reject it and say what you'd rather have.

**The first topic starts.** Exactly one topic is ever underway. That's what your
daily instalments will be about, and it's why the app never presents you with
fourteen half-finished things.

You can run **two roadmaps at once**. Any more and every one of them gets less
attention than it needs, so the rest wait, parked, until you free a slot.

---

## Every day — the digest

A digest is three to five bullets that **teach**: a rule, a gotcha, a rule of
thumb, a small worked example. Never "there's a good course on this" — links are
listed separately, and a bullet that only points somewhere else has taught you
nothing.

They arrive at an hour you choose, in your timezone. You can also pull the next one
early when you have a spare ten minutes, and if you ignore them they stop at three
unread rather than piling up to twenty.

### The read-check

From the second digest, marking one as read means answering two quick questions
about the **earlier** ones. It's short and it's all-or-nothing, and it's the reason
"Mark as read" means something: without it, acknowledging a digest only proves you
found the button.

From the fourth digest, one question asks you to answer **in a sentence** rather
than tapping an option. Your keyboard's mic works for that. It's graded on whether
you have the idea, not on spelling or grammar — and being wrong doesn't block
anything, because what it's really for is showing how you're thinking.

### When a check keeps going wrong

Get the same check wrong twice and the assistant stops asking you to re-read the
same words. It concludes that **its** explanation is the problem, re-teaches the
material from a different angle — in the style you picked on day one — and rewrites
the questions against the new version.

You still have to pass. What changes is that passing is now possible on the
strength of teaching that might actually land, rather than on persistence.

---

## Finishing a topic

Once the digests have taught the whole topic, the checkpoint opens: five questions,
80% to pass — so one of them can go wrong.

**Passing is the only way a topic is marked complete.** There is no "mark as done"
anywhere in this app. A finished roadmap means you recalled something, not that you
tapped something.

If you don't pass:

- You're told **what each missed question was testing and where to look** — never
  the answer. Handing back the right option would make the retry a copying
  exercise.
- The topic owes you **one round of revision**: a short digest written from the
  questions you actually missed, not a repeat of the original tips.
- The retry waits until you've read it. There's also a short cooldown and a limit
  of three attempts a day, and every attempt gets **fresh questions** — so a retry
  can't be re-rolling the dice until they land.

Reopening a topic you'd finished is free. The gate is on claiming knowledge, not on
withdrawing the claim.

### Explaining it in your own words

Optional, about thirty seconds, offered when a topic is ready to be completed. Say
the topic out loud — dictation is fine, rambling is fine — and it's judged on
whether the ideas are there.

It can't cost you anything: a poor attempt is never held against you, because an
exercise that can lose you progress is one nobody volunteers for. Doing it *well*
pushes the topic's next review further out — you've earned a longer gap.

Its real value is what it reveals. A wrong multiple-choice answer tells the
assistant which of four boxes you tapped. An explanation tells it how you're
thinking.

---

## Weeks later — it comes back

Completed topics resurface for a quick review on an expanding schedule: after a
day, then three, a week, a fortnight, five weeks. The better you know something,
the less often it returns.

Failing a review **doesn't take your progress away** — the topic stays complete, it
just comes back sooner. Punishing an honest attempt is the fastest way to teach
someone not to attempt.

Reviews are never a repeat of a question you've already seen. Each one is written
against what you've been asked before, so it tests the material rather than your
memory of last week's quiz.

---

## What it learns about you

Every wrong answer — from digest checks, checkpoints and reviews alike — feeds one
picture of what you *believe*, not just what you missed. Several mistakes that
point the same way become a named misunderstanding.

You can read those on the **Insights** screen: what it looks like you think, and
what's actually true. What you won't see is how it plans to test you on it again —
knowing that would tell you exactly where to concentrate.

That picture then works quietly in the background: the next digest on that topic
teaches against the misunderstanding directly, and a later checkpoint comes back to
it from a different angle. A single right answer isn't a corrected belief, so it
comes back later rather than immediately.

---

## The rest of it

**Notes.** Against any topic, keep a jotting, a code snippet, a saved link, or a
question to come back to. Unresolved questions lead the list, because coming back
to them is the point of writing them down. They survive a roadmap being edited.

**Progress you can trust.** The percentage counts topics you've *passed*.

Alongside it is a **mastery** figure, and it answers a different question: not how
far through you are, but how well you're holding what you've been tested on. It is
the average across the topics you've actually been graded on — which early on is a
small handful — so the tile says how many it's speaking for. Two passed checkpoints
can read 99% while nineteen topics are untouched, and that's the honest number:
you're holding what you've done, and you've barely started.

Within that, recent attempts weigh more heavily than old ones, and a topic fades
once its review goes overdue. So it tells you what you know *now*, not what you
knew in week one.

**A finish date.** Tell the assistant how many minutes a day you can give it, and
the roadmap tells you when you'll be done at that pace, and whether that lands
before any deadline you've set.

**Editing a roadmap doesn't reset it.** Ask for a topic to be added, removed or
reordered and everything you'd already completed stays completed.

**Ask about anything, any time.** The tutor panel follows you across the app. Tap a
topic and it offers to explain it, quiz you on it, or find you resources for it.

---

## What it deliberately won't do

- **Let you mark a topic complete.** Passing the checkpoint is the only route.
- **Show you the answer when you get one wrong.** You get the hint and what the
  question was testing, and that's the point.
- **Let you retry immediately.** A failure owes revision first, then a cooldown,
  then a daily cap.
- **Ask you the same question twice.** Every attempt is generated against what
  you've already been asked.
- **Pile up.** Three unread digests and it stops until you've caught up.
- **Send you a wall of links.** If a bullet doesn't teach you something on its own,
  it shouldn't be there.
- **Make you feel watched.** Nothing it has inferred about your mistakes appears in
  the wording of a question. The teaching is aimed at it; the accusation isn't.

---

## The screens

**Today** — what's waiting and what to do next: unread digests with their checks,
one card per running roadmap, and your streak, mastery and reviews due.

**Roadmaps** — everything you've started. Which two are running, which are parked,
and the overall picture.

**A roadmap** — its topics by stage. Start one, take its checkpoint, explain it in
your own words, keep notes on it.

**Digests** — the archive. Everything you've been sent, by roadmap and topic.

**Notes** — everything you've written down, across every roadmap.

**Insights** — what keeps tripping you up, and what it's based on.

**Settings** — your level, goals, minutes a day, what you already know, and when
digests arrive.
