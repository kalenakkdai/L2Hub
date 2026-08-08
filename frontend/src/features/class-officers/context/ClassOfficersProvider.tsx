import { createContext, useContext, type ReactNode } from 'react'
import type { ClassOfficersDataProvider } from '../api/mockClassOfficersAdapter'

type ClassOfficersContextValue = {
  dataProvider: ClassOfficersDataProvider
}

const ClassOfficersContext = createContext<ClassOfficersContextValue | null>(null)

export function ClassOfficersProvider({
  dataProvider,
  children,
}: ClassOfficersContextValue & { children: ReactNode }) {
  return (
    <ClassOfficersContext.Provider value={{ dataProvider }}>
      {children}
    </ClassOfficersContext.Provider>
  )
}

export function useClassOfficersContext() {
  const value = useContext(ClassOfficersContext)
  if (!value) {
    throw new Error('useClassOfficersContext requires ClassOfficersProvider')
  }
  return value
}
