'use client';
import { useState, useEffect } from 'react';
import { Badge, Card, Button } from '@/components/ui';
import { Search, Filter, Copy, ExternalLink } from 'lucide-react';
import { api } from '@/lib/apiClient';

export default function LibraryPage() {
  const [allVideos, setAllVideos] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [styleFilter, setStyleFilter] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allVideos, searchValue, styleFilter]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/videos?limit=100');
      setAllVideos(res.videos || []);
    } catch (err) {
      console.error('Failed to fetch videos:', err);
      setError('Failed to load video library');
      setAllVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = allVideos;

    if (searchValue) {
      result = result.filter((video) => {
        const matchesSearch =
          video.title.toLowerCase().includes(searchValue.toLowerCase()) ||
          video.creatorProfile?.handle?.toLowerCase().includes(searchValue.toLowerCase()) ||
          video.creatorProfile?.user?.name?.toLowerCase().includes(searchValue.toLowerCase());
        return matchesSearch;
      });
    }

    if (styleFilter !== 'all') {
      result = result.filter((video) => video.status === styleFilter);
    }

    setFiltered(result);
  };

  const styles = [
    'all',
    'ACTIVE',
    'PENDING',
    'ARCHIVED',
  ];

  const handleCopyLink = (videoId) => {
    setCopiedId(videoId);
    const link = `https://lylas.house/video/${videoId}`;
    navigator.clipboard.writeText(link);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Calculate library stats
  const totalViews = allVideos.reduce((sum, v) => sum + (v.views || 0), 0);
  const totalRevenue = allVideos.reduce((sum, v) => sum + (v.revenue || 0), 0);
  const avgRoas = allVideos.length > 0
    ? (allVideos.reduce((sum, v) => sum + (v.roas || 0), 0) / allVideos.length).toFixed(2)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-brand-charcoal mb-2">
          Content Library
        </h1>
        <p className="text-gray-600">
          View and manage all published UGC content
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12 text-gray-500">
          Loading video library...
        </div>
      )}

      {!loading && (
        <>
          {/* Search & Filters */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search by title or creator..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              {/* Filter Button */}
              <button className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Filter className="w-5 h-5" />
                More Filters
              </button>
            </div>

            {/* Status Filter */}
            <div className="flex flex-wrap gap-2">
              {styles.map((style) => (
                <button
                  key={style}
                  onClick={() => setStyleFilter(style)}
                  className={`
                    px-4 py-2 rounded-lg font-medium transition-all text-sm
                    ${
                      styleFilter === style
                        ? 'bg-brand-primary text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  {style === 'all' ? 'All' : style.charAt(0) + style.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Video Grid */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((video) => (
                <Card key={video.id} className="overflow-hidden">
                  {/* Thumbnail */}
                  <div className="w-full aspect-video bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center mb-4 rounded-lg relative group">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-5xl">🎬</span>
                    )}
                    <div className="absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ExternalLink className="w-8 h-8 text-white" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-col h-full">
                    <h3 className="font-bold text-brand-charcoal mb-1 line-clamp-2">
                      {video.title}
                    </h3>

                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-gray-600">
                        {video.creatorProfile?.user?.name ||
                          video.creatorProfile?.handle ||
                          'Unknown'}
                      </p>
                      <Badge variant="info" size="sm">
                        {video.status || 'Unknown'}
                      </Badge>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg mb-4 text-xs">
                      <div>
                        <p className="text-gray-600 font-semibold">Views</p>
                        <p className="font-bold text-brand-charcoal">
                          {(video.views / 1000).toFixed(1)}K
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-semibold">ROAS</p>
                        <p className="font-bold text-brand-primary">
                          {(video.roas || 0).toFixed(2)}x
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-semibold">Revenue</p>
                        <p className="font-bold text-brand-charcoal">
                          ${(video.revenue || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 mb-4">
                      {video.impressions || 0} impressions
                    </p>

                    {/* Actions */}
                    <div className="flex gap-2 mt-auto pt-4 border-t border-gray-200">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Copy}
                        onClick={() => handleCopyLink(video.id)}
                        className="flex-1"
                      >
                        {copiedId === video.id ? 'Copied!' : 'Copy Link'}
                      </Button>
                      {video.fileUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={ExternalLink}
                          onClick={() => window.open(video.fileUrl, '_blank')}
                          className="flex-1"
                        >
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <div className="text-5xl mb-4">🎬</div>
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                No videos found
              </h3>
              <p className="text-gray-500">
                Try adjusting your search or filters
              </p>
            </Card>
          )}

          {/* Library Stats */}
          {allVideos.length > 0 && (
            <Card className="bg-brand-cream border-brand-primary">
              <h3 className="font-bold text-brand-charcoal mb-4">
                Library Overview
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-brand-primary">
                    {allVideos.length}
                  </p>
                  <p className="text-sm text-gray-600">Total Videos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-brand-primary">
                    {(totalViews / 1000).toFixed(0)}K
                  </p>
                  <p className="text-sm text-gray-600">Total Views</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-brand-primary">
                    ${(totalRevenue / allVideos.length).toLocaleString('en-US', {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                  <p className="text-sm text-gray-600">Avg Revenue</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-brand-primary">
                    {avgRoas}x
                  </p>
                  <p className="text-sm text-gray-600">Avg ROAS</p>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
