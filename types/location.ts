export interface Location {
  id: string
  name: string
  description?: string
  icon?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type CreateLocationInput = Omit<Location, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateLocationInput = Partial<CreateLocationInput>
