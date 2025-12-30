import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { IpRangesModule } from './aws-ip-ranges/ip-ranges.module';

@Module({
  imports: [ScheduleModule.forRoot(), IpRangesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
