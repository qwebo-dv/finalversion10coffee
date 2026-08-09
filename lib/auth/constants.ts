export type CustomerSessionScope = "individual" | "business"

export const SESSION_COOKIE_NAMES: Record<CustomerSessionScope, string> = {
  individual: "coffee_shop_session",
  business: "coffee_business_session",
}
