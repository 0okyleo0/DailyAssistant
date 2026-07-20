import axios from "axios";

/**
 * If running inside Electron (window.electronAPI exists),
 * override axios adapter to route all requests through IPC.
 */
export function setupElectronAdapter() {
  if (typeof window === "undefined") return false;
  if (!window.electronAPI) {
    console.log("[ElectronAdapter] Running in browser mode");
    return false;
  }

  console.log("[ElectronAdapter] Electron detected - overriding axios adapter");

  axios.defaults.adapter = async (config) => {
    const method = (config.method || "get").toUpperCase();
    let url = config.url || "";

    // Strip baseURL if present
    if (config.baseURL && typeof config.baseURL === "string" && url.startsWith(config.baseURL)) {
      url = url.slice(config.baseURL.length);
    }

    // Handle "undefined/..." prefix (when REACT_APP_BACKEND_URL is undefined in build)
    if (url.startsWith("undefined")) {
      url = url.slice("undefined".length);
    }

    // Strip http(s):// origin if present
    if (/^https?:\/\//i.test(url)) {
      try {
        const u = new URL(url);
        url = u.pathname + u.search;
      } catch (e) {
        console.warn("[ElectronAdapter] URL parse failed:", url);
      }
    }

    // Ensure URL starts with /api/ (find /api/ prefix as safety net)
    const apiIdx = url.indexOf("/api/");
    if (apiIdx > 0) {
      url = url.slice(apiIdx);
    } else if (!url.startsWith("/")) {
      url = "/" + url;
    }

    // Parse body data
    let data = config.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (e) {
        /* keep as string */
      }
    }

    console.log(`[ElectronAdapter] ${method} ${url}`, data);

    let response;
    try {
      response = await window.electronAPI.request({ method, url, data });
    } catch (ipcErr) {
      console.error("[ElectronAdapter] IPC failed:", ipcErr);
      const err = new Error("IPC 通訊失敗: " + (ipcErr.message || String(ipcErr)));
      err.config = config;
      throw err;
    }

    console.log(`[ElectronAdapter] Response ${response?.status}:`, response?.data);

    const status = response?.status || 200;
    const httpResponse = {
      data: response?.data,
      status,
      statusText: status >= 400 ? "Error" : "OK",
      headers: { "content-type": "application/json" },
      config,
      request: {},
    };

    if (status >= 400) {
      const detail =
        (response?.data && (response.data.detail || response.data.error)) ||
        `Request failed (${status})`;
      const error = new Error(detail);
      error.response = httpResponse;
      error.config = config;
      throw error;
    }

    return httpResponse;
  };

  return true;
}
