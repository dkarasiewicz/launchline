import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { EventBusService } from '@launchline/core-common';
import { ConfigService } from '@nestjs/config';

describe('AuthService', () => {
  let service: AuthService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: 'DB_CONNECTION',
          useValue: {
            select: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockResolvedValue([
              {
                hashedPassword: 'hashedPassword',
                userId: 'userId',
              },
            ]),
          },
        },
        {
          provide: EventBusService,
          useValue: {
            publish: jest.fn(),
            validateMessageString: jest.fn(),
          },
        },
        {
          provide: 'TWILIO_CLIENT',
          useValue: {
            verify: {
              services: jest.fn().mockReturnThis(),
              verifications: {
                create: jest.fn(),
              },
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('configValue'),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeTruthy();
  });
});
