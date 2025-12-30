import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IpRangesController } from './ip-ranges.controller';
import { IpRangesService } from './ip-ranges.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // 30초 타임아웃
      maxRedirects: 5,
    }),
  ],
  controllers: [IpRangesController],
  providers: [IpRangesService],
  exports: [IpRangesService],
})
export class IpRangesModule {}
