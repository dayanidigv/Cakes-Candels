import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  async uploadFile(file: { originalname: string; buffer: Buffer; mimetype: string }): Promise<{ url: string; key: string }> {
    this.logger.log(`[StorageService Stub] Mock upload file: ${file.originalname} (${file.mimetype})`);
    const fileKey = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    const url = `https://s3.amazonaws.com/cakes-candles-erp-mock-bucket/${fileKey}`;
    return {
      url,
      key: fileKey
    };
  }
}
