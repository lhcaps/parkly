import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from "../lib/prisma";
import { logGateEvent } from '../services/event.service';
import { resolveDemoGateIds } from './_resolve-ids';

/**
 * Demo xử lý sự kiện cổng (Gate Events) với cơ chế Idempotency.
 * * Logic: Nếu gửi trùng idempotencyKey, hệ thống sẽ trả về ID cũ thay vì tạo mới.
 */

async function main() {
  // 0) Resolve IDs từ code (tránh hard-code numeric IDs)
  const { siteCode, deviceCode, siteId, deviceId } = await resolveDemoGateIds();
  console.log(
    `Using Site ID: ${siteId} (site_code=${siteCode}), Device ID: ${deviceId} (device_code=${deviceCode})`
  );

  const eventTime = new Date();
  
  // Khởi tạo idempotencyKey ổn định dựa trên logic: SITE|DEVICE|DIRECTION|TIME|UID 
  const idempotencyKey = `SITE${siteId}|DEV${deviceId}|ENTRY|${eventTime.toISOString()}|RFID:TEST_001`;

  console.log('--- Đang gửi Event lần 1 ---');
  const res1 = await logGateEvent({
    siteId,
    deviceId,
    direction: 'ENTRY',
    eventTime,
    idempotencyKey,
    rfidUid: 'TEST_001',
    licensePlateRaw: '51A-999.99',
    imageUrl: 'https://example.com/snapshots/entry_001.jpg',
    rawPayload: {
      ocr_confidence: 0.92,
      device_metadata: { firmware: '1.0.0', temp: '36C' },
    },
  });

  console.log('--- Đang gửi Event lần 2 (Retry cùng Key/Time) ---');
  // Hệ thống sẽ trả về event_id hiện có thay vì tạo row mới trong MySQL 
  const res2 = await logGateEvent({
    siteId,
    deviceId,
    direction: 'ENTRY',
    eventTime,
    idempotencyKey,
    rfidUid: 'TEST_001',
    licensePlateRaw: '51A-999.99',
    imageUrl: 'https://example.com/snapshots/entry_001.jpg',
    rawPayload: { retry: true },
  });

  console.log('Kết quả lần 1:', res1);
  console.log('Kết quả lần 2 (Idempotency Hit):', res2);
  
  if (res1.eventId === res2.eventId) {
    console.log('✅ Thành công: Idempotency hoạt động đúng (Cùng một Event ID).');
  } else {
    console.log('❌ Thất bại: Event ID không khớp. Kiểm tra lại trigger/service.');
  }
}

main()
  .catch((e) => {
    console.error('Error running test-gate-event:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });