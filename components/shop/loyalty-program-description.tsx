export type LoyaltyProgramRules = {
  tiers: { minSubtotal: number; percent: number }[]
  maxRedemptionPercent: number
  expiryDays: number
}

export function LoyaltyProgramDescription({ rules }: { rules: LoyaltyProgramRules }) {
  return (
    <section className="rounded-3xl border border-neutral-100 bg-white p-5 sm:p-6">
      <h2 className="text-xl font-black text-neutral-900">Как работают баллы</h2>
      <div className="mt-5 space-y-5 text-sm leading-6 text-neutral-600">
        <div>
          <h3 className="font-black text-neutral-900">Баллы — это рубли</h3>
          <p className="mt-1">1 балл = 1 ₽. Актуальный остаток и дату окончания срока действия можно посмотреть в личном кабинете.</p>
        </div>
        <div>
          <h3 className="font-black text-neutral-900">Когда начисляются</h3>
          <p className="mt-1">Баллы начисляются после доставки оплаченного розничного заказа. Чем больше сумма товаров в заказе, тем выше кэшбэк.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {rules.tiers.map((tier) => <span key={tier.minSubtotal} className="rounded-full bg-[#f4edfa] px-3 py-1.5 text-xs font-bold text-[#5b328a]">от {tier.minSubtotal.toLocaleString("ru-RU")} ₽ — {tier.percent}%</span>)}
          </div>
        </div>
        <div>
          <h3 className="font-black text-neutral-900">Как потратить</h3>
          <p className="mt-1">Баллами можно оплатить кофе — до {rules.maxRedemptionPercent}% его стоимости. При оформлении заказа выберите «Списать баллы» и укажите нужную сумму.</p>
        </div>
        <div>
          <h3 className="font-black text-neutral-900">Что нельзя совмещать</h3>
          <p className="mt-1">Баллы не суммируются с промокодом, персональной скидкой и другими скидками на заказ.</p>
        </div>
        <div>
          <h3 className="font-black text-neutral-900">Срок действия</h3>
          <p className="mt-1">Баллы действуют {rules.expiryDays} дней. Новый доставленный и оплаченный заказ продлевает срок действия накопленных баллов.</p>
        </div>
        <div>
          <h3 className="font-black text-neutral-900">Если заказ отменён или возвращён</h3>
          <p className="mt-1">Неиспользованные при отмене баллы возвращаются. При возврате заказа начисленные за него баллы отменяются, а использованные возвращаются на {rules.expiryDays} дней.</p>
        </div>
      </div>
    </section>
  )
}
