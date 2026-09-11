export interface Category {
  id: string
  name: string
  description?: string
  icon?: string
  color?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type CreateCategoryInput = Omit<Category, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateCategoryInput = Partial<CreateCategoryInput>
