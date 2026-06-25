import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;
export const API = `${BASE}/api`;
export const FILE_BASE = BASE;

const client = axios.create({
  baseURL: API,
  withCredentials: true,
});

client.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err?.response?.status === 401) {
      // try refresh once
      const original = err.config;
      if (!original._retry) {
        original._retry = true;
        try {
          await axios.post(`${API}/auth/refresh`, {}, { withCredentials: true });
          return client(original);
    } catch (_e) {
      // refresh failed; user will get 401
    }
      }
    }
    return Promise.reject(err);
  }
);

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default client;
