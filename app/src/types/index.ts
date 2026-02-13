export interface AuthPayload {
  sub: number;
  employeeCode: string;
  name: string;
  role: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DashboardData {
  stockSummary: { drinkId: number; name: string; stock: number; imageUrl: string | null }[];
  todayConsumption: { drinkId: number; name: string; totalQuantity: number }[];
  todayTotal: number;
  recentAlerts: { id: number; createdAt: string; diffs: { drinkName: string; diff: number }[] }[];
  weeklyTrend: { date: string; totalQuantity: number }[];
}
