import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  setDoc,
  getDoc,
  increment
} from 'firebase/firestore';
import { 
  Gamepad2, Plus, Trash2, Edit2, 
  History, ShieldCheck, RefreshCw
} from 'lucide-react';

/* --- TA VRAIE CONFIGURATION FIREBASE --- */
const firebaseConfig = {
  apiKey: "AIzaSyBxiSdRXu_5fi3ZLQ4fR85IGgQf1SnO45k",
  authDomain: "nexus-bet.firebaseapp.com",
  projectId: "nexus-bet",
  storageBucket: "nexus-bet.firebasestorage.app",
  messagingSenderId: "914502754442",
  appId: "1:914502754442:web:5bbadb94ee76b956fa4d73",
  measurementId: "G-1LZPEWNBPN"
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ID fixe pour ton projet local (ne touche pas à ça)
const appId = 'nexus-bet-local'; 

/* --- CONSTANTS --- */
const COLLECTION_TEAMS = 'teams';
const COLLECTION_MATCHES = 'matches';
const COLLECTION_BETS = 'bets';
const COLLECTION_USERS = 'users';
const INITIAL_BALANCE = 1000;

// --- LISTE D'ÉQUIPES ÉTENDUE ---
const DEMO_TEAMS = [
  { name: 'Karmine Corp', region: 'EU', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Karmine_Corp_logo.svg/1200px-Karmine_Corp_logo.svg.png' },
  { name: 'T1', region: 'KR', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f3/T1_logo.svg/1200px-T1_logo.svg.png' },
  { name: 'G2 Esports', region: 'EU', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/1/12/G2_Esports_logo.svg/1200px-G2_Esports_logo.svg.png' },
  { name: 'Gen.G', region: 'KR', logo: 'https://am-a.akamaihd.net/image?resize=200:&f=http%3A%2F%2Fstatic.lolesports.com%2Fteams%2FGenG-Full-Logo.png' },
  { name: 'Fnatic', region: 'EU', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/43/Fnatic_logo.svg/1200px-Fnatic_logo.svg.png' },
  { name: 'Team Vitality', region: 'EU', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/Team_Vitality_logo.svg/1200px-Team_Vitality_logo.svg.png' },
  { name: 'JD Gaming', region: 'CN', logo: 'https://am-a.akamaihd.net/image?resize=200:&f=http%3A%2F%2Fstatic.lolesports.com%2Fteams%2FJD_Gaming_logo.png' },
  { name: 'Cloud9', region: 'NA', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Cloud9_logo.svg/1200px-Cloud9_logo.svg.png' },
];

/* --- COMPONENTS --- */
const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-bold transition-all duration-200 flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-50";
  const variants = {
    primary: "bg-gradient-to-r from-green-400 to-emerald-600 text-black hover:shadow-[0_0_15px_rgba(52,211,153,0.5)]",
    secondary: "bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700",
    danger: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/50",
    ghost: "text-zinc-400 hover:text-white hover:bg-white/5",
    neon: "bg-purple-600 text-white hover:bg-purple-500 hover:shadow-[0_0_15px_rgba(147,51,234,0.5)]",
    success: "bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30"
  };
  return <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`} disabled={disabled}>{children}</button>;
};

const Card = ({ children, className = '' }) => (
  <div className={`bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-xl p-6 ${className}`}>{children}</div>
);

const Input = ({ label, ...props }) => (
  <div className="flex flex-col gap-1 mb-4">
    <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold ml-1">{label}</label>
    <input className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-green-500 w-full" {...props} />
  </div>
);

const Badge = ({ status }) => {
  const styles = { upcoming: "bg-blue-500/20 text-blue-400", live: "bg-red-500/20 text-red-500 animate-pulse", finished: "bg-zinc-700/50 text-zinc-400" };
  const labels = { upcoming: "À venir", live: "EN DIRECT", finished: "Terminé" };
  return <span className={`px-2 py-0.5 rounded text-xs font-bold border uppercase tracking-wider ${styles[status]}`}>{labels[status] || status}</span>;
};

const TeamLogo = ({ url, alt }) => (
  <div className="w-12 h-12 rounded-full bg-zinc-800 border-2 border-zinc-700 overflow-hidden flex items-center justify-center">
    {url ? <img src={url} alt={alt} className="w-full h-full object-cover" onError={(e) => e.target.style.display='none'} /> : <span className="text-zinc-500 text-xs">{alt?.substring(0,2)}</span>}
  </div>
);

/* --- MAIN APP --- */
export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [view, setView] = useState('landing');
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [userBets, setUserBets] = useState([]);
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  // Form States
  const [isBetModalOpen, setIsBetModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [betAmount, setBetAmount] = useState(10);
  const [betTeamId, setBetTeamId] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingMatch, setEditingMatch] = useState(null);

  useEffect(() => {
    signInAnonymously(auth);
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userRef = doc(db, 'artifacts', appId, 'users', u.uid, COLLECTION_USERS, 'profile');
        const snap = await getDoc(userRef);
        if (!snap.exists()) await setDoc(userRef, { balance: INITIAL_BALANCE, createdAt: serverTimestamp() });
        onSnapshot(userRef, (doc) => doc.exists() && setUserData(doc.data()));
        
        const betsQ = query(collection(db, 'artifacts', appId, 'users', u.uid, COLLECTION_BETS), orderBy('createdAt', 'desc'));
        onSnapshot(betsQ, (s) => setUserBets(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubT = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTION_TEAMS)), (s) => setTeams(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubM = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', COLLECTION_MATCHES)), (s) => setMatches(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubT(); unsubM(); };
  }, [user]);

  // --- FONCTION DE SEED AMÉLIORÉE ---
  const seedDatabase = async () => {
    const teamIds = [];
    
    // 1. Créer les équipes
    for (const team of DEMO_TEAMS) {
      const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTION_TEAMS), team);
      teamIds.push({ ...team, id: ref.id });
    }

    const now = new Date();
    
    // 2. Créer des scénarios de matchs variés
    const matchesToCreate = [
      // Match A VENIR (Demain)
      {
        teamA: teamIds[0].id, teamB: teamIds[1].id, teamAName: teamIds[0].name, teamBName: teamIds[1].name,
        date: new Date(now.getTime() + 86400000).toISOString(), status: 'upcoming', oddsA: 2.10, oddsB: 1.65, scoreA: 0, scoreB: 0
      },
      // Match EN DIRECT (Aujourd'hui)
      {
        teamA: teamIds[2].id, teamB: teamIds[3].id, teamAName: teamIds[2].name, teamBName: teamIds[3].name,
        date: now.toISOString(), status: 'live', oddsA: 1.85, oddsB: 1.85, scoreA: 2, scoreB: 1
      },
      // Match TERMINÉ (Hier)
      {
        teamA: teamIds[4].id, teamB: teamIds[5].id, teamAName: teamIds[4].name, teamBName: teamIds[5].name,
        date: new Date(now.getTime() - 86400000).toISOString(), status: 'finished', oddsA: 1.40, oddsB: 2.80, scoreA: 3, scoreB: 0
      },
      // Match A VENIR (Dans 2 jours) - Gros choc
      {
        teamA: teamIds[6].id, teamB: teamIds[7].id, teamAName: teamIds[6].name, teamBName: teamIds[7].name,
        date: new Date(now.getTime() + 172800000).toISOString(), status: 'upcoming', oddsA: 1.55, oddsB: 2.30, scoreA: 0, scoreB: 0
      }
    ];

    for (const match of matchesToCreate) {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTION_MATCHES), match);
    }
    
    alert("✨ Base de données enrichie avec succès ! (Équipes + Matchs variés)");
  };

  const handlePlaceBet = async () => {
    if (userData.balance < betAmount) return alert("Fonds insuffisants");
    const odds = betTeamId === selectedMatch.teamA ? selectedMatch.oddsA : selectedMatch.oddsB;
    const teamName = betTeamId === selectedMatch.teamA ? selectedMatch.teamAName : selectedMatch.teamBName;
    
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, COLLECTION_USERS, 'profile'), { balance: increment(-betAmount) });
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, COLLECTION_BETS), {
      matchId: selectedMatch.id, teamId: betTeamId, teamName, amount: parseInt(betAmount), odds, 
      potentialGain: Math.floor(betAmount * odds), status: 'pending', 
      matchDetails: `${selectedMatch.teamAName} vs ${selectedMatch.teamBName}`, createdAt: serverTimestamp()
    });
    setIsBetModalOpen(false);
  };

  const processBet = async (bet) => {
    const match = matches.find(m => m.id === bet.matchId);
    if (!match || match.status !== 'finished') return;
    const winnerId = match.scoreA > match.scoreB ? match.teamA : match.teamB;
    const status = winnerId === bet.teamId ? 'won' : 'lost';
    
    const batchPromises = [updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, COLLECTION_BETS, bet.id), { status })];
    if (status === 'won') batchPromises.push(updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, COLLECTION_USERS, 'profile'), { balance: increment(bet.potentialGain) }));
    await Promise.all(batchPromises);
  };

  const saveTeam = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    const data = { name: fd.get('name'), region: fd.get('region'), logo: fd.get('logo') };
    editingTeam.id ? await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTION_TEAMS, editingTeam.id), data) 
                   : await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTION_TEAMS), data);
    setEditingTeam(null);
  };

  const saveMatch = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    const tA = teams.find(t => t.id === fd.get('teamA'));
    const tB = teams.find(t => t.id === fd.get('teamB'));
    const data = {
      teamA: fd.get('teamA'), teamB: fd.get('teamB'), teamAName: tA?.name, teamBName: tB?.name,
      date: fd.get('date'), status: fd.get('status'), oddsA: parseFloat(fd.get('oddsA')), oddsB: parseFloat(fd.get('oddsB')),
      scoreA: parseInt(fd.get('scoreA')), scoreB: parseInt(fd.get('scoreB'))
    };
    editingMatch.id ? await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTION_MATCHES, editingMatch.id), data)
                    : await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTION_MATCHES), data);
    setEditingMatch(null);
  };

  if (view === 'landing') return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center text-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900/20 via-black to-black"></div>
      <div className="z-10">
        <h1 className="text-6xl font-black mb-4">NEXUS<span className="text-green-500">BET</span></h1>
        <p className="text-zinc-400 mb-8 max-w-lg mx-auto">La plateforme ultime de paris E-Sport. Rejoignez l'élite maintenant.</p>
        <Button onClick={() => setView('matches')} className="px-8 py-4 text-xl">COMMENCER <Gamepad2/></Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-zinc-200 font-sans pb-20">
      <nav className="bg-zinc-950/80 backdrop-blur border-b border-zinc-800 sticky top-0 z-50 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h1 className="font-black text-xl tracking-tight cursor-pointer" onClick={() => setView('matches')}>NEXUS<span className="text-green-500">BET</span></h1>
            <div className="hidden md:flex gap-2">
              <Button variant="ghost" onClick={() => setView('matches')} className={view === 'matches' ? 'bg-zinc-800 text-white' : ''}><Gamepad2 size={16}/> Matchs</Button>
              <Button variant="ghost" onClick={() => setView('history')} className={view === 'history' ? 'bg-zinc-800 text-white' : ''}><History size={16}/> Paris</Button>
              {isAdminMode && <Button variant="ghost" onClick={() => setView('admin')} className={view === 'admin' ? 'bg-zinc-800 text-white' : ''}><ShieldCheck size={16}/> Admin</Button>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-zinc-900 rounded-full border border-zinc-800 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
              <span className="font-mono font-bold text-green-400">{userData?.balance || 0}</span>
            </div>
            <button onClick={() => setIsAdminMode(!isAdminMode)} className={`p-2 rounded ${isAdminMode ? 'text-red-400 bg-red-900/20' : 'text-zinc-600'}`}><ShieldCheck size={20}/></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {view === 'matches' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.length === 0 && <div className="col-span-full text-center py-20 text-zinc-500">Aucun match. {isAdminMode && "Allez dans Admin > Générer Démo."}</div>}
            {matches.map(m => (
              <Card key={m.id} className="relative group hover:border-zinc-600 transition-all">
                <div className="flex justify-between mb-4"><Badge status={m.status}/><span className="text-xs text-zinc-500 font-mono">{new Date(m.date).toLocaleDateString()}</span></div>
                <div className="flex justify-between items-center mb-6">
                  <div className="text-center"><TeamLogo url={teams.find(t=>t.id===m.teamA)?.logo} alt={m.teamAName}/><div className="font-bold mt-2">{m.teamAName}</div></div>
                  <div className="text-zinc-600 italic font-black">VS</div>
                  <div className="text-center"><TeamLogo url={teams.find(t=>t.id===m.teamB)?.logo} alt={m.teamBName}/><div className="font-bold mt-2">{m.teamBName}</div></div>
                </div>
                {m.status !== 'finished' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { setSelectedMatch(m); setBetTeamId(m.teamA); setIsBetModalOpen(true); }} className="bg-zinc-800 p-2 rounded hover:bg-zinc-700 border border-zinc-700 text-center"><div className="text-xs text-zinc-400">Win A</div><div className="font-mono text-green-400 font-bold">x{m.oddsA}</div></button>
                    <button onClick={() => { setSelectedMatch(m); setBetTeamId(m.teamB); setIsBetModalOpen(true); }} className="bg-zinc-800 p-2 rounded hover:bg-zinc-700 border border-zinc-700 text-center"><div className="text-xs text-zinc-400">Win B</div><div className="font-mono text-green-400 font-bold">x{m.oddsB}</div></button>
                  </div>
                ) : <div className="text-center bg-zinc-800 py-2 rounded text-sm font-bold text-zinc-500">Terminé • {m.scoreA} - {m.scoreB}</div>}
              </Card>
            ))}
          </div>
        )}

        {view === 'history' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-2xl font-bold mb-6">Mes Paris</h2>
            {userBets.map(b => (
              <div key={b.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex justify-between items-center">
                <div>
                  <div className="font-bold">{b.matchDetails}</div>
                  <div className="text-sm text-zinc-400">Choix: <span className="text-white">{b.teamName}</span> • Mise: {b.amount}</div>
                </div>
                <div>
                  {b.status === 'pending' && matches.find(m=>m.id===b.matchId)?.status === 'finished' ? 
                    <Button variant="success" onClick={() => processBet(b)} className="text-xs py-1 h-8">Vérifier</Button> :
                    <Badge status={b.status === 'won' ? 'Gagné' : b.status === 'lost' ? 'Perdu' : 'En cours'}/>
                  }
                  {b.status === 'won' && <div className="text-green-400 font-mono font-bold text-right">+{b.potentialGain}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'admin' && isAdminMode && (
          <div className="space-y-8">
            <div className="flex justify-between items-center bg-purple-900/10 p-6 rounded-xl border border-purple-500/20">
              <h2 className="text-xl font-bold text-purple-200">Administration</h2>
              <Button variant="neon" onClick={seedDatabase}><RefreshCw size={16}/> Générer Démo</Button>
            </div>
            
            {/* CRUD TEAMS */}
            <section>
               <div className="flex justify-between mb-4"><h3 className="font-bold">Équipes</h3><Button variant="secondary" onClick={()=>setEditingTeam({})}><Plus size={14}/></Button></div>
               {editingTeam && (
                 <form onSubmit={saveTeam} className="bg-zinc-900 p-4 rounded mb-4 border border-zinc-700 flex flex-col gap-2">
                   <Input name="name" defaultValue={editingTeam.name} placeholder="Nom" required/>
                   <Input name="region" defaultValue={editingTeam.region} placeholder="Région"/>
                   <Input name="logo" defaultValue={editingTeam.logo} placeholder="URL Logo"/>
                   <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={()=>setEditingTeam(null)}>Annuler</Button><Button type="submit">Sauvegarder</Button></div>
                 </form>
               )}
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {teams.map(t => (
                   <div key={t.id} className="bg-zinc-900 p-3 rounded border border-zinc-800 flex items-center justify-between">
                     <div className="flex items-center gap-2"><TeamLogo url={t.logo} size="sm"/><span className="font-bold text-sm">{t.name}</span></div>
                     <div className="flex"><button onClick={()=>setEditingTeam(t)} className="p-1 text-blue-400"><Edit2 size={14}/></button><button onClick={()=>deleteDoc(doc(db,'artifacts',appId,'public','data',COLLECTION_TEAMS,t.id))} className="p-1 text-red-400"><Trash2 size={14}/></button></div>
                   </div>
                 ))}
               </div>
            </section>

             {/* CRUD MATCHES */}
             <section>
               <div className="flex justify-between mb-4"><h3 className="font-bold">Matchs</h3><Button variant="secondary" onClick={()=>setEditingMatch({})}><Plus size={14}/></Button></div>
               {editingMatch && (
                 <form onSubmit={saveMatch} className="bg-zinc-900 p-4 rounded mb-4 border border-zinc-700 grid grid-cols-2 gap-4">
                   <select name="teamA" className="bg-zinc-950 p-2 rounded text-white border border-zinc-800" defaultValue={editingMatch.teamA}>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
                   <select name="teamB" className="bg-zinc-950 p-2 rounded text-white border border-zinc-800" defaultValue={editingMatch.teamB}>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
                   <Input name="date" type="datetime-local" defaultValue={editingMatch.date?.slice(0,16)} required/>
                   <select name="status" className="bg-zinc-950 p-2 rounded text-white border border-zinc-800" defaultValue={editingMatch.status || 'upcoming'}><option value="upcoming">À venir</option><option value="live">Live</option><option value="finished">Terminé</option></select>
                   <Input name="oddsA" placeholder="Cote A" step="0.01" defaultValue={editingMatch.oddsA || 1.5}/>
                   <Input name="oddsB" placeholder="Cote B" step="0.01" defaultValue={editingMatch.oddsB || 1.5}/>
                   <Input name="scoreA" placeholder="Score A" type="number" defaultValue={editingMatch.scoreA || 0}/>
                   <Input name="scoreB" placeholder="Score B" type="number" defaultValue={editingMatch.scoreB || 0}/>
                   <div className="col-span-2 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={()=>setEditingMatch(null)}>Annuler</Button><Button type="submit">Sauvegarder</Button></div>
                 </form>
               )}
               <div className="space-y-2">
                 {matches.map(m => (
                   <div key={m.id} className="bg-zinc-900 p-3 rounded border border-zinc-800 flex justify-between items-center">
                     <div><span className={`text-xs uppercase font-bold mr-2 ${m.status==='live'?'text-red-500':'text-zinc-500'}`}>{m.status}</span> <span className="font-bold">{m.teamAName} vs {m.teamBName}</span></div>
                     <div className="flex"><button onClick={()=>setEditingMatch(m)} className="p-1 text-blue-400"><Edit2 size={14}/></button><button onClick={()=>deleteDoc(doc(db,'artifacts',appId,'public','data',COLLECTION_MATCHES,m.id))} className="p-1 text-red-400"><Trash2 size={14}/></button></div>
                   </div>
                 ))}
               </div>
            </section>
          </div>
        )}
      </main>

      {isBetModalOpen && selectedMatch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <Card className="w-full max-w-sm border-green-500/30 shadow-2xl shadow-green-900/20">
            <h3 className="text-xl font-bold text-center mb-4">Miser sur {betTeamId === selectedMatch.teamA ? selectedMatch.teamAName : selectedMatch.teamBName}</h3>
            <div className="flex gap-2 mb-6"><button onClick={()=>setBetAmount(Math.max(10, betAmount-10))} className="p-3 bg-zinc-800 rounded">-</button><input className="flex-1 bg-black text-center text-xl font-mono border border-zinc-700 rounded" value={betAmount} onChange={e=>setBetAmount(parseInt(e.target.value)||0)}/><button onClick={()=>setBetAmount(betAmount+10)} className="p-3 bg-zinc-800 rounded">+</button></div>
            <div className="flex gap-2"><Button variant="ghost" className="flex-1" onClick={()=>setIsBetModalOpen(false)}>Annuler</Button><Button className="flex-1" onClick={handlePlaceBet}>Confirmer</Button></div>
          </Card>
        </div>
      )}
    </div>
  );
}