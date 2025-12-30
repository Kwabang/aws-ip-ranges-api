import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import {
  AWSIpRangesResponse,
  ServiceIpRanges,
  ServicesListResponse,
  RegionsListResponse,
  AllServicesIpRanges,
  IpSearchResult,
  IpSearchMatch,
} from './interfaces/ip-ranges.interface';

@Injectable()
export class IpRangesService implements OnModuleInit {
  private readonly logger = new Logger(IpRangesService.name);
  private readonly AWS_IP_RANGES_URL =
    'https://ip-ranges.amazonaws.com/ip-ranges.json';

  // 캐시된 데이터
  private ipRangesData: AWSIpRangesResponse | null = null;
  private serviceIpRangesMap: Map<string, ServiceIpRanges> = new Map();
  private lastUpdated: Date | null = null;

  constructor(private readonly httpService: HttpService) {}

  /**
   * 앱 시작 시 초기 데이터 로드
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing IP Ranges Service...');
    await this.fetchIpRanges();
  }

  /**
   * 30분마다 AWS IP ranges 데이터 갱신
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron(): Promise<void> {
    this.logger.log('Scheduled fetch: Updating AWS IP ranges...');
    await this.fetchIpRanges();
  }

  /**
   * AWS IP ranges 데이터 fetch 및 처리
   */
  async fetchIpRanges(): Promise<void> {
    try {
      this.logger.log(`Fetching IP ranges from ${this.AWS_IP_RANGES_URL}`);

      const response = await firstValueFrom(
        this.httpService.get<AWSIpRangesResponse>(this.AWS_IP_RANGES_URL),
      );

      this.ipRangesData = response.data;
      this.lastUpdated = new Date();

      // 서비스별로 그룹화
      this.groupByService();

      this.logger.log(
        `Successfully fetched IP ranges. SyncToken: ${this.ipRangesData.syncToken}, ` +
          `Services: ${this.serviceIpRangesMap.size}, ` +
          `IPv4 prefixes: ${this.ipRangesData.prefixes.length}, ` +
          `IPv6 prefixes: ${this.ipRangesData.ipv6_prefixes?.length || 0}`,
      );
    } catch (error) {
      this.logger.error('Failed to fetch AWS IP ranges', error);
    }
  }

  /**
   * 서비스별로 IP ranges 그룹화
   */
  private groupByService(): void {
    if (!this.ipRangesData) return;

    const serviceMap = new Map<
      string,
      { ipv4: Set<string>; ipv6: Set<string> }
    >();

    // IPv4 prefixes 처리
    for (const prefix of this.ipRangesData.prefixes) {
      if (!serviceMap.has(prefix.service)) {
        serviceMap.set(prefix.service, {
          ipv4: new Set(),
          ipv6: new Set(),
        });
      }
      serviceMap.get(prefix.service)!.ipv4.add(prefix.ip_prefix);
    }

    // IPv6 prefixes 처리
    if (this.ipRangesData.ipv6_prefixes) {
      for (const prefix of this.ipRangesData.ipv6_prefixes) {
        if (!serviceMap.has(prefix.service)) {
          serviceMap.set(prefix.service, {
            ipv4: new Set(),
            ipv6: new Set(),
          });
        }
        serviceMap.get(prefix.service)!.ipv6.add(prefix.ipv6_prefix);
      }
    }

    // ServiceIpRanges 형태로 변환
    this.serviceIpRangesMap.clear();
    for (const [service, ranges] of serviceMap) {
      const ipv4Array = Array.from(ranges.ipv4);
      const ipv6Array = Array.from(ranges.ipv6);

      this.serviceIpRangesMap.set(service, {
        service,
        ipv4_prefixes: ipv4Array,
        ipv6_prefixes: ipv6Array,
        count: {
          ipv4: ipv4Array.length,
          ipv6: ipv6Array.length,
        },
      });
    }
  }

  /**
   * 사용 가능한 서비스 목록 조회
   */
  getServices(): ServicesListResponse {
    const services = Array.from(this.serviceIpRangesMap.keys()).sort();

    return {
      services,
      syncToken: this.ipRangesData?.syncToken || '',
      lastUpdated: this.lastUpdated?.toISOString() || '',
    };
  }

  /**
   * 사용 가능한 리전 목록 조회
   */
  getRegions(): RegionsListResponse {
    const regionSet = new Set<string>();

    if (this.ipRangesData) {
      for (const prefix of this.ipRangesData.prefixes) {
        regionSet.add(prefix.region);
      }
      if (this.ipRangesData.ipv6_prefixes) {
        for (const prefix of this.ipRangesData.ipv6_prefixes) {
          regionSet.add(prefix.region);
        }
      }
    }

    return {
      regions: Array.from(regionSet).sort(),
      syncToken: this.ipRangesData?.syncToken || '',
      lastUpdated: this.lastUpdated?.toISOString() || '',
    };
  }

  /**
   * 특정 서비스의 IP ranges 조회 (region 필터 지원)
   */
  getServiceIpRanges(service: string, region?: string): ServiceIpRanges | null {
    // 대소문자 구분 없이 검색
    const upperService = service.toUpperCase();

    // region 필터가 있으면 raw 데이터에서 필터링
    if (region && this.ipRangesData) {
      return this.filterByServiceAndRegion(upperService, region);
    }

    for (const [key, value] of this.serviceIpRangesMap) {
      if (key.toUpperCase() === upperService) {
        return value;
      }
    }

    return null;
  }

  /**
   * 서비스와 region으로 필터링
   */
  private filterByServiceAndRegion(
    service: string,
    region: string,
  ): ServiceIpRanges | null {
    if (!this.ipRangesData) return null;

    const upperRegion = region.toUpperCase();
    const ipv4Prefixes: string[] = [];
    const ipv6Prefixes: string[] = [];

    // IPv4 필터링
    for (const prefix of this.ipRangesData.prefixes) {
      if (
        prefix.service.toUpperCase() === service &&
        prefix.region.toUpperCase() === upperRegion
      ) {
        ipv4Prefixes.push(prefix.ip_prefix);
      }
    }

    // IPv6 필터링
    if (this.ipRangesData.ipv6_prefixes) {
      for (const prefix of this.ipRangesData.ipv6_prefixes) {
        if (
          prefix.service.toUpperCase() === service &&
          prefix.region.toUpperCase() === upperRegion
        ) {
          ipv6Prefixes.push(prefix.ipv6_prefix);
        }
      }
    }

    // 결과가 없으면 null
    if (ipv4Prefixes.length === 0 && ipv6Prefixes.length === 0) {
      return null;
    }

    return {
      service,
      ipv4_prefixes: ipv4Prefixes,
      ipv6_prefixes: ipv6Prefixes,
      count: {
        ipv4: ipv4Prefixes.length,
        ipv6: ipv6Prefixes.length,
      },
    };
  }

  /**
   * 전체 서비스별 IP ranges 조회 (region 필터 지원)
   */
  getAllServiceIpRanges(region?: string): AllServicesIpRanges {
    const services: Record<string, Omit<ServiceIpRanges, 'service'>> = {};

    if (region && this.ipRangesData) {
      // region 필터가 있으면 각 서비스별로 필터링
      for (const serviceName of this.serviceIpRangesMap.keys()) {
        const filtered = this.filterByServiceAndRegion(
          serviceName.toUpperCase(),
          region,
        );
        if (filtered && (filtered.count.ipv4 > 0 || filtered.count.ipv6 > 0)) {
          const { service: _, ...rest } = filtered;
          services[serviceName] = rest;
        }
      }
    } else {
      for (const [serviceName, ranges] of this.serviceIpRangesMap) {
        const { service: _, ...rest } = ranges;
        services[serviceName] = rest;
      }
    }

    return {
      syncToken: this.ipRangesData?.syncToken || '',
      lastUpdated: this.lastUpdated?.toISOString() || '',
      services,
    };
  }

  /**
   * IP 주소로 서비스 및 리전 검색
   */
  searchByIp(ip: string): IpSearchResult {
    const matches: IpSearchMatch[] = [];

    if (!this.ipRangesData) {
      return { ip, found: false, matches };
    }

    const isIPv6 = ip.includes(':');

    if (isIPv6) {
      // IPv6 검색
      if (this.ipRangesData.ipv6_prefixes) {
        for (const prefix of this.ipRangesData.ipv6_prefixes) {
          if (this.isIpv6InCidr(ip, prefix.ipv6_prefix)) {
            matches.push({
              service: prefix.service,
              region: prefix.region,
              prefix: prefix.ipv6_prefix,
              network_border_group: prefix.network_border_group,
            });
          }
        }
      }
    } else {
      // IPv4 검색
      for (const prefix of this.ipRangesData.prefixes) {
        if (this.isIpv4InCidr(ip, prefix.ip_prefix)) {
          matches.push({
            service: prefix.service,
            region: prefix.region,
            prefix: prefix.ip_prefix,
            network_border_group: prefix.network_border_group,
          });
        }
      }
    }

    return {
      ip,
      found: matches.length > 0,
      matches,
    };
  }

  /**
   * IPv4가 CIDR 범위 내에 있는지 확인
   */
  private isIpv4InCidr(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);

    const ipNum = this.ipv4ToNumber(ip);
    const rangeNum = this.ipv4ToNumber(range);

    return (ipNum & mask) === (rangeNum & mask);
  }

  /**
   * IPv4 문자열을 숫자로 변환
   */
  private ipv4ToNumber(ip: string): number {
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }

  /**
   * IPv6가 CIDR 범위 내에 있는지 확인
   */
  private isIpv6InCidr(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split('/');
    const prefixBits = parseInt(bits, 10);

    const ipExpanded = this.expandIpv6(ip);
    const rangeExpanded = this.expandIpv6(range);

    const ipBinary = this.ipv6ToBinary(ipExpanded);
    const rangeBinary = this.ipv6ToBinary(rangeExpanded);

    return ipBinary.substring(0, prefixBits) === rangeBinary.substring(0, prefixBits);
  }

  /**
   * IPv6 주소 확장 (:: 압축 해제)
   */
  private expandIpv6(ip: string): string {
    if (ip.includes('::')) {
      const parts = ip.split('::');
      const left = parts[0] ? parts[0].split(':') : [];
      const right = parts[1] ? parts[1].split(':') : [];
      const missing = 8 - left.length - right.length;
      const middle = Array(missing).fill('0000');
      const all = [...left, ...middle, ...right];
      return all.map((p) => p.padStart(4, '0')).join(':');
    }
    return ip
      .split(':')
      .map((p) => p.padStart(4, '0'))
      .join(':');
  }

  /**
   * IPv6 주소를 이진수 문자열로 변환
   */
  private ipv6ToBinary(ip: string): string {
    return ip
      .split(':')
      .map((hex) => parseInt(hex, 16).toString(2).padStart(16, '0'))
      .join('');
  }

  /**
   * 데이터가 로드되었는지 확인
   */
  isDataLoaded(): boolean {
    return this.ipRangesData !== null;
  }
}
