import { syncMoyskladOrderStatuses } from "../lib/moysklad/status-sync"
import { preparePayloadRuntime } from "./payload-runtime"

async function main() {
  const args = process.argv.slice(2)
  if (args.length && (args.length !== 2 || args[0] !== "--order-number" || !args[1].trim())) {
    throw new Error("Usage: statuses [--order-number 10C-00522]")
  }
  preparePayloadRuntime()
  const [{ getPayload }, configModule] = await Promise.all([
    import("payload"),
    import("../payload.config"),
  ])
  const payload = await getPayload({ config: configModule.default })
  let orderIds: (string | number)[] | undefined
  if (args.length) {
    const { docs } = await payload.find({
      collection: "orders",
      where: { orderId: { equals: args[1] } },
      depth: 0,
      limit: 2,
      overrideAccess: true,
    })
    if (docs.length !== 1 || !docs[0].moyskladCustomerOrderId) {
      throw new Error("Не найден единственный заказ с указанным номером и связью с МойСклад")
    }
    orderIds = [docs[0].id]
  }
  const result = await syncMoyskladOrderStatuses(payload, { orderIds })
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.ok ? 0 : 1)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
