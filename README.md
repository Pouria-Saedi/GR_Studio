# GR Studio storefront

A responsive storefront and local commerce prototype for GR Studio. The site uses Node.js built-ins, plain JavaScript, and CSS; it has no third-party runtime dependencies.

## Requirements

- Node.js 24.15.0 or newer (uses the built-in `node:sqlite` module)

## Run locally

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The development server watches server-side files, applies CSS changes without a full page reload, and reloads the page when browser JavaScript or HTML changes. Stop it with `Ctrl+C`.

To run without the file watcher, use `npm start`.

## Store features

- Product catalog with search, category filtering, sorting, product pages, sale pricing, and stock status.
- Browser-persisted shopping bag and server-side stock validation when an order is placed.
- Checkout that records an unpaid order request; it does not collect or process card details.
- Customer registration and sign-in, account profile and password updates, saved addresses, and order history for orders placed while signed in.
- Newsletter signup and subscriber management in the administrator area.
- Password-protected administrator area for catalog, inventory, orders, and fulfillment updates.
- Responsive informational pages and locally stored product, payment, and page illustration artwork.

Apple and Google sign-in marks are visual placeholders; OAuth sign-in is not connected. Customer email verification and password recovery are not connected because no outbound email service is configured.

## Local data and administrator access

The server creates `data/gr-studio.sqlite` on first run. It stores the catalog, customer accounts, saved addresses, sessions, newsletter subscribers, and orders. If present during first initialization, `data/products.json` and `data/orders.json` are imported as legacy data. The product JSON file is retained as the catalog seed; the database, legacy order file, and server logs are local runtime data and are excluded from Git.

Set an administrator password before starting the server:

```powershell
$env:GR_ADMIN_PASSWORD = "choose-a-private-password"
npm run dev
```

Do not commit the password or local database. Set `NODE_ENV=production` behind HTTPS to add the `Secure` attribute to the administrator session cookie. Set `PORT` to change the listening port.

## Before a public launch

This is a local commerce prototype. Prices, stock, business details, shipping destinations, delivery options, taxes, refunds, privacy practices, and legal terms require owner review and real configuration. Orders are saved as unpaid requests; there is no payment provider, payment confirmation, or customer email notification. Footer payment marks are illustrative and do not mean those methods are available.

Review the Apple and Google sign-in placeholders before launch. Production deployment also needs a reviewed identity/session setup, deployment secrets, backups, and operational monitoring. The informational and legal pages include draft content that needs owner confirmation and appropriate review.

Payment marks in `assets/payments/` are local SVGs from the [Datatrans payment-logo collection](https://github.com/datatrans/payment-logos). Included marks are Apple Pay, Bancontact, Google Pay, iDEAL, Klarna, Mastercard, Maestro, PayPal, Visa, and American Express. These marks remain the property of their respective owners. Follow their brand requirements and show a payment mark as an accepted method only when that method is actually available. See [Apple Pay marketing guidelines](https://developer.apple.com/apple-pay/marketing/) and [Mastercard brand guidance](https://www.mastercard.us/en-us/business/overview/start-accepting/payment-innovations/brand-center.html).
