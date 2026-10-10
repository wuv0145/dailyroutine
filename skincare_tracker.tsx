import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { Sun, Moon, Plus, Trash2, Check, Edit2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'skincare-tracker-app';

const PRESETS = [
  { icon: '🧼', label: '洗面乳' },
  { icon: '💧', label: '化妝水' },
  { icon: '✨', label: '精華液' },
  { icon: '🧴', label: '乳液/面霜' },
  { icon: '👁️', label: '眼霜' },
  { icon: '☀️', label: '防曬' },
  { icon: '🎭', label: '面膜' },
  { icon: '👄', label: '護唇膏' },
  { icon: '➕', label: '其他' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [routines, setRoutines] = useState([]);
  const [activeTab, setActiveTab] = useState('morning'); // 'morning' or 'evening'
  const [isEditing, setIsEditing] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [completedSteps, setCompletedSteps] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // 格式化日期為 YYYY-MM-DD 作為 Firebase 的 Document ID
  const dateStr = selectedDate.toLocaleDateString('en-CA'); 

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // 監聽使用者的保養品清單 (Routines)
    const routinesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'routines');
    const unsubscribeRoutines = onSnapshot(routinesRef, (snapshot) => {
      const fetchedRoutines = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // 依照建立時間排序
      fetchedRoutines.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
      setRoutines(fetchedRoutines);
    }, (error) => console.error("Error fetching routines:", error));

    return () => {
      unsubscribeRoutines();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // 監聽選擇日期的打卡紀錄 (Daily Logs)
    const dailyLogRef = doc(db, 'artifacts', appId, 'users', user.uid, 'daily_logs', dateStr);
    const unsubscribeLog = onSnapshot(dailyLogRef, (docSnap) => {
      if (docSnap.exists()) {
        setCompletedSteps(docSnap.data().completedSteps || []);
      } else {
        setCompletedSteps([]);
      }
    }, (error) => console.error("Error fetching daily log:", error));

    return () => {
      unsubscribeLog();
    };
  }, [user, dateStr]);

  const handleAddStep = async (e) => {
    e.preventDefault();
    if (!user || !newStepName.trim()) return;

    try {
      const routinesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'routines');
      await addDoc(routinesRef, {
        name: newStepName.trim(),
        type: activeTab,
        createdAt: serverTimestamp()
      });
      setNewStepName('');
    } catch (error) {
      console.error("Error adding step:", error);
    }
  };

  const handleDeleteStep = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'routines', id));
    } catch (error) {
      console.error("Error deleting step:", error);
    }
  };

  const toggleCompletion = async (stepId) => {
    if (!user) return;
    
    let newCompleted;
    if (completedSteps.includes(stepId)) {
      newCompleted = completedSteps.filter(id => id !== stepId);
    } else {
      newCompleted = [...completedSteps, stepId];
    }

    try {
      const dailyLogRef = doc(db, 'artifacts', appId, 'users', user.uid, 'daily_logs', dateStr);
      await setDoc(dailyLogRef, { completedSteps: newCompleted }, { merge: true });
    } catch (error) {
      console.error("Error updating completion:", error);
    }
  };

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const isToday = new Date().toLocaleDateString('en-CA') === dateStr;

  const currentRoutines = routines.filter(r => r.type === activeTab);
  const progress = currentRoutines.length > 0 
    ? Math.round((currentRoutines.filter(r => completedSteps.includes(r.id)).length / currentRoutines.length) * 100) 
    : 0;

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-pink-500 font-sans">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_#ec4899]"></div>
          <p className="tracking-widest uppercase text-sm font-bold">載入中 / Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-pink-500/30">
      <div className="max-w-md mx-auto min-h-screen flex flex-col relative overflow-hidden shadow-2xl shadow-black">
        
        {/* 背景環境光 */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[30%] bg-pink-600/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[40%] bg-pink-800/10 blur-[120px] rounded-full pointer-events-none"></div>

        {/* 頂部標題與編輯按鈕 */}
        <header className="px-6 pt-10 pb-4 flex justify-between items-center relative z-10">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-pink-600 drop-shadow-[0_0_10px_rgba(236,72,153,0.4)] tracking-wider">
              Delicate Glow Up
            </h1>
            <p className="text-zinc-500 text-[10px] tracking-widest mt-1 uppercase font-bold">Daily Skincare Log</p>
          </div>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={`p-3 rounded-xl transition-all duration-300 shadow-lg ${
              isEditing 
                ? 'bg-pink-600 text-black shadow-[0_0_20px_rgba(236,72,153,0.5)]' 
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-pink-400 hover:border-pink-500/50 hover:shadow-[0_0_15px_rgba(236,72,153,0.2)]'
            }`}
          >
            {isEditing ? <Check size={20} /> : <Edit2 size={20} />}
          </button>
        </header>

        {/* 日期選擇器 */}
        <div className="px-6 pb-4 relative z-10 flex items-center justify-between">
          <button onClick={() => changeDate(-1)} className="p-2 text-zinc-500 hover:text-pink-400 transition-colors">
            <ChevronLeft size={24} />
          </button>
          
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center gap-2 text-pink-500">
              <Calendar size={16} />
              <span className="font-bold tracking-wider text-sm">{dateStr}</span>
            </div>
            <span className="text-xs text-zinc-500 font-bold mt-1">
              {isToday ? "今天 TODAY" : "歷史紀錄 HISTORY"}
            </span>
          </div>

          <button onClick={() => changeDate(1)} disabled={isToday} className="p-2 text-zinc-500 hover:text-pink-400 transition-colors disabled:opacity-30 disabled:hover:text-zinc-500">
            <ChevronRight size={24} />
          </button>
        </div>

        {/* 檢視模式的進度條 */}
        {!isEditing && (
          <div className="px-6 py-2 relative z-10">
            <div className="flex justify-between text-[10px] font-bold mb-2 text-zinc-400 tracking-wider">
              <span>完成進度 / PROGRESS</span>
              <span className="text-pink-400 drop-shadow-[0_0_5px_rgba(236,72,153,0.8)]">{progress}%</span>
            </div>
            <div className="h-2 w-full bg-zinc-900/80 rounded-full overflow-hidden border border-zinc-800/50">
              <div 
                className="h-full bg-gradient-to-r from-pink-600 via-pink-400 to-pink-300 transition-all duration-700 ease-out shadow-[0_0_15px_#ec4899]"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* 早晚切換標籤 */}
        <div className="px-6 py-4 grid grid-cols-2 gap-3 relative z-10">
          <button
            onClick={() => setActiveTab('morning')}
            className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-all duration-300 ${
              activeTab === 'morning'
                ? 'bg-zinc-900 border border-pink-500/80 text-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.2)]'
                : 'bg-zinc-900/40 border border-transparent text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900'
            }`}
          >
            <Sun size={18} className={activeTab === 'morning' ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]' : ''} />
            <span className="text-sm tracking-wide">早晨 / AM</span>
          </button>
          <button
            onClick={() => setActiveTab('evening')}
            className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-all duration-300 ${
              activeTab === 'evening'
                ? 'bg-zinc-900 border border-pink-500/80 text-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.2)]'
                : 'bg-zinc-900/40 border border-transparent text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900'
            }`}
          >
            <Moon size={18} className={activeTab === 'evening' ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]' : ''} />
            <span className="text-sm tracking-wide">夜晚 / PM</span>
          </button>
        </div>

        {/* 保養品清單 */}
        <div className="flex-1 overflow-y-auto px-6 py-2 relative z-10 hide-scrollbar space-y-3 pb-40">
          {currentRoutines.length === 0 ? (
             <div className="text-center py-12 flex flex-col items-center justify-center opacity-50">
                <span className="text-4xl mb-4">✨</span>
                <p className="text-zinc-400 font-medium text-sm">尚未設定保養清單</p>
                <p className="text-zinc-600 text-xs mt-1">點擊右上角進入編輯模式</p>
             </div>
          ) : (
            currentRoutines.map((step) => {
              const isDone = completedSteps.includes(step.id);
              
              return (
                <div 
                  key={step.id}
                  className={`group relative flex items-center justify-between p-4 rounded-xl transition-all duration-300 overflow-hidden ${
                    isEditing 
                      ? 'bg-zinc-900 border border-zinc-800' 
                      : isDone
                        ? 'bg-black border border-pink-500/30 opacity-70 shadow-[inset_0_0_20px_rgba(236,72,153,0.05)]'
                        : 'bg-zinc-900 border border-zinc-800 hover:border-pink-500/50 cursor-pointer'
                  }`}
                  onClick={() => !isEditing && toggleCompletion(step.id)}
                >
                  {/* 完成時的微弱光暈 */}
                  {!isEditing && isDone && (
                    <div className="absolute left-0 top-0 w-1 h-full bg-pink-500 shadow-[0_0_10px_#ec4899]"></div>
                  )}

                  <div className="flex items-center gap-4 relative z-10 w-full pl-2">
                    {!isEditing && (
                      <div className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-all duration-300 flex-shrink-0 ${
                        isDone 
                          ? 'border-pink-500 bg-pink-500 text-black shadow-[0_0_15px_#ec4899]' 
                          : 'border-zinc-600 bg-zinc-950 text-transparent'
                      }`}>
                        <Check size={14} strokeWidth={4} />
                      </div>
                    )}
                    
                    <span className={`font-medium tracking-wide transition-all duration-300 break-words flex-1 ${
                      !isEditing && isDone ? 'text-zinc-500 line-through' : 'text-zinc-100'
                    }`}>
                      {step.name}
                    </span>
                  </div>

                  {/* 編輯模式：刪除按鈕 */}
                  {isEditing && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteStep(step.id); }}
                      className="relative z-10 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 編輯模式：新增保養品面板 */}
        {isEditing && (
          <div className="absolute bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
            <div className="p-4">
              <p className="text-xs font-bold text-zinc-500 mb-3 tracking-widest">快速加入 / QUICK ADD</p>
              <div className="grid grid-cols-5 gap-2 mb-4 overflow-x-auto hide-scrollbar">
                {PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setNewStepName(preset.icon + ' ' + preset.label + ' ')}
                    className="flex flex-col items-center justify-center p-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-pink-500/50 hover:bg-pink-500/10 transition-all group"
                  >
                    <span className="text-xl mb-1 group-hover:scale-110 transition-transform">{preset.icon}</span>
                    <span className="text-[9px] text-zinc-400 whitespace-nowrap group-hover:text-pink-300">{preset.label}</span>
                  </button>
                ))}
              </div>

              <form onSubmit={handleAddStep} className="flex gap-2">
                <input
                  type="text"
                  value={newStepName}
                  onChange={(e) => setNewStepName(e.target.value)}
                  placeholder="或手動輸入產品名稱..."
                  className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-pink-500 rounded-xl px-4 py-3 text-sm text-zinc-100 outline-none transition-all placeholder:text-zinc-600 focus:shadow-[0_0_15px_rgba(236,72,153,0.3)]"
                />
                <button 
                  type="submit"
                  disabled={!newStepName.trim()}
                  className="bg-pink-600 text-black px-6 rounded-xl font-bold flex items-center justify-center transition-all hover:bg-pink-500 disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(236,72,153,0.5)]"
                >
                  <Plus size={20} strokeWidth={3} />
                </button>
              </form>
            </div>
          </div>
        )}

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}} />
    </div>
  );
}