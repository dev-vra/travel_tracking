import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { logoutUser, getUserExpenses } from '../services/firebase';
import { Expense, ExpenseCategory, CategorySummary } from '../types';
import { Button } from './Button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { LogOut, Plus, Wallet, Receipt, Calendar } from 'lucide-react';

interface DashboardProps {
  user: User;
  onAddExpense: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  [ExpenseCategory.FOOD]: '#10b981', // emerald-500
  [ExpenseCategory.TRANSPORT]: '#3b82f6', // blue-500
  [ExpenseCategory.STAY]: '#8b5cf6', // violet-500
  [ExpenseCategory.OTHER]: '#f59e0b', // amber-500
};

export const Dashboard: React.FC<DashboardProps> = ({ user, onAddExpense }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (user.uid) {
        const data = await getUserExpenses(user.uid);
        setExpenses(data);
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // Calculations
  const totalSpent = expenses.reduce((acc, curr) => {
    // Note: Assuming everything is converted to BRL for prototype simplicity as per prompt
    // In a real app, we would use an exchange rate API here.
    return acc + curr.amount; 
  }, 0);

  const categoryData: CategorySummary[] = Object.values(ExpenseCategory).map(cat => {
    const total = expenses
      .filter(e => e.category === cat)
      .reduce((acc, curr) => acc + curr.amount, 0);
    return {
      name: cat,
      value: total,
      color: CATEGORY_COLORS[cat]
    };
  }).filter(c => c.value > 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 relative">
      {/* Header */}
      <header className="px-6 pt-12 pb-6 bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-800">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Overview</h1>
            <p className="text-sm text-zinc-400 mt-1 truncate max-w-[200px]">{user.email}</p>
          </div>
          <button 
            onClick={logoutUser}
            className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800 transition-all"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Total Card */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 shadow-xl shadow-black/50 relative overflow-hidden">
          <div className="absolute right-0 top-0 p-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          <div className="relative z-10">
            <p className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-1">Total Spent</p>
            <h2 className="text-4xl font-bold text-white tracking-tight">
              {formatCurrency(totalSpent)}
            </h2>
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 w-fit px-2 py-1 rounded-md">
              <Wallet className="w-3 h-3" />
              <span>Global Total (BRL)</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
        
        {/* Chart Section */}
        {categoryData.length > 0 && (
          <div className="space-y-4">
             <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Breakdown</h3>
             <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData}>
                    <XAxis dataKey="name" hide />
                    <Tooltip 
                      cursor={{fill: '#27272a'}}
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }}
                      itemStyle={{ color: '#f4f4f5' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             </div>
             
             {/* Legend/List */}
             <div className="grid grid-cols-1 gap-3">
               {categoryData.map((cat) => (
                 <div key={cat.name} className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm font-medium text-zinc-300">{cat.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-white">{formatCurrency(cat.value)}</span>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* Recent List (Simple view) */}
        <div className="space-y-4">
           <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Recent Transactions</h3>
           {loading ? (
             <div className="text-center py-10 text-zinc-600 animate-pulse">Loading data...</div>
           ) : expenses.length === 0 ? (
             <div className="text-center py-10 border border-dashed border-zinc-800 rounded-xl">
               <Receipt className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
               <p className="text-zinc-500">No expenses yet.</p>
             </div>
           ) : (
             <div className="space-y-3">
               {expenses.map((expense) => (
                 <div key={expense.id} className="group flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-emerald-500/30 transition-colors">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-zinc-200">{expense.description}</span>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{expense.category}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(expense.date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-emerald-400">
                        {expense.currency} {expense.amount.toFixed(2)}
                      </span>
                      {expense.receiptUrl && (
                        <a 
                          href={expense.receiptUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <Receipt className="w-3 h-3" /> View Receipt
                        </a>
                      )}
                    </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-6 z-30">
        <button
          onClick={onAddExpense}
          className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-full p-4 shadow-lg shadow-emerald-500/30 transition-transform active:scale-95 flex items-center justify-center"
        >
          <Plus className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
};