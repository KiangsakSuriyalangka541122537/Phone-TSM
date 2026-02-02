import React, { useState, useEffect, useMemo } from 'react';
import { Phone, Search, History, Plus, Edit2, Trash2, MapPin, Building2, PhoneCall, ChevronDown, X, AlertTriangle, Loader2, RefreshCw, CloudUpload, CheckCircle2, Download, Github } from 'lucide-react';
import { PhoneEntry, SearchHistoryItem } from './types';
import { INITIAL_PHONE_DATA } from './constants';
import Button from './components/Button';
import Modal from './components/Modal';
import { api } from './services/api';

function App() {
  // State for Data
  const [phoneData, setPhoneData] = useState<PhoneEntry[]>(INITIAL_PHONE_DATA);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Sync State
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(() => {
    const saved = localStorage.getItem('searchHistory');
    return saved ? JSON.parse(saved) : [];
  });

  // Modals State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PhoneEntry | null>(null);
  const [isCustomBuilding, setIsCustomBuilding] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<PhoneEntry>>({ building: '', department: '', number: '' });

  // Initial Fetch
  useEffect(() => {
    fetchData(true);
  }, []);

  const fetchData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await api.getPhoneData();
      // ถ้า API ส่งข้อมูลกลับมาให้ใช้ข้อมูลจาก API
      if (data && data.length > 0) {
        setPhoneData(data);
        setShowSyncBanner(false);
      } else {
        // เชื่อมต่อสำเร็จ แต่ไม่มีข้อมูลใน Supabase
        console.log("Connected to API but data is empty.");
        setShowSyncBanner(true);
        // ถ้าไม่มีข้อมูลใน Server ให้ใช้ข้อมูล Local แสดงผลไปก่อน
        if (phoneData.length === 0) setPhoneData(INITIAL_PHONE_DATA);
      }
    } catch (error) {
      console.error("Failed to fetch data, keeping local data.", error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
  }, [searchHistory]);

  // Bulk Sync Logic (Fast)
  const handleSyncDefaultData = async () => {
    if (!window.confirm(`คุณต้องการนำเข้าข้อมูลเบอร์โทรพื้นฐานจำนวน ${INITIAL_PHONE_DATA.length} รายการ ไปยัง Supabase ใช่หรือไม่?`)) {
      return;
    }

    setIsSyncing(true);
    try {
      // ใช้ Bulk Upsert ส่งทีเดียว 150 รายการ
      await api.bulkUpsertPhoneData(INITIAL_PHONE_DATA);
      
      alert('นำเข้าข้อมูลสำเร็จทั้งหมดเรียบร้อยแล้ว');
      setShowSyncBanner(false);
      
      // โหลดข้อมูลใหม่จาก Server เพื่อความชัวร์
      fetchData(false);

    } catch (error) {
      console.error("Sync error:", error);
      alert('เกิดข้อผิดพลาดในการนำเข้าข้อมูล \nกรุณาตรวจสอบว่าได้ปิด RLS ใน Supabase หรือยัง?');
    } finally {
      setIsSyncing(false);
    }
  };

  // Export CSV Logic
  const handleExportCSV = () => {
    if (phoneData.length === 0) {
      alert("ไม่มีข้อมูลที่จะส่งออก");
      return;
    }

    // 1. Prepare Headers matches Supabase DB columns
    const headers = ["id", "building", "department", "number", "created_at"];

    // 2. Map Data to CSV Rows (Escaping quotes and handling commas)
    const rows = phoneData.map(item => [
      `"${item.id}"`,
      `"${(item.building || '').replace(/"/g, '""')}"`,
      `"${(item.department || '').replace(/"/g, '""')}"`,
      `"${(item.number || '').replace(/"/g, '""')}"`,
      `"${item.created_at || new Date().toISOString()}"`
    ]);

    // 3. Combine into CSV String
    const csvContent = [
      headers.join(','), 
      ...rows.map(e => e.join(','))
    ].join('\n');

    // 4. Create Blob with BOM (Byte Order Mark) for Thai Support in Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // 5. Create Download Link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `phonebook_backup_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handlers
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.department || !formData.number || !formData.building) return;

    setIsSaving(true);
    try {
      if (editingEntry) {
        // Edit
        const updatedEntry = { ...formData, id: editingEntry.id } as PhoneEntry;
        
        try {
          await api.updatePhoneData(updatedEntry);
        } catch (e) {
          console.warn("API Error, updating local state only");
        }
        
        // Optimistic Update
        setPhoneData(prev => prev.map(item => 
          item.id === editingEntry.id ? updatedEntry : item
        ));
      } else {
        // Add
        const newEntry: PhoneEntry = {
          id: Date.now().toString(),
          building: formData.building!,
          department: formData.department!,
          number: formData.number!,
          created_at: new Date().toISOString() // เพิ่มวันที่ปัจจุบัน
        };
        
        try {
          await api.addPhoneData(newEntry);
          // ถ้าสำเร็จ (ไม่ error)
          // Optimistic Update
          setPhoneData(prev => [...prev, newEntry]);
          closeForm();
        } catch (e) {
           console.error(e);
           alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐานข้อมูล\nกรุณาตรวจสอบ Console Log");
           // ถ้าบันทึกไม่สำเร็จ ไม่ต้องอัปเดตหน้าจอ หรือจะแจ้งเตือนเฉยๆ ก็ได้
        }
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการทำงาน');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (deleteTargetId) {
      setIsSaving(true);
      try {
        try {
          await api.deletePhoneData(deleteTargetId);
        } catch (e) {
          console.warn("API Error, deleting from local state only");
        }
        
        setPhoneData(prev => prev.filter(item => item.id !== deleteTargetId));
        if (isFormOpen && editingEntry?.id === deleteTargetId) {
          closeForm();
        }
        setDeleteTargetId(null);
      } catch (error) {
        alert('เกิดข้อผิดพลาดในการลบข้อมูล');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const openAddForm = () => {
    setEditingEntry(null);
    setFormData({ building: '', department: '', number: '' });
    setIsCustomBuilding(false);
    setIsFormOpen(true);
  };

  const openEditForm = (entry: PhoneEntry) => {
    setEditingEntry(entry);
    setFormData(entry);
    setIsCustomBuilding(false);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingEntry(null);
    setIsCustomBuilding(false);
  };

  const formatTime = (ms: number) => {
    return new Date(ms).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  };

  const filteredData = useMemo(() => {
    const lowerTerm = searchTerm.toLowerCase();
    return phoneData.filter(item => {
      const dept = (item.department || '').toLowerCase();
      const num = (item.number || '');
      const build = (item.building || '').toLowerCase();
      return dept.includes(lowerTerm) || num.includes(lowerTerm) || build.includes(lowerTerm);
    });
  }, [phoneData, searchTerm]);

  const groupedData = useMemo<{ [key: string]: PhoneEntry[] }>(() => {
    const groups: { [key: string]: PhoneEntry[] } = {};
    filteredData.forEach(item => {
      const buildingName = item.building || 'อื่นๆ';
      if (!groups[buildingName]) groups[buildingName] = [];
      groups[buildingName].push(item);
    });
    return groups;
  }, [filteredData]);

  const uniqueBuildings = useMemo(() => {
    return Array.from(new Set(phoneData.map(item => item.building || 'อื่นๆ'))).sort();
  }, [phoneData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length > 2) {
        setSearchHistory(prev => {
           if (prev.length > 0 && prev[0].term === searchTerm) return prev;
           return [{
             id: Date.now().toString(),
             term: searchTerm,
             timestamp: Date.now(),
             resultCount: filteredData.length
           }, ...prev].slice(0, 50);
        });
      }
    }, 2000); 
    return () => clearTimeout(timer);
  }, [searchTerm, filteredData.length]);

  return (
    <div className="min-h-screen bg-sky-50 text-slate-800 font-['Kanit'] pb-20">
      
      {/* Sync Banner */}
      {showSyncBanner && !isLoading && !isSyncing && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 animate-in slide-in-from-top-2">
           <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-amber-800">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">
                  ตรวจพบฐานข้อมูล Supabase ว่างเปล่า ต้องการนำเข้าข้อมูลเบอร์โทรพื้นฐานหรือไม่? ({INITIAL_PHONE_DATA.length} รายการ)
                </span>
              </div>
              <Button size="sm" onClick={handleSyncDefaultData} className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white border-transparent shadow-none">
                <CloudUpload className="w-4 h-4 mr-2" />
                นำเข้าข้อมูลเดี๋ยวนี้
              </Button>
           </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-sky-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div 
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => {
                setSearchTerm('');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <div className="p-2 bg-teal-500 rounded-xl shadow-lg shadow-teal-500/30 group-hover:bg-teal-600 transition-colors">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight group-hover:text-teal-700 transition-colors">สมุดโทรศัพท์ภายใน</h1>
                <p className="text-xs md:text-sm text-slate-500">โรงพยาบาลสมเด็จพระเจ้าตากสินมหาราช</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
               {/* Export CSV Button */}
               <Button variant="ghost" onClick={handleExportCSV} className="hidden md:inline-flex text-slate-600 hover:text-teal-700">
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
               </Button>

               {/* Manual Sync Button */}
               {showSyncBanner && (
                 <Button variant="secondary" onClick={handleSyncDefaultData} className="hidden md:inline-flex text-amber-600 border-amber-200 hover:bg-amber-50">
                    <CloudUpload className="w-4 h-4 mr-2" />
                    Sync Data
                 </Button>
               )}

               {/* GitHub Button (Optional placeholder) */}
               <a 
                 href="https://github.com" 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="hidden md:inline-flex items-center justify-center rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-300 px-4 py-2 text-base"
               >
                 <Github className="w-4 h-4 mr-2" />
                 GitHub
               </a>

               <Button variant="ghost" onClick={() => setIsHistoryOpen(true)} className="hidden md:inline-flex">
                  <History className="w-4 h-4 mr-2" />
                  ประวัติ
               </Button>
               <Button onClick={openAddForm} className="shadow-teal-500/20">
                  <Plus className="w-4 h-4 mr-2" />
                  เพิ่มเบอร์โทร
               </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-6 mb-2 relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-100 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
              placeholder="ค้นหาชื่อแผนก, เบอร์โทร, หรืออาคาร..."
              value={searchTerm}
              onChange={handleSearch}
            />
            {searchTerm && !isLoading && (
               <div className="absolute right-3 top-3.5 text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                 พบ {filteredData.length} รายการ
               </div>
            )}
            {isLoading && !isSyncing && (
              <div className="absolute right-3 top-3.5">
                <Loader2 className="w-5 h-5 text-teal-500 animate-spin" />
              </div>
            )}
          </div>
          
          <div className="md:hidden mt-2 flex flex-wrap gap-2 justify-between items-center">
             <button onClick={handleExportCSV} className="text-sm font-medium text-slate-600 flex items-center">
                <Download className="w-4 h-4 mr-1" /> Export CSV
             </button>
             {showSyncBanner && (
                 <button onClick={handleSyncDefaultData} className="text-sm font-medium text-amber-600 flex items-center">
                    <CloudUpload className="w-4 h-4 mr-1" /> Sync Data
                 </button>
             )}
             <button onClick={() => setIsHistoryOpen(true)} className="text-sm text-slate-500 underline ml-auto">
               ดูประวัติการค้นหา
             </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading && filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
             <Loader2 className="w-12 h-12 text-teal-500 animate-spin mb-4" />
             <p className="text-slate-500">กำลังโหลดข้อมูล...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900">ไม่พบข้อมูล</h3>
            <p className="text-slate-500 mt-1">ลองค้นหาด้วยคำอื่น หรือเพิ่มข้อมูลใหม่</p>
            <div className="flex justify-center gap-3 mt-4">
              <Button variant="ghost" onClick={() => fetchData(false)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                รีโหลด
              </Button>
              <Button variant="secondary" onClick={openAddForm}>
                เพิ่มข้อมูลใหม่
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedData).map(([building, items]: [string, PhoneEntry[]]) => (
              <div key={building} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Header */}
                <div className="bg-teal-700 px-6 py-4 border-b border-teal-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-teal-100" />
                  <h2 className="text-lg font-semibold text-white">{building}</h2>
                  <span className="ml-auto text-xs font-medium bg-white/20 px-2.5 py-1 rounded-full border border-white/20 text-white backdrop-blur-sm">
                    {items.length} แผนก
                  </span>
                </div>
                {/* Grid layout */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item) => (
                    <div key={item.id} className="relative bg-white border border-slate-200 rounded-xl p-4 hover:shadow-lg hover:border-teal-200 transition-all duration-200 group flex flex-col h-full">
                      {/* Top: Department Name */}
                      <div className="mb-3 pr-6">
                        <h3 className="font-medium text-slate-700 text-lg leading-snug group-hover:text-teal-600 transition-colors">
                          {item.department || 'ไม่ระบุชื่อแผนก'}
                        </h3>
                      </div>

                      {/* Middle: Phone Number */}
                      <div className="flex items-center mt-auto pt-3 border-t border-slate-50">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-teal-50 rounded-md">
                            <PhoneCall className="w-4 h-4 text-teal-600" />
                          </div>
                          <a href={`tel:${(item.number || '').split('/')[0].trim()}`} className="font-mono text-lg font-semibold text-slate-700 hover:text-teal-600 transition-colors">
                            {item.number || '-'}
                          </a>
                        </div>
                      </div>

                      {/* Edit/Delete Actions */}
                      <div className="absolute top-2 right-2 flex gap-1 bg-white/90 backdrop-blur-sm rounded-lg p-0.5 z-10 shadow-sm border border-slate-100">
                        <button 
                          onClick={(e) => { 
                            e.preventDefault(); 
                            e.stopPropagation();
                            openEditForm(item); 
                          }} 
                          className="p-1.5 text-slate-500 hover:text-teal-500 hover:bg-teal-50 rounded-md transition-colors"
                          title="แก้ไข"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={(e) => { 
                            e.preventDefault(); 
                            e.stopPropagation();
                            handleDelete(item.id); 
                          }} 
                          className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                          title="ลบ"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Sync Progress Modal (Simplified for Bulk Sync) */}
      <Modal 
         isOpen={isSyncing} 
         onClose={() => { /* Prevent closing while syncing */ }} 
         title="กำลังนำเข้าข้อมูล..."
      >
         <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="w-16 h-16 text-teal-500 animate-spin mb-4" />
            <h3 className="text-lg font-bold text-slate-800 mb-2">
               กำลังส่งข้อมูลไปยัง Supabase
            </h3>
            <p className="text-slate-500 text-center">
               กรุณารอสักครู่...
            </p>
         </div>
      </Modal>

      {/* History Modal */}
      <Modal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} title="ประวัติการค้นหา">
        {searchHistory.length === 0 ? (
          <p className="text-center text-slate-500 py-8">ยังไม่มีประวัติการค้นหา</p>
        ) : (
          <div className="space-y-1">
            <div className="flex justify-between items-center mb-4">
               <span className="text-sm text-slate-500">รายการล่าสุด</span>
               <button onClick={() => setSearchHistory([])} className="text-xs text-rose-500 hover:underline">ล้างประวัติ</button>
            </div>
            {searchHistory.map((item) => (
              <div key={item.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-full text-slate-400">
                    <Search size={14} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">{item.term}</p>
                    <p className="text-xs text-slate-400">{formatTime(item.timestamp)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSearchTerm(item.term);
                    setIsHistoryOpen(false);
                  }}
                  className="text-xs text-teal-600 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ค้นหาอีกครั้ง
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Add/Edit Modal */}
      <Modal 
        isOpen={isFormOpen} 
        onClose={closeForm} 
        title={editingEntry ? 'แก้ไขข้อมูล' : 'เพิ่มเบอร์โทรใหม่'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-5">
          {isSaving && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl">
              <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            </div>
          )}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">อาคาร / สถานที่</label>
            {!isCustomBuilding ? (
              <div className="relative group">
                <Building2 className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors z-10" />
                <div className="relative">
                  <select
                    required
                    className="block w-full pl-11 pr-10 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 font-semibold appearance-none focus:bg-white focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm cursor-pointer"
                    value={formData.building}
                    onChange={(e) => {
                      if (e.target.value === 'CUSTOM_BUILDING_OPTION') {
                        setIsCustomBuilding(true);
                        setFormData(prev => ({ ...prev, building: '' }));
                      } else {
                        setFormData(prev => ({ ...prev, building: e.target.value }));
                      }
                    }}
                  >
                    <option value="" disabled>เลือกอาคาร</option>
                    {uniqueBuildings.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                    <option value="CUSTOM_BUILDING_OPTION" className="font-medium text-teal-600 bg-teal-50">+ เพิ่มอาคารใหม่...</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-3.5 h-5 w-5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            ) : (
              <div className="relative group animate-in fade-in zoom-in-95 duration-200">
                <Building2 className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                <input
                  type="text"
                  required
                  autoFocus
                  className="block w-full pl-11 pr-10 py-3 bg-white border-2 border-teal-500 rounded-xl text-slate-800 font-semibold placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                  placeholder="ระบุชื่ออาคารใหม่..."
                  value={formData.building}
                  onChange={e => setFormData({ ...formData, building: e.target.value })}
                />
                <button 
                  type="button"
                  onClick={() => {
                    setIsCustomBuilding(false);
                    setFormData(prev => ({ ...prev, building: '' }));
                  }}
                  className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  title="ยกเลิก / กลับไปเลือกจากรายการ"
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">ชื่อแผนก / ห้อง</label>
            <div className="relative group">
              <MapPin className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
              <input
                type="text"
                required
                className="block w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 font-semibold placeholder-slate-400 focus:bg-white focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                placeholder="เช่น ห้องฉุกเฉิน, การเงิน"
                value={formData.department}
                onChange={e => setFormData({ ...formData, department: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">เบอร์โทรศัพท์ภายใน</label>
            <div className="relative group">
              <Phone className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
              <input
                type="text"
                required
                className="block w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 font-semibold placeholder-slate-400 focus:bg-white focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                placeholder="เช่น 1000, 2000 / 2001"
                value={formData.number}
                onChange={e => setFormData({ ...formData, number: e.target.value })}
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-6 flex items-center justify-between">
            {editingEntry && (
              <button
                type="button"
                onClick={() => handleDelete(editingEntry.id)}
                className="flex items-center text-rose-500 hover:text-rose-600 font-medium transition-colors px-2 py-1 -ml-2 rounded-lg hover:bg-rose-50"
              >
                <Trash2 className="w-5 h-5 mr-1.5" />
                ลบรายการนี้
              </button>
            )}
            <div className={`flex gap-3 ${!editingEntry ? 'w-full justify-end' : ''}`}>
              <Button type="button" variant="secondary" onClick={closeForm} disabled={isSaving}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isSaving}>
                {editingEntry ? 'บันทึก' : 'เพิ่มข้อมูล'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTargetId}
        onClose={() => !isSaving && setDeleteTargetId(null)}
        title="ยืนยันการลบข้อมูล"
      >
        <div className="flex flex-col items-center text-center p-4">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4 animate-in zoom-in duration-300">
            {isSaving ? <Loader2 size={32} className="text-rose-500 animate-spin" /> : <AlertTriangle size={32} className="text-rose-500" />}
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">คุณแน่ใจหรือไม่?</h3>
          <p className="text-slate-500 mb-8 max-w-xs mx-auto">
            คุณต้องการลบเบอร์โทรแผนกนี้ใช่หรือไม่? <br/>
            <span className="text-rose-500 text-sm">การกระทำนี้ไม่สามารถเรียกคืนได้</span>
          </p>
          <div className="flex gap-3 w-full">
            <Button variant="secondary" className="flex-1" onClick={() => setDeleteTargetId(null)} disabled={isSaving}>
              ยกเลิก
            </Button>
            <Button variant="danger" className="flex-1" onClick={confirmDelete} disabled={isSaving}>
              {isSaving ? 'กำลังลบ...' : 'ยืนยันลบข้อมูล'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default App;