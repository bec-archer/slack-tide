'use client'

import { createContext, useContext } from 'react'
import type { ShopEmployeeRole } from '@/lib/types'

interface ShopContextType {
  shopId: string | null
  role: ShopEmployeeRole | null
  employeeId: string | null
  shopName: string | null
  shopVerified: boolean
  isShopLoading: boolean
  isShopUser: boolean
  isShopAdmin: boolean
  refreshShopContext: () => Promise<void>
}

const ShopContext = createContext<ShopContextType | undefined>(undefined)

// Stubbed — shop_employees table does not exist in this project's database
export function ShopProvider({ children }: { children: React.ReactNode }) {
  return (
    <ShopContext.Provider
      value={{
        shopId: null,
        role: null,
        employeeId: null,
        shopName: null,
        shopVerified: false,
        isShopLoading: false,
        isShopUser: false,
        isShopAdmin: false,
        refreshShopContext: async () => {},
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
