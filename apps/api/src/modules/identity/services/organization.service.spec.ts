import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrganizationService } from './organization.service';

const mockOrganizationRepository = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

jest.mock('@cc-erp/database', () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => mockOrganizationRepository),
}));

describe('OrganizationService', () => {
  let service: OrganizationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganizationService],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all organizations', async () => {
      mockOrganizationRepository.findAll.mockResolvedValue([{ id: 'org-1' }]);

      const result = await service.findAll();

      expect(result).toEqual([{ id: 'org-1' }]);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when the organization does not exist', async () => {
      mockOrganizationRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('should return the organization when found', async () => {
      mockOrganizationRepository.findById.mockResolvedValue({ id: 'org-1', name: 'Acme Bakery' });

      const result = await service.findOne('org-1');

      expect(result).toEqual({ id: 'org-1', name: 'Acme Bakery' });
    });
  });

  describe('create', () => {
    it('should create the organization via the repository', async () => {
      const dto = { code: 'CC001', name: 'Acme Bakery' };
      mockOrganizationRepository.create.mockResolvedValue({ id: 'org-1', ...dto });

      const result = await service.create(dto as any);

      expect(mockOrganizationRepository.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'org-1', ...dto });
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when the organization does not exist', async () => {
      mockOrganizationRepository.findById.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'X' } as any)).rejects.toThrow(
        NotFoundException
      );
      expect(mockOrganizationRepository.update).not.toHaveBeenCalled();
    });

    it('should update the organization when it exists', async () => {
      mockOrganizationRepository.findById.mockResolvedValue({ id: 'org-1' });
      mockOrganizationRepository.update.mockResolvedValue({ id: 'org-1', name: 'Renamed' });

      const result = await service.update('org-1', { name: 'Renamed' } as any);

      expect(mockOrganizationRepository.update).toHaveBeenCalledWith('org-1', { name: 'Renamed' });
      expect(result).toEqual({ id: 'org-1', name: 'Renamed' });
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when the organization does not exist', async () => {
      mockOrganizationRepository.findById.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
      expect(mockOrganizationRepository.delete).not.toHaveBeenCalled();
    });

    it('should soft-delete the organization when it exists', async () => {
      mockOrganizationRepository.findById.mockResolvedValue({ id: 'org-1' });
      mockOrganizationRepository.delete.mockResolvedValue({ id: 'org-1', isActive: false });

      const result = await service.remove('org-1');

      expect(mockOrganizationRepository.delete).toHaveBeenCalledWith('org-1');
      expect(result).toEqual({ id: 'org-1', isActive: false });
    });
  });
});
