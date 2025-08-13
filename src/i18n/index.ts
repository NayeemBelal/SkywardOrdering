import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Common
      submit: 'Submit',
      sent: 'Request sent!',
      back: 'Back',
      loading: 'Loading...',
      error: 'Error',
      save: 'Save',
      cancel: 'Cancel',
      add: 'Add',
      remove: 'Remove',
      delete: 'Delete',
      edit: 'Edit',
      create: 'Create',
      item: 'Item',
      sku: 'SKU',
      category: 'Category',
      image: 'Image',
      submitted: 'Submitted',
      lines: 'Lines',
      'new supply request': 'New supply request',
      
      // Navigation
      dashboard: 'Dashboard',
      admin: 'Admin',
      logout: 'Logout',
      'admin login': 'Admin login',
      'back to request': 'Back to request',
      
      // Request Page
      site: 'Site',
      employee: 'Employee',
      'configuration required': 'Configuration Required',
      'missing env vars': 'This app requires Supabase configuration to work properly.',
      'please create env file': 'Please create a .env file with:',
      
      // Supplies Page
      'supplies for': 'Supplies for',
      'unknown site': 'Unknown Site',
      'no supplies found': 'No supplies found',
      'loading supplies': 'Loading supplies...',
      'on hand': 'On Hand',
      'order qty': 'Order Qty',
      'submitting': 'Submitting...',
      
      // Categories
      consumables: 'Consumables',
      supply: 'Supply',
      equipment: 'Equipment',
      
      // Admin
      sites: 'Sites',
      'add site': 'Add site',
      'no sites yet': 'No sites yet',
      'site name': 'Site name',
      'employees one per line': 'Employees (one per line)',
      'site supplies': 'Site supplies',
      'add row': 'Add row',
      'supply name': 'Supply name',
      'save site': 'Save site',
      'saving': 'Saving...',
      
      // Site Detail
      employees: 'Employees',
      supplies: 'Supplies',
      'new employee name': 'New employee name',
      'no employees': 'No employees',
      'delete site': 'Delete site',
      
      // Success Page
      'request sent': 'Request sent!',
    }
  },
  es: {
    translation: {
      // Common
      submit: 'Enviar',
      sent: '¡Solicitud enviada!',
      back: 'Atrás',
      loading: 'Cargando...',
      error: 'Error',
      save: 'Guardar',
      cancel: 'Cancelar',
      add: 'Agregar',
      remove: 'Eliminar',
      delete: 'Eliminar',
      edit: 'Editar',
      create: 'Crear',
      item: 'Artículo',
      sku: 'SKU',
      category: 'Categoría',
      submitted: 'Enviado',
      lines: 'Líneas',
      'new supply request': 'Nueva solicitud de suministros',
      
      // Navigation
      dashboard: 'Panel',
      admin: 'Administrador',
      logout: 'Cerrar sesión',
      'admin login': 'Iniciar sesión admin',
      'back to request': 'Volver a solicitud',
      
      // Request Page
      site: 'Sitio',
      employee: 'Empleado',
      'configuration required': 'Configuración Requerida',
      'missing env vars': 'Esta aplicación requiere configuración de Supabase para funcionar correctamente.',
      'please create env file': 'Por favor cree un archivo .env con:',
      
      // Supplies Page
      'supplies for': 'Suministros para',
      'unknown site': 'Sitio Desconocido',
      'no supplies found': 'No se encontraron suministros',
      'loading supplies': 'Cargando suministros...',
      'on hand': 'En Mano',
      'order qty': 'Cant. Pedido',
      'submitting': 'Enviando...',
      
      // Categories
      consumables: 'Consumibles',
      supply: 'Suministros',
      equipment: 'Equipos',
      
      // Admin
      sites: 'Sitios',
      'add site': 'Agregar sitio',
      'no sites yet': 'Aún no hay sitios',
      'site name': 'Nombre del sitio',
      'employees one per line': 'Empleados (uno por línea)',
      'site supplies': 'Suministros del sitio',
      'add row': 'Agregar fila',
      'supply name': 'Nombre del suministro',
      'save site': 'Guardar sitio',
      'saving': 'Guardando...',
      
      // Site Detail
      employees: 'Empleados',
      supplies: 'Suministros',
      'new employee name': 'Nombre del nuevo empleado',
      'no employees': 'No hay empleados',
      'delete site': 'Eliminar sitio',
      
      // Success Page
      'request sent': '¡Solicitud enviada!',
    }
  }
};

// Get saved language from localStorage or detect browser language or default to English
const getInitialLanguage = () => {
  // First priority: saved language from localStorage
  const saved = localStorage.getItem('app-language');
  if (saved && (saved === 'en' || saved === 'es')) {
    return saved;
  }
  
  // Second priority: browser language
  const browserLang = navigator.language || navigator.languages?.[0] || 'en';
  if (browserLang.startsWith('es')) {
    return 'es';
  }
  
  // Default: English
  return 'en';
};

const savedLanguage = getInitialLanguage();

i18n.use(initReactI18next).init({
  resources,
  lng: savedLanguage, // Use saved language
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Listen for language changes and save to localStorage
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('app-language', lng);
});

export default i18n;
