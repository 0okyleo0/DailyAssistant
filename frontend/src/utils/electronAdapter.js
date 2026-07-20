import axios from "axios";

/**
 * If running inside Electron (window.electronAPI exists),
 * override axios adapter to route all requests through IPC
 * instead of HTTP. This lets the same React code work in both
 * web (via FastAPI backend) and desktop (via Electron IPC).
 */
export function setupElectronAdapter() {
  if (typeof window === "undefined") {
    console.log("[ElectronAdapter] window undefined, skipping");
    return false;
  }
  if (!window.electronAPI) {
    console.log("[ElectronAdapter] window.electronAPI not found - running in browser mode");
    return false;
  }

  console.log("[ElectronAdapter] window.electronAPI found - overriding axios adapter");
  console.log("[ElectronAdapter] electronAPI keys:", Object.keys(window.electronAPI));

  axios.defaults.adapter = async (config) => {
    const method = (config.method || "get").toUpperCase();

    // Extract path from URL (strip base URL and origin if present)
    let url = config.url || "";
    if (config.baseURL && url.startsWith(config.baseURL)) {
      url = url.slice(config.baseURL.length);
    }
    try {
      if (url.startsWith("http://") || url.startsWith("https://")) {
        const u = new URL(url);
        url = u.pathname + u.search;
      }
    } catch (e) {
      console.warn("[ElectronAdapter] URL parse failed for:", url);
    }

    // Ensure url starts with / for our route matcher
    if (!url.startsWith("/")) url = "/" + url;

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
      console.error("[ElectronAdapter] IPC request failed:", ipcErr);
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
        `Request failed (status ${status})`;
      const error = new Error(detail);
      error.response = httpResponse;
      error.config = config;
      throw error;
    }

    return httpResponse;
  };

  return true;
}
