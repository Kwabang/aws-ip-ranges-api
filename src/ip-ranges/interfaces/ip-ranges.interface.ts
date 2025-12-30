/**
 * AWS IP Ranges JSON 응답 인터페이스
 */

// IPv4 prefix 객체
export interface IPPrefix {
  ip_prefix: string;
  region: string;
  service: string;
  network_border_group: string;
}

// IPv6 prefix 객체
export interface IPv6Prefix {
  ipv6_prefix: string;
  region: string;
  service: string;
  network_border_group: string;
}

// AWS IP ranges 전체 응답 구조
export interface AWSIpRangesResponse {
  syncToken: string;
  createDate: string;
  prefixes: IPPrefix[];
  ipv6_prefixes: IPv6Prefix[];
}

// 서비스별 IP ranges 응답
export interface ServiceIpRanges {
  service: string;
  ipv4_prefixes: string[];
  ipv6_prefixes: string[];
  count: {
    ipv4: number;
    ipv6: number;
  };
}

// 서비스 목록 응답
export interface ServicesListResponse {
  services: string[];
  syncToken: string;
  lastUpdated: string;
}

// 리전 목록 응답
export interface RegionsListResponse {
  regions: string[];
  syncToken: string;
  lastUpdated: string;
}

// 전체 서비스별 IP ranges 응답 (key가 서비스명이므로 내부 service 필드 제외)
export interface AllServicesIpRanges {
  syncToken: string;
  lastUpdated: string;
  services: Record<string, Omit<ServiceIpRanges, 'service'>>;
}
