import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { monitorAuthState } from './services/firebase';
import { AuthScreen } from './components/AuthScreen';
import { Dashboard } from './components/Dashboard';
import { ExpenseForm } from './components/ExpenseForm';
import { ViewState } from './types';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewState>('DASHBOARD');

  useEffect(() => {
    const unsubscribe = monitorAuthState((currentUser) => {
      setUser(currentUser);
      setLoading(false);
      // Reset view to dashboard on login
      if (currentUser) {
        setView('DASHBOARD');
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-emerald-500">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  // Router Logic
  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="antialiased text-zinc-100 bg-zinc-950 min-h-screen font-sans selection:bg-emerald-500/30">
      {view === 'DASHBOARD' && (
        <Dashboard 
          user={user} 
          onAddExpense={() => setView('ADD_EXPENSE')} 
        />
      )}
      
      {view === 'ADD_EXPENSE' && (
        <ExpenseForm 
          uid={user.uid}
          onBack={() => setView('DASHBOARD')}
          onSuccess={() => setView('DASHBOARD')}
        />
      )}
    </div>
  );
};

export default App;