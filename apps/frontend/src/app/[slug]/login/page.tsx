"use client";
// =============================================================================
// src/app/[slug]/login/page.tsx
// =============================================================================
// O QUE FAZ:
//   Página de login do tenant. Exibe formulário com e-mail e senha.
//   Ao autenticar com sucesso, redireciona para /<slug>/dashboard.
//
//   IMPORTANTE: Esta página usa o endpoint /dev/token que é de desenvolvimento.
//   Em produção, o backend deve expor um endpoint de login com produção segura.
// =============================================================================

import type { Metadata } from "next";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { login } from "@/services/auth.service";
import { TOKEN_KEY, TENANT_SLUG_KEY } from "@/services/api";
import { isJwtExpired } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Se já estiver autenticado, vai direto para dashboard
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && !isJwtExpired(token)) {
      router.replace(`/${slug}/dashboard`);
    }
  }, [slug, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Preencha e-mail e senha.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Salva slug no localStorage ANTES, pois o serviço de login pode precisar
      localStorage.setItem(TENANT_SLUG_KEY, slug);

      await login({ email, password }, slug);
      router.push(`/${slug}/dashboard`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao fazer login. Verifique suas credenciais.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      {/* Card central de login */}
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-1 text-center">
          {/* Logo placeholder */}
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold">
            {slug.charAt(0).toUpperCase()}
          </div>
          <CardTitle className="text-2xl">Entrar</CardTitle>
          <CardDescription className="font-mono text-xs">
            {slug}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* E-mail */}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                hasError={!!error}
              />
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  hasError={!!error}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Mensagem de erro */}
            {error && (
              <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
                {error}
              </p>
            )}

            {/* Botão submit */}
            <Button type="submit" className="w-full" isLoading={isLoading}>
              <LogIn className="mr-2 h-4 w-4" />
              Entrar
            </Button>
          </form>

          {/* Nota de desenvolvimento */}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Ambiente de desenvolvimento &mdash; endpoint <code>/dev/token</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
