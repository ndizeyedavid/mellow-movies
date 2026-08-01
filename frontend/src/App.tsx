import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import BrowsePage from './pages/BrowsePage'
import MoviesPage from './pages/MoviesPage'
import ShowsPage from './pages/ShowsPage'
import SupportPage from './pages/SupportPage'
import SubscriptionPage from './pages/SubscriptionPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'browse', element: <BrowsePage /> },
      { path: 'movies', element: <MoviesPage /> },
      { path: 'shows', element: <ShowsPage /> },
      { path: 'support', element: <SupportPage /> },
      { path: 'pricing', element: <SubscriptionPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
