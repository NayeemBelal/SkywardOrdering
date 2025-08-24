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
      'uploading': 'Uploading...',
      'delete site': 'Delete site',
      
      // Custom Requests
      'custom requests': 'Custom Requests',
      'add custom': 'Add Custom',
      'no custom requests': 'No custom requests added',
      'item name': 'Item Name',
      'actions': 'Actions',
      'enter item name': 'Enter item name',
      'custom item': 'Custom Item',
      
      // Bulk Import
      'bulk import': 'Bulk Import',
      'bulk import items': 'Bulk Import Items',
      'file format instructions': 'File Format Instructions',
      'excel format description': 'Your Excel or CSV file should have the following columns in order:',
      'type values': 'Valid type values',
      'items consumed during use': 'Items that are consumed during use (paper towels, soap, etc.)',
      'reusable tools and equipment': 'Reusable tools and cleaning supplies (mops, brooms, etc.)',
      'large machinery and equipment': 'Large machinery and equipment (vacuums, scrubbers, etc.)',
      'site validation message': 'All rows must have site location matching "{{siteName}}"',
      'select file': 'Select File',
      'choose file': 'Choose File',
      'supported formats': 'Supported formats',
      'errors found': 'Errors Found',
      'preview import data': 'Preview Import Data',
      'back to upload': 'Back to Upload',
      'validation errors': 'Validation Errors',
      'fix errors before importing': 'Please fix all errors before importing.',
      'items to import': 'Items to Import',
      'row': 'Row',
      'site location': 'Site Location',
      'importing': 'Importing...',
      'import items': 'Import Items',
      'import product images': 'Import Product Images',
      'back to preview': 'Back to Preview',
      'image import instructions': 'Image Import Instructions',
      'image filename format': 'Image files should be named with the item SKU followed by the file extension:',
      'supported image formats': 'Supported formats',
      'image sku matching note': 'Only images with SKUs matching imported items will be uploaded.',
      'select images': 'Select Images',
      'add images': 'Add Images',
      'click to select multiple images': 'Click to select multiple image files',
      'image errors': 'Image Errors',
      'selected images': 'Selected Images',
      'filename': 'Filename',
      'extracted sku': 'Extracted SKU',
      'file size': 'File Size',
      'no images selected': 'No images selected yet',
      'next add images': 'Next: Add Images',
      'skip images import only items': 'Skip Images - Import Items Only',
      'import items and images': 'Import Items and Images',
      
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
      image: 'Imagen',
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
      
      // Custom Requests
      'custom requests': 'Solicitudes Personalizadas',
      'add custom': 'Agregar Personalizado',
      'no custom requests': 'No hay solicitudes personalizadas',
      'item name': 'Nombre del Artículo',
      'actions': 'Acciones',
      'enter item name': 'Ingrese el nombre del artículo',
      'custom item': 'Artículo Personalizado',
      
      // Bulk Import
      'bulk import': 'Importación en Lote',
      'bulk import items': 'Importar Artículos en Lote',
      'file format instructions': 'Instrucciones de Formato de Archivo',
      'excel format description': 'Su archivo Excel o CSV debe tener las siguientes columnas en orden:',
      'type values': 'Valores de tipo válidos',
      'items consumed during use': 'Artículos que se consumen durante el uso (toallas de papel, jabón, etc.)',
      'reusable tools and equipment': 'Herramientas reutilizables y suministros de limpieza (trapeadores, escobas, etc.)',
      'large machinery and equipment': 'Maquinaria y equipo grande (aspiradoras, fregadoras, etc.)',
      'site validation message': 'Todas las filas deben tener la ubicación del sitio que coincida con "{{siteName}}"',
      'select file': 'Seleccionar Archivo',
      'choose file': 'Elegir Archivo',
      'supported formats': 'Formatos compatibles',
      'errors found': 'Errores Encontrados',
      'preview import data': 'Vista Previa de Datos de Importación',
      'back to upload': 'Volver a Subir',
      'validation errors': 'Errores de Validación',
      'fix errors before importing': 'Por favor corrija todos los errores antes de importar.',
      'items to import': 'Artículos a Importar',
      'row': 'Fila',
      'site location': 'Ubicación del Sitio',
      'importing': 'Importando...',
      'import items': 'Importar Artículos',
      'import product images': 'Importar Imágenes de Productos',
      'back to preview': 'Volver a Vista Previa',
      'image import instructions': 'Instrucciones de Importación de Imágenes',
      'image filename format': 'Los archivos de imagen deben nombrarse con el SKU del artículo seguido de la extensión del archivo:',
      'supported image formats': 'Formatos compatibles',
      'image sku matching note': 'Solo se subirán las imágenes con SKUs que coincidan con los artículos importados.',
      'select images': 'Seleccionar Imágenes',
      'add images': 'Agregar Imágenes',
      'click to select multiple images': 'Haga clic para seleccionar varios archivos de imagen',
      'image errors': 'Errores de Imagen',
      'selected images': 'Imágenes Seleccionadas',
      'filename': 'Nombre del Archivo',
      'extracted sku': 'SKU Extraído',
      'file size': 'Tamaño del Archivo',
      'no images selected': 'No se han seleccionado imágenes aún',
      'next add images': 'Siguiente: Agregar Imágenes',
      'skip images import only items': 'Omitir Imágenes - Importar Solo Artículos',
      'import items and images': 'Importar Artículos e Imágenes',
      
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
