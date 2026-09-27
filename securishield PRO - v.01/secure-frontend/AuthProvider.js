import React, { createContext, useState, useContext } from "react";
import axios from "axios";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(null);

  const login = async (username, password) => {
    const response = await axios.post("/login", { username, password });
    // Refresh token dans cookie HTTP-only, accessToken en mémoire React
    setAccessToken(response.data.accessToken);
  };

  const logout = async () => {
    await axios.post("/logout");
    setAccessToken(null);
  };

  const refreshAccessToken = async () => {
    try {
      const response = await axios.post("/refresh_token");
      setAccessToken(response.data.accessToken);
      return response.data.accessToken;
    } catch {
      setAccessToken(null);
      return null;
    }
  };

  // Intercepteur pour ajouter accessToken aux requêtes et gérer 401
  axios.interceptors.request.use(
    (config) => {
      if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
      return config;
    },
    (error) => Promise.reject(error)
  );

  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axios(originalRequest);
        }
      }
      return Promise.reject(error);
    }
  );

  return (
    <AuthContext.Provider value={{ accessToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
