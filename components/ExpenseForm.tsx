import React, { useState } from 'react';
import { Button } from './Button';
import { Input, Select } from './Input';
import { ExpenseCategory, Currency } from '../types';
import { addExpenseToFirestore, uploadReceipt } from '../services/firebase';
import { ArrowLeft, Camera, CheckCircle2, X, AlertCircle } from 'lucide-react';

interface ExpenseFormProps {
  uid: string;
  onBack: () => void;
  onSuccess: () => void;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ uid, onBack, onSuccess }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>(Currency.BRL);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<ExpenseCategory>(ExpenseCategory.FOOD);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let receiptUrl = '';
      
      // Lógica de Upload com tratamento de falha parcial
      if (file) {
        try {
            receiptUrl = await uploadReceipt(file, uid);
        } catch (uploadErr: any) {
            console.error("Upload failed", uploadErr);
            
            // Tratamento específico de erros conhecidos
            if (uploadErr.code === 'storage/unauthorized') {
                throw new Error("Permissão negada no Storage. Vá em Firebase Console > Storage > Rules e mude para 'allow read, write: if true;'");
            }

            if (uploadErr.message === "TIMEOUT_UPLOAD" || uploadErr.code === 'storage/retry-limit-exceeded') {
                const prosseguir = window.confirm(
                    "O upload da imagem está demorando muito. Deseja salvar a despesa SEM o comprovante?"
                );
                if (!prosseguir) {
                    throw new Error("Upload cancelado.");
                }
                receiptUrl = ''; 
            } else {
                throw new Error("Falha ao enviar imagem: " + uploadErr.message);
            }
        }
      }

      // Lógica do Firestore
      try {
        await addExpenseToFirestore({
            uid,
            description,
            amount: parseFloat(amount),
            currency,
            date,
            category,
            receiptUrl,
            createdAt: Date.now(),
        });
      } catch (dbErr: any) {
          console.error("Firestore failed", dbErr);
          if (dbErr.code === 'permission-denied') {
            throw new Error("Permissão negada no Banco de Dados. Verifique as Regras do Firestore.");
          }
          throw new Error("Falha ao salvar dados. Verifique sua conexão.");
      }

      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao salvar despesa. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4 flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-semibold text-white">Nova Despesa</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-32">
        <form id="expense-form" onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <Input
              label="O que você comprou?"
              placeholder="ex: Jantar no Mario's"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
            
            <div className="flex gap-4">
              <div className="flex-[2]">
                <Input
                  label="Valor"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="flex-1">
                <Select
                  label="Moeda"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  options={[
                    { value: Currency.BRL, label: 'BRL' },
                    { value: Currency.USD, label: 'USD' },
                    { value: Currency.EUR, label: 'EUR' },
                  ]}
                />
              </div>
            </div>

            <Input
              label="Data"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />

            <Select
              label="Categoria"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              options={Object.values(ExpenseCategory).map(cat => ({ value: cat, label: cat }))}
            />
          </div>

          {/* Receipt Upload */}
          <div className="space-y-2">
             <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">
                Comprovante (Opcional)
            </label>
            <div className="relative group">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className={`
                flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed transition-all
                ${file 
                  ? 'border-emerald-500/50 bg-emerald-500/5' 
                  : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-700'
                }
              `}>
                {file ? (
                  <>
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-emerald-400">{file.name}</p>
                      <p className="text-xs text-emerald-500/60 mt-1">Clique para alterar</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-zinc-800 rounded-full text-zinc-400 group-hover:scale-110 transition-transform">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-zinc-300">Toque para fotografar</p>
                      <p className="text-xs text-zinc-500 mt-1">ou selecione da galeria</p>
                    </div>
                  </>
                )}
              </div>
            </div>
            {file && (
              <button 
                type="button"
                onClick={() => setFile(null)}
                className="text-xs text-red-400 flex items-center gap-1 hover:text-red-300 ml-1"
              >
                <X className="w-3 h-3" /> Remover comprovante
              </button>
            )}
          </div>
          
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

        </form>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950 border-t border-zinc-800 pb-8">
         <div className="max-w-lg mx-auto">
            <Button 
              type="submit" 
              form="expense-form" 
              isLoading={loading}
            >
              Salvar Despesa
            </Button>
         </div>
      </div>
    </div>
  );
};