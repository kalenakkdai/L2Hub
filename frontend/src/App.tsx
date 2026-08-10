import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './AppRoutes'
import { AuthProvider } from './auth/AuthProvider'
import { AppearanceEffect } from './components/AppearanceEffect'
import {
  LIVE_DEMO_BANNER_OFFSET,
  LiveDemoBanner,
} from './components/LiveDemoBanner'

function App() {
  return (
    <BrowserRouter>
      {/* Inside the router so auth-aware components can redirect. */}
      <AuthProvider>
        <AppearanceEffect />
        {/* TEMPORARY live-demo banner — delete LiveDemoBanner.tsx + this block after the demo. */}
        <LiveDemoBanner />
        <div className={LIVE_DEMO_BANNER_OFFSET}>
          <AppRoutes />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
