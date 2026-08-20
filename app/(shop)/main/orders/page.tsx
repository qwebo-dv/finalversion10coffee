import { OrdersPage } from "../../../dashboard/orders/page"

export default function RetailOrdersPage() {
  return <OrdersPage sessionScope="individual" />
}

export const dynamic = "force-dynamic"
