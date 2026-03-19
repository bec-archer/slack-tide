import { SupabaseClient } from '@supabase/supabase-js'
import type { ShopEmployeeRole } from '@/lib/types'

export interface ShopContext {
  shop_id: string
  user_id: string
  role: ShopEmployeeRole
  employee_id: string
}

// Stubbed — shop_employees table does not exist in this project's database
export async function getShopContext(
  _supabase: SupabaseClient,
  _userId: string,
  _shopId?: string
): Promise<ShopContext | null> {
  return null
}

export async function requireShopAdmin(
  _supabase: SupabaseClient,
  _userId: string,
  _shopId: string
): Promise<ShopContext | null> {
  return null
}
