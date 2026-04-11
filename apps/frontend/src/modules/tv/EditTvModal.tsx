"use client";
// =============================================================================
// src/modules/tv/EditTvModal.tsx
// =============================================================================
// O QUE FAZ:
//   Modal para editar os dados de uma TV já cadastrada.
//   Pré-preenche o formulário com os dados atuais do dispositivo
//   e chama PATCH /tv/devices/:id ao confirmar.
//
// POR QUE NÃO REUSAR O AddTvModal?
//   AddTvModal chama POST /tv/devices (criar) — EditTvModal chama
//   PATCH /tv/devices/:id (atualizar parcialmente). A semântica da ação
//   é diferente, assim como o título, texto do botão e o endpoint.
//   Componentes separados permite evoluir cada um de forma independente.
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
import { updateDevice } from "@/services/tv.service";
import type { TvDevice, RegisterTvDeviceInput } from "@/types/api";

// =============================================================================
// PROPS
// =============================================================================
interface EditTvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  /** TV cujos dados serão editados. `null` quando o modal está fechado. */
  device: TvDevice | null;
}

// =============================================================================
// COMPONENTE: EditTvModal
// =============================================================================
export function EditTvModal({
  isOpen,
  onClose,
  onSuccess,
  device,
}: EditTvModalProps) {
  const [form, setForm] = useState<RegisterTvDeviceInput>({
    name: "",
    ip_address: "",
    mac_address: undefined,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof RegisterTvDeviceInput, string>>
  >({});

  // Pré-preenche o formulário com os dados atuais da TV ao abrir
  // POR QUE useEffect e não useState inicial?
  //   O modal pode ser aberto para TVs diferentes — sem useEffect,
  //   os dados da TV anterior ficam no estado.
  useEffect(() => {
    if (isOpen && device) {
      setForm({
        name: device.name,
        ip_address: device.ip_address,
        mac_address: device.mac_address ?? undefined,
      });
      setErrors({});
    }
  }, [isOpen, device]);

  function handleClose() {
    setErrors({});
    onClose();
  }

  function handleChange(field: keyof RegisterTvDeviceInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value || undefined }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  // Validação espelhada do AddTvModal para consistência
  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!form.name?.trim()) newErrors.name = "Nome é obrigatório";
    if (!form.ip_address?.trim()) {
      newErrors.ip_address = "Endereço IP é obrigatório";
    } else {
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
    if (!device || !validate()) return;

    setIsLoading(true);
    try {
      const payload: Partial<RegisterTvDeviceInput> = {
        name: form.name!.trim(),
        ip_address: form.ip_address!.trim(),
        // Envia `undefined` para limpar o MAC ou o novo valor
        mac_address: form.mac_address?.trim() || undefined,
      };

      const result = await updateDevice(device.id, payload);
      onSuccess(result.mensagem ?? `TV "${result.device.name}" atualizada!`);
      handleClose();
    } catch (err) {
      setErrors({
        ip_address:
          err instanceof Error ? err.message : "Erro ao atualizar TV.",
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
            Editar TV — {device?.name}
          </DialogTitle>
          <DialogDescription>
            Atualize os dados de conexão desta TV. O IP e o MAC devem ser
            acessíveis pela rede do servidor.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome da TV */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-tv-name">Nome da TV *</Label>
            <Input
              id="edit-tv-name"
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
            <Label htmlFor="edit-tv-ip">Endereço IP *</Label>
            <Input
              id="edit-tv-ip"
              placeholder="Ex: 192.168.1.50"
              value={form.ip_address ?? ""}
              onChange={(e) => handleChange("ip_address", e.target.value)}
              hasError={!!errors.ip_address}
            />
            {errors.ip_address ? (
              <p className="text-xs text-destructive">{errors.ip_address}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                IP da TV na rede local do servidor.
              </p>
            )}
          </div>

          {/* MAC Address (opcional) */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-tv-mac">
              MAC Address{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Input
              id="edit-tv-mac"
              placeholder="Ex: AA:BB:CC:DD:EE:FF"
              value={form.mac_address ?? ""}
              onChange={(e) => handleChange("mac_address", e.target.value)}
              hasError={!!errors.mac_address}
            />
            {errors.mac_address ? (
              <p className="text-xs text-destructive">{errors.mac_address}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Necessário para Wake-on-LAN. Deixe vazio para remover.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading}>
              <Tv className="h-4 w-4" />
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
