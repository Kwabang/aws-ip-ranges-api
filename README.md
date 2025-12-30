# AWS IP Ranges API

AWS에서 제공하는 IP ranges를 30분마다 가져와 서비스별로 그룹화하여 조회할 수 있는 NestJS API입니다.

## 설치

```bash
npm install
```

## 실행

```bash
# 개발 모드 (watch)
npm run start:dev

# 프로덕션
npm run build
npm run start:prod
```

## API 엔드포인트

### 서비스 목록 조회
```bash
GET /ip-ranges/services
```

**응답:**
```json
{
  "services": ["AMAZON", "CLOUDFRONT", "EC2", "S3", ...],
  "syncToken": "1766626705",
  "lastUpdated": "2025-12-30T10:22:32.506Z"
}
```

### 리전 목록 조회
```bash
GET /ip-ranges/regions
```

**응답:**
```json
{
  "regions": ["GLOBAL", "af-south-1", "ap-east-1", ...],
  "syncToken": "1766626705",
  "lastUpdated": "2025-12-30T10:22:32.506Z"
}
```

### 특정 서비스 IP ranges 조회
```bash
GET /ip-ranges/:service
GET /ip-ranges/:service?region=ap-northeast-2
```

**예시:** `GET /ip-ranges/EC2?region=ap-northeast-2`
```json
{
  "service": "EC2",
  "ipv4_prefixes": ["3.5.140.0/22", ...],
  "ipv6_prefixes": ["2600:9000:5206::/48", ...],
  "count": { "ipv4": 42, "ipv6": 43 }
}
```

### 전체 서비스별 IP ranges 조회
```bash
GET /ip-ranges
GET /ip-ranges?region=us-east-1
```

## 데이터 소스

- [AWS IP Ranges](https://ip-ranges.amazonaws.com/ip-ranges.json)
