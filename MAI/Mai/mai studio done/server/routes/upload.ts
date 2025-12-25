import { RequestHandler } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { getUserIdFromSession } from '../sessions';
import { supabase } from '../supabaseClient';

const MAX_SHORT_DURATION = 20 * 60; // 20 minutes in seconds
const MAX_MOVIE_DURATION = 150 * 60; // 150 minutes in seconds

const getUserFromRequest = async (req: any): Promise<any | null> => {
  const sessionId = req.cookies.sessionId;
  if (!sessionId) return null;
  const userId = getUserIdFromSession(sessionId);
  if (!userId) return null;

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  return user;
};

const getVideoDuration = (_filePath: string): Promise<number> => {
  return new Promise((resolve, _reject) => {
    // For now, we'll use a simple approach. In production, you'd use ffprobe or similar
    // For this demo, we'll return a mock duration or try to read metadata
    // This is a placeholder - proper video duration extraction would require ffmpeg/ffprobe

    // Mock duration for demo - in real implementation, use proper video processing
    setTimeout(() => {
      // This should be replaced with actual video duration extraction
      resolve(60); // Mock 1 minute duration
    }, 100);
  });
};

export const handleUploadVideo: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { title, description, content_type, series_id } = req.body;

    if (!title || !content_type) {
      return res.status(400).json({
        success: false,
        error: 'Title and content type are required',
      });
    }

    if (!['short', 'movie'].includes(content_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid content type',
      });
    }

    const files = req.files as Record<string, any>;
    if (!files || !files.video_file) {
      return res.status(400).json({
        success: false,
        error: 'Video file is required',
      });
    }

    const videoFile = files.video_file[0];
    const thumbnailFile = files.thumbnail_file ? files.thumbnail_file[0] : null;

    // Validate video duration
    const videoPath = path.join(process.cwd(), 'uploads', 'videos', videoFile.filename);
    const duration = await getVideoDuration(videoPath);

    const maxDuration = content_type === 'short' ? MAX_SHORT_DURATION : MAX_MOVIE_DURATION;
    if (duration > maxDuration) {
      // Clean up uploaded files
      try {
        await fs.unlink(videoPath);
        if (thumbnailFile) {
          const thumbnailPath = path.join(process.cwd(), 'uploads', 'thumbnails', thumbnailFile.filename);
          await fs.unlink(thumbnailPath);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up files:', cleanupError);
      }

      return res.status(400).json({
        success: false,
        error: `Video duration exceeds the limit for ${content_type}s (${maxDuration / 60} minutes)`,
      });
    }

    // Validate series_id if provided
    if (series_id) {
      const { data: series } = await supabase
        .from('series')
        .select('id')
        .eq('id', series_id)
        .eq('creator_id', user.id)
        .single();

      if (!series) {
        return res.status(400).json({
          success: false,
          error: 'Invalid series selected',
        });
      }
    }

    // Create video record in database
    const videoData = {
      creator_id: user.id,
      series_id: series_id || null,
      title,
      description: description || null,
      content_type,
      video_url: `/uploads/videos/${videoFile.filename}`,
      thumbnail_url: thumbnailFile ? `/uploads/thumbnails/${thumbnailFile.filename}` : null,
      duration,
      views: 0,
      likes: 0,
      featured: false,
      status: 'pending', // Videos need approval
      is_unlockable: false,
      unlock_price: null,
    };

    const { data: video, error: insertError } = await supabase
      .from('content')
      .insert(videoData)
      .select(`
        *,
        creator:users!content_creator_id_fkey (
          id,
          username,
          display_name,
          role
        ),
        series (
          id,
          name,
          description
        )
      `)
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      // Clean up uploaded files
      try {
        await fs.unlink(videoPath);
        if (thumbnailFile) {
          const thumbnailPath = path.join(process.cwd(), 'uploads', 'thumbnails', thumbnailFile.filename);
          await fs.unlink(thumbnailPath);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up files:', cleanupError);
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to save video',
      });
    }

    res.json({
      success: true,
      video: {
        id: video.id,
        creator_id: video.creator_id,
        series_id: video.series_id,
        title: video.title,
        description: video.description,
        type: video.content_type,
        thumbnail_url: video.thumbnail_url,
        video_url: video.video_url,
        views: video.views,
        likes: video.likes,
        featured: video.featured,
        status: video.status,
        is_unlockable: video.is_unlockable,
        unlock_price: video.unlock_price,
        created_at: video.created_at,
        updated_at: video.updated_at,
        creator: video.creator,
        series: video.series,
      },
    });
  } catch (error) {
    console.error('Upload video error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    });
  }
};