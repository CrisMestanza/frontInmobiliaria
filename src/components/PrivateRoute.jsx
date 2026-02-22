// src/components/PrivateRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

const PrivateRoute = ({ children }) => {
  const [isAuth, setIsAuth] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      let token = localStorage.getItem("access");
      if (!token) {
        setIsAuth(false);
        return;
      }

      try {
        const res = await fetch("https://api.geohabita.com/api/check_auth/", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          setIsAuth(true);
          return;
        }

        if (res.status === 401) {
          // intentar refresh
          const newToken = await refreshAccessToken();
          if (newToken) {
            // reintentar
            const r2 = await fetch("https://api.geohabita.com/api/check_auth/", {
              headers: { Authorization: `Bearer ${newToken}` },
            });
            setIsAuth(r2.ok);
            return;
          }
        }

        setIsAuth(false);
      } catch (err) {
        console.error("Error check_auth:", err);
        setIsAuth(false);
      }
    };

    const refreshAccessToken = async () => {
      const refresh = localStorage.getItem("refresh");
      if (!refresh) return null;
      try {
        const res = await fetch("https://api.geohabita.com/api/token/refresh/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        localStorage.setItem("access", data.access);
        return data.access;
      } catch (err) {
        console.error("Refresh error:", err);
        return null;
      }
    };

    checkAuth();
  }, []);

  if (isAuth === null) return <p>Cargando...</p>;
  return isAuth ? children : <Navigate to="/" />;
};

export default PrivateRoute;
