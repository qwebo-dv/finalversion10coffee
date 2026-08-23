import styles from "./loyalty-program-description.module.css"

export type LoyaltyProgramRules = {
  tiers: { minSubtotal: number; percent: number }[]
  maxRedemptionPercent: number
  expiryDays: number
}

export function LoyaltyProgramDescription({ rules }: { rules: LoyaltyProgramRules }) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Как работают баллы</h2>
      <div className={styles.body}>
        <div>
          <h3 className={styles.itemTitle}>Баллы — это рубли</h3>
          <p className={styles.paragraph}>1 балл = 1 ₽. Актуальный остаток и дату окончания срока действия можно посмотреть в личном кабинете.</p>
        </div>
        <div>
          <h3 className={styles.itemTitle}>Когда начисляются</h3>
          <p className={styles.paragraph}>Баллы начисляются после доставки оплаченного розничного заказа. Чем больше сумма товаров в заказе, тем выше кэшбэк.</p>
          <div className={styles.tiers}>
            {rules.tiers.map((tier) => <span key={tier.minSubtotal} className={styles.tier}>от {tier.minSubtotal.toLocaleString("ru-RU")} ₽ — {tier.percent}%</span>)}
          </div>
        </div>
        <div>
          <h3 className={styles.itemTitle}>Как потратить</h3>
          <p className={styles.paragraph}>Баллами можно оплатить кофе — до {rules.maxRedemptionPercent}% его стоимости. При оформлении заказа выберите «Списать баллы» и укажите нужную сумму.</p>
        </div>
        <div>
          <h3 className={styles.itemTitle}>Что нельзя совмещать</h3>
          <p className={styles.paragraph}>Баллы не суммируются с промокодом, персональной скидкой и другими скидками на заказ.</p>
        </div>
        <div>
          <h3 className={styles.itemTitle}>Срок действия</h3>
          <p className={styles.paragraph}>Баллы действуют {rules.expiryDays} дней. Новый доставленный и оплаченный заказ продлевает срок действия накопленных баллов.</p>
        </div>
        <div>
          <h3 className={styles.itemTitle}>Если заказ отменён или возвращён</h3>
          <p className={styles.paragraph}>Неиспользованные при отмене баллы возвращаются. При возврате заказа начисленные за него баллы отменяются, а использованные возвращаются на {rules.expiryDays} дней.</p>
        </div>
      </div>
    </section>
  )
}
