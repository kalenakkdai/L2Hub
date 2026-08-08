import { createContext, useContext, type ReactNode } from 'react'
import type {
  EventPlanningAuthProvider,
  EventPlanningDataProvider,
} from '../api/mockPlanningAdapter'

type EventPlanningContextValue = {
  dataProvider: EventPlanningDataProvider
  authProvider: EventPlanningAuthProvider
}

const EventPlanningContext = createContext<EventPlanningContextValue | null>(
  null,
)

export function EventPlanningProvider({
  dataProvider,
  authProvider,
  children,
}: EventPlanningContextValue & { children: ReactNode }) {
  return (
    <EventPlanningContext.Provider value={{ dataProvider, authProvider }}>
      {children}
    </EventPlanningContext.Provider>
  )
}

export function useEventPlanningContext() {
  const value = useContext(EventPlanningContext)
  if (!value) {
    throw new Error('useEventPlanningContext requires EventPlanningProvider')
  }
  return value
}
