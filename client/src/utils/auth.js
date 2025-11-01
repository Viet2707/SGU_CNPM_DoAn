// utils/auth.js
export const saveToken = (role, token) => {
  if (!role || !token) return;
  localStorage.setItem(`token_${role}`, token);
};

export const getToken = (role) => {
  if (!role) return null;
  return localStorage.getItem(`token_${role}`);
};

export const removeToken = (role) => {
  if (!role) return;
  localStorage.removeItem(`token_${role}`);
};

export const clearAllTokens = () => {
  ["admin", "restaurant", "delivery", "customer"].forEach((r) =>
    localStorage.removeItem(`token_${r}`)
  );
};
