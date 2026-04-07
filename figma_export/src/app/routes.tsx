import { createBrowserRouter } from 'react-router';
import OperationalDashboard from './pages/OperationalDashboard';
import LogisticsDashboard from './pages/LogisticsDashboard';
import BusinessDashboard from './pages/BusinessDashboard';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: OperationalDashboard,
  },
  {
    path: '/logistics',
    Component: LogisticsDashboard,
  },
  {
    path: '/business',
    Component: BusinessDashboard,
  },
]);
