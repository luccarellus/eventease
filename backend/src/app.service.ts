import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getApiInfo() {
    return {
      name: 'EventEase API',
      version: '1.0.0',
      status: 'operational',
    };
  }
}
