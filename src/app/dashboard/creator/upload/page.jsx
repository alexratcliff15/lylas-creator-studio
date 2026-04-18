'use client';
import { useState, useEffect, useRef } from 'react';
import { Badge, ProgressBar, Card, Button } from '@/components/ui';
import { Upload, X, CheckCircle, Clock, FileVideo } from 'lucide-react';
import { useCreatorProfile } from '@/hooks/useCreatorProfile';
import { api } from '@/lib/apiClient';

const CONTENT_TYPES = [
  { id: 'reel', label: 'Reel', description: '15-60 seconds' },
  { id: 'story', label: 'Story', description: '3-15 seconds' },
  { id: 'feed', label: 'Feed Post', description: 'Static or carousel' },
];

export default function UploadPage() {
  const { profile, loading: profileLoading, error: profileError } = useCreatorProfile();
  const [campaigns, setCampaigns] = useState([]);
  const [recentUploads, setRecentUploads] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [hookLine, setHookLine] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const MAX_SIZE_MB = 500;

  const acceptFile = (file) => {
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      alert('Please select a video or image file.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File is too large. Max ${MAX_SIZE_MB} MB.`);
      return;
    }
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    acceptFile(file);
    // allow choosing the same file again later
    e.target.value = '';
  };

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    async function fetchUploadData() {
      if (!profile?.id) return;

      try {
        setLoading(true);

        // Fetch campaigns
        const campaignsResponse = await api.get('/api/campaigns');
        const campaignsData = campaignsResponse.campaigns || [];
        setCampaigns(campaignsData);

        // Fetch recent uploads
        const videosResponse = await api.get(
          `/api/videos?creatorProfileId=${profile.id}`
        );
        const videosData = videosResponse.videos || [];
        setRecentUploads(videosData.slice(0, 5));

        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchUploadData();
  }, [profile?.id]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    acceptFile(file);
  };

  const handlePublish = async () => {
    if (!selectedFile) {
      alert('Please select a video or image file first.');
      return;
    }
    if (!selectedCampaign || !selectedType || !hookLine) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      const videoData = {
        title: hookLine,
        description: notes,
        creatorProfileId: profile.id,
        campaignId: selectedCampaign,
        fileUrl: `local://${selectedFile.name}`,
        thumbnailUrl: 'https://placeholder-thumbnail.jpg',
        status: 'PUBLISHED',
      };

      await api.post('/api/videos', videoData);

      // Reset form
      setSelectedCampaign('');
      setSelectedType('');
      setHookLine('');
      setNotes('');
      clearFile();

      alert('Video published successfully!');

      // Refresh recent uploads
      const videosResponse = await api.get(
        `/api/videos?creatorProfileId=${profile.id}`
      );
      const videosData = videosResponse.videos || [];
      setRecentUploads(videosData.slice(0, 5));
    } catch (err) {
      alert('Error publishing video: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedCampaign || !selectedType || !hookLine) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      const videoData = {
        title: hookLine,
        description: notes,
        creatorProfileId: profile.id,
        campaignId: selectedCampaign,
        fileUrl: selectedFile ? `local://${selectedFile.name}` : 'https://placeholder-video.mp4',
        thumbnailUrl: 'https://placeholder-thumbnail.jpg',
        status: 'UPLOADED',
      };

      await api.post('/api/videos', videoData);

      // Reset form
      setSelectedCampaign('');
      setSelectedType('');
      setHookLine('');
      setNotes('');
      clearFile();

      alert('Video saved as draft!');

      // Refresh recent uploads
      const videosResponse = await api.get(
        `/api/videos?creatorProfileId=${profile.id}`
      );
      const videosData = videosResponse.videos || [];
      setRecentUploads(videosData.slice(0, 5));
    } catch (err) {
      alert('Error saving draft: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading upload page...</p>
        </div>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal mb-2">Upload Video</h1>
          <p className="text-gray-600">Create and submit new UGC content for campaigns</p>
        </div>
        <Card className="text-center py-12">
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Profile Not Found</h3>
          <p className="text-gray-500">Complete your profile to start uploading.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-brand-charcoal mb-2">Upload Video</h1>
        <p className="text-gray-600">
          Create and submit new UGC content for campaigns
        </p>
      </div>

      {error && (
        <Card className="bg-red-50 border border-red-200 p-4">
          <p className="text-red-800 text-sm">Error: {error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Section */}
        <Card className="lg:col-span-2">
          {/* Drop Zone */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {selectedFile ? (
            <div className="relative border-2 border-brand-primary/40 bg-brand-cream/30 rounded-xl p-5">
              <button
                type="button"
                onClick={clearFile}
                className="absolute top-3 right-3 p-1 rounded-full hover:bg-black/10 transition-colors"
                aria-label="Remove file"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
              <div className="flex gap-4 items-center">
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-black/5 flex items-center justify-center flex-shrink-0">
                  {selectedFile.type.startsWith('video/') ? (
                    <video
                      src={previewUrl}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FileVideo className="w-4 h-4 text-brand-primary" />
                    <p className="text-sm font-semibold text-brand-charcoal truncate">
                      {selectedFile.name}
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">
                    {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB · {selectedFile.type || 'unknown'}
                  </p>
                  <Button variant="secondary" size="sm" onClick={openFilePicker}>
                    Choose a different file
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={openFilePicker}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') openFilePicker();
              }}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                ${
                  dragActive
                    ? 'border-brand-primary bg-brand-cream'
                    : 'border-gray-300 hover:border-gray-400'
                }
              `}
            >
              <Upload className="w-12 h-12 text-brand-primary mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-brand-charcoal mb-1">
                Drag your video here
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                or click to browse from your device (video or image, up to {MAX_SIZE_MB}MB)
              </p>
              <Button
                type="button"
                className="inline-block"
                onClick={(e) => {
                  e.stopPropagation();
                  openFilePicker();
                }}
              >
                Select File
              </Button>
            </div>
          )}

          {/* Form Fields */}
          <div className="mt-8 space-y-6">
            {/* Campaign Selection */}
            <div>
              <label className="block text-sm font-semibold text-brand-charcoal mb-2">
                Campaign
              </label>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="">Select a campaign</option>
                {campaigns.map((camp) => (
                  <option key={camp.id} value={camp.id}>
                    {camp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Content Type */}
            <div>
              <label className="block text-sm font-semibold text-brand-charcoal mb-3">
                Content Type
              </label>
              <div className="grid grid-cols-3 gap-3">
                {CONTENT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`
                      p-3 rounded-lg border-2 transition-all text-center
                      ${
                        selectedType === type.id
                          ? 'border-brand-primary bg-brand-cream'
                          : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <p className="font-semibold text-sm text-brand-charcoal">
                      {type.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {type.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Hook Line */}
            <div>
              <label className="block text-sm font-semibold text-brand-charcoal mb-2">
                Hook / Opening Line
              </label>
              <input
                type="text"
                value={hookLine}
                onChange={(e) => setHookLine(e.target.value)}
                placeholder="e.g., 'Wait for the transformation...' 'This changed my life...'"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
              <p className="text-xs text-gray-500 mt-1">
                Great hooks help increase engagement and conversions
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-brand-charcoal mb-2">
                Production Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this video - hashtags, tips for promotion, A/B test info..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
              />
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button
                onClick={handlePublish}
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? 'Publishing...' : 'Publish Video'}
              </Button>
              <Button
                variant="secondary"
                onClick={handleSaveDraft}
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? 'Saving...' : 'Save as Draft'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Tips Sidebar */}
        <div className="space-y-4">
          <Card>
            <h3 className="font-bold text-brand-charcoal mb-3">Tips for Success</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-2">
                <span className="text-brand-primary font-bold">•</span>
                <span>Strong hook in first 3 seconds</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-primary font-bold">•</span>
                <span>Show product benefit early</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-primary font-bold">•</span>
                <span>Clear call-to-action at end</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-primary font-bold">•</span>
                <span>Keep authentic and relatable</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-primary font-bold">•</span>
                <span>Vertical video format preferred</span>
              </li>
            </ul>
          </Card>

          <Card>
            <h3 className="font-bold text-brand-charcoal mb-3">Supported Formats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Max file size:</span>
                <span className="font-semibold">500 MB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Resolution:</span>
                <span className="font-semibold">1080x1920</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Frame rate:</span>
                <span className="font-semibold">24-60 FPS</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Uploads */}
      <Card>
        <div className="mb-6">
          <h2 className="text-lg font-bold text-brand-charcoal">Recent Uploads</h2>
          <p className="text-sm text-gray-500">Your latest submissions</p>
        </div>

        {recentUploads.length > 0 ? (
          <div className="space-y-4">
            {recentUploads.map((upload) => (
              <div
                key={upload.id}
                className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-semibold text-brand-charcoal">
                        {upload.title}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {upload.campaign?.name || 'N/A'}
                      </p>
                    </div>
                    <Badge
                      variant={
                        upload.status === 'PUBLISHED'
                          ? 'success'
                          : upload.status === 'PROCESSING'
                            ? 'warning'
                            : 'info'
                      }
                      size="sm"
                    >
                      {upload.status === 'PUBLISHED'
                        ? 'Live'
                        : upload.status === 'PROCESSING'
                          ? 'Processing'
                          : 'Pending Review'}
                    </Badge>
                  </div>

                  <ProgressBar
                    value={upload.status === 'PUBLISHED' ? 100 : 75}
                    max={100}
                    showPercent={true}
                    size="sm"
                    color={
                      upload.status === 'PUBLISHED'
                        ? 'bg-green-600'
                        : 'bg-brand-primary'
                    }
                  />

                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(upload.createdAt || Date.now()).toLocaleDateString()}
                  </p>
                </div>

                {upload.status === 'PUBLISHED' && (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                )}
                {upload.status === 'PROCESSING' && (
                  <div className="animate-spin">
                    <Clock className="w-5 h-5 text-brand-primary flex-shrink-0" />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No uploads yet. Start by uploading your first video!</p>
          </div>
        )}
      </Card>
    </div>
  );
}
