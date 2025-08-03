import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function App() {
  const { i18n } = useTranslation();
  const toggle = () => i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');
  return (
    <div className="min-h-screen">
      <header className="p-2 text-right">
        <button onClick={toggle}>🌐</button>
      </header>
      <main className="p-4"><Outlet /></main>
    </div>
  );
}
