import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import "@/index.css";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ProductsPage from "@/pages/Products";
import InventoryPage from "@/pages/Inventory";
import OrdersPage from "@/pages/Orders";
import DealerBrowse from "@/pages/DealerBrowse";
import { DealersPage, SuppliersPage, MnpPage } from "@/pages/People";
import WarehousesPage from "@/pages/Warehouses";
import ProcurementPage from "@/pages/Procurement";
import PurchaseOrdersPage from "@/pages/PurchaseOrders";
import TallySyncPage from "@/pages/TallySync";
import AIInsightsPage from "@/pages/AIInsights";
import AnalyticsPage from "@/pages/Analytics";
import NotificationsPage from "@/pages/Notifications";
import AuditLogsPage from "@/pages/AuditLogs";
import SettingsPage from "@/pages/Settings";
import InvoicesPage from "@/pages/Invoices";

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading || user === null) return null;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />

            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

            {/* Admin + MNP + Dealer common */}
            <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />

            {/* Dealer */}
            <Route path="/browse" element={<ProtectedRoute roles={["dealer", "admin"]}><DealerBrowse /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute roles={["dealer", "admin"]}><InvoicesPage /></ProtectedRoute>} />

            {/* Admin / MNP */}
            <Route path="/products" element={<ProtectedRoute roles={["admin", "mnp"]}><ProductsPage /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute roles={["admin", "mnp"]}><InventoryPage /></ProtectedRoute>} />
            <Route path="/warehouses" element={<ProtectedRoute roles={["admin"]}><WarehousesPage /></ProtectedRoute>} />
            <Route path="/dealers" element={<ProtectedRoute roles={["admin", "mnp"]}><DealersPage /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute roles={["admin"]}><SuppliersPage /></ProtectedRoute>} />
            <Route path="/mnp" element={<ProtectedRoute roles={["admin"]}><MnpPage /></ProtectedRoute>} />
            <Route path="/procurement" element={<ProtectedRoute roles={["admin", "mnp"]}><ProcurementPage /></ProtectedRoute>} />
            <Route path="/purchase-orders" element={<ProtectedRoute roles={["admin", "supplier"]}><PurchaseOrdersPage /></ProtectedRoute>} />
            <Route path="/tally" element={<ProtectedRoute roles={["admin", "mnp"]}><TallySyncPage /></ProtectedRoute>} />
            <Route path="/ai-insights" element={<ProtectedRoute roles={["admin", "mnp"]}><AIInsightsPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute roles={["admin", "mnp"]}><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/audit" element={<ProtectedRoute roles={["admin"]}><AuditLogsPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute roles={["admin"]}><SettingsPage /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
