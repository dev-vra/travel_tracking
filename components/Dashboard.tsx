import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { logoutUser, getUserExpenses } from '../services/firebase';
import { Expense, ExpenseCategory, CategorySummary } from '../types';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { LogOut, Plus, Wallet, Receipt, Calendar, Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);

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

  // Função para Gerar PDF
  const generatePDF = () => {
    if (expenses.length === 0) {
      alert("Não há despesas cadastradas para gerar o relatório.");
      return;
    }

    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.text("Relatório de Despesas - NomadLedger", 14, 22);
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Usuário: ${user.email}`, 14, 30);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 36);
      doc.text(`Total Gasto: ${formatCurrency(totalSpent)}`, 14, 42);

      // Tabela
      const tableData = expenses.map(exp => [
          new Date(exp.date).toLocaleDateString('pt-BR'),
          exp.description,
          exp.category,
          `${exp.currency} ${exp.amount.toFixed(2)}`,
          exp.receiptUrl ? 'Link' : '-' // Placeholder para o link
      ]);

      autoTable(doc, {
          head: [['Data', 'Descrição', 'Categoria', 'Valor', 'Comprovante']],
          body: tableData,
          startY: 50,
          theme: 'grid',
          headStyles: { fillColor: [16, 185, 129] }, // Emerald 500
          didDrawCell: (data) => {
              // Adicionar link clicável na coluna de Comprovante
              if (data.section === 'body' && data.column.index === 4) {
                  const expense = expenses[data.row.index];
                  if (expense.receiptUrl) {
                      doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: expense.receiptUrl });
                  }
              }
          }
      });

      doc.save(`relatorio_despesas_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar o PDF. Tente novamente.");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 relative">
      {/* Header */}
      <header className="px-6 pt-12 pb-6 bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-800">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Visão Geral</h1>
            <p className="text-sm text-zinc-400 mt-1 truncate max-w-[200px]">{user.email}</p>
          </div>
          <button 
            onClick={logoutUser}
            className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800 transition-all"
            aria-label="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Total Card */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 shadow-xl shadow-black/50 relative overflow-hidden">
          <div className="absolute right-0 top-0 p-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          <div className="relative z-10 flex justify-between items-end">
             <div>
                <p className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-1">Total Gasto</p>
                <h2 className="text-4xl font-bold text-white tracking-tight">
                {formatCurrency(totalSpent)}
                </h2>
                <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 w-fit px-2 py-1 rounded-md">
                    <Wallet className="w-3 h-3" />
                    <span>Total Global (BRL)</span>
                </div>
             </div>
             
             {/* Botão de Exportar */}
             <button 
                onClick={generatePDF}
                className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl border border-zinc-700 transition-all flex flex-col items-center gap-1 active:scale-95"
                title="Baixar Relatório PDF"
             >
                <Download className="w-5 h-5" />
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
        
        {/* Chart Section (Donut Chart) */}
        {categoryData.length > 0 && (
          <div className="space-y-4">
             <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Detalhamento</h3>
             <div className="flex flex-col md:flex-row items-center gap-6 bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800/50">
                {/* Gráfico Donut com tamanho fixo para evitar erro de redimensionamento */}
                <div className="h-48 w-48 shrink-0 relative flex items-center justify-center">
                   <PieChart width={192} height={192}>
                        <Pie
                          data={categoryData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                            formatter={(value: number) => formatCurrency(value)}
                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }}
                            itemStyle={{ color: '#f4f4f5' }}
                        />
                   </PieChart>
                   {/* Texto no meio do Donut */}
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-xs font-semibold text-zinc-500">CATEGORIAS</span>
                   </div>
                </div>

                {/* Legenda Lateral */}
                <div className="flex-1 w-full grid grid-cols-1 gap-3">
                    {categoryData.map((cat) => (
                        <div key={cat.name} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-zinc-800/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full shadow-[0_0_10px]" style={{ backgroundColor: cat.color, boxShadow: `0 0 10px ${cat.color}40` }} />
                                <span className="text-sm font-medium text-zinc-300">{cat.name}</span>
                            </div>
                            <span className="text-sm font-semibold text-white">{formatCurrency(cat.value)}</span>
                        </div>
                    ))}
                </div>
             </div>
          </div>
        )}

        {/* Recent List */}
        <div className="space-y-4">
           <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Transações Recentes</h3>
           {loading ? (
             <div className="flex flex-col items-center justify-center py-10 text-zinc-600">
               <Loader2 className="w-6 h-6 animate-spin mb-2" />
               <p>Carregando dados...</p>
             </div>
           ) : expenses.length === 0 ? (
             <div className="text-center py-10 border border-dashed border-zinc-800 rounded-xl">
               <Receipt className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
               <p className="text-zinc-500">Nenhuma despesa ainda.</p>
             </div>
           ) : (
             <div className="space-y-3">
               {expenses.map((expense) => (
                 <div key={expense.id} className="group flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-emerald-500/30 transition-colors">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-zinc-200">{expense.description}</span>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400" style={{ color: CATEGORY_COLORS[expense.category] }}>
                            {expense.category}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(expense.date).toLocaleDateString('pt-BR')}
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
                          <Receipt className="w-3 h-3" /> Ver Comprovante
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
          aria-label="Adicionar Despesa"
        >
          <Plus className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
};