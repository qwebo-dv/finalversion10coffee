This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## B2B / B2C administration

Payload uses one database and one admin application with explicit sales channels:

- `wholesale` — the B2B cabinet at `/dashboard`;
- `retail` — the B2C cabinet at `/main`;
- `/admin` — staff administration with the `Опт / Розница / Все` workspace switcher.

Orders and clients always store `salesChannel`. The legacy `customerType` field remains for backwards compatibility and describes the legal/customer type rather than the sales channel.

Before deploying this change:

1. Configure `CRON_SECRET` and the channel-specific MoySklad variables documented in `.env.example`.
2. Run `npm run payload:migrate` as an explicit deployment step.
3. Verify that the MoySklad sales channels, projects, stores and initial states referenced by the environment variables exist.
4. Test one wholesale and one retail order, then confirm that `/api/cron/moysklad-status-sync` updates their statuses.

The old shared `MOYSKLAD_*` variables remain fallbacks, so the migration can be deployed before the channel-specific IDs are populated.

MoySklad sales-channel types use its documented enum. The recommended mapping is `DIRECT_SALES` for the wholesale cabinet and `ECOMMERCE` for the retail online shop. Use `RETAIL_SALES` only when the source is a physical POS retail sale rather than an online order.

## MoySklad rounding and link maintenance (September 2026)

The rounding fix requires a normal application deployment, with no database schema migration. It preserves the site's saved prices, discounts, numbers and totals. Since 2026-09-23, each exported item keeps one row, its full quantity and its explicit discount percentage. When whole-ruble discount rounding would change the line total, only its MoySklad unit price is adjusted, using fractional kopecks as needed (the API declares `price` as Float in kopecks). Exact lines keep their original price. This replaces the previous net-price/zero-discount and split-row fallback. Assortment and VAT stay unchanged. Orders and invoices receive identical positions; a mismatching API response is recorded as an error with the remote IDs retained. API price precision still requires verification on a real affected order after deployment.

Deployment alone does not update existing documents. In the deployed application's terminal, explicitly select the internal Payload IDs requiring an update:

```sh
node scripts/moysklad-maintenance.mjs retry --ids 123,124 --force
```

Replace the example IDs with verified IDs. This updates existing orders and invoices; paid/shipped documents require separate reconciliation. `--force` requires `--ids`. Without arguments, `retry` retains the existing full-sweep behavior. Normal admin retries skip unchanged synced orders.

The owner explicitly excluded historical order `10C-00179` (Payload ID `160`) from repeat export on 2026-09-07. The retry service matches both identifiers and silently skips this order, including background retries, admin selections and `--force`. It emits no individual progress or summary message for the exclusion. It neither modifies the order nor clears its stored error, and other uniqueness conflicts remain errors. Bulk totals include unchanged orders and exclusions in the skipped count, and show only actual export attempts as "к выгрузке". This exception requires only an application deployment, with no migration or environment changes; link recovery below remains available separately.

To restore a lost link without server-terminal access, open the existing order in Payload. The **Связь с существующим заказом МойСклад** panel appears when a remote order or invoice ID is missing. Choose **Проверить связь с МойСклад**, review the matching company, item, amount and invoice, then choose **Восстановить связь**. Reload the card using its link to see the saved IDs. The ordinary bulk retry button does not perform this repair.

Only staff with integration permissions can use this operation. The server verifies both documents during preview and again on apply. A stale preview, ambiguous match, different counterparty, conflicting local link, changed document or missing audit log aborts the operation. The transaction records the previous six metadata fields in `moysklad_sync_logs` alongside the operator ID before updating the link. It never writes to MoySklad and does not change the site's order number, contents, totals or payment/fulfilment statuses. The CLI uses this same service.

Alternatively, to restore a lost link from the application terminal, first run a read-only check:

```sh
node scripts/moysklad-maintenance.mjs relink --order-id ID --order-number NUMBER --remote-order-id UUID --remote-invoice-id UUID --expect-total RUB --expect-counterparty-id UUID
```

The relink operation verifies the number, organization, counterparty, product/variant, quantity, price, discount, total, invoice-to-order reference and absence of another local link. It is deliberately limited to one product line with no delivery charge; other cases need a separate reviewed plan. It never writes to MoySklad. After a successful check, append `--apply --backup-file /tmp/moysklad-link-before.json` to the same command. The backup path must be new. A transaction updates only six integration fields, checks that all other local order/item data stayed unchanged, and checks both remote document versions again before committing. Existing payment/fulfilment statuses are preserved. Reapplying an already restored link creates no documents.

After deployment and maintenance, verify the actual Payload and MoySklad cards, IDs and totals. Local tests (`npm run test:moysklad`), TypeScript checks and a build do not establish production completion. [MoySklad position format](https://github.com/moysklad/api-remap-1.2-doc/blob/master/md/documents/_customerOrder.md#позиции-заказа-покупателя) documents the price in kopecks and the discount percentage.
