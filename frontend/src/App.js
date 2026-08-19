import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import "@/index.css";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "@/pages/Login";
import ErrorBoundary from "@/components/ErrorBoundary";
import { CircleNotch } from "@phosphor-icons/react";

// Lazy load page components for UI speed optimization
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const ProductsPage = lazy(() => import("@/pages/Products"));
const InventoryPage = lazy(() => import("@/pages/Inventory"));
const OrdersPage = lazy(() => import("@/pages/Orders"));
const DealerBrowse = lazy(() => import("@/pages/DealerBrowse"));
const WarehousesPage = lazy(() => import("@/pages/Warehouses"));
const ProcurementPage = lazy(() => import("@/pages/Procurement"));
const PurchaseOrdersPage = lazy(() => import("@/pages/PurchaseOrders"));
const TallySyncPage = lazy(() => import("@/pages/TallySync"));
const AnalyticsPage = lazy(() => import("@/pages/Analytics"));
const NotificationsPage = lazy(() => import("@/pages/Notifications"));
const AuditLogsPage = lazy(() => import("@/pages/AuditLogs"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const InvoicesPage = lazy(() => import("@/pages/Invoices"));

// Lazy load named exports from People.js
const DealersPage = lazy(() => import("@/pages/People").then(m => ({ default: m.DealersPage })));
const SuppliersPage = lazy(() => import("@/pages/People").then(m => ({ default: m.SuppliersPage })));
const MnpPage = lazy(() => import("@/pages/People").then(m => ({ default: m.MnpPage })));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F5F7]">
      <CircleNotch size={32} className="animate-spin text-[#F28C18]" />
    </div>
  );
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading || user === null) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  const savedPath = localStorage.getItem("yf_last_path");
  const targetPath = savedPath && savedPath !== "/" && savedPath !== "/login" ? savedPath : "/dashboard";
  return <Navigate to={targetPath} replace />;
}

export default function App() {
  return (
    <div className="App">
      <ErrorBoundary>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
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

              {/* Lazy load named exports from People.js */}
              {/* Admin / CNF / MNP — each gets its tabKey for staff gating */}
              <Route path="/analytics"       element={<ProtectedRoute roles={["admin", "cnf", "mnp"]} tabKey="analytics"      ><AnalyticsPage /></ProtectedRoute>} />
              <Route path="/products"        element={<ProtectedRoute roles={["admin", "cnf", "mnp"]} tabKey="products"       ><ProductsPage /></ProtectedRoute>} />
              <Route path="/inventory"       element={<ProtectedRoute roles={["admin", "cnf", "mnp"]} tabKey="inventory"      ><InventoryPage /></ProtectedRoute>} />
              <Route path="/warehouses"      element={<ProtectedRoute roles={["admin"]}               tabKey="warehouses"     ><WarehousesPage /></ProtectedRoute>} />
              <Route path="/dealers"         element={<ProtectedRoute roles={["admin", "cnf", "mnp"]} tabKey="dealers"        ><DealersPage /></ProtectedRoute>} />
              <Route path="/suppliers"       element={<ProtectedRoute roles={["admin"]}               tabKey="suppliers"      ><SuppliersPage /></ProtectedRoute>} />
              <Route path="/cnf"             element={<ProtectedRoute roles={["admin", "cnf", "mnp"]} tabKey="cnf"            ><MnpPage /></ProtectedRoute>} />
              <Route path="/mnp"             element={<ProtectedRoute roles={["admin", "cnf", "mnp"]} tabKey="cnf"            ><MnpPage /></ProtectedRoute>} />
              <Route path="/procurement"     element={<ProtectedRoute roles={["admin", "cnf", "mnp"]} tabKey="procurement"    ><ProcurementPage /></ProtectedRoute>} />
              <Route path="/purchase-orders" element={<ProtectedRoute roles={["admin", "supplier"]}   tabKey="purchase-orders"><PurchaseOrdersPage /></ProtectedRoute>} />
              <Route path="/tally"           element={<ProtectedRoute roles={["admin", "cnf", "mnp"]} tabKey="tally"          ><TallySyncPage /></ProtectedRoute>} />
              <Route path="/audit"           element={<ProtectedRoute roles={["admin"]}               tabKey="audit"          ><AuditLogsPage /></ProtectedRoute>} />
              <Route path="/settings"        element={<ProtectedRoute roles={["admin"]}               tabKey="settings"       ><SettingsPage /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  </div>
);
}

