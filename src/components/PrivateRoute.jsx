import { withApiBase } from "../config/api.js";
import { authFetch } from "../config/authFetch.js";
// src/components/PrivateRoute.jsx
import React, { useEffect, useState } from "react";
import GeoHabitaLoader from "./GeoHabitaLoader";
import { Navigate } from "react-router-dom";

const PrivateRoute = ({ children }) => {
  const [isAuth, setIsAuth] = useState(null);
  const [appLoading, setAppLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      let token = localStorage.getItem("access");
      const idInmo = localStorage.getItem("idinmobiliaria");
      if (!token) {
        setIsAuth(false);
        return;
      }
      if (!idInmo) {
        setIsAuth(false);
        return;
      }

      try {
        const res = await authFetch(withApiBase("https://api.geohabita.com/api/check_auth/"), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          setIsAuth(true);
          return;
        }

        setIsAuth(false);
      } catch (err) {
        console.error("Error check_auth:", err);
        setIsAuth(false);
      }
    };

    checkAuth();
  }, []);

  if (isAuth === null) return <GeoHabitaLoader autoHide={false} />;
  if (!isAuth) return <Navigate to="/" />;

  const renderedChildren = React.isValidElement(children)
    ? React.cloneElement(children, { setAppLoading })
    : children;

  return (
    <>
      {appLoading && <GeoHabitaLoader autoHide={false} />}
      {renderedChildren}
    </>
  );
};

export default PrivateRoute;
