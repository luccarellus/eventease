import { Global, Module } from '@nestjs/common';
import { NevaProService } from './nevapro.service';

@Global()
@Module({
  providers: [NevaProService],
  exports: [NevaProService],
})
export class NevaProModule {}
