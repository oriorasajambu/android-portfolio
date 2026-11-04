---
title: Card management under partial failure
order: 2
kicker: Feature study · OctoMobile
summary: Card screens that stay useful while data is loading, when one part fails, and while the customer retries.
product: OctoMobile, a native Android mobile-banking application.
context: A card screen brings together information that is loaded separately — the card itself, its status, and details such as limits — and offers actions that depend on that status, such as blocking, activating, or changing the PIN.
userTask: Check a debit or credit card and act on it — for example, block a card that has been lost — even if some information is temporarily unavailable.
contribution: I built the UI and integration on the Android client for managing debit and credit cards — block, activate and change PIN — and for the account detail screens of credit cards, savings and current accounts, and time deposits.
teamBoundary: This was team work on a shared product. The study describes my implementation work on the Android client only, not product, backend or design ownership.
responsibilities:
  - Card management for debit and credit cards — block card, activate card, change PIN.
  - Account detail screens for credit cards, savings and current accounts, and time deposits.
  - Screen behavior during loading, partial-data failures, and retry.
  - Virtual card number screens.
technologies:
  - Kotlin
  - Native Android
  - VIPER architecture
walkthrough: cards
diagram:
  src: diagrams/card-states.svg
  alt: State diagram for one screen section — Loading leads to either Loaded or Failed; Failed offers Retry, which returns to Loading for that section only, while other sections stay Loaded.
  caption: Original explanatory diagram. Each section of the screen moves through its own states, so a failure stays local.
---

## The problem

A card screen looks like one thing to the customer, but it is assembled from several pieces of information. Any one of them can be slow or unavailable at a given moment. If the whole screen treats a single missing piece as a total failure, the customer loses access to what *did* load — including, possibly, the button they came for.

The most urgent card actions are also the ones where this matters most. Someone who has just lost a card wants to block it, not read an error page.

## Loading, partial failure, and recovery

The screen behavior I worked on covers three moments:

- **Loading.** Each section shows that it is on its way, while the parts already available are usable.
- **Partial failure.** A section that fails says so in place, and offers a retry for that section. The rest of the screen — and actions that do not depend on the missing data — remain available.
- **Recovery.** Retrying fills in what is missing, ideally without the customer losing their place or watching the whole screen fall back to a loading state.

The illustrated sequence above walks through these three moments with synthetic data.

## Actions that depend on status

Card actions such as block, activate and change PIN depend on the card's current status. Presenting only the actions that apply — and keeping them reachable when unrelated details fail to load — is part of making the screen dependable.

## Related work in the same area

My work on OctoMobile also includes cardless withdrawal and deposit with active-code viewing, account detail screens for savings and current accounts and time deposits, virtual card numbers, and point transfers.

*Screens on this page are original illustrations with synthetic data. They explain the concepts and do not reproduce the production application.*
