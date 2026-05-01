"""
auth.py — Custom App Frappe: brain_sso
Módulo: Controle de Operações Financeiras

Endpoint SSO exposto como:
  GET /api/method/brain_sso.auth.login?token=<jwt>

Fluxo (Fase 2 — IMPLEMENTADO):
  1. Laravel gera JWT HS256 (TTL 60s) com payload: sub, tid, iat, exp, jti
  2. Usuário é redirecionado para este endpoint com o token
  3. Frappe valida assinatura HMAC-SHA256 com BRAIN_SSO_SECRET
  4. Frappe valida expiração e existência do usuário
  5. frappe.set_user(email) → sessão criada
  6. Redirect para /app (desk do ERPNext)

Configuração (site_config.json do Frappe):
  bench --site financeiro.test set-config brain_sso_secret "SEU_SEGREDO_AQUI"
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

import frappe
from frappe import _


# =============================================================================
# UTILITÁRIOS INTERNOS
# =============================================================================

def _safe_b64decode(data: str) -> bytes:
    """Decodifica Base64url com padding automático."""
    # Normaliza Base64url → Base64 padrão
    data = data.replace("-", "+").replace("_", "/")
    padding = (4 - len(data) % 4) % 4
    return base64.b64decode(data + "=" * padding)


def _validate_and_decode_jwt(token: str, secret: str) -> dict:
    """
    Valida um JWT HS256 gerado pelo ErpNextService::generateSsoToken() do Laravel.

    Verifica:
      - Estrutura (3 partes separadas por '.')
      - Assinatura HMAC-SHA256 (timing-safe compare)
      - Campo 'exp' (expiração)

    Returns:
        dict: payload decodificado com campos sub, tid, iat, exp, jti

    Raises:
        frappe.AuthenticationError: em qualquer falha de validação
    """
    parts = token.split(".")
    if len(parts) != 3:
        frappe.throw(_("Token SSO malformado."), frappe.AuthenticationError)

    header_b64, payload_b64, sig_b64 = parts

    # 1. Recalcula assinatura esperada
    message = f"{header_b64}.{payload_b64}".encode("utf-8")
    expected_sig = hmac.new(
        secret.encode("utf-8"),
        message,
        hashlib.sha256,
    ).digest()

    # 2. Compara com a assinatura recebida (timing-safe)
    try:
        received_sig = _safe_b64decode(sig_b64)
    except Exception:
        frappe.throw(_("Assinatura do token SSO inválida."), frappe.AuthenticationError)

    if not hmac.compare_digest(expected_sig, received_sig):
        frappe.throw(_("Assinatura do token SSO inválida."), frappe.AuthenticationError)

    # 3. Decodifica payload
    try:
        payload = json.loads(_safe_b64decode(payload_b64))
    except Exception:
        frappe.throw(_("Payload do token SSO inválido."), frappe.AuthenticationError)

    # 4. Valida expiração
    if payload.get("exp", 0) < int(time.time()):
        frappe.throw(_("Token SSO expirado. Tente acessar novamente."), frappe.AuthenticationError)

    return payload


# =============================================================================
# ENDPOINT PÚBLICO
# =============================================================================

@frappe.whitelist(allow_guest=True)
def login() -> None:
    """
    Endpoint SSO: valida JWT do Laravel e loga o usuário no Frappe.

    Acessível em: GET /api/method/brain_sso.auth.login?token=<jwt>

    Após autenticação bem-sucedida, redireciona para /app (dashboard ERPNext).
    """
    token: str = frappe.request.args.get("token", "").strip()

    if not token:
        frappe.throw(_("Token SSO ausente na requisição."), frappe.AuthenticationError)

    # Lê o segredo compartilhado do site_config.json do Frappe
    # Configurar via: bench --site <site> set-config brain_sso_secret "VALOR"
    secret: str | None = frappe.conf.get("brain_sso_secret")

    if not secret:
        frappe.log_error(
            title="brain_sso: Configuração ausente",
            message="A chave 'brain_sso_secret' não está definida em site_config.json.",
        )
        frappe.throw(
            _("Serviço SSO não configurado. Contate o administrador."),
            frappe.AuthenticationError,
        )

    # Valida e decodifica o JWT
    payload = _validate_and_decode_jwt(token, secret)

    email: str = payload.get("sub", "")

    if not email:
        frappe.throw(_("Token SSO não contém identificador de usuário."), frappe.AuthenticationError)

    # Verifica se o usuário existe no ERPNext
    if not frappe.db.exists("User", {"name": email, "enabled": 1}):
        frappe.throw(
            _("Usuário {0} não encontrado ou inativo no ERPNext. Ative o módulo novamente.").format(email),
            frappe.AuthenticationError,
        )

    # Efetua o login silencioso — cria a sessão Frappe
    frappe.local.login_manager.login_as(email)
    frappe.local.response["type"]     = "redirect"
    frappe.local.response["location"] = "/app"
