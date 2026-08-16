// Determine API base URL
// 1. Use NEXT_PUBLIC_API_URL if explicitly set
// 2. In production (on victory.pingtech.dev), use relative path
// 3. Otherwise, use localhost for development
function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // Check if we're on the production domain
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'victory.pingtech.dev' || hostname.includes('pingtech.dev')) {
      return '/api/v1'; // Relative path - same domain
    }
  }

  // Development default
  return 'http://localhost:8000/api/v1';
}

const API_BASE_URL = getApiBaseUrl();

export interface ApiError {
  detail: string;
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // Load token from localStorage
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('academy_token');
      if (storedToken) {
        this.token = storedToken;
      }
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('academy_token', token);
    } else {
      localStorage.removeItem('academy_token');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    console.log('API Request:', { url, method: options.method || 'GET', headers }); // Debug log

    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log('API Response:', { status: response.status, statusText: response.statusText, url: response.url }); // Debug log

    if (!response.ok) {
      let errorMessage = 'An error occurred';
      let errorDetail: any = null;
      try {
        const error: any = await response.json();
        errorDetail = error;
        console.error('API Error Response:', error); // Debug log
        // Handle FastAPI validation errors (422)
        if (error.detail && Array.isArray(error.detail)) {
          const validationErrors = error.detail.map((e: any) =>
            `${e.loc?.join('.')}: ${e.msg}`
          ).join(', ');
          errorMessage = validationErrors || error.detail || response.statusText;
        } else {
          errorMessage = error.detail || response.statusText || 'An error occurred';
        }
      } catch (e) {
        console.error('Failed to parse error response:', e); // Debug log
        errorMessage = response.statusText || 'An error occurred';
      }
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).detail = errorDetail;
      throw error;
    }

    // Handle 204 No Content responses (no body to parse)
    if (response.status === 204) {
      return null as T;
    }

    // Try to parse JSON, but handle empty responses gracefully
    try {
      const text = await response.text();
      return text ? JSON.parse(text) : (null as T);
    } catch (e) {
      // If parsing fails and it's not an error response, return null
      console.warn('Failed to parse response as JSON, returning null:', e);
      return null as T;
    }
  }

  // Auth
  async login(username: string, password: string) {
    const requestBody = { username, password };
    console.log('Login request body:', requestBody); // Debug log
    const data = await this.request<{
      access_token: string;
      token_type: string;
      user: any;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    this.setToken(data.access_token);
    return data;
  }

  async getCurrentUser() {
    return this.request<any>('/auth/me');
  }

  // Children
  async getChildren(params?: {
    level?: string;
    search?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.level) queryParams.append('level', params.level);
    if (params?.search) queryParams.append('search', params.search);

    const query = queryParams.toString();
    return this.request<any[]>(`/children${query ? `?${query}` : ''}`);
  }

  async getChild(id: string) {
    return this.request<any>(`/children/${id}`);
  }

  async createChild(data: any) {
    return this.request<any>('/children', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateChild(id: string, data: any) {
    return this.request<any>(`/children/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteChild(id: string) {
    return this.request<void>(`/children/${id}`, {
      method: 'DELETE',
    });
  }

  // Payments
  async getPayments(params?: {
    child_id?: string;
    status?: string;
    month?: string;
    year?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.child_id) queryParams.append('child_id', params.child_id);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.month) queryParams.append('month', params.month);
    if (params?.year) queryParams.append('year', params.year.toString());

    const query = queryParams.toString();
    return this.request<any[]>(`/payments${query ? `?${query}` : ''}`);
  }

  async createPayment(data: any) {
    return this.request<any>('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePayment(id: string, data: any) {
    return this.request<any>(`/payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Levels
  async getLevels() {
    return this.request<any[]>('/levels');
  }

  async createLevel(data: any) {
    return this.request<any>('/levels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLevel(id: string, data: any) {
    return this.request<any>(`/levels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLevel(id: string) {
    return this.request<void>(`/levels/${id}`, {
      method: 'DELETE',
    });
  }

  // Users
  async getUsers() {
    return this.request<any[]>('/users');
  }

  async createUser(data: any) {
    return this.request<any>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
