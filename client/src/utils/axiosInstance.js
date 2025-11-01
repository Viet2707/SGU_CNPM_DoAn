import axios from "axios";
import { getToken } from "./auth";

export const apiForRole = (role, baseURL) => {
  const token = getToken(role);
  return axios.create({
    baseURL,
    headers: token
      ? { Authorization: `Bearer ${token}` }
      : {},
  });
};
