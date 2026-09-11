export interface Item {
  id: string
  name: string
  templateId?: string
  categoryId?: string
  locationId: string
  quantity: number
  unit: string
  expirationDate?: string
  purchaseDate?: string
  notes?: string
  createdById: string
  createdAt: string
  updatedAt: string
}

export type CreateItemInput = Omit<Item, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateItemInput = Partial<CreateItemInput>

export type ItemFormOutput = Omit<CreateItemInput, 'createdById'>
