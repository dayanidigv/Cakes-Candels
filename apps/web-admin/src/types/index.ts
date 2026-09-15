export interface Organization {
  id: string;
  name: string;
  taxIdentifier?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Branch {
  id: string;
  organizationId: string;
  organization?: Organization;
  name: string;
  type: 'FACTORY' | 'RETAIL_BRANCH' | 'TRANSIT_HUB';
  address: string;
  phone?: string;
  gstin?: string;
  isActive: boolean;
  createdAt: string;
}

export interface POSRegister {
  id: string;
  branchId: string;
  branch?: Branch;
  name: string;
  deviceIdentifier: string;
  isActive: boolean;
  createdAt: string;
}

export interface Permission {
  id: string;
  name: string;
  description?: string;
}

export interface Role {
  id: string;
  name: string;
  type: 'SUPER_ADMIN' | 'FACTORY_MANAGER' | 'BRANCH_MANAGER' | 'POS_OPERATOR' | 'LOGISTICS_COORDINATOR';
  description?: string;
  isActive: boolean;
  rolePermissions: { permission: Permission }[];
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  description?: string;
}

export interface BranchSetting {
  id: string;
  branchId: string;
  branch?: Branch;
  key: string;
  value: string;
}

export interface FeatureFlag {
  id: string;
  branchId?: string;
  key: string;
  isEnabled: boolean;
}

export interface AuditLog {
  id: string;
  module: string;
  entity: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPIRE';
  performedBy: string;
  branchId: string;
  ip?: string;
  device?: string;
  before?: any;
  after?: any;
  timestamp: string;
}

export interface TaxRule { id: string; name: string; rate: number; isActive: boolean; }
export interface Uom { id: string; name: string; symbol: string; isActive: boolean; }
export interface Category { id: string; name: string; description?: string; isActive: boolean; }
export interface Brand { id: string; name: string; description?: string; isActive: boolean; }
export interface Supplier { id: string; name: string; contactPerson?: string; email?: string; phone?: string; address?: string; taxId?: string; isActive: boolean; }
export interface StorageLocation { id: string; branchId: string; name: string; description?: string; isActive: boolean; branch?: Branch; }

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}
