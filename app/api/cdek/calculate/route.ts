import { NextRequest, NextResponse } from "next/server"
import { calculateTariff } from "@/lib/cdek"
import { getShopProducts } from "@/lib/actions/products"
import {
  calculateDeliveryPackaging,
  getDeliveryPackagingSettings,
  shippingLinesFromCartItems,
} from "@/lib/delivery-packaging"

type RequestedItem = { productId?: string; variantId?: string; quantity?: number }

export async function POST(req: NextRequest) {
  try {
    const { cityCode, items } = await req.json() as { cityCode?: number; items?: RequestedItem[] }

    if (!cityCode || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "cityCode и товары обязательны" },
        { status: 400 },
      )
    }

    const products = await getShopProducts()
    const cartItems = items.flatMap((requested) => {
      const product = products.find((entry) => entry.id === String(requested.productId || ""))
      const variant = product?.variants?.find((entry) => entry.id === String(requested.variantId || "") && entry.is_available !== false)
      const quantity = Math.max(0, Math.min(100, Math.floor(Number(requested.quantity) || 0)))
      return product && variant && quantity > 0 ? [{ quantity, variant }] : []
    })
    if (cartItems.length !== items.length) {
      return NextResponse.json({ error: "Один из товаров недоступен или изменился" }, { status: 400 })
    }

    const settings = await getDeliveryPackagingSettings()
    const packaging = calculateDeliveryPackaging(shippingLinesFromCartItems(cartItems), settings)

    const tariffs = await calculateTariff(
      Number(cityCode),
      packaging.packages.map(({ weight, length, width, height }) => ({ weight, length, width, height })),
    )

    // delivery_mode: 1=дверь-дверь, 2=дверь-склад, 3=склад-дверь, 4=склад-склад
    // Courier = modes 1 & 3 (to door), Pickup = modes 2 & 4 (to warehouse/PVZ)
    const courierTariffs = tariffs
      .filter((t) => t.delivery_mode === 1 || t.delivery_mode === 3)
      .sort((a, b) => a.delivery_sum - b.delivery_sum)

    const pickupTariffs = tariffs
      .filter((t) => t.delivery_mode === 2 || t.delivery_mode === 4)
      .sort((a, b) => a.delivery_sum - b.delivery_sum)

    const mapTariff = (t: typeof tariffs[0]) => ({
      code: t.tariff_code,
      name: t.tariff_name,
      price: Math.round(t.delivery_sum + packaging.packagingCost),
      carrierPrice: Math.round(t.delivery_sum),
      packagingCost: packaging.packagingCost,
      packageCount: packaging.packages.length,
      minDays: t.period_min,
      maxDays: t.period_max,
      mode: t.delivery_mode,
    })

    return NextResponse.json({
      courier: courierTariffs.map(mapTariff),
      pickup: pickupTariffs.map(mapTariff),
      packages: packaging.packages.map(({ length, width, height, weight }) => ({ length, width, height, weight })),
    })
  } catch (e) {
    console.error("CDEK calculate error:", e)
    const message = e instanceof Error ? e.message : "Ошибка расчёта"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
