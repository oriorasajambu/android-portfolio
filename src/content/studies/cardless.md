---
title: Cardless withdrawal and deposit
order: 6
kicker: Feature study · OctoMobile
summary: Using an ATM without a card, through a short-lived code created in the app — and a clear view of which codes are still active.
product: OctoMobile, a native Android mobile-banking application.
context: Cardless transactions let a customer withdraw or deposit cash at an ATM without their card. The customer prepares the transaction in the app and receives a code to enter at the ATM. A code is only useful for a limited time.
userTask: Withdraw or deposit cash without a card, and keep track of codes that have been created.
contribution: I built UI and integration on the Android client for cardless withdrawal, cardless deposit and viewing active codes.
teamBoundary: This was team work on a shared product. The study describes my implementation work on the Android client only, not product, backend or design ownership.
responsibilities:
  - Cardless withdrawal on the Android client.
  - Cardless deposit on the Android client.
  - Viewing active codes.
technologies:
  - Kotlin
  - Native Android
  - VIPER architecture
walkthrough: cardless
diagram:
  src: diagrams/cardless-states.svg
  alt: State diagram — Create a code for withdraw or deposit, the code is Active and listed with time left, then it becomes Used when entered at the ATM or Expired when its validity ends.
  caption: Original explanatory diagram. One code, a clear lifecycle.
---

## The problem

Cardless cash splits one task across two places. The customer starts on their phone and finishes at an ATM, possibly minutes later. In between, the only thing that connects the two is a code — and that code is short-lived.

The interface has to make the code easy to use at the ATM, make its time limit visible, and give the customer a place to find it again.

## What the feature has to handle

- **Preparing the transaction.** The customer chooses withdrawal or deposit, the account and the amount before a code is created.
- **The code itself.** The code must be easy to read and type at the ATM, and its remaining validity must be obvious.
- **Finding it again.** A customer who leaves the screen, or creates more than one code, needs a single place to see which codes are still active.

## Related work in the same area

Cardless transactions sit alongside the account and card screens covered in the [card management study](../card-management/), as another way customers reach their money without a physical card in hand.

*Screens on this page are original illustrations with synthetic data. They explain the concepts and do not reproduce the production application.*
