import axios from "axios";

const configuredApiUrl = import.meta.env.VITE_API_URL || "";
const fallbackApiUrl = import.meta.env.DEV
  ? "http://127.0.0.1:5001"
  : "https://vconstech-crm-new.onrender.com";

export const API_BASE_URL = (
  configuredApiUrl || fallbackApiUrl
)
  .trim()
  .replace(/\/$/, "");

export const ERP_API_BASE_URL = (
  import.meta.env.VITE_ERP_API_URL || "https://vconstech-test.onrender.com/api"
)
  .trim()
  .replace(/\/$/, "");

const isCustomerApiRequest = (url = "") => String(url).includes("/api/customers");

export const clearSessionAndRedirectToLogin = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("employee");
  if (window.location.pathname !== "/") window.location.assign("/");
};

// The project uses axios directly in many components. Configuring the shared
// default instance here keeps every customer axios request authenticated.
axios.interceptors.request.use((config) => {
  if (isCustomerApiRequest(config.url)) {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && isCustomerApiRequest(error?.config?.url)) {
      clearSessionAndRedirectToLogin();
    }
    return Promise.reject(error);
  }
);

// Use for customer calls made with fetch (for example the manual-reminder modal).
export const customerApiFetch = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) clearSessionAndRedirectToLogin();
  return response;
};

export const unwrapCustomerList = (payload) =>
  payload?.customers ||
  payload?.data?.customers ||
  payload?.users ||
  payload?.data?.users ||
  (Array.isArray(payload) ? payload : []);

export const unwrapCustomer = (payload) =>
  payload?.customer || payload?.data?.customer || payload;
