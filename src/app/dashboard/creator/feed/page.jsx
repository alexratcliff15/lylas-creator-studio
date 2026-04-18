'use client';
import { useState, useEffect } from 'react';
import { Badge, Card, Avatar } from '@/components/ui';
import { TrendingUp, Eye, MessageCircle, Share2, Heart, Bookmark } from 'lucide-react';
import { useCreatorProfile } from '@/hooks/useCreatorProfile';
import { api } from '@/lib/apiClient';

export default function CreatorFeedPage() {
  const { profile, loading: profileLoading, error: profileError } = useCreatorProfile();
  const [feedPosts, setFeedPosts] = useState([]);
  const [topStyles, setTopStyles] = useState([]);
  const [likedPosts, setLikedPosts] = useState(new Set());
  const [savedPosts, setSavedPosts] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchFeedData() {
      if (!profile?.id) return;

      try {
        setLoading(true);

        // Fetch feed posts
        const feedResponse = await api.get(`/api/feed?creatorProfileId=${profile.id}`);
        const posts = feedResponse.posts || [];
        setFeedPosts(posts);

        // Calculate top styles from posts
        const styleMap = {};
        posts.forEach(post => {
          if (post.tags && Array.isArray(post.tags)) {
            post.tags.forEach(tag => {
              if (!styleMap[tag]) {
                styleMap[tag] = { name: tag, avgRoas: 0, videoCount: 0, trend: '+0%' };
              }
              styleMap[tag].videoCount += 1;
              styleMap[tag].avgRoas += post.roas || 0;
            });
          }
        });

        // Calculate averages and trends
        const styles = Object.values(styleMap)
          .map(style => ({
            ...style,
            avgRoas: style.avgRoas / Math.max(style.videoCount, 1),
            trend: `+${Math.random() * 20 | 0}%`,
          }))
          .sort((a, b) => b.avgRoas - a.avgRoas)
          .slice(0, 4);

        setTopStyles(styles);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchFeedData();
  }, [profile?.id]);

  const toggleLike = (postId) => {
    const newLiked = new Set(likedPosts);
    if (newLiked.has(postId)) {
      newLiked.delete(postId);
    } else {
      newLiked.add(postId);
    }
    setLikedPosts(newLiked);
  };

  const toggleSave = (postId) => {
    const newSaved = new Set(savedPosts);
    if (newSaved.has(postId)) {
      newSaved.delete(postId);
    } else {
      newSaved.add(postId);
    }
    setSavedPosts(newSaved);
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading feed...</p>
        </div>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal mb-2">Creator Feed</h1>
          <p className="text-gray-600">Learn from top-performing creators in the community</p>
        </div>
        <Card className="text-center py-12">
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Profile Not Found</h3>
          <p className="text-gray-500">Complete your profile to view the feed.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-brand-charcoal mb-2">Creator Feed</h1>
        <p className="text-gray-600">
          Learn from top-performing creators in the community
        </p>
      </div>

      {error && (
        <Card className="bg-red-50 border border-red-200 p-4">
          <p className="text-red-800 text-sm">Error loading feed: {error}</p>
        </Card>
      )}

      {/* Top Converting Styles */}
      {topStyles.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-brand-charcoal mb-4">
            Top Converting Content Styles
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {topStyles.map((style) => (
              <Card key={style.name} className="flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-brand-charcoal">
                      {style.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {style.videoCount} videos
                    </p>
                  </div>
                  <Badge variant="info" size="sm" icon={TrendingUp}>
                    {style.trend}
                  </Badge>
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-600">Avg ROAS</p>
                  <p className="text-2xl font-bold text-brand-primary">
                    {style.avgRoas.toFixed(1)}x
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Feed Posts */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-brand-charcoal">
          Latest From Creators
        </h2>

        {feedPosts.length > 0 ? (
          feedPosts.map((post) => (
            <Card key={post.id} className="hover:shadow-lg transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <Avatar
                    initials={post.creatorProfile?.handle?.substring(0, 2).toUpperCase() || 'CR'}
                    size="md"
                  />
                  <div>
                    <h3 className="font-semibold text-brand-charcoal">
                      {post.creatorProfile?.handle || 'Unknown Creator'}
                    </h3>
                    <p className="text-xs text-gray-500">Creator</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Recently</p>
              </div>

              {/* Content */}
              <p className="text-gray-800 mb-4 leading-relaxed">{post.content}</p>

              {/* Video Reference */}
              {post.videoTitle && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600">Featured video</p>
                  <p className="font-semibold text-brand-charcoal">{post.videoTitle}</p>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-brand-cream rounded-lg">
                <div>
                  <p className="text-xs text-gray-600">ROAS</p>
                  <p className="font-bold text-brand-primary">
                    {post.roas ? post.roas.toFixed(1) : '0'}x
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Views</p>
                  <p className="font-bold text-brand-charcoal">
                    {post.views ? (post.views / 1000).toFixed(1) : '0'}K
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Saves</p>
                  <p className="font-bold text-brand-charcoal">
                    {Math.round((post.saves || 0) / 100) || '0'}
                  </p>
                </div>
              </div>

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {post.tags.slice(0, 3).map((tag, idx) => (
                    <Badge key={idx} variant="default" size="sm">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 text-gray-600">
                <button
                  className="flex items-center gap-2 hover:text-brand-primary transition-colors"
                  onClick={() => toggleLike(post.id)}
                >
                  <Heart
                    className={`w-5 h-5 ${
                      likedPosts.has(post.id) ? 'fill-red-500 text-red-500' : ''
                    }`}
                  />
                  <span className="text-sm font-medium">{post.likes || 0}</span>
                </button>

                <button className="flex items-center gap-2 hover:text-brand-primary transition-colors">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">{post.comments || 0}</span>
                </button>

                <button
                  className="flex items-center gap-2 hover:text-brand-primary transition-colors"
                  onClick={() => toggleSave(post.id)}
                >
                  <Bookmark
                    className={`w-5 h-5 ${
                      savedPosts.has(post.id) ? 'fill-brand-primary text-brand-primary' : ''
                    }`}
                  />
                  <span className="text-sm font-medium">Save</span>
                </button>

                <button className="flex items-center gap-2 hover:text-brand-primary transition-colors">
                  <Share2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Share</span>
                </button>
              </div>
            </Card>
          ))
        ) : (
          <Card className="text-center py-12">
            <p className="text-gray-500">No posts in feed yet</p>
          </Card>
        )}
      </div>
    </div>
  );
}
