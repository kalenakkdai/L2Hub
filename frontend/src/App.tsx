import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './AppRoutes'
import { AuthProvider } from './auth/AuthProvider'

function App() {
  return (
    <BrowserRouter>
      {/* Inside the router so auth-aware components can redirect. */}
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
