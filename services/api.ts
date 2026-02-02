import { createClient } from '@supabase/supabase-js';
import { PhoneEntry } from '../types';

// *** ตั้งค่า SUPABASE CONFIGURATION ที่นี่ ***
// คุณสามารถหาค่าเหล่านี้ได้จาก Supabase Dashboard -> Project Settings -> API
const SUPABASE_URL = 'https://okeyxsiqxuzimyfwojlu.supabase.co'; // เปลี่ยนเป็น Project URL ของคุณถ้าไม่ตรง
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZXl4c2lxeHV6aW15Zndvamx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDE4OTQsImV4cCI6MjA4NTMxNzg5NH0.NVpRclwEWDkYLo_WwgYSGcTHrIAyh1JCCreIiMT5z6Y'; // *** นำค่า anon public key มาใส่ที่นี่ ***

// กำหนด schema เป็น 'Book-Phone' ตามที่ย้ายตารางไป
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: {
    schema: 'Book-Phone'
  }
});

const TABLE_NAME = 'hospital_phonebook'; // ชื่อตารางที่เราแยกไว้

export const api = {
  // ดึงข้อมูลทั้งหมด
  getPhoneData: async (): Promise<PhoneEntry[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      return data || [];

    } catch (error) {
      console.error('Error fetching data form Supabase:', error);
      return [];
    }
  },

  // เพิ่มข้อมูลทีละรายการ (สำหรับกดปุ่มเพิ่มเอง)
  addPhoneData: async (entry: PhoneEntry) => {
    try {
      // ใช้ .insert สำหรับการเพิ่มข้อมูลใหม่ เพื่อความชัดเจนและถูกต้อง
      // ส่ง entry ทั้งก้อนไปเลย เพื่อให้รวม created_at ด้วย
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert([entry])
        .select();

      if (error) {
        console.error("Supabase Insert Error:", error.message);
        throw error;
      }
      return data;
    } catch (error) {
      console.error('Error adding data:', error);
      throw error;
    }
  },

  // เพิ่มข้อมูลทีละหลายรายการ (สำหรับการ Sync ครั้งแรก - เร็วกว่ามาก)
  bulkUpsertPhoneData: async (entries: PhoneEntry[]) => {
    try {
      // แปลงข้อมูลให้ตรงกับ format ของตาราง
      const formattedEntries = entries.map(({ id, building, department, number }) => ({
        id,
        building,
        department,
        number
      }));

      const { data, error } = await supabase
        .from(TABLE_NAME)
        .upsert(formattedEntries)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error bulk adding data:', error);
      throw error;
    }
  },

  // แก้ไขข้อมูล
  updatePhoneData: async (entry: PhoneEntry) => {
    try {
      const { id, building, department, number } = entry;
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .update({ building, department, number })
        .eq('id', id)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating data:', error);
      throw error;
    }
  },

  // ลบข้อมูล
  deletePhoneData: async (id: string) => {
    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting data:', error);
      throw error;
    }
  }
};