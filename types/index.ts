// ============================================================
// Enums
// ============================================================

export type AdminRole = "ADMIN" | "MANAGER"

export type OrderStatus =
  | "new"
  | "confirmed"
  | "invoiced"
  | "paid"
  | "in_production"
  | "ready"
  | "shipped"
  | "delivered"
  | "returned"
  | "cancelled"

export type DeliveryMethod = "self_pickup" | "cdek" | "cap_2000" | "sochi_delivery"

export type ProductType = "coffee" | "tea" | "accessory" | (string & {})
export type ProductDetailsSchema = "generic" | "coffee" | "tea"

export interface ProductTypeOption {
  id: string
  slug: ProductType
  name: string
  icon_url: string | null
  sort_order: number
  product_count: number
  details_schema: ProductDetailsSchema
}

export type StickerType = string

export interface ProductTag {
  id: string
  name: string
  slug: string
  color?: string
}

export type NotificationType = "order_update" | "news" | "product_restock"

export type PromoDiscountType = "percentage" | "fixed_amount"
export type CustomerType = "individual" | "business"

// ============================================================
// User types
// ============================================================

export interface ClientProfile {
  id: string
  email: string
  full_name: string
  phone: string | null
  address?: string | null
  customer_type?: CustomerType
  created_at: string
  updated_at: string
}

export interface AdminProfile {
  id: string
  email: string
  full_name: string
  role: AdminRole
  invited_by: string | null
  created_at: string
  updated_at: string
}

export interface AdminInvitation {
  id: string
  email: string
  role: AdminRole
  invited_by: string
  token: string
  expires_at: string
  used_at: string | null
  created_at: string
}

// ============================================================
// Company
// ============================================================

export interface Company {
  id: string
  client_id: string
  name: string
  inn: string
  kpp: string | null
  ogrn: string | null
  legal_address: string | null
  actual_address: string | null
  bank_name: string | null
  bik: string | null
  correspondent_account: string | null
  settlement_account: string | null
  contact_person: string | null
  contact_phone: string | null
  contact_email: string | null
  moysklad_counterparty_id: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// Category
// ============================================================

export interface Category {
  id: string
  parent_id: string | null
  name: string
  slug: string
  product_type: ProductType
  description: string | null
  sort_order: number
  depth: number
  path: string
  is_visible: boolean
  created_at: string
  updated_at: string
  children?: Category[]
}

// ============================================================
// Product
// ============================================================

export interface BrewingMethod {
  method: string
  description: string
  image_url?: string
}

export interface CoffeeBrewingGuide {
  id: string
  title: string
  description: string
  content: string
  image_url?: string
}

export interface BrewingInstruction {
  title: string
  text: string
  image_url?: string
}

export interface AttachedFile {
  name: string
  url: string
  size: number
}

export interface ProductReview {
  id: string
  author_name: string | null
  rating: number
  comment: string | null
  created_at: string
  client_id?: string | null
  status?: "pending" | "approved" | "rejected" | string | null
}

export interface Product {
  id: string
  category_id: string
  category_ids?: string[]
  product_type: ProductType
  product_type_name: string
  product_type_schema: ProductDetailsSchema
  name: string
  slug: string
  moysklad_id?: string | null
  description: string | null
  description_images: string[]
  sort_order: number
  is_visible: boolean
  is_popular: boolean
  stickers: ProductTag[]

  // Rating & reviews
  rating?: number
  reviews_count?: number
  reviews?: ProductReview[]

  // Coffee-specific
  roaster: string | null
  roast_level: string | null
  country: string | null
  region: string | null
  processing_method: string | null
  taste_description: string | null
  acidity: number | null
  bitterness: number | null
  sweetness: number | null
  body: number | null
  coffee_group: "espresso" | "filter" | "drip" | null
  growing_height: string | null
  q_grader_rating: number | null

  // Tea-specific
  brewing_instructions: BrewingInstruction[] | null

  // Coffee brewing methods
  brewing_methods: BrewingMethod[] | null

  // Attached files
  attached_files: AttachedFile[] | null

  // Media
  images: string[]
  video_urls: string[]

  created_at: string
  updated_at: string

  // Relations
  variants?: ProductVariant[]
  category?: Category
}

export interface ProductVariant {
  id: string
  product_id: string
  name: string
  sku: string | null
  moysklad_id?: string | null
  moysklad_type?: "product" | "variant" | "service" | null
  price: number
  weight_grams: number | null
  is_available: boolean
  sort_order: number
  grind_options: string[]
  created_at: string
  updated_at: string
}

// ============================================================
// Cart
// ============================================================

export interface CartItem {
  id: string
  client_id: string
  product_id: string
  variant_id: string
  quantity: number
  grind_option: string | null
  created_at: string
  updated_at: string

  // Relations (joined)
  product?: Product
  variant?: ProductVariant
}

// ============================================================
// Order
// ============================================================

export interface Order {
  id: string
  order_id: string
  client_id: string
  customer_type?: CustomerType
  checkout_mode?: "account" | "guest"
  customer_full_name?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  payment_method?: "invoice" | "yookassa" | "sber_online"
  payment_external_id?: string | null
  payment_url?: string | null
  company_name: string | null
  company_inn: string | null
  status: OrderStatus
  payment_status: string
  delivery_method: DeliveryMethod
  delivery_address: string | null
  subtotal: number
  discount_amount: number
  delivery_cost: number
  total: number
  total_weight_grams: number
  promo_code_id: string | null
  comment: string | null
  admin_notes: string | null
  cdek_tracking_number: string | null
  cap_2000_tracking_number: string | null
  moysklad_counterparty_id?: string | null
  moysklad_customer_order_id?: string | null
  moysklad_invoice_out_id?: string | null
  moysklad_stock_loss_id?: string | null
  moysklad_stock_loss_synced_at?: string | null
  moysklad_stock_loss_error?: string | null
  moysklad_sync_status?: string | null
  moysklad_sync_error?: string | null
  moysklad_synced_at?: string | null
  created_at: string
  updated_at: string

  // Relations
  items?: OrderItem[]
  client?: ClientProfile
  promo_code?: PromoCode
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  variant_id: string
  product_name: string
  variant_name: string
  grind_option: string | null
  quantity: number
  unit_price: number
  total_price: number
  discount_percent?: number
  discount_amount?: number
  weight_grams: number | null
  stock_product_moysklad_id?: string | null
  stock_quantity_kg?: number | null
  stock_price_per_kg?: number | null
}

export interface OrderStatusHistory {
  id: string
  order_id: string
  old_status: OrderStatus | null
  new_status: OrderStatus
  changed_by: string
  note: string | null
  created_at: string
}

// ============================================================
// Promo Code
// ============================================================

export interface PromoCode {
  id: string
  code: string
  discount_type: PromoDiscountType
  discount_value: number
  audience?: "all" | CustomerType
  applicable_products?: string[]
  is_single_use: boolean
  max_uses: number | null
  current_uses: number
  restricted_to_email: string | null
  restricted_to_client_id: string | null
  min_order_amount: number | null
  starts_at: string
  expires_at: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// Favorites
// ============================================================

export interface Favorite {
  id: string
  client_id: string
  product_id: string
  created_at: string
  product?: Product
}

// ============================================================
// Notification
// ============================================================

export interface Notification {
  id: string
  client_id: string
  type: NotificationType
  title: string
  message: string
  data: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

// ============================================================
// News
// ============================================================

export interface News {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  cover_image: string | null
  is_published: boolean
  published_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// Blog Post
// ============================================================

export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: unknown
  coverImage: string | null
  isPublished: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

// ============================================================
// Client Settings
// ============================================================

export interface ClientSettings {
  id: string
  client_id: string
  quick_comments: string[]
  default_company_id: string | null
  default_delivery_method: DeliveryMethod | null
  created_at: string
  updated_at: string
}
