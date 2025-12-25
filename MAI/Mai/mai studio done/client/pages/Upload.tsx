import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload as UploadIcon, AlertCircle, CheckCircle } from 'lucide-react';
import { UploadVideoRequest, UploadVideoResponse, Series, ListSeriesResponse } from '../../shared/api';

const MAX_SHORT_DURATION = 20 * 60; // 20 minutes in seconds
const MAX_MOVIE_DURATION = 150 * 60; // 150 minutes in seconds

export default function Upload() {
  const navigate = useNavigate();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSeries();
  }, []);

  const loadSeries = async () => {
    setLoadingSeries(true);
    try {
      const response = await fetch('/api/series');
      const result: ListSeriesResponse = await response.json();
      if (result.success) {
        setSeries((result.series || []).filter(s => s.id && s.name));
      }
    } catch (error) {
      console.error('Error loading series:', error);
    } finally {
      setLoadingSeries(false);
    }
  };

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content_type: 'short' as 'short' | 'movie',
    series_id: '',
  });

  const [series, setSeries] = useState<Series[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);

  const [files, setFiles] = useState({
    video: null as File | null,
    thumbnail: null as File | null,
  });

  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file');
      return;
    }

    // Get video duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = Math.floor(video.duration);
      setVideoDuration(duration);

      // Validate duration
      const maxDuration = formData.content_type === 'short' ? MAX_SHORT_DURATION : MAX_MOVIE_DURATION;
      if (duration > maxDuration) {
        setError(`Video duration exceeds the limit for ${formData.content_type}s (${maxDuration / 60} minutes)`);
        setFiles(prev => ({ ...prev, video: null }));
        if (videoInputRef.current) videoInputRef.current.value = '';
        return;
      }

      setFiles(prev => ({ ...prev, video: file }));
      setError('');
    };
    video.src = URL.createObjectURL(file);
  };

  const handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file for thumbnail');
      return;
    }

    setFiles(prev => ({ ...prev, thumbnail: file }));
  };

  const handleContentTypeChange = (value: 'short' | 'movie') => {
    setFormData(prev => ({ ...prev, content_type: value }));

    // Re-validate video duration if video is already selected
    if (videoDuration !== null) {
      const maxDuration = value === 'short' ? MAX_SHORT_DURATION : MAX_MOVIE_DURATION;
      if (videoDuration > maxDuration) {
        setError(`Video duration exceeds the limit for ${value}s (${maxDuration / 60} minutes)`);
        setFiles(prev => ({ ...prev, video: null }));
        if (videoInputRef.current) videoInputRef.current.value = '';
        setVideoDuration(null);
      } else {
        setError('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!files.video) {
      setError('Please select a video file');
      return;
    }

    if (!formData.title.trim()) {
      setError('Please enter a title');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const uploadData: UploadVideoRequest = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        content_type: formData.content_type,
        series_id: formData.series_id || undefined,
        video_file: files.video,
        thumbnail_file: files.thumbnail || undefined,
      };

      const formDataToSend = new FormData();
      formDataToSend.append('title', uploadData.title);
      if (uploadData.description) {
        formDataToSend.append('description', uploadData.description);
      }
      formDataToSend.append('content_type', uploadData.content_type);
      if (uploadData.series_id) {
        formDataToSend.append('series_id', uploadData.series_id);
      }
      formDataToSend.append('video_file', uploadData.video_file);
      if (uploadData.thumbnail_file) {
        formDataToSend.append('thumbnail_file', uploadData.thumbnail_file);
      }

      const response = await fetch('/api/upload/video', {
        method: 'POST',
        body: formDataToSend,
      });

      const result: UploadVideoResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (success) {
    return (
      <Layout>
        <div className="min-h-screen pt-20 flex items-center justify-center">
          <div className="card-glow rounded-lg p-8 border border-green-500/20 max-w-md w-full">
            <div className="flex items-center gap-4 mb-4">
              <CheckCircle className="text-green-400" size={32} />
              <h2 className="text-2xl font-bold text-green-400">Upload Successful!</h2>
            </div>
            <p className="text-gray-300">
              Your video has been uploaded and is being processed. You'll be redirected to the home page shortly.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen pt-20 px-4 pb-20">
        <div className="container-wide max-w-2xl">
          <div className="mb-8">
            <h1 className="text-4xl font-black text-gradient-gold-red mb-2">
              Upload Video
            </h1>
            <p className="text-gray-400">
              Share your content with the MAI Studios community
            </p>
          </div>

          <div className="card-glow rounded-lg p-8 border border-white/10">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Content Type */}
              <div>
                <Label className="text-white font-semibold mb-3 block">Content Type</Label>
                <RadioGroup
                  value={formData.content_type}
                  onValueChange={handleContentTypeChange}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="short" id="short" />
                    <Label htmlFor="short" className="text-gray-300">
                      Short (max {MAX_SHORT_DURATION / 60} minutes)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="movie" id="movie" />
                    <Label htmlFor="movie" className="text-gray-300">
                      Movie (max {MAX_MOVIE_DURATION / 60} minutes)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Title */}
              <div>
                <Label htmlFor="title" className="text-white font-semibold mb-2 block">
                  Title *
                </Label>
                <Input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter video title"
                  className="bg-black/50 border-white/20 text-white"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description" className="text-white font-semibold mb-2 block">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter video description (optional)"
                  className="bg-black/50 border-white/20 text-white min-h-[100px]"
                />
              </div>

              {/* Series */}
              <div>
                <Label className="text-white font-semibold mb-2 block">
                  Series (Optional)
                </Label>
                <Select
                  value={formData.series_id || "none"}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, series_id: value === "none" ? "" : value }))}
                  disabled={loadingSeries}
                >
                  <SelectTrigger className="bg-black/50 border-white/20 text-white">
                    <SelectValue placeholder={loadingSeries ? "Loading series..." : "Select a series"} />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/20">
                    <SelectItem value="none">No series</SelectItem>
                    {series.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Video File */}
              <div>
                <Label className="text-white font-semibold mb-2 block">
                  Video File *
                </Label>
                <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-yellow-400/50 transition-colors">
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoFileChange}
                    className="hidden"
                    id="video-file"
                  />
                  <label htmlFor="video-file" className="cursor-pointer">
                    <UploadIcon className="mx-auto mb-4 text-gray-400" size={48} />
                    <p className="text-gray-300 mb-2">
                      {files.video ? files.video.name : 'Click to select video file'}
                    </p>
                    {videoDuration && (
                      <p className="text-sm text-gray-400">
                        Duration: {formatDuration(videoDuration)}
                      </p>
                    )}
                  </label>
                </div>
              </div>

              {/* Thumbnail File */}
              <div>
                <Label className="text-white font-semibold mb-2 block">
                  Thumbnail (Optional)
                </Label>
                <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-yellow-400/50 transition-colors">
                  <input
                    ref={thumbnailInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailFileChange}
                    className="hidden"
                    id="thumbnail-file"
                  />
                  <label htmlFor="thumbnail-file" className="cursor-pointer">
                    <UploadIcon className="mx-auto mb-4 text-gray-400" size={48} />
                    <p className="text-gray-300">
                      {files.thumbnail ? files.thumbnail.name : 'Click to select thumbnail image'}
                    </p>
                  </label>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <Alert className="border-red-500/20 bg-red-500/10">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-400">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isUploading || !files.video}
                className="w-full neon-btn-gold"
              >
                {isUploading ? 'Uploading...' : 'Upload Video'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}