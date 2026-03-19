'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ShopEmployeeRole } from '@/lib/types'

interface ShopContextType {
  /** The shop this user belongs to (null if not a shop employee) */
  shopId: string | null
  /** The user's role in the shop */
  role: ShopEmployeeRole | null
  /** The shop_employees row ID */
  employeeId: string | null
  /** The shop's display name */
  shopName: string | null
  /** Whether the shop is verified */
  shopVerified: boolean
  /** Whether we're still loading shop context */
  isShopLoading: boolean
  /** Whether the current user is a shop employee at all */
  isShopUser: boolean
  /** Whether the current user is a shop admin */
  isShopAdmin: boolean
  /** Re-fetch shop context (e.g. after registration) */
  refreshShopContext: () => Promise<void>
}

const ShopContext = createContext<ShopContextType | undefined>(undefined)

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth()
  const [shopId, setShopId] = useState<string | null>(null)
  const [role, setRole] = useState<ShopEmployeeRole | null>(null)
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [shopName, setShopName] = useState<string | null>(null)
  const [shopVerified, setShopVerified] = useState(false)
  const [isShopLoading, setIsShopLoading] = useState(true)

  const supabase = createBrowserClient()

  const fetchShopContext = useCallback(async () => {
    if (!user) {
      setShopId(null)
      setRole(null)
      setEmployeeId(null)
      setShopName(null)
      setShopVerified(false)
      setIsShopLoading(false)
      return
    }

    setIsShopLoading(true)

    try {
      // Find the user's active shop_employees row (not removed)
      const { data: employee, error: empError } = await supabase
        .from('shop_employees')
        .select('id, shop_id, role')
        .eq('user_id', user.id)
        .is('removed_at', null)
        .limit(1)
        .maybeSingle()

      if (empError || !employee) {
        setShopId(null)
        setRole(null)
        setEmployeeId(null)
        setShopName(null)
        setShopVerified(false)
        setIsShopLoading(false)
        return
      }

      // Fetch the shop's basic info
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('name, verified')
        .eq('id', employee.shop_id)
        .single()

      if (shopError || !shop) {
        setShopId(null)
        setRole(null)
        setEmployeeId(null)
        setShopName(null)
        setShopVerified(false)
        setIsShopLoading(false)
        return
      }

      setShopId(employee.shop_id)
      setRole(employee.role as ShopEmployeeRole)
      setEmployeeId(employee.id)
      setShopName(shop.name)
      setShopVerified(shop.verified)
    } catch {
      setShopId(null)
      setRole(null)
      setEmployeeId(null)
      setShopName(null)
      setShopVerified(false)
    } finally {
      setIsShopLoading(false)
    }
  }, [user, supabase])

  useEffect(() => {
    if (!isAuthLoading) {
      fetchShopContext()
    }
  }, [isAuthLoading, fetchShopContext])

  const isShopUser = shopId !== null
  const isShopAdmin = isShopUser && role === 'admin'

  return (
    <ShopContext.Provider
      value={{
        shopId,
        role,
        employeeId,
        shopName,
        shopVerified,
        isShopLoading,
        isShopUser,
        isShopAdmin,
        refreshShopContext: fetchShopContext,
      }}
    >
      {children}
    </ShopContext.Provider>
  )
}

export function useShop() {
  const context = useContext(ShopContext)
  if (context === undefined) {
    throw new Error('useShop must be used within a ShopProvider')
  }
  return context
}
