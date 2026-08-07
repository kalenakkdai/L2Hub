import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import type {
  GradebookAuthProvider,
  GradebookCommandProvider,
  GradebookDataProvider,
} from '../api/contracts'

export interface GradebookContextValue {
  dataProvider: GradebookDataProvider
  commandProvider?: GradebookCommandProvider | null
  authProvider: GradebookAuthProvider
}

const GradebookContext = createContext<GradebookContextValue | null>(null)

export interface GradebookProviderProps {
  dataProvider: GradebookDataProvider
  commandProvider?: GradebookCommandProvider | null
  authProvider: GradebookAuthProvider
  children: ReactNode
}

/**
 * Dependency injection boundary for Grades.
 * Pages/hooks read providers from context — never construct Supabase/FastAPI clients.
 */
export function GradebookProvider({
  dataProvider,
  commandProvider = null,
  authProvider,
  children,
}: GradebookProviderProps) {
  const value = useMemo(
    () => ({ dataProvider, commandProvider, authProvider }),
    [dataProvider, commandProvider, authProvider],
  )

  return (
    <GradebookContext.Provider value={value}>
      {children}
    </GradebookContext.Provider>
  )
}

export function useGradebookContext(): GradebookContextValue {
  const ctx = useContext(GradebookContext)
  if (!ctx) {
    throw new Error(
      'useGradebookContext must be used within a GradebookProvider',
    )
  }
  return ctx
}
