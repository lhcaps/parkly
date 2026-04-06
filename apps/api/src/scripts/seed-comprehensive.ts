/**
 * PARKLY - Comprehensive Seed Script
 * Seeds database with diverse data for:
 * - 5 Parking Sites across Vietnam
 * - Multiple Gates and Lanes per site
 * - Multiple Zone types (VIP, Regular, Motorbike, Reserved)
 * - Multiple Subscriptions (Monthly, VIP)
 * - Multiple Users with different roles
 * - Sample Tariffs and Customers
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Starting comprehensive seed...');
  console.log('========================================');

  // ============================================================
  // PHASE 1: Create Roles
  // ============================================================
  console.log('📋 Creating roles...');
  const roles = await Promise.all([
    prisma.roles.upsert({
      where: { role_code: 'SUPER_ADMIN' },
      update: {},
      create: { role_code: 'SUPER_ADMIN', name: 'Super Administrator' },
    }),
    prisma.roles.upsert({
      where: { role_code: 'SITE_ADMIN' },
      update: {},
      create: { role_code: 'SITE_ADMIN', name: 'Site Administrator' },
    }),
    prisma.roles.upsert({
      where: { role_code: 'MANAGER' },
      update: {},
      create: { role_code: 'MANAGER', name: 'Site Manager' },
    }),
    prisma.roles.upsert({
      where: { role_code: 'CASHIER' },
      update: {},
      create: { role_code: 'CASHIER', name: 'Cashier' },
    }),
    prisma.roles.upsert({
      where: { role_code: 'GUARD' },
      update: {},
      create: { role_code: 'GUARD', name: 'Security Guard' },
    }),
    prisma.roles.upsert({
      where: { role_code: 'OPERATOR' },
      update: {},
      create: { role_code: 'OPERATOR', name: 'Operations Operator' },
    }),
    prisma.roles.upsert({
      where: { role_code: 'VIEWER' },
      update: {},
      create: { role_code: 'VIEWER', name: 'Read-only Viewer' },
    }),
    // Legacy aliases (backward compat with code using ADMIN/OPS/WORKER)
    prisma.roles.upsert({
      where: { role_code: 'ADMIN' },
      update: {},
      create: { role_code: 'ADMIN', name: 'Admin (legacy alias for SUPER_ADMIN)' },
    }),
    prisma.roles.upsert({
      where: { role_code: 'OPS' },
      update: {},
      create: { role_code: 'OPS', name: 'Ops (legacy alias for OPERATOR)' },
    }),
    prisma.roles.upsert({
      where: { role_code: 'WORKER' },
      update: {},
      create: { role_code: 'WORKER', name: 'Worker (legacy alias for OPERATOR)' },
    }),
  ]);
  console.log(`✅ Created ${roles.length} roles`);

  // ============================================================
  // PHASE 2: Create Users
  // ============================================================
  console.log('👤 Creating users...');
  // Scrypt hash of "Admin@123" — matches verifyPassword() in auth-service
  const passwordHash = 'scrypt$IqKE8utO4vMlIyFYmg_DDQ$M0-wGGkDDBHuRbUPqX7Klz-3LNEJwIZBsX6sfZvW123pXj6A4zslCcV6TATNH9wMYgoYjxXyGj6OPe6eHPbtFQ';

  const users = await Promise.all([
    prisma.users.upsert({
      where: { username: 'admin' },
      update: {},
      create: { username: 'admin', password_hash: passwordHash, status: 'ACTIVE' },
    }),
    prisma.users.upsert({
      where: { username: 'manager_hcm' },
      update: {},
      create: { username: 'manager_hcm', password_hash: passwordHash, status: 'ACTIVE' },
    }),
    prisma.users.upsert({
      where: { username: 'manager_dn' },
      update: {},
      create: { username: 'manager_dn', password_hash: passwordHash, status: 'ACTIVE' },
    }),
    prisma.users.upsert({
      where: { username: 'manager_hn' },
      update: {},
      create: { username: 'manager_hn', password_hash: passwordHash, status: 'ACTIVE' },
    }),
    prisma.users.upsert({
      where: { username: 'cashier_hcm_01' },
      update: {},
      create: { username: 'cashier_hcm_01', password_hash: passwordHash, status: 'ACTIVE' },
    }),
    prisma.users.upsert({
      where: { username: 'cashier_hcm_02' },
      update: {},
      create: { username: 'cashier_hcm_02', password_hash: passwordHash, status: 'ACTIVE' },
    }),
    prisma.users.upsert({
      where: { username: 'cashier_dn_01' },
      update: {},
      create: { username: 'cashier_dn_01', password_hash: passwordHash, status: 'ACTIVE' },
    }),
    prisma.users.upsert({
      where: { username: 'guard_hcm_01_1' },
      update: {},
      create: { username: 'guard_hcm_01_1', password_hash: passwordHash, status: 'ACTIVE' },
    }),
    prisma.users.upsert({
      where: { username: 'guard_hcm_01_2' },
      update: {},
      create: { username: 'guard_hcm_01_2', password_hash: passwordHash, status: 'ACTIVE' },
    }),
    prisma.users.upsert({
      where: { username: 'guard_dn_01_1' },
      update: {},
      create: { username: 'guard_dn_01_1', password_hash: passwordHash, status: 'ACTIVE' },
    }),
  ]);
  console.log(`✅ Created ${users.length} users`);

  // Assign roles to users
  const userRoleMap: Record<string, string> = {
    admin: 'SUPER_ADMIN',
    manager_hcm: 'MANAGER',
    manager_dn: 'MANAGER',
    manager_hn: 'MANAGER',
    cashier_hcm_01: 'CASHIER',
    cashier_hcm_02: 'CASHIER',
    cashier_dn_01: 'CASHIER',
    guard_hcm_01_1: 'GUARD',
    guard_hcm_01_2: 'GUARD',
    guard_dn_01_1: 'GUARD',
  };

  const roleMap: Record<string, { role_id: bigint }> = {};
  for (const r of roles) {
    roleMap[r.role_code] = r;
  }

  for (const [username, roleCode] of Object.entries(userRoleMap)) {
    const user = await prisma.users.findUnique({ where: { username } });
    const role = roleMap[roleCode];
    if (user && role) {
      await prisma.user_roles.upsert({
        where: { user_id_role_id: { user_id: user.user_id, role_id: role.role_id } },
        update: {},
        create: { user_id: user.user_id, role_id: role.role_id },
      });
      console.log(`✅ ${username.padEnd(20)} -> ${roleCode}`);
    }
  }

  // ============================================================
  // PHASE 3: Create Parking Sites
  // ============================================================
  console.log('🏢 Creating parking sites...');
  const sites = await Promise.all([
    prisma.parking_sites.upsert({
      where: { site_code: 'PARK_HCM_CENTRAL' },
      update: {},
      create: {
        site_code: 'PARK_HCM_CENTRAL',
        name: 'Parkly TP.HCM - Trung Tâm',
        timezone: 'Asia/Ho_Chi_Minh',
        is_active: true,
      },
    }),
    prisma.parking_sites.upsert({
      where: { site_code: 'PARK_HCM_DISCOVERY' },
      update: {},
      create: {
        site_code: 'PARK_HCM_DISCOVERY',
        name: 'Parkly TP.HCM - Discovery',
        timezone: 'Asia/Ho_Chi_Minh',
        is_active: true,
      },
    }),
    prisma.parking_sites.upsert({
      where: { site_code: 'PARK_DN_CENTRAL' },
      update: {},
      create: {
        site_code: 'PARK_DN_CENTRAL',
        name: 'Parkly Đà Nẵng - Trung Tâm',
        timezone: 'Asia/Ho_Chi_Minh',
        is_active: true,
      },
    }),
    prisma.parking_sites.upsert({
      where: { site_code: 'PARK_HA_CENTRAL' },
      update: {},
      create: {
        site_code: 'PARK_HA_CENTRAL',
        name: 'Parkly Hà Nội - Trung Tâm',
        timezone: 'Asia/Ho_Chi_Minh',
        is_active: true,
      },
    }),
    prisma.parking_sites.upsert({
      where: { site_code: 'PARK_CT_CENTRAL' },
      update: {},
      create: {
        site_code: 'PARK_CT_CENTRAL',
        name: 'Parkly Cần Thơ - Trung Tâm',
        timezone: 'Asia/Ho_Chi_Minh',
        is_active: true,
      },
    }),
  ]);
  console.log(`✅ Created ${sites.length} parking sites`);

  const siteHCM = sites[0];
  const siteHCMD = sites[1];
  const siteDN = sites[2];
  const siteHN = sites[3];
  const siteCT = sites[4];

  // ============================================================
  // PHASE 4: Create Zones
  // ============================================================
  console.log('🗺️ Creating zones...');

  // HCM Central Zones
  const zonesHCM = await Promise.all([
    prisma.zones.upsert({
      where: { site_id_code: { site_id: siteHCM.site_id, code: 'VIP_PLATINUM' } },
      update: {},
      create: { site_id: siteHCM.site_id, code: 'VIP_PLATINUM', name: 'VIP Platinum - Tầng 1', vehicle_type: 'CAR' },
    }),
    prisma.zones.upsert({
      where: { site_id_code: { site_id: siteHCM.site_id, code: 'VIP_GOLD' } },
      update: {},
      create: { site_id: siteHCM.site_id, code: 'VIP_GOLD', name: 'VIP Gold - Tầng 2', vehicle_type: 'CAR' },
    }),
    prisma.zones.upsert({
      where: { site_id_code: { site_id: siteHCM.site_id, code: 'REGULAR_FLOOR1' } },
      update: {},
      create: { site_id: siteHCM.site_id, code: 'REGULAR_FLOOR1', name: 'Khu Thường - Tầng 1', vehicle_type: 'CAR' },
    }),
    prisma.zones.upsert({
      where: { site_id_code: { site_id: siteHCM.site_id, code: 'REGULAR_FLOOR2' } },
      update: {},
      create: { site_id: siteHCM.site_id, code: 'REGULAR_FLOOR2', name: 'Khu Thường - Tầng 2', vehicle_type: 'CAR' },
    }),
    prisma.zones.upsert({
      where: { site_id_code: { site_id: siteHCM.site_id, code: 'MOTORBIKE_A' } },
      update: {},
      create: { site_id: siteHCM.site_id, code: 'MOTORBIKE_A', name: 'Khu Xe Máy A', vehicle_type: 'MOTORBIKE' },
    }),
    prisma.zones.upsert({
      where: { site_id_code: { site_id: siteHCM.site_id, code: 'MOTORBIKE_B' } },
      update: {},
      create: { site_id: siteHCM.site_id, code: 'MOTORBIKE_B', name: 'Khu Xe Máy B', vehicle_type: 'MOTORBIKE' },
    }),
  ]);

  // HCM Discovery Zones
  const zonesHCMD = await Promise.all([
    prisma.zones.upsert({
      where: { site_id_code: { site_id: siteHCMD.site_id, code: 'VIP_PREMIUM' } },
      update: {},
      create: { site_id: siteHCMD.site_id, code: 'VIP_PREMIUM', name: 'VIP Premium', vehicle_type: 'CAR' },
    }),
    prisma.zones.upsert({
      where: { site_id_code: { site_id: siteHCMD.site_id, code: 'REGULAR_A' } },
      update: {},
      create: { site_id: siteHCMD.site_id, code: 'REGULAR_A', name: 'Khu A - Thường', vehicle_type: 'CAR' },
    }),
    prisma.zones.upsert({
      where: { site_id_code: { site_id: siteHCMD.site_id, code: 'MOTORBIKE' } },
      update: {},
      create: { site_id: siteHCMD.site_id, code: 'MOTORBIKE', name: 'Khu Xe Máy', vehicle_type: 'MOTORBIKE' },
    }),
  ]);

  // DN Central Zones
  const zonesDN = await Promise.all([
    prisma.zones.upsert({
      where: { site_id_code: { site_id: siteDN.site_id, code: 'VIP_GOLD' } },
      update: {},
      create: { site_id: siteDN.site_id, code: 'VIP_GOLD', name: 'VIP Gold', vehicle_type: 'CAR' },
    }),
    prisma.zones.upsert({
      where: { site_id_code: { site_id: siteDN.site_id, code: 'REGULAR_FLOOR1' } },
      update: {},
      create: { site_id: siteDN.site_id, code: 'REGULAR_FLOOR1', name: 'Khu Thường - Tầng 1', vehicle_type: 'CAR' },
    }),
    prisma.zones.upsert({
      where: { site_id_code: { site_id: siteDN.site_id, code: 'MOTORBIKE' } },
      update: {},
      create: { site_id: siteDN.site_id, code: 'MOTORBIKE', name: 'Khu Xe Máy', vehicle_type: 'MOTORBIKE' },
    }),
  ]);

  console.log(`✅ Created zones: ${zonesHCM.length} (HCM), ${zonesHCMD.length} (HCMD), ${zonesDN.length} (DN)`);

  // ============================================================
  // PHASE 5: Create Gate Devices
  // ============================================================
  console.log('🚪 Creating gate devices...');

  // HCM Central Devices
  const devicesHCM = await Promise.all([
    // Gate 1 devices
    prisma.gate_devices.upsert({
      where: { site_id_device_code: { site_id: siteHCM.site_id, device_code: 'G1_ENTRY_CAM' } },
      update: {},
      create: { site_id: siteHCM.site_id, device_code: 'G1_ENTRY_CAM', device_type: 'CAMERA_ALPR', direction: 'ENTRY', location_hint: 'Gate 1 - Lối Vào Chính - Camera' },
    }),
    prisma.gate_devices.upsert({
      where: { site_id_device_code: { site_id: siteHCM.site_id, device_code: 'G1_ENTRY_RFID' } },
      update: {},
      create: { site_id: siteHCM.site_id, device_code: 'G1_ENTRY_RFID', device_type: 'RFID_READER', direction: 'ENTRY', location_hint: 'Gate 1 - Lối Vào Chính - RFID' },
    }),
    prisma.gate_devices.upsert({
      where: { site_id_device_code: { site_id: siteHCM.site_id, device_code: 'G1_ENTRY_BAR' } },
      update: {},
      create: { site_id: siteHCM.site_id, device_code: 'G1_ENTRY_BAR', device_type: 'BARRIER', direction: 'ENTRY', location_hint: 'Gate 1 - Lối Vào Chính - Barrier' },
    }),
    prisma.gate_devices.upsert({
      where: { site_id_device_code: { site_id: siteHCM.site_id, device_code: 'G1_EXIT_CAM' } },
      update: {},
      create: { site_id: siteHCM.site_id, device_code: 'G1_EXIT_CAM', device_type: 'CAMERA_ALPR', direction: 'EXIT', location_hint: 'Gate 1 - Lối Ra Chính - Camera' },
    }),
    prisma.gate_devices.upsert({
      where: { site_id_device_code: { site_id: siteHCM.site_id, device_code: 'G1_EXIT_RFID' } },
      update: {},
      create: { site_id: siteHCM.site_id, device_code: 'G1_EXIT_RFID', device_type: 'RFID_READER', direction: 'EXIT', location_hint: 'Gate 1 - Lối Ra Chính - RFID' },
    }),
    prisma.gate_devices.upsert({
      where: { site_id_device_code: { site_id: siteHCM.site_id, device_code: 'G1_EXIT_BAR' } },
      update: {},
      create: { site_id: siteHCM.site_id, device_code: 'G1_EXIT_BAR', device_type: 'BARRIER', direction: 'EXIT', location_hint: 'Gate 1 - Lối Ra Chính - Barrier' },
    }),
    // Gate 2 devices (VIP Express)
    prisma.gate_devices.upsert({
      where: { site_id_device_code: { site_id: siteHCM.site_id, device_code: 'G2_ENTRY_CAM' } },
      update: {},
      create: { site_id: siteHCM.site_id, device_code: 'G2_ENTRY_CAM', device_type: 'CAMERA_ALPR', direction: 'ENTRY', location_hint: 'Gate 2 - VIP Express - Camera' },
    }),
    prisma.gate_devices.upsert({
      where: { site_id_device_code: { site_id: siteHCM.site_id, device_code: 'G2_ENTRY_RFID' } },
      update: {},
      create: { site_id: siteHCM.site_id, device_code: 'G2_ENTRY_RFID', device_type: 'RFID_READER', direction: 'ENTRY', location_hint: 'Gate 2 - VIP Express - RFID' },
    }),
    prisma.gate_devices.upsert({
      where: { site_id_device_code: { site_id: siteHCM.site_id, device_code: 'G2_ENTRY_BAR' } },
      update: {},
      create: { site_id: siteHCM.site_id, device_code: 'G2_ENTRY_BAR', device_type: 'BARRIER', direction: 'ENTRY', location_hint: 'Gate 2 - VIP Express - Barrier' },
    }),
    prisma.gate_devices.upsert({
      where: { site_id_device_code: { site_id: siteHCM.site_id, device_code: 'G2_EXIT_CAM' } },
      update: {},
      create: { site_id: siteHCM.site_id, device_code: 'G2_EXIT_CAM', device_type: 'CAMERA_ALPR', direction: 'EXIT', location_hint: 'Gate 2 - VIP Express - Camera' },
    }),
    prisma.gate_devices.upsert({
      where: { site_id_device_code: { site_id: siteHCM.site_id, device_code: 'G2_EXIT_RFID' } },
      update: {},
      create: { site_id: siteHCM.site_id, device_code: 'G2_EXIT_RFID', device_type: 'RFID_READER', direction: 'EXIT', location_hint: 'Gate 2 - VIP Express - RFID' },
    }),
    prisma.gate_devices.upsert({
      where: { site_id_device_code: { site_id: siteHCM.site_id, device_code: 'G2_EXIT_BAR' } },
      update: {},
      create: { site_id: siteHCM.site_id, device_code: 'G2_EXIT_BAR', device_type: 'BARRIER', direction: 'EXIT', location_hint: 'Gate 2 - VIP Express - Barrier' },
    }),
  ]);
  console.log(`✅ Created ${devicesHCM.length} devices for HCM Central`);

  // ============================================================
  // PHASE 6: Create Gate Lanes
  // ============================================================
  console.log('🛤️ Creating gate lanes...');

  const g1EntryRFID = devicesHCM.find(d => d.device_code === 'G1_ENTRY_RFID')!;
  const g1ExitRFID = devicesHCM.find(d => d.device_code === 'G1_EXIT_RFID')!;
  const g2EntryRFID = devicesHCM.find(d => d.device_code === 'G2_ENTRY_RFID')!;
  const g2ExitRFID = devicesHCM.find(d => d.device_code === 'G2_EXIT_RFID')!;

  const lanes = await Promise.all([
    prisma.gate_lanes.upsert({
      where: { site_id_lane_code: { site_id: siteHCM.site_id, lane_code: 'G1_ENTRY' } },
      update: {},
      create: { site_id: siteHCM.site_id, gate_code: 'G1', lane_code: 'G1_ENTRY', name: 'Gate 1 - Lối Vào', direction: 'ENTRY', status: 'ACTIVE', sort_order: 10, primary_device_id: g1EntryRFID.device_id },
    }),
    prisma.gate_lanes.upsert({
      where: { site_id_lane_code: { site_id: siteHCM.site_id, lane_code: 'G1_EXIT' } },
      update: {},
      create: { site_id: siteHCM.site_id, gate_code: 'G1', lane_code: 'G1_EXIT', name: 'Gate 1 - Lối Ra', direction: 'EXIT', status: 'ACTIVE', sort_order: 11, primary_device_id: g1ExitRFID.device_id },
    }),
    prisma.gate_lanes.upsert({
      where: { site_id_lane_code: { site_id: siteHCM.site_id, lane_code: 'G2_ENTRY' } },
      update: {},
      create: { site_id: siteHCM.site_id, gate_code: 'G2', lane_code: 'G2_ENTRY', name: 'Gate 2 - VIP Express Vào', direction: 'ENTRY', status: 'ACTIVE', sort_order: 20, primary_device_id: g2EntryRFID.device_id },
    }),
    prisma.gate_lanes.upsert({
      where: { site_id_lane_code: { site_id: siteHCM.site_id, lane_code: 'G2_EXIT' } },
      update: {},
      create: { site_id: siteHCM.site_id, gate_code: 'G2', lane_code: 'G2_EXIT', name: 'Gate 2 - VIP Express Ra', direction: 'EXIT', status: 'ACTIVE', sort_order: 21, primary_device_id: g2ExitRFID.device_id },
    }),
  ]);
  console.log(`✅ Created ${lanes.length} gate lanes`);

  // ============================================================
  // PHASE 7: Create Tariffs
  // ============================================================
  console.log('💰 Creating tariffs...');

  const tariffs = await Promise.all([
    prisma.tariffs.create({
      data: {
        site_id: siteHCM.site_id,
        name: 'Giá Giờ - Ô Tô Thường',
        applies_to: 'TICKET',
        vehicle_type: 'CAR',
        is_active: true,
        valid_from: new Date(),
      },
    }),
    prisma.tariffs.create({
      data: {
        site_id: siteHCM.site_id,
        name: 'Giá Giờ - Xe Máy',
        applies_to: 'TICKET',
        vehicle_type: 'MOTORBIKE',
        is_active: true,
        valid_from: new Date(),
      },
    }),
    prisma.tariffs.create({
      data: {
        site_id: siteHCM.site_id,
        name: 'Gói VIP Platinum - Ô Tô',
        applies_to: 'SUBSCRIPTION',
        vehicle_type: 'CAR',
        is_active: true,
        valid_from: new Date(),
      },
    }),
  ]);
  console.log(`✅ Created ${tariffs.length} tariffs`);

  // Create tariff rules
  await Promise.all([
    prisma.tariff_rules.create({
      data: { tariff_id: tariffs[0].tariff_id, rule_type: 'FREE_MINUTES', param_json: { minutes: 15 }, priority: 10 },
    }),
    prisma.tariff_rules.create({
      data: { tariff_id: tariffs[0].tariff_id, rule_type: 'HOURLY', param_json: { rate: 35000, unit: 'hour', max_daily: 350000 }, priority: 20 },
    }),
    prisma.tariff_rules.create({
      data: { tariff_id: tariffs[1].tariff_id, rule_type: 'FREE_MINUTES', param_json: { minutes: 15 }, priority: 10 },
    }),
    prisma.tariff_rules.create({
      data: { tariff_id: tariffs[1].tariff_id, rule_type: 'HOURLY', param_json: { rate: 10000, unit: 'hour', max_daily: 80000 }, priority: 20 },
    }),
    prisma.tariff_rules.create({
      data: { tariff_id: tariffs[2].tariff_id, rule_type: 'DAILY_CAP', param_json: { flat_rate: 500000, billing: 'monthly' }, priority: 10 },
    }),
  ]);
  console.log('✅ Created tariff rules');

  // ============================================================
  // PHASE 8: Create Customers
  // ============================================================
  console.log('👥 Creating customers...');

  const customers = await Promise.all([
    prisma.customers.create({ data: { full_name: 'Nguyễn Văn A - VIP Platinum', phone: '0900100001', email: 'vip.platinum.01@parkly.local', status: 'ACTIVE' } }),
    prisma.customers.create({ data: { full_name: 'Trần Thị B - VIP Platinum', phone: '0900100002', email: 'vip.platinum.02@parkly.local', status: 'ACTIVE' } }),
    prisma.customers.create({ data: { full_name: 'Vũ Thị F - VIP Gold', phone: '0900200001', email: 'vip.gold.01@parkly.local', status: 'ACTIVE' } }),
    prisma.customers.create({ data: { full_name: 'Đỗ Thị K - Monthly', phone: '0900300001', email: 'monthly.01@parkly.local', status: 'ACTIVE' } }),
    prisma.customers.create({ data: { full_name: 'Ngô Văn L - Monthly', phone: '0900300002', email: 'monthly.02@parkly.local', status: 'ACTIVE' } }),
  ]);
  console.log(`✅ Created ${customers.length} customers`);

  // ============================================================
  // PHASE 9: Create Vehicles
  // ============================================================
  console.log('🚗 Creating vehicles...');

  const vehicles = await Promise.all([
    prisma.vehicles.create({ data: { license_plate: '51A-11111', vehicle_type: 'CAR', owner_customer_id: customers[0].customer_id } }),
    prisma.vehicles.create({ data: { license_plate: '51A-22222', vehicle_type: 'CAR', owner_customer_id: customers[0].customer_id } }),
    prisma.vehicles.create({ data: { license_plate: '51B-11111', vehicle_type: 'CAR', owner_customer_id: customers[1].customer_id } }),
    prisma.vehicles.create({ data: { license_plate: '51D-11111', vehicle_type: 'CAR', owner_customer_id: customers[2].customer_id } }),
    prisma.vehicles.create({ data: { license_plate: '51G-11111', vehicle_type: 'CAR', owner_customer_id: customers[3].customer_id } }),
    prisma.vehicles.create({ data: { license_plate: '51H-11111', vehicle_type: 'CAR', owner_customer_id: customers[4].customer_id } }),
    prisma.vehicles.create({ data: { license_plate: '51M1-1111', vehicle_type: 'MOTORBIKE', owner_customer_id: customers[0].customer_id } }),
  ]);
  console.log(`✅ Created ${vehicles.length} vehicles`);

  // ============================================================
  // PHASE 10: Create Subscriptions
  // ============================================================
  console.log('📋 Creating subscriptions...');

  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneYearLater = new Date(now.getTime() + 335 * 24 * 60 * 60 * 1000);
  const oneMonthLater = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000);

  const subscriptions = await Promise.all([
    prisma.subscriptions.create({
      data: {
        site_id: siteHCM.site_id,
        customer_id: customers[0].customer_id,
        plan_type: 'VIP',
        start_date: oneMonthAgo,
        end_date: oneYearLater,
        status: 'ACTIVE',
      },
    }),
    prisma.subscriptions.create({
      data: {
        site_id: siteHCM.site_id,
        customer_id: customers[1].customer_id,
        plan_type: 'VIP',
        start_date: oneMonthAgo,
        end_date: oneYearLater,
        status: 'ACTIVE',
      },
    }),
    prisma.subscriptions.create({
      data: {
        site_id: siteHCM.site_id,
        customer_id: customers[2].customer_id,
        plan_type: 'VIP',
        start_date: oneMonthAgo,
        end_date: oneYearLater,
        status: 'ACTIVE',
      },
    }),
    prisma.subscriptions.create({
      data: {
        site_id: siteHCM.site_id,
        customer_id: customers[3].customer_id,
        plan_type: 'MONTHLY',
        start_date: oneMonthAgo,
        end_date: oneMonthLater,
        status: 'ACTIVE',
      },
    }),
  ]);
  console.log(`✅ Created ${subscriptions.length} subscriptions`);

  // ============================================================
  // PHASE 11: Create Credentials (RFID Cards)
  // ============================================================
  console.log('🔐 Creating credentials...');

  const credentials = await Promise.all([
    prisma.credentials.create({ data: { site_id: siteHCM.site_id, subscription_id: subscriptions[0].subscription_id, rfid_uid: 'PLAT-HCM-0001', status: 'ACTIVE' } }),
    prisma.credentials.create({ data: { site_id: siteHCM.site_id, subscription_id: subscriptions[0].subscription_id, rfid_uid: 'PLAT-HCM-0002', status: 'ACTIVE' } }),
    prisma.credentials.create({ data: { site_id: siteHCM.site_id, subscription_id: subscriptions[1].subscription_id, rfid_uid: 'PLAT-HCM-0003', status: 'ACTIVE' } }),
    prisma.credentials.create({ data: { site_id: siteHCM.site_id, subscription_id: subscriptions[2].subscription_id, rfid_uid: 'GOLD-HCM-0001', status: 'ACTIVE' } }),
  ]);
  console.log(`✅ Created ${credentials.length} credentials`);

  // ============================================================
  // PHASE 12: Create Subscription Vehicles
  // ============================================================
  console.log('🔗 Creating subscription vehicle links...');

  await Promise.all([
    prisma.subscription_vehicles.create({
      data: {
        subscription_id: subscriptions[0].subscription_id,
        site_id: siteHCM.site_id,
        vehicle_id: vehicles[0].vehicle_id,
        plate_compact: '51A11111',
        status: 'ACTIVE',
        is_primary: true,
        valid_from: oneMonthAgo,
        valid_to: oneYearLater,
      },
    }),
    prisma.subscription_vehicles.create({
      data: {
        subscription_id: subscriptions[0].subscription_id,
        site_id: siteHCM.site_id,
        vehicle_id: vehicles[1].vehicle_id,
        plate_compact: '51A22222',
        status: 'ACTIVE',
        is_primary: false,
        valid_from: oneMonthAgo,
        valid_to: oneYearLater,
      },
    }),
    prisma.subscription_vehicles.create({
      data: {
        subscription_id: subscriptions[2].subscription_id,
        site_id: siteHCM.site_id,
        vehicle_id: vehicles[3].vehicle_id,
        plate_compact: '51D11111',
        status: 'ACTIVE',
        is_primary: true,
        valid_from: oneMonthAgo,
        valid_to: oneYearLater,
      },
    }),
  ]);
  console.log('✅ Created subscription vehicle links');

  // ============================================================
  // PHASE 13: Create Sample Tickets
  // ============================================================
  console.log('🎫 Creating sample tickets...');

  const today = new Date();
  const entryTime1 = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0);
  const entryTime2 = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 30, 0);

  const tickets = await Promise.all([
    prisma.tickets.create({
      data: {
        site_id: siteHCM.site_id,
        ticket_code: 'DEMO-T-00000001',
        vehicle_id: vehicles[4].vehicle_id,
        entry_time: entryTime1,
        status: 'OPEN',
      },
    }),
    prisma.tickets.create({
      data: {
        site_id: siteHCM.site_id,
        ticket_code: 'DEMO-T-00000002',
        vehicle_id: vehicles[5].vehicle_id,
        entry_time: entryTime2,
        status: 'OPEN',
      },
    }),
  ]);
  console.log(`✅ Created ${tickets.length} sample tickets`);

  // ============================================================
  // PHASE 14: Create Device Heartbeats
  // ============================================================
  console.log('💓 Creating device heartbeats...');

  await Promise.all(
    devicesHCM.map(device =>
      prisma.device_heartbeats.create({
        data: {
          site_id: siteHCM.site_id,
          device_id: device.device_id,
          status: 'ONLINE',
          reported_at: new Date(),
          latency_ms: Math.floor(Math.random() * 50) + 10,
          firmware_version: 'FW-2.1.0',
          ip_address: '192.168.1.10',
        },
      })
    )
  );
  console.log('✅ Created device heartbeats');

  // ============================================================
  // Summary
  // ============================================================
  console.log('========================================');
  console.log('🎉 Comprehensive seed completed!');
  console.log('');
  console.log('📊 Summary:');
  console.log(`   - Sites: ${sites.length}`);
  console.log(`   - Zones: ${zonesHCM.length + zonesHCMD.length + zonesDN.length}`);
  console.log(`   - Gate Devices: ${devicesHCM.length}`);
  console.log(`   - Gate Lanes: ${lanes.length}`);
  console.log(`   - Tariffs: ${tariffs.length}`);
  console.log(`   - Customers: ${customers.length}`);
  console.log(`   - Vehicles: ${vehicles.length}`);
  console.log(`   - Subscriptions: ${subscriptions.length}`);
  console.log(`   - Credentials: ${credentials.length}`);
  console.log(`   - Tickets: ${tickets.length}`);
  console.log('');
  console.log('🔑 Default login credentials:');
  console.log('   - Username: admin');
  console.log('   - Password: Admin@123');
  console.log('');
  console.log('📝 Note: Run the SQL seed file for additional sample data.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
