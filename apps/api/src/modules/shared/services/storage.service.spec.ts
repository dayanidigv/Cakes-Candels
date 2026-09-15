import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StorageService],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // KNOWN STUB: this is a mock S3-shaped uploader — it never touches a real object store, it just
  // fabricates a key/url pair. This test documents the current stub shape, not a real integration.
  describe('uploadFile (KNOWN STUB)', () => {
    it('should return a mock url/key pair derived from the filename', async () => {
      const file = { originalname: 'cake photo.png', buffer: Buffer.from('data'), mimetype: 'image/png' };

      const result = await service.uploadFile(file);

      expect(result.key).toMatch(/^\d+-cake_photo\.png$/);
      expect(result.url).toBe(`https://s3.amazonaws.com/cakes-candles-erp-mock-bucket/${result.key}`);
    });

    it('should replace whitespace in the original filename with underscores', async () => {
      const file = { originalname: 'my   file name.jpg', buffer: Buffer.from(''), mimetype: 'image/jpeg' };

      const result = await service.uploadFile(file);

      expect(result.key).not.toMatch(/\s/);
      expect(result.key).toContain('my_file_name.jpg');
    });
  });
});
