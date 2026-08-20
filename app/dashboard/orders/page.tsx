import { getClientOrders } from "@/lib/actions/orders"
import { OrdersList } from "@/components/dashboard/orders-list"

export const dynamic = "force-dynamic"

export async function OrdersPage({ sessionScope = "business" }: { sessionScope?: "individual" | "business" } = {}) {
  const orders = await getClientOrders(sessionScope)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-black text-neutral-900 tracking-tight">Заказы</h1>
        <p className="text-[12px] text-neutral-400 mt-1">
          История и управление заказами
        </p>
      </div>

      <OrdersList initialOrders={orders} />
    </div>
  )
}

export default function WholesaleOrdersPage() {
  return <OrdersPage sessionScope="business" />
}
