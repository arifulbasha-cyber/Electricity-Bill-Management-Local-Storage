
export interface BillConfig {
  month: string;
  dateGenerated: string;
  totalBillPayable: number;
  bkashFee: number;
  includeLateFee: boolean;
  includeBkashFee: boolean;
}

export interface MeterReading {
  id: string;
  name: string;
  meterNo: string;
  previous: number;
  current: number;
}

export interface UserCalculation {
  id: string;
  name: string;
  unitsUsed: number;
  energyCost: number;
  fixedCost: number;
  totalPayable: number;
  previous: number;
  current: number;
}

export interface BillCalculationResult {
  vatFixed: number;
  vatDistributed: number;
  vatTotal: number;
  lateFee: number;
  calculatedRate: number;
  totalUnits: number;
  userCalculations: UserCalculation[];
  totalCollection: number;
}

export interface SavedBill {
  id: string;
  savedAt: string;
  config: BillConfig;
  mainMeter: MeterReading;
  meters: MeterReading[];
}

export interface Slab {
  limit: number;
  rate: number;
}

export interface TariffConfig {
  demandCharge: number;
  meterRent: number;
  vatRate: number; 
  slabs: Slab[];
  bkashCharge: number;
}

export interface Tenant {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface SpreadsheetConfig {
  webAppUrl: string;
  spreadsheetId?: string;
}

export interface DraftData {
  updatedAt: number;
  config: BillConfig;
  mainMeter: MeterReading;
  meters: MeterReading[];
}

// Added FirebaseConfigJson interface
export interface FirebaseConfigJson {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}
