// Registers (or re-points) the store's HTTP webhook for the configured
// environment. Usage:
//   npm run billing:waffo-webhook -- https://your-tunnel.ngrok-free.app
// The path /api/webhooks/waffo is appended when the URL has no path.
import { WaffoPancake } from "@waffo/pancake-ts";

const EVENTS = [
  "order.completed",
  "subscription.activated",
  "subscription.renewed",
  "subscription.recovered",
  "subscription.canceling",
  "subscription.uncanceled",
  "subscription.canceled",
  "subscription.past_due",
  "refund.succeeded",
];

function webhookUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== "https:") {
    throw new Error("Use an https URL (for local testing: ngrok http 3000).");
  }
  if (url.pathname === "/" || url.pathname === "") {
    url.pathname = "/api/webhooks/waffo";
  }
  return url.toString();
}

async function main() {
  const merchantId = process.env.WAFFO_MERCHANT_ID;
  const privateKey = process.env.WAFFO_PRIVATE_KEY;
  const storeId = process.env.WAFFO_STORE_ID;
  const testMode = process.env.WAFFO_ENVIRONMENT !== "prod";
  if (!merchantId || !privateKey || !storeId) {
    throw new Error("Set WAFFO_MERCHANT_ID, WAFFO_PRIVATE_KEY and WAFFO_STORE_ID in .env.");
  }
  const raw = process.argv[2];
  if (!raw) {
    throw new Error("Usage: npm run billing:waffo-webhook -- https://your-public-url");
  }
  const url = webhookUrl(raw);
  const client = new WaffoPancake({ merchantId, privateKey });

  const result = await client.graphql.query({
    query: `query { stores { id storeWebhooks { id channel url testMode } } }`,
  });
  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join("; "));
  }
  const store = (result.data?.stores ?? []).find((candidate) => candidate.id === storeId);
  const existing = (store?.storeWebhooks ?? []).find(
    (webhook) => webhook.channel === "http" && webhook.testMode === testMode,
  );

  if (existing) {
    await client.webhooks.update({ id: existing.id, url, events: EVENTS });
    console.log(`Updated ${testMode ? "test" : "prod"} webhook ${existing.id} -> ${url}`);
  } else {
    const created = await client.webhooks.add({ storeId, channel: "http", url, events: EVENTS, testMode });
    console.log(`Added ${testMode ? "test" : "prod"} webhook -> ${url}`, created?.webhook?.id ?? "");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
