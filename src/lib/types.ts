/** Tipe data bersama antara frontend & backend. */

export type Role = 'owner' | 'kasir';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  workshopName: string;
  tagline: string;
  address: string;
  phone: string;
  footerNote: string;
  taxEnabled: boolean;
  taxPercent: number;
  lowStockAlert: boolean;
  receiptWidth: number;
  printAutoOpen: boolean;

  // Perangkat keras
  printerType: 'browser' | 'windows' | 'network' | 'serial' | 'file';
  printerName: string;
  printerHost: string;
  printerPort: number;
  comPort: string;
  baudRate: number;
  printerAutoCut: boolean;
  printCopies: number;
  openDrawerOnCash: boolean;
  drawerPin: number;
  scannerEnterAddsItem: boolean;
  scannerBeep: boolean;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  costPrice?: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  barcode: string;
  location: string;
  supplier?: string;
  active: boolean;
  notes: string;
  movements?: StockMovement[];
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'in' | 'out';
  qty: number;
  refType: string;
  refId: string | null;
  refCode?: string;
  note: string;
  createdAt: string;
}

export interface Service {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  durationMin: number;
  active: boolean;
  notes: string;
}

export interface Mechanic {
  id: string;
  name: string;
  phone: string;
  sharePercent: number;
  active: boolean;
  notes: string;
}

export interface Vehicle {
  id: string;
  customerId: string;
  plateNumber: string;
  brand: string;
  model: string;
  year: number | null;
  type: string;
  notes: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  active: boolean;
  vehicles?: Vehicle[];
  vehicleCount?: number;
  transactionCount?: number;
  totalSpend?: number;
  lastVisit?: string | null;
  history?: Array<{
    id: string;
    code: string;
    date: string;
    total: number;
    status: string;
    paymentMethod: string;
    plateNumber: string;
  }>;
}

export interface TransactionItem {
  type: 'product' | 'service';
  refId: string;
  code: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  costPrice?: number;
  discount: number;
  mechanicId?: string | null;
  subtotal: number;
}

export interface Transaction {
  id: string;
  code: string;
  date: string;
  customerId: string | null;
  customerName: string;
  vehicleId: string | null;
  plateNumber: string;
  vehicleLabel: string;
  items: TransactionItem[];
  subtotal: number;
  discountTotal: number;
  discountAmount?: number;
  taxEnabled: boolean;
  taxPercent: number;
  taxAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  creditSettled?: boolean;
  paidAmount: number;
  changeAmount: number;
  status: 'paid' | 'void';
  note: string;
  userId: string;
  userName?: string;
  workOrderId?: string | null;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  createdAt: string;
}

export type PaymentMethod = 'cash' | 'transfer' | 'qris' | 'debit' | 'credit';

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  transfer: 'Transfer Bank',
  qris: 'QRIS',
  debit: 'Kartu Debit',
  credit: 'Kredit / Bon',
};

export type WoStatus = 'menunggu' | 'dikerjakan' | 'selesai' | 'diambil';

export const WO_STATUS_LABELS: Record<WoStatus, string> = {
  menunggu: 'Menunggu',
  dikerjakan: 'Dikerjakan',
  selesai: 'Selesai',
  diambil: 'Diambil',
};

export interface WorkOrder {
  id: string;
  code: string;
  queueNumber: number;
  date: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  vehicleId: string | null;
  plateNumber: string;
  vehicleLabel: string;
  complaint: string;
  diagnosis: string;
  mechanicId: string | null;
  mechanicName: string;
  odometer: number | null;
  status: WoStatus;
  statusLabel?: string;
  estimatedCost: number;
  items: TransactionItem[];
  note: string;
  transactionId: string | null;
  transactionCode?: string;
}

export interface Expense {
  id: string;
  date: string;
  name: string;
  category: string;
  amount: number;
  note: string;
  userId: string;
  userName?: string;
}

export interface DashboardSummary {
  today: { omzet: number; transactions: number; profit: number | null };
  month: {
    omzet: number;
    transactions: number;
    profit: number | null;
    expenses: number;
    netProfit: number | null;
  };
  workOrders: { active: number; waiting: number; inProgress: number; ready: number };
  inventory: { totalProducts: number; lowStock: number; stockValue: number | null };
  receivables: { count: number; total: number };
  recentTransactions: Array<{
    id: string;
    code: string;
    date: string;
    customerName: string;
    total: number;
    paymentMethod: string;
    itemCount: number;
  }>;
  lowStockItems: Array<{
    id: string;
    code: string;
    name: string;
    stock: number;
    minStock: number;
    unit: string;
  }>;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    totalRows: number;
    totalPages: number;
    totalOmzet?: number;
  };
}
