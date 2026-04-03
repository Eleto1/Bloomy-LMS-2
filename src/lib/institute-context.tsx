import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface InstituteData {
  name: string;
  logoUrl: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  accentColor: string;
  theme: string;
}

interface InstituteContextType extends InstituteData {
  refresh: () => Promise<void>;
}

const InstituteContext = createContext<InstituteContextType>({
  name: '',
  logoUrl: '',
  email: '',
  phone: '',
  location: '',
  website: '',
  accentColor: '#10b981',
  theme: 'light',
  refresh: async () => {},
});

export function InstituteProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<InstituteData>({
    name: '',
    logoUrl: '',
    email: '',
    phone: '',
    location: '',
    website: '',
    accentColor: '#10b981',
    theme: 'light',
  });

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('institute_settings')
      .select('institute_name, logo_url, email, phone, location, website, accent_color, theme')
      .single();

    if (data) {
      setData({
        name: data.institute_name || '',
        logoUrl: data.logo_url || '',
        email: data.email || '',
        phone: data.phone || '',
        location: data.location || '',
        website: data.website || '',
        accentColor: data.accent_color || '#10b981',
        theme: data.theme || 'light',
      });
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  return (
    <InstituteContext.Provider value={{ ...data, refresh: fetchSettings }}>
      {children}
    </InstituteContext.Provider>
  );
}

export function useInstitute() {
  return useContext(InstituteContext);
}