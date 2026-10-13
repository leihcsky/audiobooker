// Lists the products in the configured Waffo store. Usage:
//   npm run billing:waffo-products
import { WaffoPancake } from "@waffo/pancake-ts";

async function main() {
  const merchantId = process.env.WAFFO_MERCHANT_ID;
  const privateKey = process.env.WAFFO_PRIVATE_KEY;
  const storeId = process.env.WAFFO_STORE_ID;
  if (!merchantId || !privateKey || !storeId) {
    throw new Error("Set WAFFO_MERCHANT_ID, WAFFO_PRIVATE_KEY and WAFFO_STORE_ID in .env.");
  }
  const client = new WaffoPancake({ merchantId, privateKey });
  const result = await client.graphql.query({
    query: `query ($storeId: String!) {
      onetimeProducts(storeId: $storeId) {
        id name status
        prices { currency priceInfo { amount taxCategory } }
      }
      subscriptionProducts(storeId: $storeId) {
        id name billingPeriod status
        prices { currency priceInfo { amount taxCategory } }
      }
    }`,
    variables: { storeId },
  });
  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join("; "));
  }
  const rows = [
    ...(result.data?.subscriptionProducts ?? []).map((p) => ({ type: `subscription/${p.billingPeriod}`, ...p })),
    ...(result.data?.onetimeProducts ?? []).map((p) => ({ type: "one-time", ...p })),
  ];
  if (rows.length === 0) {
    console.log("No products in this store yet.");
    return;
  }
  for (const product of rows) {
    const prices = (product.prices ?? [])
      .map((price) => {
        const info = price.priceInfo ?? {};
        return `${price.currency} ${info.amount} (${info.taxCategory})`;
      })
      .join(", ");
    console.log(`${product.id}  ${product.type}  ${product.status}  ${product.name}  ${prices}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
