import { createContext, useContext, type ReactNode } from 'react'
import type { ClassOfficersDataProvider } from '../api/mockClassOfficersAdapter'
import type { ClassCohort } from '../types'

type ClassOfficersContextValue = {
  dataProvider: ClassOfficersDataProvider
  cohort: ClassCohort
  // setCohort removed — cohort is URL-driven for AC/ASBO tabs.
  canSwitchCohort: boolean
}

const ClassOfficersContext = createContext<ClassOfficersContextValue | null>(null)

export function ClassOfficersProvider({
  dataProvider,
  cohort,
  canSwitchCohort = false,
  children,
}: ClassOfficersContextValue & { children: ReactNode }) {
  return (
    <ClassOfficersContext.Provider
      value={{ dataProvider, cohort, canSwitchCohort }}
    >
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
