import { Test, TestingModule } from '@nestjs/testing';
import { FusionAuthClient } from './fusion-auth.client';

describe('FusionAuthClient', () => {
  let provider: FusionAuthClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FusionAuthClient],
    }).compile();

    provider = module.get<FusionAuthClient>(FusionAuthClient);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
