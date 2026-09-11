export interface ItemTemplate {
  id: string
  name: string
  categoryId?: string
  defaultUnit: string
  defaultQuantity: number
  defaultExpirationDays?: number
  defaultStorageLocationId?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export type CreateTemplateInput = Omit<ItemTemplate, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateTemplateInput = Partial<CreateTemplateInput>
