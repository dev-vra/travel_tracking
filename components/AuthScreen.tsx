import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, resetPassword } from '../services/firebase';
import { Button } from './Button';
import { Input } from './Input';
import { Plane, AlertCircle, ArrowLeft, Mail } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  // View States: 'LOGIN' | 'SIGNUP' | 'RESET'
  const [viewState, setViewState] = useState<'LOGIN' | 'SIGNUP' | 'RESET'>('LOGIN');
  
  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    // Validação de senha no cadastro
    if (viewState === 'SIGNUP' && password !== confirmPassword) {
      setError("As senhas digitadas não coincidem.");
      setLoading(false);
      return;
    }

    try {
      if (viewState === 'LOGIN') {
        await signInWithEmailAndPassword(auth, email, password);
      } else if (viewState === 'SIGNUP') {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      handleFirebaseError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await resetPassword(email);
      setSuccessMsg("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
      setTimeout(() => setViewState('LOGIN'), 5000); // Volta pro login após 5s
    } catch (err: any) {
      handleFirebaseError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFirebaseError = (err: any) => {
    let msg = "Ocorreu um erro inesperado.";
    if (err.code === 'auth/invalid-credential') msg = "E-mail ou senha incorretos.";
    if (err.code === 'auth/user-not-found') msg = "Usuário não encontrado.";
    if (err.code === 'auth/wrong-password') msg = "Senha incorreta.";
    if (err.code === 'auth/email-already-in-use') msg = "Este e-mail já está cadastrado.";
    if (err.code === 'auth/weak-password') msg = "A senha deve ter pelo menos 6 caracteres.";
    if (err.code === 'auth/invalid-email') msg = "Formato de e-mail inválido.";
    if (err.code === 'auth/too-many-requests') msg = "Muitas tentativas. Tente novamente mais tarde.";
    setError(msg);
  };

  // Renderização da Tela de Recuperação de Senha
  if (viewState === 'RESET') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-950 relative overflow-hidden">
        <div className="w-full max-w-md z-10">
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 p-8 rounded-3xl shadow-xl">
             <button 
                onClick={() => { setViewState('LOGIN'); setError(null); setSuccessMsg(null); }}
                className="mb-6 text-zinc-400 hover:text-white flex items-center gap-2 transition-colors"
             >
                <ArrowLeft className="w-4 h-4" /> Voltar para Login
             </button>
             
             <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Recuperar Senha</h2>
                <p className="text-zinc-400 text-sm">Digite seu e-mail e enviaremos um link para redefinir sua senha.</p>
             </div>

             <form onSubmit={handleResetPassword} className="space-y-6">
                <Input
                  label="Endereço de E-mail"
                  type="email"
                  placeholder="nomad@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                
                {successMsg && (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                        <Mail className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-emerald-200">{successMsg}</p>
                    </div>
                )}

                {error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-200">{error}</p>
                    </div>
                )}

                <Button type="submit" isLoading={loading}>
                  Enviar Link
                </Button>
             </form>
          </div>
        </div>
      </div>
    );
  }

  // Renderização da Tela de Login / Cadastro
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-950 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/10 rounded-full blur-[100px]" />

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl mb-4">
            <Plane className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">NomadLedger</h1>
          <p className="text-zinc-500 mt-2">Controle sua jornada, centavo por centavo.</p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 p-8 rounded-3xl shadow-xl">
          <div className="flex gap-4 mb-8 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
            <button
              onClick={() => { setViewState('LOGIN'); setError(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                viewState === 'LOGIN' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => { setViewState('SIGNUP'); setError(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                viewState === 'SIGNUP' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Criar Conta
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <Input
              label="Endereço de E-mail"
              type="email"
              placeholder="nomad@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {/* Campo Confirmar Senha (apenas no cadastro) */}
            {viewState === 'SIGNUP' && (
              <Input
                label="Confirmar Senha"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            )}

            {/* Link Esqueci Minha Senha (apenas no login) */}
            {viewState === 'LOGIN' && (
                <div className="flex justify-end">
                    <button 
                        type="button"
                        onClick={() => setViewState('RESET')}
                        className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
                    >
                        Esqueci minha senha
                    </button>
                </div>
            )}

            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <Button type="submit" isLoading={loading}>
              {viewState === 'LOGIN' ? 'Acessar Painel' : 'Começar Aventura'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};