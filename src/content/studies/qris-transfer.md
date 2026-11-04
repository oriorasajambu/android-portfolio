---
title: QRIS Transfer — sending money by scanning
order: 4
kicker: Feature study · OctoMobile
summary: Transfers that start from a scanned QRIS code, where the step that matters most is confirming who receives the money.
product: OctoMobile, a native Android mobile-banking application.
context: With QRIS Transfer, a customer sends money to another person by scanning that person's QRIS code instead of typing an account number. Scanning removes typing errors, but it also means the customer may not have read the recipient's details before reaching the confirm step.
userTask: Send money to a person by scanning their code, and be sure it goes to the right recipient.
contribution: I built UI and integration on the Android client for QRIS Transfer.
teamBoundary: This was team work on a shared product. The study describes my implementation work on the Android client only, not product, backend or design ownership.
responsibilities:
  - UI and integration for the QRIS Transfer flow on the Android client.
technologies:
  - Kotlin
  - Native Android
  - VIPER architecture
walkthrough: transfer
diagram:
  src: diagrams/transfer-flow.svg
  alt: Flow diagram — Scan the recipient's QRIS code, see the recipient's name, confirm an amount from an account, then a transfer receipt with a reference.
  caption: Original explanatory diagram. The recipient is shown before any money moves.
---

## The problem

A payment to a merchant and a transfer to a person look alike on the surface: scan a code, enter an amount, confirm. The difference is what happens when something is wrong. A merchant payment has a counter and a cashier; a transfer to the wrong person has neither.

So the most important screen in a scan-to-transfer flow is not the scanner. It is the confirmation, where the customer sees who will receive the money before anything moves.

## What the feature has to handle

- **Scanning.** The flow starts from a camera, so the customer needs a clear target and a clear message about what kind of code to point at.
- **Recipient confirmation.** Once the code is read, the recipient is shown in a form the customer can check, before they commit to an amount.
- **Amount and source.** The customer chooses how much to send and from which account, and the confirm button repeats the amount.
- **Receipt.** A completed transfer ends with a receipt and a reference the customer can share or quote later.

## How it relates to the other QR work

QRIS Transfer reuses the scanning step familiar from QR payments, covered in the [QR payments study](../qr-payments/), but ends in a person-to-person transfer rather than a merchant payment.

*Screens on this page are original illustrations with synthetic data. They explain the concepts and do not reproduce the production application.*
