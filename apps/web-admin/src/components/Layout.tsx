import React, { useState, useEffect } from 'react';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: string;
}

interface NavGroup {
  id: string;
  title: string;
  icon: string;
  items: NavItem[];
}

export const Layout = ({ children, activeTab, setActiveTab }: any) => {
  const [collapsedSidebar, setCollapsedSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    core: true,
    inventory: true,
    production: true,
    sales: true,
    crm: true,
    logistics: true,
    hr: true,
    finance: true,
    rules: true,
    system: true,
  });

  const navGroups: NavGroup[] = [
    {
      id: 'core',
      title: 'Core Setup',
      icon: 'corporate_fare',
      items: [
        { id: 'organizations', label: 'Organizations', icon: 'domain' },
        { id: 'branches', label: 'Branches', icon: 'location_on' },
        { id: 'registers', label: 'POS Registers', icon: 'point_of_sale' },
        { id: 'settings', label: 'Settings', icon: 'settings' },
        { id: 'roles', label: 'Roles & Perms', icon: 'admin_panel_settings' },
        { id: 'flags', label: 'Feature Flags', icon: 'flag' },
      ],
    },
    {
      id: 'inventory',
      title: 'Inventory & Pricing',
      icon: 'inventory_2',
      items: [
        { id: 'products', label: 'Products Master', icon: 'inventory' },
        { id: 'categories', label: 'Categories', icon: 'folder_open' },
        { id: 'brands', label: 'Brands', icon: 'sell' },
        { id: 'storage', label: 'Storage Locations', icon: 'warehouse' },
        { id: 'uoms', label: 'Units of Measure', icon: 'straighten' },
        { id: 'productattributes', label: 'Product Attributes', icon: 'tune' },
        { id: 'recipemasters', label: 'Recipe Masters', icon: 'menu_book' },
        { id: 'suppliers', label: 'Suppliers', icon: 'local_shipping' },
        { id: 'supplieritems', label: 'Supplier Pricing', icon: 'price_check' },
        { id: 'vehicles', label: 'Active Vehicles', icon: 'directions_car' },
        { id: 'stocklevels', label: 'Stock Levels', icon: 'inventory_2', badge: 'LIVE' },
        { id: 'stocktransfers', label: 'Stock Transfers', icon: 'swap_horiz' },
        { id: 'wastagelogs', label: 'Wastage Logs', icon: 'delete_sweep' },
      ],
    },
    {
      id: 'production',
      title: 'Production',
      icon: 'precision_manufacturing',
      items: [
        { id: 'productionorders', label: 'Production Orders', icon: 'precision_manufacturing' },
      ],
    },
    {
      id: 'sales',
      title: 'Procurement & Sales',
      icon: 'shopping_bag',
      items: [
        { id: 'purchaseorders', label: 'Purchase Orders', icon: 'shopping_cart' },
        { id: 'customcakes', label: 'Custom Cakes', icon: 'cake', badge: 'NEW' },
      ],
    },
    {
      id: 'crm',
      title: 'CRM & Loyalty',
      icon: 'groups',
      items: [
        { id: 'crm_dashboard', label: 'CRM Overview', icon: 'auto_graph' },
        { id: 'crm_customers', label: 'Customers & 360', icon: 'people' },
        { id: 'crm_segments', label: 'Customer Segments', icon: 'pie_chart' },
        { id: 'crm_automations', label: 'Automations', icon: 'smart_toy' },
      ],
    },
    {
      id: 'logistics',
      title: 'Logistics',
      icon: 'local_shipping',
      items: [
        { id: 'logistics_trips', label: 'Active Trips', icon: 'route' },
      ],
    },
    {
      id: 'hr',
      title: 'HR & Payroll',
      icon: 'badge',
      items: [
        { id: 'hr_attendance', label: 'Attendance', icon: 'fingerprint' },
        { id: 'hr_leaves', label: 'Leave Requests', icon: 'event_busy' },
        { id: 'designations', label: 'Designations', icon: 'badge' },
      ],
    },
    {
      id: 'finance',
      title: 'Finance & Accounting',
      icon: 'account_balance',
      items: [
        { id: 'fin_expenses', label: 'Expenses Subledger', icon: 'receipt_long' },
        { id: 'fin_registers', label: 'Cash Registers', icon: 'savings' },
        { id: 'fin_ledger', label: 'Supplier Ledger', icon: 'account_balance' },
      ],
    },
    {
      id: 'rules',
      title: 'System Rules & Masters',
      icon: 'rule',
      items: [
        { id: 'taxes', label: 'Tax Rules', icon: 'receipt_long' },
        { id: 'numberseries', label: 'Number Series', icon: 'pin' },
        { id: 'approvalworkflows', label: 'Workflows', icon: 'account_tree' },
        { id: 'reasonmasters', label: 'Reason Masters', icon: 'help_outline' },
        { id: 'paymentmethods', label: 'Payment Methods', icon: 'payment' },
      ],
    },
    {
      id: 'system',
      title: 'Audit & Logs',
      icon: 'shield',
      items: [
        { id: 'auditlogs', label: 'Audit Logs', icon: 'description' },
        { id: 'notifications', label: 'Notifications', icon: 'notifications', badge: '4' },
      ],
    },
  ];

  // Auto-expand group containing activeTab on load
  useEffect(() => {
    const parentGroup = navGroups.find(g => g.items.some(i => i.id === activeTab));
    if (parentGroup) {
      setOpenGroups(prev => ({ ...prev, [parentGroup.id]: true }));
    }
  }, [activeTab]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toggleAllGroups = (open: boolean) => {
    const next: Record<string, boolean> = {};
    navGroups.forEach(g => { next[g.id] = open; });
    setOpenGroups(next);
  };

  // Filter items based on search query
  const matchesSearch = (item: NavItem) => {
    if (!searchQuery.trim()) return true;
    return item.label.toLowerCase().includes(searchQuery.toLowerCase());
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-app)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Sidebar Container */}
      <aside
        style={{
          width: collapsedSidebar ? '72px' : '280px',
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--color-sidebar-border)',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--color-sidebar-text)',
          zIndex: 100,
          position: 'sticky',
          top: 0,
          height: '100vh',
          boxSizing: 'border-box',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: collapsedSidebar ? '20px 12px' : '20px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsedSidebar ? 'center' : 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          {!collapsedSidebar && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                }}
              >
                🎂
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-sidebar-active-text)', letterSpacing: '0.3px' }}>
                  Cakes & Candles
                </h1>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>ERP Enterprise Admin</span>
              </div>
            </div>
          )}
          {collapsedSidebar && (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}
            >
              🎂
            </div>
          )}
          <button
            onClick={() => setCollapsedSidebar(!collapsedSidebar)}
            title={collapsedSidebar ? 'Expand Sidebar' : 'Collapse Sidebar'}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: 'var(--color-sidebar-text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {collapsedSidebar ? 'menu_open' : 'keyboard_double_arrow_left'}
            </span>
          </button>
        </div>

        {/* Search Bar & Actions (Expanded Mode) */}
        {!collapsedSidebar && (
          <div style={{ padding: '16px 16px 8px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: 9, fontSize: 18, color: '#64748b' }}>
                search
              </span>
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  color: 'var(--color-sidebar-active-text)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                  margin: 0,
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Actions Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Navigation
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => toggleAllGroups(true)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer', padding: 0 }}
                  title="Expand all categories"
                >
                  Expand All
                </button>
                <span style={{ color: '#475569', fontSize: 11 }}>•</span>
                <button
                  onClick={() => toggleAllGroups(false)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer', padding: 0 }}
                  title="Collapse all categories"
                >
                  Collapse All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', padding: collapsedSidebar ? '12px 8px' : '8px 12px' }}>
          {/* Dashboard Item */}
          <div style={{ marginBottom: 8 }}>
            <button
              onClick={() => setActiveTab('dashboard')}
              title={collapsedSidebar ? 'Dashboard' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsedSidebar ? 'center' : 'flex-start',
                gap: '12px',
                padding: collapsedSidebar ? '12px' : '10px 14px',
                background: activeTab === 'dashboard' ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : 'rgba(255, 255, 255, 0.03)',
                color: activeTab === 'dashboard' ? '#ffffff' : 'var(--color-sidebar-text)',
                border: activeTab === 'dashboard' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(255, 255, 255, 0.04)',
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: activeTab === 'dashboard' ? 600 : 500,
                fontSize: '14px',
                width: '100%',
                boxShadow: activeTab === 'dashboard' ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                dashboard
              </span>
              {!collapsedSidebar && <span>Dashboard</span>}
            </button>
          </div>

          {/* Group Accordions */}
          {navGroups.map(group => {
            const filteredItems = group.items.filter(matchesSearch);
            if (filteredItems.length === 0) return null;

            const isOpen = openGroups[group.id] || searchQuery.length > 0;
            const hasActiveChild = group.items.some(i => i.id === activeTab);

            return (
              <div key={group.id} style={{ marginBottom: 6 }}>
                {/* Group Header (Collapsible) */}
                {!collapsedSidebar && (
                  <button
                    onClick={() => toggleGroup(group.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: hasActiveChild ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      color: hasActiveChild ? '#a5b4fc' : '#94a3b8',
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: '0.4px',
                      textTransform: 'uppercase',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        {group.icon}
                      </span>
                      <span>{group.title}</span>
                      <span
                        style={{
                          background: hasActiveChild ? '#6366f1' : 'rgba(255, 255, 255, 0.1)',
                          color: '#ffffff',
                          padding: '1px 6px',
                          borderRadius: 10,
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {filteredItems.length}
                      </span>
                    </div>
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: 18,
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      expand_more
                    </span>
                  </button>
                )}

                {/* Group Items List */}
                {(isOpen || collapsedSidebar) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: collapsedSidebar ? 4 : 2, paddingLeft: collapsedSidebar ? 0 : 8 }}>
                    {filteredItems.map(item => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          title={collapsedSidebar ? item.label : undefined}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: collapsedSidebar ? 'center' : 'space-between',
                            gap: '10px',
                            padding: collapsedSidebar ? '10px' : '8px 12px',
                            background: isActive
                              ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.25) 0%, rgba(99, 102, 241, 0.08) 100%)'
                              : 'transparent',
                            color: isActive ? '#ffffff' : '#cbd5e1',
                            border: 'none',
                            borderLeft: isActive ? '3px solid #6366f1' : '3px solid transparent',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontWeight: isActive ? 600 : 400,
                            fontSize: '13px',
                            width: '100%',
                            boxSizing: 'border-box',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span
                              className="material-symbols-outlined"
                              style={{
                                fontSize: '18px',
                                color: isActive ? '#818cf8' : '#94a3b8',
                                opacity: isActive ? 1 : 0.8,
                              }}
                            >
                              {item.icon}
                            </span>
                            {!collapsedSidebar && <span>{item.label}</span>}
                          </div>
                          {!collapsedSidebar && item.badge && (
                            <span
                              style={{
                                background: item.badge === 'LIVE' ? '#059669' : item.badge === 'NEW' ? '#7c3aed' : '#3b82f6',
                                color: '#ffffff',
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 6,
                              }}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div
          style={{
            padding: collapsedSidebar ? '16px 8px' : '16px 16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            marginTop: 'auto',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          {!collapsedSidebar ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#475569', overflow: 'hidden' }}>
                    <img src="https://i.pravatar.cc/150?u=a042581f4e29026024d" alt="Alex Chen" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: '#10b981',
                      border: '2px solid var(--bg-sidebar)',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'var(--color-sidebar-active-text)', fontSize: '13px', fontWeight: 600 }}>Alex Chen</span>
                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>Super Admin</span>
                </div>
              </div>
              <button
                onClick={() => alert('Logged out')}
                title="Logout"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 6,
                  display: 'flex',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  logout
                </span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#475569', overflow: 'hidden' }}>
                <img src="https://i.pravatar.cc/150?u=a042581f4e29026024d" alt="Alex Chen" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', height: '100vh', boxSizing: 'border-box' }}>
        {children}
      </main>
    </div>
  );
};
