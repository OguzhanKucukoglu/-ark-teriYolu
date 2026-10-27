import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// JWT token'ı her isteğe ekle
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('avatar_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 → login'e yönlendir
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('avatar_token');
      localStorage.removeItem('avatar_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authService = {
  login:    (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: object)                     => api.post('/auth/register', data),
  getMe:    ()                                 => api.get('/auth/me'),
};

// Lots
export const lotService = {
  getAll:        ()           => api.get('/lots'),
  getById:       (id: number) => api.get(`/lots/${id}`),
  getMovements:  (id: number) => api.get(`/lots/${id}/movements`),
  traceForward:  (id: number) => api.get(`/lots/${id}/trace/forward`),
  traceBackward: (id: number) => api.get(`/lots/${id}/trace/backward`),
};

// Raw Materials
export const rawMaterialService = {
  getAll:  ()             => api.get('/raw-materials'),
  create:  (data: object) => api.post('/raw-materials', data),
  remove:  (id: number)   => api.delete(`/raw-materials/${id}`),
};

// Butchery
export const butcheryService = {
  getAll:             ()             => api.get('/butchery'),
  getById:            (id: number)   => api.get(`/butchery/${id}`),
  create:             (data: object) => api.post('/butchery', data),
  getAvailableParts:  ()             => api.get('/butchery/parts/available'),
};

// Orders
export const orderService = {
  getAll:       ()             => api.get('/orders'),
  getById:      (id: number)   => api.get(`/orders/${id}`),
  create:       (data: object) => api.post('/orders', data),
  updateStatus: (id: number, status: string) => api.patch(`/orders/${id}/status`, { status }),
};

// Production
export const productionService = {
  getAll:    ()             => api.get('/production'),
  getById:   (id: number)   => api.get(`/production/${id}`),
  create:    (data: object) => api.post('/production', data),
  complete:  (id: number, data: object) => api.patch(`/production/${id}/complete`, data),
};

// Listings
export const listingService = {
  getProducerListings:    ()                         => api.get('/listings/producer'),
  getMyProducerListings:  ()                         => api.get('/listings/producer/mine'),
  createProducerListing:  (data: object)             => api.post('/listings/producer', data),
  updateProducerListing:  (id: number, data: object) => api.put(`/listings/producer/${id}`, data),
  toggleProducerListing:  (id: number)               => api.patch(`/listings/producer/${id}/toggle`),
  deleteProducerListing:  (id: number)               => api.delete(`/listings/producer/${id}`),
  // Hayvancı ilanları
  getFarmerListings:      ()                         => api.get('/listings/farmer'),
  getMyFarmerListings:    ()                         => api.get('/listings/farmer/mine'),
  createFarmerListing:    (data: object)             => api.post('/listings/farmer', data),
  updateFarmerListing:    (id: number, data: object) => api.put(`/listings/farmer/${id}`, data),
  toggleFarmerListing:    (id: number)               => api.patch(`/listings/farmer/${id}/toggle`),
};

// Purchases
export const purchaseService = {
  getAll:    ()             => api.get('/purchases'),
  create:    (data: object) => api.post('/purchases', data),
  feedback:  (lot_number: string, issue: string, extra?: object) =>
    api.post('/purchases/feedback', { lot_number, issue_description: issue, ...extra }),
};

// Notifications
export const notificationService = {
  getAll:   ()           => api.get('/notifications'),
  markRead: (id: number) => api.patch(`/notifications/${id}/read`),
  markAll:  ()           => api.post('/notifications/read-all'),
};

// Recalls
export const recallService = {
  getAll:    ()               => api.get('/recalls'),
  getById:   (id: number)     => api.get(`/recalls/${id}`),
  initiate:  (data: object)   => api.post('/recalls', data),
  complete:  (id: number)     => api.patch(`/recalls/${id}/complete`),
};

// ML
export const mlService = {
  predictProduction: (data: object) => api.post('/ml/predict/production', data),
  predictButchery:   (data: object) => api.post('/ml/predict/butchery', data),
};
