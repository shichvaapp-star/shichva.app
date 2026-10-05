export interface SeatingRequestItem {
  token: string;
  studentName: string;
  eligible: boolean;
  choice1?: string;
  choice2?: string;
  note?: string;
  submittedAt?: string;
  createdAt: string;
}

export interface SeatingSurveyMeta {
  isActive: boolean;
  title?: string;
  updatedAt: string;
  requests: Record<string, SeatingRequestItem>; // keyed by studentName
}

export interface AutoSeatingResult {
  updatedRows: {
    id: string;
    order: number;
    desk1_right: string;
    desk1_left: string;
    desk2_right: string;
    desk2_left: string;
    desk3_right: string;
    desk3_left: string;
    desk4_right: string;
    desk4_left: string;
  }[];
  mutualPairsCount: number;
  oneWayCount: number;
  totalPlaced: number;
  unassignedCount: number;
}
