"""
hooks.py — Configurações do Custom App brain_sso para o Frappe Framework.

Registra o app no Frappe sem interferir no comportamento padrão do ERPNext.
"""

app_name         = "brain_sso"
app_title        = "Brain SSO"
app_publisher    = "meuSistemaCompleto"
app_description  = "SSO entre o Cérebro (Laravel) e o Músculo (ERPNext) — Controle de Operações Financeiras"
app_version      = "1.0.0"
app_icon         = "octicon octicon-key"
app_color        = "#2563EB"
app_email        = "admin@meusistema.com"
app_license      = "MIT"

# Rotas whitelisted (além das decoradas com @frappe.whitelist)
# Não é necessário registrar aqui pois o decorador já cuida disso.

# Override de página de login (opcional — Fase 4: Branding)
# page_js = {"login": "public/js/login_override.js"}
