import type { VercelRequest, VercelResponse } from '@vercel/node';
import Busboy from 'busboy';
import https from 'https';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const busboy = Busboy({ headers: req.headers });
  
  const apiKey = process.env.BUNNY_STORAGE_API_KEY;
  const storageZone = process.env.BUNNY_STORAGE_ZONE;
  const cdnUrl = process.env.BUNNY_CDN_URL || ''; // Should be like https://cdn.example.com

  if (!apiKey || !storageZone) {
    console.error('Missing Bunny Storage configuration');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const uploads: Promise<any>[] = [];

  busboy.on('file', (fieldname, file, info) => {
    const { filename, mimeType } = info;
    const chunks: Buffer[] = [];

    file.on('data', (data) => {
      chunks.push(data);
    });

    const uploadPromise = new Promise((resolve, reject) => {
      file.on('end', async () => {
        const fileBuffer = Buffer.concat(chunks);
        
        // Construct Bunny Storage URL
        // Format: https://storage.bunnycdn.com/{storageZoneName}/{path}/{fileName}
        // We will organize by date or just root for now, or use the path provided in headers/query?
        // Better to let the client specify the path or just use a default 'uploads' folder.
        // Let's expect a 'path' field or just generate one.
        // For simplicity, we'll just upload to a 'uploads' folder with a timestamp.
        
        // However, the client (ProfileSetup) constructs a path: `verification/${user.id}/${fileName}`.
        // We should try to preserve this if possible. 
        // We can pass the path in a header 'x-upload-path' or as a form field.
        // Form fields are harder to sync with busboy if they come after the file.
        // Let's use a header for the path: 'x-file-path'.
        
        const path = req.headers['x-file-path'] as string || `uploads/${Date.now()}-${filename}`;
        // Sanitize path to prevent traversing? Bunny probably handles it, but good to be safe.
        // Remove leading slashes
        const cleanPath = path.replace(/^\/+/, '');
        
        const hostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com'; // Some zones are in other regions (e.g. ny.storage.bunnycdn.com)
        
        const options = {
          method: 'PUT',
          hostname: hostname,
          path: `/${storageZone}/${cleanPath}`,
          headers: {
            'AccessKey': apiKey,
            'Content-Type': mimeType,
            'Content-Length': fileBuffer.length,
          },
        };

        const bunnyReq = https.request(options, (bunnyRes) => {
          let responseData = '';
          bunnyRes.on('data', (chunk) => responseData += chunk);
          bunnyRes.on('end', () => {
            if (bunnyRes.statusCode === 201 || bunnyRes.statusCode === 200) {
              // Success
              // Construct public URL
              const publicUrl = cdnUrl 
                ? `${cdnUrl}/${cleanPath}`
                : `https://${storageZone}.b-cdn.net/${cleanPath}`; // Fallback if no custom hostname
              
              resolve({ publicUrl, path: cleanPath });
            } else {
              console.error('Bunny Upload Error:', responseData);
              reject(new Error(`Bunny Storage returned ${bunnyRes.statusCode}`));
            }
          });
        });

        bunnyReq.on('error', (e) => reject(e));
        bunnyReq.write(fileBuffer);
        bunnyReq.end();
      });
    });
    
    uploads.push(uploadPromise);
  });

  busboy.on('finish', async () => {
    try {
      const results = await Promise.all(uploads);
      if (results.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }
      // Return the first file's result (assuming single file upload for now)
      return res.status(200).json(results[0]);
    } catch (error: any) {
      console.error('Upload failed:', error);
      return res.status(500).json({ error: error.message || 'Upload failed' });
    }
  });

  busboy.on('error', (error) => {
    console.error('Busboy error:', error);
    res.status(500).json({ error: 'File parsing error' });
  });

  req.pipe(busboy);
}
