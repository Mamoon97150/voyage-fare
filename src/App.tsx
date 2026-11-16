import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { useEffect } from 'react'
import { clearLinkErrorAtStart, linkError, linkErrorAtStart, linkKind } from './lib/linkAtStart'
import { AuthProvider, RequireAuth, SignedOutOnly } from './lib/auth'
import { OfflineStrip } from './components/PhoneApp'
import { Account } from './pages/Account'
import { Admin } from './pages/Admin'
import { Compare } from './pages/Compare'
import { Demo } from './pages/Demo'
import { ForgotPassword } from './pages/ForgotPassword'
import { Home } from './pages/Home'
import { JoinTrip } from './pages/JoinTrip'
import { LinkExpired } from './pages/LinkExpired'
import { RoutePage } from './pages/RoutePage'
import { NewTrip } from './pages/NewTrip'
import { ImportIntoTrip, ImportNewTrip } from './pages/ImportFromAi'
import { Privacy } from './pages/Privacy'
import { ResetPassword } from './pages/ResetPassword'
import { SharePage } from './pages/SharePage'
import { SharedTrip } from './pages/SharedTrip'
import { SignIn } from './pages/SignIn'
import { SignUp } from './pages/SignUp'
import { TripPage } from './pages/TripPage'
import { Budget } from './pages/Budget'
import { BookingEmail } from './pages/BookingEmail'
import { WhoPaid } from './pages/WhoPaid'
import { TripSettings } from './pages/TripSettings'
import { Trips } from './pages/Trips'

/**
 * An email link that came back with an error (too old, already used): say so, on its own page.
 * The error is read from the address, or from what was captured before Supabase cleared it.
 */
function LinkErrors() {
  const location = useLocation()
  const onPage = location.pathname === '/link-expired'
  useEffect(() => {
    if (onPage) clearLinkErrorAtStart()
  }, [onPage])
  if (onPage) return null
  const fromAddress = linkError(location) ? linkKind(location.pathname) : null
  const kind = fromAddress ?? linkErrorAtStart()?.kind
  if (!kind) return null
  return <Navigate to={`/link-expired?kind=${kind}`} replace />
}

export function AppRoutes() {
  return (
    <>
      <LinkErrors />
      <OfflineStrip />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/sign-in"
          element={
            <SignedOutOnly>
              <SignIn />
            </SignedOutOnly>
          }
        />
        <Route
          path="/sign-up"
          element={
            <SignedOutOnly>
              <SignUp />
            </SignedOutOnly>
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/join/:token" element={<JoinTrip />} />
        <Route path="/demo/*" element={<Demo />} />
        <Route path="/s/:token/*" element={<SharedTrip />} />
        <Route path="/link-expired" element={<LinkExpired />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route
          path="/trips"
          element={
            <RequireAuth>
              <Trips />
            </RequireAuth>
          }
        />
        <Route
          path="/trips/new"
          element={
            <RequireAuth>
              <NewTrip />
            </RequireAuth>
          }
        />
        <Route
          path="/trips/import"
          element={
            <RequireAuth>
              <ImportNewTrip />
            </RequireAuth>
          }
        />
        <Route
          path="/trips/:tripId/import"
          element={
            <RequireAuth>
              <ImportIntoTrip />
            </RequireAuth>
          }
        />
        <Route
          path="/trips/:tripId/booking-email"
          element={
            <RequireAuth>
              <BookingEmail />
            </RequireAuth>
          }
        />
        <Route
          path="/trips/:tripId"
          element={
            <RequireAuth>
              <TripPage />
            </RequireAuth>
          }
        />
        <Route
          path="/trips/:tripId/compare"
          element={
            <RequireAuth>
              <Compare />
            </RequireAuth>
          }
        />
        <Route
          path="/trips/:tripId/budget"
          element={
            <RequireAuth>
              <Budget />
            </RequireAuth>
          }
        />
        <Route
          path="/trips/:tripId/who-paid"
          element={
            <RequireAuth>
              <WhoPaid />
            </RequireAuth>
          }
        />
        <Route
          path="/trips/:tripId/route"
          element={
            <RequireAuth>
              <RoutePage />
            </RequireAuth>
          }
        />
        <Route
          path="/trips/:tripId/settings"
          element={
            <RequireAuth>
              <TripSettings />
            </RequireAuth>
          }
        />
        <Route
          path="/share"
          element={
            <RequireAuth>
              <SharePage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <Admin />
            </RequireAuth>
          }
        />
        <Route
          path="/account"
          element={
            <RequireAuth>
              <Account />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
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
