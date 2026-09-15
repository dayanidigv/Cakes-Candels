import React, { useState } from 'react';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import Organizations from './pages/Organizations';
import Branches from './pages/Branches';
import Registers from './pages/Registers';
import Roles from './pages/Roles';
import Settings from './pages/Settings';
import FeatureFlags from './pages/FeatureFlags';
import Products from './pages/masters/Products';
import Taxes from './pages/masters/Taxes';
import Uoms from './pages/masters/Uoms';
import Categories from './pages/masters/Categories';
import Brands from './pages/masters/Brands';
import Suppliers from './pages/masters/Suppliers';
import StorageLocations from './pages/masters/StorageLocations';
import ProductAttributes from './pages/masters/ProductAttributes';
import RecipeMasters from './pages/masters/RecipeMasters';
import SupplierItems from './pages/masters/SupplierItems';
import NumberSeries from './pages/masters/NumberSeries';
import ApprovalWorkflows from './pages/masters/ApprovalWorkflows';
import NotificationTemplates from './pages/masters/NotificationTemplates';
import ReasonMasters from './pages/masters/ReasonMasters';
import PaymentMethods from './pages/masters/PaymentMethods';
import Vehicles from './pages/masters/Vehicles';
import Designations from './pages/masters/Designations';
import StockLevels from './pages/inventory/StockLevels';
import StockTransfers from './pages/inventory/StockTransfers';
import WastageLogs from './pages/inventory/WastageLogs';
import ProductionOrders from './pages/production/ProductionOrders';
import PurchaseOrders from './pages/procurement/PurchaseOrders';
import CustomCakes from './pages/sales/CustomCakes';
import CRMCustomers from './pages/crm/Customers';
import CrmDashboardPage from './pages/crm/CrmDashboardPage';
import CrmSegmentsPage from './pages/crm/CrmSegmentsPage';
import CrmAutomationsPage from './pages/crm/CrmAutomationsPage';
import Expenses from './pages/finance/Expenses';
import CashRegisters from './pages/finance/CashRegisters';
import SupplierLedger from './pages/finance/SupplierLedger';
import Attendance from './pages/hr/Attendance';
import Leaves from './pages/hr/Leaves';
import ActiveTrips from './pages/logistics/ActiveTrips';
import AuditLogs from './pages/AuditLogs';
import Notifications from './pages/Notifications';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const triggerAlert = (message: string, isError = false) => {
    alert(message);
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'organizations': return <Organizations triggerAlert={triggerAlert} />;
      case 'branches': return <Branches triggerAlert={triggerAlert} />;
      case 'registers': return <Registers triggerAlert={triggerAlert} />;
      case 'roles': return <Roles triggerAlert={triggerAlert} />;
      case 'settings': return <Settings triggerAlert={triggerAlert} />;
      case 'flags': return <FeatureFlags triggerAlert={triggerAlert} />;
      case 'products': return <Products triggerAlert={triggerAlert} />;
      case 'taxes': return <Taxes triggerAlert={triggerAlert} />;
      case 'uoms': return <Uoms triggerAlert={triggerAlert} />;
      case 'categories': return <Categories triggerAlert={triggerAlert} />;
      case 'brands': return <Brands triggerAlert={triggerAlert} />;
      case 'suppliers': return <Suppliers triggerAlert={triggerAlert} />;
      case 'storage': return <StorageLocations triggerAlert={triggerAlert} />;
      case 'productattributes': return <ProductAttributes triggerAlert={triggerAlert} />;
      case 'recipemasters': return <RecipeMasters triggerAlert={triggerAlert} />;
      case 'supplieritems': return <SupplierItems triggerAlert={triggerAlert} />;
      case 'numberseries': return <NumberSeries triggerAlert={triggerAlert} />;
      case 'approvalworkflows': return <ApprovalWorkflows triggerAlert={triggerAlert} />;
      case 'notificationtemplates': return <NotificationTemplates triggerAlert={triggerAlert} />;
      case 'reasonmasters': return <ReasonMasters triggerAlert={triggerAlert} />;
      case 'paymentmethods': return <PaymentMethods triggerAlert={triggerAlert} />;
      case 'vehicles': return <Vehicles triggerAlert={triggerAlert} />;
      case 'designations': return <Designations triggerAlert={triggerAlert} />;
      case 'stocklevels': return <StockLevels triggerAlert={triggerAlert} />;
      case 'stocktransfers': return <StockTransfers triggerAlert={triggerAlert} />;
      case 'wastagelogs': return <WastageLogs triggerAlert={triggerAlert} />;
      case 'productionorders': return <ProductionOrders />;
      case 'purchaseorders': return <PurchaseOrders />;
      // Sales / Custom Cakes
      case 'customcakes': return <CustomCakes triggerAlert={triggerAlert} />;
      // CRM
      case 'crm_dashboard': return <CrmDashboardPage />;
      case 'crm_customers': return <CRMCustomers triggerAlert={triggerAlert} />;
      case 'crm_segments': return <CrmSegmentsPage />;
      case 'crm_automations': return <CrmAutomationsPage triggerAlert={triggerAlert} />;
      // Finance
      case 'fin_expenses': return <Expenses triggerAlert={triggerAlert} />;
      case 'fin_registers': return <CashRegisters triggerAlert={triggerAlert} />;
      case 'fin_ledger': return <SupplierLedger triggerAlert={triggerAlert} />;
      // HR
      case 'hr_attendance': return <Attendance triggerAlert={triggerAlert} />;
      case 'hr_leaves': return <Leaves triggerAlert={triggerAlert} />;
      // Logistics
      case 'logistics_trips': return <ActiveTrips triggerAlert={triggerAlert} />;
      // Audit & Logs
      case 'auditlogs': return <AuditLogs />;
      case 'notifications': return <Notifications />;
      default: return <Dashboard />;
    }
  };

  return (
    <>
      <style>{`
        input, select { background: var(--color-border); border: 1px solid var(--color-border); border-radius: 8px; padding: 10px 14px; color: var(--color-text-primary); outline: none; width: 100%; box-sizing: border-box; margin-top: 5px; }
        label { font-size: 13px; font-weight: 600; }
        .btn-primary { background: var(--color-primary); color: var(--color-text-primary); border: none; border-radius: 8px; padding: 11px 24px; font-weight: 600; cursor: pointer; display: inline-block; text-align: center; }
        .btn-primary:hover { opacity: 0.9; }
      `}</style>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderPage()}
      </Layout>
    </>
  );
}

export default App;
