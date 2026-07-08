import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import type { UploadApiResponse, v2 as Cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { CLOUDINARY } from './cloudinary.provider';

@Injectable()
export class CloudinaryService {
  constructor(
    @Inject(CLOUDINARY) private readonly cloudinary: typeof Cloudinary,
  ) {}

  /**
   * Upload a file buffer to Cloudinary.
   * `resource_type: 'auto'` lets Cloudinary detect images, videos and audio.
   */
  uploadFile(
    file: Express.Multer.File,
    folder = 'cultureplusbenin',
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (error, result) => {
          if (error || !result) {
            return reject(
              new InternalServerErrorException(
                error?.message ?? 'Cloudinary upload failed',
              ),
            );
          }
          resolve(result);
        },
      );
      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  /** Remove an asset from Cloudinary by its public id. */
  async deleteFile(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw' = 'image',
  ): Promise<void> {
    await this.cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  }
}
