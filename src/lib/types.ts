// =============================================================================
// QRSTKR — Database Types
// =============================================================================

// -- Orders -------------------------------------------------------------------

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'generating'
  | 'generated'
  | 'printing'
  | 'shipped'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'refunded'

export type PaymentMethod = 'square' | 'coupon' | 'free_test'

export interface Order {
  id: string
  user_id: string | null
  status: OrderStatus
  payment_method: PaymentMethod | null
  payment_ref: string | null
  amount_cents: number
  currency: string
  shipping_name: string | null
  shipping_address: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_zip: string | null
  admin_notes: string | null
  created_at: string
  paid_at: string | null
  generated_at: string | null
  printed_at: string | null
  shipped_at: string | null
  completed_at: string | null
  updated_at: string
}

// -- Order Items --------------------------------------------------------------

export type OrderItemStatus = 'pending' | 'generating' | 'generated' | 'failed'

export interface StickerConfig {
  state_template: string
  qr_position_x: number
  qr_position_y: number
  qr_size: number
  color_bg: string
  color_stroke: string | null
  color_fill: string | null
  color_qr: string
  color_halo: string
  stroke_weight: number
  has_fill: boolean
  has_stroke: boolean
  gradient_enabled: boolean
  gradient_color1: string | null
  gradient_color2: string | null
  gradient_angle: number
}

export interface OrderItem {
  id: string
  order_id: string
  sticker_id: string | null
  status: OrderItemStatus
  design_svg: string | null  // Full SVG of customer's sticker design (captured from customizer)
  output_file_url: string | null
  output_format: string
  error_message: string | null
  qr_url: string | null
  short_code: string | null
  created_at: string
  generated_at: string | null
  // Spread from StickerConfig
  state_template: string
  qr_position_x: number
  qr_position_y: number
  qr_size: number
  color_bg: string
  color_stroke: string | null
  color_fill: string | null
  color_qr: string
  color_halo: string
  stroke_weight: number
  has_fill: boolean
  has_stroke: boolean
  gradient_enabled: boolean
  gradient_color1: string | null
  gradient_color2: string | null
  gradient_angle: number
}

// -- Coupons ------------------------------------------------------------------

export type DiscountType = 'full' | 'percent' | 'fixed_cents'

export interface Coupon {
  id: string
  code: string
  discount_type: DiscountType
  discount_value: number
  max_uses: number | null
  current_uses: number
  is_active: boolean
  valid_from: string | null
  valid_until: string | null
  description: string | null
  created_by: string | null
  created_at: string
}

export interface CouponValidation {
  valid: boolean
  coupon_id: string | null
  discount_type: DiscountType | null
  discount_value: number | null
  reason: string
}

// -- Existing tables (for reference) ------------------------------------------

export interface Sticker {
  id: string
  short_code: string
  status: 'unregistered' | 'active' | 'transferred' | 'deactivated' | 'replaced' | 'shop_managed'
  item_id: string | null
  state: string | null
  city: string | null
  lat: number | null
  lng: number | null
  batch_id: string | null
  created_at: string
}

export interface Item {
  id: string
  owner_id: string | null
  category: string
  nickname: string | null
  make: string
  model: string
  year: number
  serial_number: string | null
  custom_fields: Record<string, unknown> | null
  public_notes: string | null
  private_notes: string | null
  is_listed: boolean
  listing_price: number | null
  created_at: string
}

// -- Maintenance Records ------------------------------------------------------

export type MaintenanceRecordType = 'service' | 'repair' | 'upgrade' | 'inspection' | 'diagnostic' | 'other'
export type MaintenanceSource = 'owner_reported' | 'shop_submitted'

export interface MaintenanceRecord {
  id: string
  item_id: string
  created_by: string
  record_type: MaintenanceRecordType
  title: string
  description: string | null
  service_date: string
  cost_cents: number | null
  mileage: number | null
  provider: string | null
  // Shop-related fields
  visit_id: string | null
  mileage_at_service: number | null
  performed_by_shop: string | null
  submitted_by: string | null
  technicians: string[]   // names of techs who performed the work
  source: MaintenanceSource
  disputed: boolean
  disputed_at: string | null
  dispute_reason: string | null
  // Timestamps
  created_at: string
  updated_at: string
}

export interface CreateMaintenanceRequest {
  item_id: string
  record_type: MaintenanceRecordType
  title: string
  description?: string
  service_date: string    // YYYY-MM-DD
  cost_cents?: number
  mileage?: number
  provider?: string
}

// -- Shops --------------------------------------------------------------------

export type AccountType = 'personal' | 'business'

export type ShopCategory =
  | 'cars'
  | 'trucks'
  | 'boats'
  | 'motorcycles'
  | 'lawnmowers'
  | 'trailers'
  | 'RVs'
  | 'ATVs'
  | 'jet_skis'
  | 'generators'
  | 'heavy_equipment'
  | 'other'

export type ShopEmployeeRole = 'admin' | 'technician'
export type VerificationMethod = 'google_business' | 'manual_review'
export type NotificationType = 'new_shop_submission' | 'dispute_filed'

export interface Shop {
  id: string
  name: string
  address: string
  city: string
  state: string
  phone: string
  website: string | null
  categories_serviced: ShopCategory[]
  verified: boolean
  verified_at: string | null
  verified_method: VerificationMethod | null
  verification_requested: boolean
  verification_docs: Array<{ filename: string; url: string }> | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ShopEmployee {
  id: string
  shop_id: string
  user_id: string | null
  email: string | null
  phone: string | null
  role: ShopEmployeeRole
  invited_by: string
  invited_at: string
  accepted_at: string | null
  removed_at: string | null
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  related_item_id: string | null
  related_record_id: string | null
  read_at: string | null
  created_at: string
}

// -- Shop API Request Types ---------------------------------------------------

export interface CreateShopRequest {
  name: string
  address: string
  city: string
  state: string
  phone: string
  website?: string
  categories_serviced: ShopCategory[]
}

export interface ServiceVisitLineItem {
  record_type: MaintenanceRecordType
  title: string
  description?: string
  cost_cents?: number
}

export interface CreateServiceVisitRequest {
  item_id: string
  service_date: string              // YYYY-MM-DD
  mileage_at_service?: number
  technicians?: string[]            // names of techs who worked on it
  line_items: ServiceVisitLineItem[]
  // Attachment handled separately via file upload
}

export interface DisputeRecordRequest {
  reason: string
}

// -- API Request/Response types -----------------------------------------------

export interface CreateOrderRequest {
  sticker_config: StickerConfig
  design_svg: string  // Captured SVG of the sticker design as rendered in customizer
  payment_method: PaymentMethod
  payment_ref?: string  // coupon code or Square transaction ID
  shipping?: {
    name: string
    address: string
    city: string
    state: string
    zip: string
  }
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[]
}
