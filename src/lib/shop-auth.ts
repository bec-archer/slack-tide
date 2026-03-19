import { SupabaseClient } from '@supabase/supabase-js'
import type { ShopEmployeeRole } from '@/lib/types'

// =============================================================================
// Shop Auth Helper
// Checks whether the current user is an active shop employee and returns
// their shop context (shop_id, role). Used by all shop API routes.
// =============================================================================

export interface ShopContext {
  shop_id: string
  user_id: string
  role: ShopEmployeeRole
  employee_id: string
}

/**
 * Get the shop context for the current user.
 * Returns null if the user is not an active employee of any shop.
 * If shopId is provided, checks that specific shop. Otherwise returns
 * the first active shop membership found.
 */
export async function getShopContext(
  supabase: SupabaseClient,
  userId: string,
  shopId?: string
): Promise<ShopContext | null> {
  let query = supabase
    .from('shop_employees')
    .select('id, shop_id, user_id, role')
    .eq('user_id', userId)
    .is('removed_at', null)

  if (shopId) {
    query = query.eq('shop_id', shopId)
  }

  const { data, error } = await query.limit(1).single()

  if (error || !data) return null

  return {
    shop_id: data.shop_id,
    user_id: data.user_id,
    role: data.role as ShopEmployeeRole,
    employee_id: data.id,
  }
}

/**
 * Require the current user to be a shop admin for the given shop.
 * Returns the shop context if they are, null otherwise.
 */
export async function requireShopAdmin(
  supabase: SupabaseClient,
  userId: string,
  shopId: string
): Promise<ShopContext | null> {
  const ctx = await getShopContext(supabase, userId, shopId)
  if (!ctx || ctx.role !== 'admin') return null
  return ctx
}
