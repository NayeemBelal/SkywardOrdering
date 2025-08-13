import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function App() {
  const { i18n, t } = useTranslation();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  
  const toggleLanguage = () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
    setShowLanguageMenu(false);
  };

  const getCurrentLanguageName = () => {
    return i18n.language === 'es' ? 'Español' : 'English';
  };

  const getCurrentLanguageFlag = () => {
    return i18n.language === 'es' ? '🇪🇸' : '🇺🇸';
  };

  return (
    <div className="min-h-screen">
      <header className="p-2 text-right relative">
        <div className="inline-block">
          <button 
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span className="text-lg">{getCurrentLanguageFlag()}</span>
            <span className="font-medium">{getCurrentLanguageName()}</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showLanguageMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-50">
              <div className="py-1">
                <button
                  onClick={() => {
                    i18n.changeLanguage('en');
                    setShowLanguageMenu(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3 ${
                    i18n.language === 'en' ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                >
                  <span className="text-lg">🇺🇸</span>
                  <span>English</span>
                  {i18n.language === 'en' && <span className="text-blue-600">✓</span>}
                </button>
                <button
                  onClick={() => {
                    i18n.changeLanguage('es');
                    setShowLanguageMenu(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3 ${
                    i18n.language === 'es' ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                >
                  <span className="text-lg">🇪🇸</span>
                  <span>Español</span>
                  {i18n.language === 'es' && <span className="text-blue-600">✓</span>}
                </button>
              </div>
            </div>
          )}
        </div>
      </header>
      <main className="p-4"><Outlet /></main>
      
      {/* Click outside to close language menu */}
      {showLanguageMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowLanguageMenu(false)}
        />
      )}
    </div>
  );
}
