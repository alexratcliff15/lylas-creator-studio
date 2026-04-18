'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/apiClient';

export function useCreatorProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        // Use /api/me to get the logged-in user's own profile directly
        const data = await api.get('/api/me');
        if (data.creatorProfile) {
          setProfile(data.creatorProfile);
        } else {
          setError('No creator profile found');
        }
      } catch (err) {
        // Fallback to old search method
        try {
          const userData = JSON.parse(localStorage.getItem('user') || '{}');
          if (!userData.email) {
            setError('Not logged in');
            setLoading(false);
            return;
          }
          const searchData = await api.get(`/api/creators?search=${encodeURIComponent(userData.email)}&limit=1`);
          if (searchData.creators && searchData.creators.length > 0) {
            setProfile(searchData.creators[0]);
          } else {
            setError('No creator profile found');
          }
        } catch (fallbackErr) {
          setError(fallbackErr.message);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  return { profile, loading, error };
}
