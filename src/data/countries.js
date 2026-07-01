import COUNTRIES from "./countries.json";

// Lista estática (sin red, sin CORS) en lugar de restcountries.com,
// cuya API v3 fue deprecada y dejó de servir respuestas válidas.
// Generada una sola vez a partir del paquete "world-countries"
// (ver package.json -> devDependencies) con solo los campos usados
// por el formulario de país/moneda.
export default COUNTRIES;
