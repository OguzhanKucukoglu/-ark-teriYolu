import React, { createContext, useContext, useEffect, useState } from 'react';
import { ConfigProvider, Dropdown, Button, Space } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import 'dayjs/locale/en';
import 'dayjs/locale/de';

// Ant Design Yerelleştirmeleri
import trTR from 'antd/locale/tr_TR';
import enUS from 'antd/locale/en_US';
import deDE from 'antd/locale/de_DE';

// Sözlükler
import { tr } from './locales/tr';
import { en } from './locales/en';
import { de } from './locales/de';

export type Language = 'tr' | 'en' | 'de';

export interface LanguageOption {
  code: Language;
  label: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'tr', label: 'Türkçe',  flag: '🇹🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

const LOCALES_DATA: Record<Language, any> = { tr, en, de };

const ANTD_LOCALES: Record<Language, typeof trTR> = {
  tr: trTR,
  en: enUS,
  de: deDE,
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'tr',
  setLanguage: () => {},
  t: (path) => path,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('avatar_language') as Language;
    return saved === 'en' || saved === 'de' ? saved : 'tr';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('avatar_language', lang);
    dayjs.locale(lang);
  };

  useEffect(() => {
    dayjs.locale(language);
  }, [language]);

  const t = (path: string, params?: Record<string, string | number>): string => {
    const keys = path.split('.');
    let current: any = LOCALES_DATA[language];

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        // Fallback Türkçe
        current = undefined;
        break;
      }
    }

    if (current === undefined) {
      let fallback: any = LOCALES_DATA['tr'];
      for (const key of keys) {
        if (fallback && typeof fallback === 'object' && key in fallback) {
          fallback = fallback[key];
        } else {
          fallback = undefined;
          break;
        }
      }
      current = fallback ?? path;
    }

    let text = String(current);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`{${k}}`, 'g'), String(v));
      }
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      <ConfigProvider locale={ANTD_LOCALES[language]}>
        {children}
      </ConfigProvider>
    </LanguageContext.Provider>
  );
};

export function useTranslation() {
  return useContext(LanguageContext);
}

/**
 * Üst çubuğa (Header) yerleşen pratik Dil Seçici Bileşeni
 */
export const LanguageSwitcher: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const { language, setLanguage } = useTranslation();
  const current = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  const menuItems = LANGUAGES.map(l => ({
    key: l.code,
    label: (
      <Space>
        <span>{l.flag}</span>
        <span style={{ fontWeight: l.code === language ? 600 : 400 }}>{l.label}</span>
      </Space>
    ),
    onClick: () => setLanguage(l.code),
  }));

  return (
    <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
      <Button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
        <GlobalOutlined />
        <span>{current.flag} {current.label}</span>
      </Button>
    </Dropdown>
  );
};
