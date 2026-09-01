jest.mock('../api', () => ({
  api: { get: jest.fn(), post: jest.fn() },
  saveActiveFarmId: jest.fn().mockResolvedValue(undefined),
  getActiveFarmId: jest.fn(),
  clearActiveFarmId: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../auth.service', () => ({
  updateTokens: jest.fn().mockResolvedValue(undefined),
}));

import { getMyFarms, switchFarmRequest } from '../farm.service';
import { api, saveActiveFarmId } from '../api';
import { updateTokens } from '../auth.service';

describe('farm.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMyFarms', () => {
    it('returns the farms list from GET /v1/me/farms', async () => {
      const farms = [{ farmId: 'farm-1', farmName: 'Fazenda A', role: 'MANAGER', status: 'ACTIVE' }];
      (api.get as jest.Mock).mockResolvedValue({ data: farms });

      const result = await getMyFarms();

      expect(api.get).toHaveBeenCalledWith('/v1/me/farms');
      expect(result).toEqual(farms);
    });
  });

  describe('switchFarmRequest', () => {
    it('posts the chosen farm and rotates the token pair returned by the API', async () => {
      (api.post as jest.Mock).mockResolvedValue({
        data: {
          accessToken: 'new-token',
          refreshToken: 'new-refresh',
          farmId: 'farm-2',
          role: 'MANAGER',
          farmStatus: 'ACTIVE',
        },
      });

      await switchFarmRequest('farm-2');

      expect(api.post).toHaveBeenCalledWith('/v1/auth/switch-farm', { farmId: 'farm-2' });
      expect(updateTokens).toHaveBeenCalledWith('new-token', 'new-refresh');
    });

    it('persists the switched farm as the active farm in SecureStore', async () => {
      (api.post as jest.Mock).mockResolvedValue({
        data: { accessToken: 'new-token', farmId: 'farm-2', role: 'MANAGER', farmStatus: 'ACTIVE' },
      });

      await switchFarmRequest('farm-2');

      expect(saveActiveFarmId).toHaveBeenCalledWith('farm-2');
    });
  });
});
