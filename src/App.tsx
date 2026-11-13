import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider, RequireAuth, SignedOutOnly } from './lib/auth'
import { ForgotPassword } from './pages/ForgotPassword'
import { Home } from './pages/Home'
import { NewTrip } from './pages/NewTrip'
import { ResetPassword } from './pages/ResetPassword'
import { SignIn } from './pages/SignIn'
import { SignUp } from './pages/SignUp'
import { TripPage } from './pages/TripPage'
import { Trips } from './pages/Trips'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sign-in" element={<SignedOutOnly><SignIn /></SignedOutOnly>} />
      <Route path="/sign-up" element={<SignedOutOnly><SignUp /></SignedOutOnly>} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/trips" element={<RequireAuth><Trips /></RequireAuth>} />
      <Route path="/trips/new" element={<RequireAuth><NewTrip /></RequireAuth>} />
      <Route path="/trips/:tripId" element={<RequireAuth><TripPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
