import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-3">
            <AlertCircle className="h-8 w-8 shrink-0 text-destructive" aria-hidden="true" />
            <h1 className="text-2xl font-bold">Página não encontrada</h1>
          </div>

          <p className="text-sm text-muted-foreground">
            O endereço que você abriu não existe ou foi movido.
          </p>

          <Button asChild className="mt-6">
            <a href={`${base}/`}>Voltar ao início</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
