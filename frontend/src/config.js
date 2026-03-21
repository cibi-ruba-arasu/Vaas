export const API_URL = import.meta.env.MODE === 'development' 
  ? "http://localhost:5000" 
  : "https://vaas-production.up.railway.app";