"use client";
// =============================================================================
// src/modules/tv/AddTvModal.tsx
// =============================================================================
// O QUE FAZ:
//   Modal para cadastrar uma nova TV no sistema do tenant.
//   Coleta: Nome da TV, Endereço IP e (opcionalmente) MAC Address.
//   Após o cadastro, emite callback de sucesso para atualizar a grade.
// =============================================================================

import { useState, useEffect } from "react";
import { Tv } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerDevice } from "@/services/tv.service";
import type { RegisterTvDeviceInput } from "@/types/api";

// =============================================================================
// PROPS
// =============================================================================
interface AddTvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  /**
   * Valores iniciais opcionais para pré-preencher o formulário.
   * POR QUE? Permite que o DiscoverModal passe o IP descoberto via SSDP
   * diretamente para o cadastro, evitando que o usuário precise digitar.
   */
  initialValues?: Partial<RegisterTvDeviceInput>;
}

// Estado inicial do formulário (facilita o reset ao fechar)
const INITIAL_FORM: RegisterTvDeviceInput = {
  name: "",
  ip_address: "",
  mac_address: undefined,
};

// =============================================================================
// COMPONENTE: AddTvModal
// =============================================================================
export function AddTvModal({
  isOpen,
  onClose,
  onSuccess,
  initialValues,
}: AddTvModalProps) {
  const [form, setForm] = useState<RegisterTvDeviceInput>(INITIAL_FORM);

  // Reinicializa o formulário sempre que o modal abre
  // POR QUE no isOpen e não uma única vez? O usuário pode fechar e abrir
  // o modal várias vezes com IPs diferentes (descoberta de múltiplas TVs).
  useEffect(() => {
    if (isOpen) {
      setForm({ ...INITIAL_FORM, ...(initialValues ?? {}) });
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof RegisterTvDeviceInput, string>>
  >({});

  function handleClose() {
    setForm(INITIAL_FORM);
    setErrors({});
    onClose();
  }

  // Atualiza um campo específico do formulário
  function handleChange(field: keyof RegisterTvDeviceInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value || undefined }));
    // Limpa o erro deste campo ao começar a digitar
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  // Validação básica no frontend antes de chamar o Backend
  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!form.name?.trim()) newErrors.name = "Nome é obrigatório";
    if (!form.ip_address?.trim()) {
      newErrors.ip_address = "Endereço IP é obrigatório";
    } else {
      // Validação simples de IP (o Backend valida mais rigorosamente com Zod)
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(form.ip_address)) {
        newErrors.ip_address = "Formato inválido. Ex: 192.168.1.10";
      }
    }
    if (form.mac_address) {
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      if (!macRegex.test(form.mac_address)) {
        newErrors.mac_address = "Formato inválido. Ex: AA:BB:CC:DD:EE:FF";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      // Remove campos opcionais vazios antes de enviar
      const payload: RegisterTvDeviceInput = {
        name: form.name!.trim(),
        ip_address: form.ip_address!.trim(),
        ...(form.mac_address?.trim() && {
          mac_address: form.mac_address.trim(),
        }),
      };

      const result = await registerDevice(payload);
      onSuccess(result.mensagem ?? `TV "${result.device.name}" cadastrada!`);
      handleClose();
    } catch (err) {
      setErrors({
        ip_address:
          err instanceof Error ? err.message : "Erro ao cadastrar TV.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tv className="h-4 w-4 text-primary" />
            Adicionar nova TV
          </DialogTitle>
          <DialogDescription>
            Preencha os dados da TV que deseja controlar remotamente. O IP deve
            ser acessível pela rede do servidor.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome da TV */}
          <div className="space-y-1.5">
            <Label htmlFor="tv-name">Nome da TV *</Label>
            <Input
              id="tv-name"
              placeholder="Ex: TV Recepção, TV Sala Principal"
              value={form.name ?? ""}
              onChange={(e) => handleChange("name", e.target.value)}
              hasError={!!errors.name}
              autoFocus
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Endereço IP */}
          <div className="space-y-1.5">
            <Label htmlFor="tv-ip">Endereço IP *</Label>
            <Input
              id="tv-ip"
              placeholder="Ex: 192.168.1.50"
              value={form.ip_address ?? ""}
              onChange={(e) => handleChange("ip_address", e.target.value)}
              hasError={!!errors.ip_address}
            />
            {errors.ip_address ? (
              <p className="text-xs text-destructive">{errors.ip_address}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                IP da TV na rede local. Use a varredura SSDP para descobrir
                automaticamente.
              </p>
            )}
          </div>

          {/* MAC Address (opcional) */}
          <div className="space-y-1.5">
            <Label htmlFor="tv-mac">
              MAC Address{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Input
              id="tv-mac"
              placeholder="Ex: AA:BB:CC:DD:EE:FF"
              value={form.mac_address ?? ""}
              onChange={(e) => handleChange("mac_address", e.target.value)}
              hasError={!!errors.mac_address}
            />
            {errors.mac_address ? (
              <p className="text-xs text-destructive">{errors.mac_address}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Necessário para Wake-on-LAN (ligar a TV remotamente).
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading}>
              <Tv className="h-4 w-4" />
              Adicionar TV
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
