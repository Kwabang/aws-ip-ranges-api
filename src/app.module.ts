import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { IpRangesModule } from './ip-ranges/ip-ranges.module';

@Module({
  imports: [ScheduleModule.forRoot(), IpRangesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
