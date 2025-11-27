import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { logoutUser, getUserExpenses } from '../services/firebase';
import { Expense, ExpenseCategory, CategorySummary } from '../types';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { LogOut, Plus, Receipt, Calendar, Download, Loader2, FilterX } from 'lucide-react';

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
  
  // Filtros de Data
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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

  // Lógica de Filtragem (Comparação de string YYYY-MM-DD evita bugs de timezone)
  const filteredExpenses = expenses.filter(expense => {
    if (startDate && expense.date < startDate) return false;
    if (endDate && expense.date > endDate) return false;
    return true;
  });

  // Calculations baseados nos filtrados
  const totalSpent = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  const categoryData: CategorySummary[] = Object.values(ExpenseCategory).map(cat => {
    const total = filteredExpenses
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

  // Função para Gerar CSV (Excel) Robusta
  const generateCSV = () => {
    try {
        if (filteredExpenses.length === 0) {
          alert("Não há despesas no período selecionado para exportar.");
          return;
        }

        const headers = ['Data', 'Descrição', 'Categoria', 'Valor', 'Moeda', 'Link Comprovante'];
        const csvRows = [headers.join(';')];

        for (const exp of filteredExpenses) {
            // Formatação manual da data para DD/MM/AAAA para evitar que o new Date() 
            // subtraia um dia devido ao fuso horário do navegador
            const [ano, mes, dia] = exp.date.split('-');
            const dataFormatada = `${dia}/${mes}/${ano}`;
            
            // Escapar aspas duplas na descrição
            const descricaoSegura = `"${exp.description.replace(/"/g, '""')}"`;

            const row = [
                dataFormatada,
                descricaoSegura,
                exp.category,
                exp.amount.toFixed(2).replace('.', ','), // Formato 10,50
                exp.currency,
                exp.receiptUrl || ''
            ];
            csvRows.push(row.join(';'));
        }

        // Adiciona BOM para o Excel reconhecer acentuação (UTF-8)
        const csvString = csvRows.join('\n');
        const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
        
        // Cria link de download
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `nomad_relatorio_${startDate || 'inicio'}_ate_${endDate || 'fim'}.csv`;
        
        document.body.appendChild(link);
        link.click();
        
        // Limpeza
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Erro ao gerar CSV:", error);
        alert("Ocorreu um erro ao gerar o arquivo. Verifique o console para mais detalhes.");
    }
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 relative">
      {/* Header */}
      <header className="px-6 pt-8 pb-6 bg-zinc-900 border-b border-zinc-800">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Visão Geral</h1>
            <p className="text-sm text-zinc-400 mt-1 truncate max-w-[200px]">{user.email}</p>
          </div>
          <button 
            onClick={logoutUser}
            className="p-2 bg-zinc-950 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800 transition-all"
            aria-label="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Filtros de Data */}
        <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50 mb-6 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Período
                </span>
                {(startDate || endDate) && (
                    <button 
                        onClick={clearFilters}
                        className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1"
                    >
                        <FilterX className="w-3 h-3" /> Limpar Filtros
                    </button>
                )}
            </div>
            <div className="flex gap-3">
                <div className="flex-1">
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none placeholder-zinc-600"
                    />
                </div>
                <div className="flex items-center text-zinc-600">até</div>
                <div className="flex-1">
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none placeholder-zinc-600"
                    />
                </div>
            </div>
        </div>

        {/* Total Card */}
        <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6 border border-zinc-700/50 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 p-24 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          <div className="relative z-10 flex justify-between items-end">
             <div>
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-1">Total no Período</p>
                <h2 className="text-3xl font-bold text-white tracking-tight">
                {formatCurrency(totalSpent)}
                </h2>
             </div>
             
             {/* Botão de Exportar */}
             <button 
                onClick={generateCSV}
                className="p-3 bg-zinc-700/50 hover:bg-zinc-700 text-emerald-400 rounded-xl border border-zinc-600/50 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                title="Baixar Relatório Excel"
                type="button"
             >
                <Download className="w-5 h-5" />
                <span className="text-xs font-medium hidden sm:inline">CSV</span>
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
        
        {/* Chart Section (Donut Chart) */}
        {categoryData.length > 0 ? (
          <div className="space-y-4">
             <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Detalhamento</h3>
             <div className="flex flex-col md:flex-row items-center gap-6 bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800/50">
                {/* Gráfico Donut com tamanho fixo */}
                <div className="h-48 w-48 shrink-0 relative flex items-center justify-center mx-auto md:mx-0">
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
        ) : (
            <div className="p-6 text-center border border-dashed border-zinc-800 rounded-2xl">
                <p className="text-zinc-500 text-sm">Nenhum dado para o gráfico neste período.</p>
            </div>
        )}

        {/* Recent List */}
        <div className="space-y-4">
           <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
               {startDate || endDate ? 'Transações Filtradas' : 'Todas Transações'}
               <span className="ml-2 text-zinc-600 text-xs font-normal normal-case">
                   ({filteredExpenses.length} itens)
               </span>
           </h3>
           
           {loading ? (
             <div className="flex flex-col items-center justify-center py-10 text-zinc-600">
               <Loader2 className="w-6 h-6 animate-spin mb-2" />
               <p>Carregando dados...</p>
             </div>
           ) : filteredExpenses.length === 0 ? (
             <div className="text-center py-10 border border-dashed border-zinc-800 rounded-xl">
               <Receipt className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
               <p className="text-zinc-500">Nenhuma despesa encontrada.</p>
             </div>
           ) : (
             <div className="space-y-3">
               {filteredExpenses.map((expense) => (
                 <div key={expense.id} className="group flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-emerald-500/30 transition-colors">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-zinc-200">{expense.description}</span>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400" style={{ color: CATEGORY_COLORS[expense.category] }}>
                            {expense.category}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {/* Conversão manual para evitar erro de Timezone no display */}
                          {expense.date.split('-').reverse().join('/')}
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