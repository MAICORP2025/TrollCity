
/**
 * Bunny Storage Client
 * Handles file uploads via Vercel Serverless Function proxy
 */

export interface UploadResult {
  publicUrl: string | null;
  path: string | null;
  error: Error | null;
}

export const bunnyStorage = {
  /**
   * Upload a file to Bunny Storage
   * @param path - The destination path (e.g., "verification/user123/id.jpg")
   * @param file - The file object to upload
   */
  upload: async (path: string, file: File): Promise<UploadResult> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'x-file-path': path,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      return {
        publicUrl: data.publicUrl,
        path: data.path,
        error: null,
      };
    } catch (error: any) {
      console.error('Bunny Storage Upload Error:', error);
      return {
        publicUrl: null,
        path: null,
        error: error,
      };
    }
  },

  /**
   * Get the public URL for a file
   * Note: This assumes the file exists and the CDN is configured.
   */
  getPublicUrl: (path: string) => {
    const baseUrl = import.meta.env.VITE_HLS_BASE_URL || 'https://cdn.maitrollcity.com';
    // Remove leading slash if present
    const cleanPath = path.replace(/^\/+/, '');
    return {
      data: {
        publicUrl: `${baseUrl}/${cleanPath}`,
      },
    };
  },
};
