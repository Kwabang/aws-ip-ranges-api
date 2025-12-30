import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { IpRangesService } from './ip-ranges.service';
import type {
  ServiceIpRanges,
  ServicesListResponse,
  RegionsListResponse,
  AllServicesIpRanges,
} from './interfaces/ip-ranges.interface';

@Controller('ip-ranges')
export class IpRangesController {
  constructor(private readonly ipRangesService: IpRangesService) {}

  /**
   * 사용 가능한 서비스 목록 조회
   * GET /ip-ranges/services
   */
  @Get('services')
  getServices(): ServicesListResponse {
    this.ensureDataLoaded();
    return this.ipRangesService.getServices();
  }

  /**
   * 사용 가능한 리전 목록 조회
   * GET /ip-ranges/regions
   */
  @Get('regions')
  getRegions(): RegionsListResponse {
    this.ensureDataLoaded();
    return this.ipRangesService.getRegions();
  }

  /**
   * 전체 서비스별 IP ranges 조회
   * GET /ip-ranges?region=ap-northeast-2
   */
  @Get()
  getAllIpRanges(@Query('region') region?: string): AllServicesIpRanges {
    this.ensureDataLoaded();
    return this.ipRangesService.getAllServiceIpRanges(region);
  }

  /**
   * 특정 서비스의 IP ranges 조회
   * GET /ip-ranges/:service?region=ap-northeast-2
   */
  @Get(':service')
  getServiceIpRanges(
    @Param('service') service: string,
    @Query('region') region?: string,
  ): ServiceIpRanges {
    this.ensureDataLoaded();

    const result = this.ipRangesService.getServiceIpRanges(service, region);

    if (!result) {
      const regionMsg = region ? ` in region '${region}'` : '';
      throw new NotFoundException(
        `Service '${service}'${regionMsg} not found. Use GET /ip-ranges/services to see available services.`,
      );
    }

    return result;
  }

  /**
   * 데이터 로드 여부 확인
   */
  private ensureDataLoaded(): void {
    if (!this.ipRangesService.isDataLoaded()) {
      throw new ServiceUnavailableException(
        'IP ranges data is not yet loaded. Please try again later.',
      );
    }
  }
}
