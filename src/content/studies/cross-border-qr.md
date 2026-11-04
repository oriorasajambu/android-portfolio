---
title: Cross-border QR — paying abroad in two currencies
order: 5
kicker: Feature study · OctoMobile
summary: Paying merchants abroad by QR, where the customer has to understand an amount in another currency before confirming in rupiah.
product: OctoMobile, a native Android mobile-banking application.
context: Cross-border QR payments let customers pay merchants outside Indonesia using a QR code from a local payment network. The merchant asks for an amount in its own currency, while the customer pays from a rupiah account.
userTask: Pay a merchant abroad by scanning a QR code, and know what the payment will cost in rupiah.
contribution: I built UI and integration on the Android client for paying with cross-border QR.
teamBoundary: This was team work on a shared product. The study describes my implementation work on the Android client only, not product, backend or design ownership.
responsibilities:
  - UI and integration for cross-border QR payments on the Android client.
technologies:
  - Kotlin
  - Native Android
  - VIPER architecture
walkthrough: xb
diagram:
  src: diagrams/xb-flow.svg
  alt: Flow diagram — a merchant abroad asks for a foreign amount, the conversion shows both currencies, the customer confirms in rupiah, and the receipt shows both amounts.
  caption: Original explanatory diagram. The merchant amount and the rupiah amount stay side by side from scan to receipt.
---

## The problem

Paying abroad adds a question that a domestic payment never asks: *how much is this, really?* The merchant's screen shows one currency, the customer's account holds another, and the customer is often in a hurry at an unfamiliar counter.

The interface has to carry two numbers at once without making either of them hard to read.

## What the feature has to handle

- **The merchant's amount.** After scanning, the customer sees what the merchant is asking for, in the merchant's currency, so they can match it against the counter.
- **The rupiah amount.** Next to it, the customer sees what they will pay from their account, so the decision is made in a currency they think in.
- **Confirmation.** The confirm step makes clear which amount is being charged to the account.
- **The receipt.** The receipt keeps both amounts, so the customer can reconcile the payment later.

## How it relates to the other QR work

Cross-border QR builds on the domestic QRIS payments in the [QR payments study](../qr-payments/), adding the currency dimension on top of the same scan, confirm and receipt pattern.

*Screens on this page are original illustrations with synthetic data, including sample exchange rates. They explain the concepts and do not reproduce the production application.*
