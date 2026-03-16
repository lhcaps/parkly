// src/types/event.ts
export interface DeviceEventMongo {
  mysql_event_id: string; // ID để nối sang MySQL
  raw_payload: {
    image_url: string;
    ocr_confidence: number;
    bounding_box: { x: number; y: number; w: number; h: number };
    device_metadata: {
      firmware: string;
      temp: string;
      [key: string]: any; // Cho phép thêm các trường linh hoạt khác
    };
  };
  created_at: Date;
}