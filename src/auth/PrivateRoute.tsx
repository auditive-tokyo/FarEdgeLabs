import React from "react";
import { useAuth } from "./AuthContext";
import Login from "@/components/Content/Login/Login";

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <>{children}</> : <Login />;
};

export default PrivateRoute;
