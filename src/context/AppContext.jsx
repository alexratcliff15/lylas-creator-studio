'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [portalMode, setPortalMode] = useState('creator');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load user from localStorage on mount
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setPortalMode(parsedUser.role || 'creator');
      } catch (err) {
        console.error('Failed to parse user:', err);
      }
    }
    setLoading(false);
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setNotifications([]);
  };

  const addNotification = (notification) => {
    const id = Date.now();
    const newNotif = { ...notification, id };
    setNotifications((prev) => [...prev, newNotif]);

    if (notification.duration !== 'persistent') {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration || 3000);
    }

    return id;
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const switchPortal = (mode) => {
    // Creators can only be in creator mode
    if (user?.role === 'creator' && mode !== 'creator') return;
    setPortalMode(mode);
  };

  const value = {
    user,
    setUser,
    portalMode,
    switchPortal,
    notifications,
    addNotification,
    removeNotification,
    logout,
    loading,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
