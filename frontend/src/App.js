import React from "react";
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
import AnalyticsPage from "@/pages/Analytics";
import NotificationsPage from "@/pages/Notifications";
import AuditLogsPage from "@/pages/AuditLogs";
import SettingsPage from "@/pages/Settings";
import InvoicesPage from "@/pages/Invoices";

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading || user === null) return null;
  if (!user) return <Navigate to="/login" replace />;
  const savedPath = localStorage.getItem("yf_last_path");
  const targetPath = savedPath && savedPath !== "/" && savedPath !== "/login" ? savedPath : "/dashboard";
  return <Navigate to={targetPath} replace />;
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Dashboard — accessible to all logged-in users */}
            <Route path="/dashboard" element={<ProtectedRoute tabKey="dashboard"><Dashboard /></ProtectedRoute>} />

            {/* Common (Admin + MNP + Dealer) */}
            <Route path="/orders" element={<ProtectedRoute tabKey="orders"><OrdersPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute tabKey="notifications"><NotificationsPage /></ProtectedRoute>} />

            {/* Dealer-only */}
            <Route path="/browse" element={<ProtectedRoute roles={["dealer", "admin"]}><DealerBrowse /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute roles={["dealer", "admin"]}><InvoicesPage /></ProtectedRoute>} />

            {/* Admin / MNP — each gets its tabKey for staff gating */}
            <Route path="/analytics"       element={<ProtectedRoute roles={["admin", "mnp"]}     tabKey="analytics"      ><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/products"        element={<ProtectedRoute roles={["admin", "mnp"]}     tabKey="products"       ><ProductsPage /></ProtectedRoute>} />
            <Route path="/inventory"       element={<ProtectedRoute roles={["admin", "mnp"]}     tabKey="inventory"      ><InventoryPage /></ProtectedRoute>} />
            <Route path="/warehouses"      element={<ProtectedRoute roles={["admin"]}            tabKey="warehouses"     ><WarehousesPage /></ProtectedRoute>} />
            <Route path="/dealers"         element={<ProtectedRoute roles={["admin", "mnp"]}     tabKey="dealers"        ><DealersPage /></ProtectedRoute>} />
            <Route path="/suppliers"       element={<ProtectedRoute roles={["admin"]}            tabKey="suppliers"      ><SuppliersPage /></ProtectedRoute>} />
            <Route path="/mnp"             element={<ProtectedRoute roles={["admin"]}            tabKey="mnp"            ><MnpPage /></ProtectedRoute>} />
            <Route path="/procurement"     element={<ProtectedRoute roles={["admin", "mnp"]}     tabKey="procurement"    ><ProcurementPage /></ProtectedRoute>} />
            <Route path="/purchase-orders" element={<ProtectedRoute roles={["admin", "supplier"]}tabKey="purchase-orders"><PurchaseOrdersPage /></ProtectedRoute>} />
            <Route path="/tally"           element={<ProtectedRoute roles={["admin", "mnp"]}     tabKey="tally"          ><TallySyncPage /></ProtectedRoute>} />
            <Route path="/audit"           element={<ProtectedRoute roles={["admin"]}            tabKey="audit"          ><AuditLogsPage /></ProtectedRoute>} />
            <Route path="/settings"        element={<ProtectedRoute roles={["admin"]}            tabKey="settings"       ><SettingsPage /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
