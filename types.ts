export interface PhoneEntry {
  id: string;
  building: string;
  department: string;
  number: string;
  created_at?: string;
}

export interface SearchHistoryItem {
  id: string;
  term: string;
  timestamp: number;
  resultCount: number;
}