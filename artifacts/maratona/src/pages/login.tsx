import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trophy, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.user);
        setLocation("/");
      },
      onError: (err: { message?: string }) => {
        toast({ title: "Acesso Negado", description: err?.message ?? "Credenciais corporativas inválidas", variant: "destructive" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email, password } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-[40vh] bg-sidebar pointer-events-none" />
      <div className="absolute top-1/4 left-0 w-full h-px bg-sidebar-accent pointer-events-none opacity-50" />
      
      <div className="w-full max-w-[420px] px-6 relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/20 rotate-3 transition-transform hover:rotate-0 duration-300">
            <Trophy size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight leading-tight uppercase">Maratona de</h1>
          <h1 className="text-3xl font-black text-primary tracking-tight leading-tight uppercase">Resultados</h1>
        </div>

        <Card className="border-none shadow-xl shadow-slate-200/50 bg-white rounded-2xl overflow-hidden">
          <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-800">Acesso Corporativo</p>
              <p className="text-xs font-medium text-slate-500">Cenográfica Eventos</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
              <span className="text-[10px] font-black text-slate-500">CE</span>
            </div>
          </div>
          
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="font-semibold text-slate-700">E-mail Corporativo</Label>
                <Input
                  id="email"
                  data-testid="input-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@cenografica.com.br"
                  className="h-12 bg-slate-50 border-slate-200 focus-visible:ring-primary focus-visible:border-primary"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="font-semibold text-slate-700">Senha</Label>
                </div>
                <Input
                  id="password"
                  data-testid="input-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 bg-slate-50 border-slate-200 focus-visible:ring-primary focus-visible:border-primary"
                  required
                />
              </div>
              
              <Button
                data-testid="button-submit-login"
                type="submit"
                className="w-full h-12 text-base font-bold shadow-md shadow-primary/20 group mt-4"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Autenticando..." : (
                  <>Acessar Plataforma <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" /></>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <p className="text-center text-xs font-medium text-slate-400 mt-8 uppercase tracking-widest">
          Sistema Exclusivo • Uso Restrito
        </p>
      </div>
    </div>
  );
}
