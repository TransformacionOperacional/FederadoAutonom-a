// Configuracion del entorno. Las URL de Power Automate incluyen la firma (sig) de acceso;
// para produccion se recomienda inyectarlas en el pipeline de despliegue (ver README).
export const environment = {
  production: true,
  apiUsuario: 'CotizadorVG',
  apiContrasena: 'Sura2025*',
  apis: {
    login: 'https://2fa36fac371d4dcf8ae6279f09e7bc.87.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/837da8653c374ea38d3b18d141712594/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-tuTKQsJJUvueQ8daEmop0lzuzvVl4xHkUii944MRt8',
    validarToken: 'https://2fa36fac371d4dcf8ae6279f09e7bc.87.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/8a4ca32652c8423da0bf840c807851cd/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=dhD7PQamDrvJKiIRjygu0FyN4ZurhQrIqk-wu2H5MAs',
    tasasCoberturas: 'https://2fa36fac371d4dcf8ae6279f09e7bc.87.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/3bdc2f33585c485f9d394c1d73122c37/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=cOMyHLPKcYp9-mpp7gV4VLy7b2TwQAwjN6t-rfVZ73M',
    actividadesEconomicas: 'https://2fa36fac371d4dcf8ae6279f09e7bc.87.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/28/workflows/a8b0296c9f99415d97cdcf35b7c687a6/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=yrpT0ViTVfP0CyV-rvuzActJpjpMjKBnXmyY4CG7-ZI',
    asesores: 'https://2fa36fac371d4dcf8ae6279f09e7bc.87.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/11/workflows/10e4ac573ce149bd97fc24395250e74d/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=e2rhuYqdrphOVntoVnBjtrNqFTXYrIhAhEaNyfk_onc',
    guardarCotizacion: 'https://2fa36fac371d4dcf8ae6279f09e7bc.87.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/19/workflows/dccbecc12dae4476a7c4effd82315fb1/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=jnWYN4UWkOdiy9_cj74__FewMOiqG_zNcW2bJ7VAE58',
    cotizacionesUsuario: 'https://2fa36fac371d4dcf8ae6279f09e7bc.87.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/16/workflows/d054d6fb5aed442da6ddaa2b4466e90e/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Qbg8iqGzE7SnJDx6ji_GeoiV5k4H5OLhnYIUnobjhjM',
    consultarCotizacion: 'https://2fa36fac371d4dcf8ae6279f09e7bc.87.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/01/workflows/409bd10cdce94f8ebf8742c8badb6745/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Jhk81ambkYjXS_IizATVmFJUTTueePoD-x0cAaFoQb0',
    polizasTomador: 'https://2fa36fac371d4dcf8ae6279f09e7bc.87.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/01/workflows/69988fd0736244bd95c857c2df907d58/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Fa49HIuVHllcttrTgRX6Y4Yz-MVgKLLLn07KOuBRt98'
  }
};
