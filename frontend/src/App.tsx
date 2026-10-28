import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ButcheryPage from './pages/hayvanci/ButcheryPage';
import RawMaterialsPage from './pages/hayvanci/RawMaterialsPage';
import OrdersPage from './pages/hayvanci/OrdersPage';
import ProducerListingsPage from './pages/hayvanci/ProducerListingsPage';
import FarmerListingsPage from './pages/hayvanci/FarmerListingsPage';
import FarmerSalesPage from './pages/hayvanci/FarmerSalesPage';
import ProductionPage from './pages/sucukcu/ProductionPage';
import ProducerOrdersPage from './pages/sucukcu/ProducerOrdersPage';
import ProducerListingsManagePage from './pages/sucukcu/ProducerListingsManagePage';
import MarketListingsPage from './pages/market/MarketListingsPage';
import PurchasesPage from './pages/market/PurchasesPage';
import LotsPage from './pages/shared/LotsPage';
import LotTracePage from './pages/shared/LotTracePage';
import RecallPage from './pages/shared/RecallPage';
import ReportsPage from './pages/shared/ReportsPage';
import { InvoicesPage } from './pages/shared/InvoicesPage';
import { LanguageProvider } from './i18n';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }
          >
            <Route index                           element={<DashboardPage />} />
            {/* İşletme */}
            <Route path="butchery"                 element={<ButcheryPage />} />
            <Route path="raw-materials"            element={<RawMaterialsPage />} />
            <Route path="orders"                   element={<OrdersPage />} />
            <Route path="producer-listings"        element={<ProducerListingsPage />} />
            <Route path="farmer-listings"          element={<FarmerListingsPage />} />
            <Route path="sales"                    element={<FarmerSalesPage />} />
            {/* Üretici */}
            <Route path="producer-listings-manage" element={<ProducerListingsManagePage />} />
            <Route path="production"               element={<ProductionPage />} />
            <Route path="producer-orders"          element={<ProducerOrdersPage />} />
            <Route path="sucukcu/production"       element={<ProductionPage />} />
            <Route path="sucukcu/producer-orders"  element={<ProducerOrdersPage />} />
            {/* Market */}
            <Route path="market-listings"          element={<MarketListingsPage />} />
            <Route path="purchases"                element={<PurchasesPage />} />
            {/* Ortak */}
            <Route path="lots"                     element={<LotsPage />} />
            <Route path="lots/:id/trace"           element={<LotTracePage />} />
            <Route path="recalls"                  element={<RecallPage />} />
            <Route path="reports"                  element={<ReportsPage />} />
            <Route path="invoices"                 element={<InvoicesPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
