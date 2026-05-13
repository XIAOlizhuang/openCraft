import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export default api

export const chatApi = {
  send: (message: string) => api.post('/chat/send', { message }),
  history: () => api.get('/chat/history'),
  clear: () => api.delete('/chat/history'),
}

export const microAppApi = {
  list: (source?: string) => api.get(`/micro-apps${source ? `?source=${source}` : ''}`),
  get: (id: string) => api.get(`/micro-apps/${id}`),
  create: (data: Record<string, unknown>) => api.post('/micro-apps', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/micro-apps/${id}`, data),
  delete: (id: string) => api.delete(`/micro-apps/${id}`),
  execute: (id: string, user_input?: Record<string, unknown>) => api.post(`/micro-apps/${id}/execute`, user_input ? { user_input } : {}),
  optimize: (id: string, instruction: string) => api.post(`/micro-apps/${id}/optimize`, { instruction }),
  clone: (id: string) => api.post(`/micro-apps/${id}/clone`),
  history: (id: string) => api.get(`/micro-apps/${id}/history`),
}

export const apiCatalogApi = {
  list: () => api.get('/apis'),
}

export const favoriteApi = {
  list: () => api.get('/favorites'),
  create: (data: Record<string, unknown>) => api.post('/favorites', data),
  delete: (id: string) => api.delete(`/favorites/${id}`),
  reorder: (fav_ids: string[]) => api.put('/favorites/reorder', { fav_ids }),
}

export const schedulerApi = {
  list: () => api.get('/scheduler/jobs'),
  create: (data: Record<string, unknown>) => api.post('/scheduler/jobs', data),
  delete: (id: string) => api.delete(`/scheduler/jobs/${id}`),
  pause: (id: string) => api.post(`/scheduler/jobs/${id}/pause`),
  resume: (id: string) => api.post(`/scheduler/jobs/${id}/resume`),
}

export const skillApi = {
  list: () => api.get('/skills'),
  get: (name: string) => api.get(`/skills/${encodeURIComponent(name)}`),
}

export const dataApi = {
  samples: () => api.get('/data/samples'),
  current: () => api.get('/data/current'),
  switch: (source: string) => api.post('/data/switch', { source }),
  load: (payload: unknown) => api.post('/data/load', { payload }),
  export: () => api.get('/data/export'),
}

export const browseApi = {
  fetch: (url: string) => api.get('/tools/browse', { params: { url } }),
}
