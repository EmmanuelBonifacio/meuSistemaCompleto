// =============================================================================
// src/modules/tv/tv.service.ts
// =============================================================================
// O QUE FAZ:
//   Camada de SERVIÇO do módulo TV. É o único lugar que conhece os protocolos
//   de comunicação com Smart TVs: SSDP, UPnP e DIAL.
//   O controller não sabe nada sobre SOAP ou UDP multicast — ele apenas chama
//   funções deste arquivo.
//
// A JORNADA DE UM COMANDO (como o URL chega ao browser da TV):
// ─────────────────────────────────────────────────────────────
//
//   PARA MÍDIA (video/image) — UPnP AVTransport:
//   ┌─────────────┐ POST /tv/control  ┌─────────────┐  SOAP HTTP   ┌──────────────┐
//   │  Aplicação  │ ────────────────► │  tv.service  │ ───────────► │   Smart TV   │
//   │  (browser)  │                   │  (este arq.) │  SetAVTransportURI + Play   │
//   └─────────────┘                   └─────────────┘              └──────────────┘
//
//   PARA WEB (web app / URL) — Protocolo DIAL:
//   ┌─────────────┐ POST /tv/control  ┌─────────────┐  HTTP POST   ┌──────────────┐
//   │  Aplicação  │ ────────────────► │  tv.service  │ ───────────► │   Smart TV   │
//   │  (browser)  │                   │  (este arq.) │  /apps/      │  (abre URL   │
//   └─────────────┘                   └─────────────┘  Browser     │  no browser) │
//                                                                   └──────────────┘
//
// OS TRÊS PROTOCOLOS:
//
//   1. SSDP (Simple Service Discovery Protocol)
//      ▪ Protocolo de descoberta UDP multicast
//      ▪ Endereço multicast: 239.255.255.250, porta 1900
//      ▪ A TV "anuncia" sua presença periodicamente — um beacon de existência
//      ▪ Nossa app envia M-SEARCH e aguarda as respostas
//      ▪ A resposta contém LOCATION: http://tv-ip:port/device-description.xml
//      ▪ Usamos o pacote 'node-ssdp' para abstrair o UDP multicast
//
//   2. UPnP AVTransport (Universal Plug and Play — Audio/Video Transport)
//      ▪ Protocolo de controle de mídia baseado em SOAP sobre HTTP
//      ▪ SOAP = Simple Object Access Protocol (XML dentro de POST HTTP)
//      ▪ O dispositivo expõe um "endpoint de controle" (ex: /upnp/control/AVTransport1)
//      ▪ Enviamos SetAVTransportURI(url) + Play() → a TV toca o conteúdo
//      ▪ Compatível com: Samsung, LG, Sony, DLNA renderers, Kodi, VLC, etc.
//      ▪ Implementado aqui manualmente com fetch() — sem biblioteca extra
//
//   3. DIAL (Discovery and Launch)
//      ▪ Protocolo desenvolvido pelo YouTube/Google para lançar aplicativos
//      ▪ Usado por: Chromecast, Samsung Smart TV, LG Smart TV, Roku, Amazon Fire
//      ▪ O cliente faz POST para http://tv-ip:dialPort/apps/{appName}
//      ▪ Body: URL-encoded parameters (ex: url=https%3A%2F%2Fmeu-site.com)
//      ▪ A TV abre o app (ex: Browser, YouTube) com os parâmetros fornecidos
//      ▪ Para URL genérica, usamos app = "Aplications" ou "Browser"
//        (não existe app universal — cada fabricante tem seu nome)
//
// LIMITAÇÃO REAL (importante entender):
//   Nem toda Smart TV suporta todos os protocolos.
//   - TVs Samsung Tizen: DIAL na porta 8001, UPnP funciona bem
//   - TVs LG WebOS: DIAL na porta 3000, websocket na 3000
//   - TVs Sony Bravia: UPnP + REST API proprietária
//   - TVs com Android TV: Chromecast (DIAL 8008) + ADB
//   - Monitores DLNA/Chromecast: DIAL puro
//   Para ambientes corporativos (Digital Signage profissional), o ideal é
//   usar um sistema dedicado (BrightSign, Screenly, etc.) ou a TV exposta
//   com um app web que receba WebSocket.
// =============================================================================

import { Client as SsdpClient } from "node-ssdp";

// =============================================================================
// TIPO: DiscoveredDevice
// =============================================================================
// Representa um dispositivo encontrado na busca SSDP.
// 'location' é a URL do XML de descrição do dispositivo (Device Description URL).
// =============================================================================
export interface DiscoveredDevice {
  ip: string; // IP onde o dispositivo respondeu
  location: string; // URL do arquivo de descrição UPnP (device description XML)
  usn: string; // Unique Service Name — identificador global único do device
  server: string; // String de identificação do servidor (ex: "Samsung/SmartTV")
  st: string; // Search Target que retornou esse dispositivo
}

// =============================================================================
// TIPO: SendContentResult
// =============================================================================
export interface SendContentResult {
  success: boolean;
  protocol: "upnp" | "dial" | "none";
  message: string;
  tvResponse?: string; // Resposta HTTP bruta da TV (útil para debug)
}

// =============================================================================
// FUNÇÃO: discoverTvDevices
// =============================================================================
// O QUE FAZ:
//   Varre a rede local em busca de dispositivos UPnP/DLNA/DIAL usando SSDP.
//   Retorna todos os dispositivos que responderam dentro do tempo limite.
//
// COMO FUNCIONA:
//   1. Cria um cliente SSDP (node-ssdp)
//   2. Envia M-SEARCH para 239.255.255.250:1900 (multicast UPnP)
//   3. Aguarda respostas por `timeoutMs` milissegundos
//   4. Deduplica por IP (um dispositivo pode responder múltiplas vezes para
//      diferentes service targets — ST)
//   5. Para e resolve a Promise com a lista encontrada
//
// PARÂMETRO: timeoutMs
//   Padrão 5000ms (5 segundos). Aumente para redes lentas.
//   Em redes corporativas com segmentação, ajuste o roteador para
//   encaminhar SSDP multicast (IGMP snooping).
// =============================================================================
export function discoverTvDevices(
  timeoutMs = 5000,
): Promise<DiscoveredDevice[]> {
  return new Promise((resolve) => {
    const client = new SsdpClient();
    const devices: DiscoveredDevice[] = [];
    const seenIps = new Set<string>(); // evita duplicatas por IP

    // -------------------------------------------------------------------------
    // EVENTO: 'response'
    // -------------------------------------------------------------------------
    // Disparado cada vez que um dispositivo responde ao M-SEARCH.
    // `headers` contém os cabeçalhos da resposta SSDP.
    // `rinfo` contém o IP e porta de onde veio a resposta (remoteInfo).
    // -------------------------------------------------------------------------
    client.on("response", (headers, _statusCode, rinfo) => {
      const ip = rinfo.address;

      // Filtramos IPs já vistos (o mesmo dispositivo pode responder
      // a múltiplos M-SEARCH targets — queremos apenas uma entrada por IP)
      if (seenIps.has(ip)) return;
      seenIps.add(ip);

      devices.push({
        ip,
        location: (headers as Record<string, string>).LOCATION ?? "",
        usn: (headers as Record<string, string>).USN ?? "",
        server: (headers as Record<string, string>).SERVER ?? "Desconhecido",
        st: (headers as Record<string, string>).ST ?? "",
      });
    });

    // -------------------------------------------------------------------------
    // BUSCA: M-SEARCH para múltiplos Service Targets
    // -------------------------------------------------------------------------
    // "ssdp:all" captura qualquer dispositivo UPnP
    // "MediaRenderer:1" foca em telas/TVs com capacidade de renderização
    // "dial-multiscreen" foca em devices com suporte ao protocolo DIAL
    // -------------------------------------------------------------------------
    client.search("ssdp:all");
    client.search("urn:schemas-upnp-org:device:MediaRenderer:1");
    client.search("urn:dial-multiscreen-org:device:dial:1");

    // Após o timeout: para o cliente SSDP e resolve a promise com os resultados
    setTimeout(() => {
      client.stop();
      resolve(devices);
    }, timeoutMs);
  });
}

// =============================================================================
// FUNÇÃO: sendContentToDevice
// =============================================================================
// O QUE FAZ:
//   Envia uma URL de conteúdo para uma Smart TV. Escolhe o protocolo
//   automaticamente baseado no `contentType`:
//   - 'video' | 'image' → UPnP AVTransport (SOAP)
//   - 'web'             → DIAL (HTTP POST para lançar o browser da TV)
//
// PARÂMETROS:
//   ip          → Endereço IP da TV (ex: "192.168.1.50")
//   contentUrl  → URL do conteúdo a exibir (deve ser acessível pela TV na rede)
//   contentType → Tipo de conteúdo (define o protocolo usado)
//   upnpPort    → Porta do serviço AVTransport UPnP (default: 7676)
//   dialPort    → Porta do servidor DIAL da TV (default: 8008)
// =============================================================================
export async function sendContentToDevice(
  ip: string,
  contentUrl: string,
  contentType: "video" | "image" | "web",
  upnpPort = 7676,
  dialPort = 8008,
): Promise<SendContentResult> {
  if (contentType === "web") {
    return sendUrlViaDial(ip, contentUrl, dialPort);
  }

  // Para video e image, o protocolo é o mesmo (AVTransport aceita ambos)
  return sendMediaViaUpnp(ip, contentUrl, upnpPort);
}

// =============================================================================
// FUNÇÃO PRIVADA: sendMediaViaUpnp
// =============================================================================
// O QUE FAZ:
//   Usa o protocolo UPnP AVTransport para enviar uma URL de mídia para a TV.
//
// COMO FUNCIONA PASSO A PASSO:
//   1. Monta o XML SOAP de SetAVTransportURI (define qual mídia vai tocar)
//   2. Envia via HTTP POST para o endpoint de controle da TV
//   3. Monta o XML SOAP de Play (manda a TV começar a reprodução)
//   4. Envia o Play
//
// POR QUE SOAP MANUAL E NÃO UMA BIBLIOTECA?
//   As bibliotecas UPnP para Node.js são antigas e raramente mantidas.
//   SOAP é apenas XML dentro de um POST HTTP — implementar manualmente é
//   mais robusto e educativo. O AVTransport tem apenas 2 actions que precisamos.
//
// ENDPOINT PADRÃO UPnP:
//   A maioria das TVs expõe o AVTransport em:
//   /upnp/control/AVTransport1  (Samsung, Sony, Philips)
//   /MediaRenderer/AVTransport/control  (LG, genérico DLNA)
//   /AVTransport/Control    (Roku, Amazon Fire TV)
//   Tentamos o mais comum e fazemos fallback nos outros.
// =============================================================================
async function sendMediaViaUpnp(
  ip: string,
  mediaUrl: string,
  port: number,
): Promise<SendContentResult> {
  // -------------------------------------------------------------------------
  // Lista de endpoints comuns de controle AVTransport.
  // Tentamos sequencialmente até um funcionar ou todos falharem.
  // -------------------------------------------------------------------------
  const controlPathCandidates = [
    "/upnp/control/AVTransport1",
    "/MediaRenderer/AVTransport/control",
    "/AVTransport/Control",
    "/upnp/control/rendertransport1",
  ];

  let lastError = "";

  for (const controlPath of controlPathCandidates) {
    try {
      // Passo 1: SetAVTransportURI — diz à TV qual URL de mídia vai tocar
      await sendSoapAction(ip, port, controlPath, {
        serviceType: "urn:schemas-upnp-org:service:AVTransport:1",
        action: "SetAVTransportURI",
        body: `
          <InstanceID>0</InstanceID>
          <CurrentURI>${escapeXml(mediaUrl)}</CurrentURI>
          <CurrentURIMetaData>${buildDlnaMetadata(mediaUrl)}</CurrentURIMetaData>
        `,
      });

      // Passo 2: Play — inicia a reprodução na velocidade 1 (normal)
      await sendSoapAction(ip, port, controlPath, {
        serviceType: "urn:schemas-upnp-org:service:AVTransport:1",
        action: "Play",
        body: `
          <InstanceID>0</InstanceID>
          <Speed>1</Speed>
        `,
      });

      return {
        success: true,
        protocol: "upnp",
        message:
          `Conteúdo enviado com sucesso via UPnP AVTransport. ` +
          `A TV deve começar a reproduzir em instantes.`,
        tvResponse: `AVTransport endpoint: ${controlPath}`,
      };
    } catch (err) {
      // Este endpoint não funcionou — tenta o próximo
      lastError = err instanceof Error ? err.message : String(err);
      continue;
    }
  }

  // Nenhum endpoint funcionou — retorna resultado não-fatal com diagnóstico
  return {
    success: false,
    protocol: "none",
    message:
      `Não foi possível contatar a TV via UPnP AVTransport. ` +
      `Verifique se a TV está online e com UPnP habilitado nas configurações ` +
      `de rede. Último erro: ${lastError}`,
  };
}

// =============================================================================
// FUNÇÃO PRIVADA: sendUrlViaDial
// =============================================================================
// O QUE FAZ:
//   Usa o protocolo DIAL (Discovery and Launch) para abrir uma URL no
//   navegador embutido da Smart TV.
//
// COMO FUNCIONA:
//   1. HTTP POST para http://{ip}:{dialPort}/apps/Browser
//      Body (text/plain): url={URL_encoded}
//   2. A TV recebe, verifica se o app "Browser" está instalado
//   3. Se sim: abre o browser com a URL fornecida
//   4. Retorna HTTP 201 Created se sucesso, 404 se app não encontrado
//
// NOMES ALTERNATIVOS DO APP BROWSER:
//   Cada fabricante registra o nome do app browser de forma diferente:
//   Samsung Tizen: "GoogleBrowser", "SamsungBrowser", "SMARTV2" (varia por modelo)
//   LG WebOS: "com.webos.app.browser"
//   Android TV: "chrome" (via ADB, não DIAL)
//   Roku: "tvinput.hdmi1" ou channel ID específico
//   Dispositivos DIAL genéricos: "Browser"
//
//   Como o nome varia, tentamos múltiplos em sequência.
//
// LIMITAÇÃO CONHECIDA:
//   Sem um nome de app válido registrado na TV, o DIAL sozinho não consegue
//   abrir uma URL arbitrária. A abordagem mais confiável para Digital Signage
//   é ter uma aplicação HTML5 instalada na TV que receba atualizações via
//   WebSocket ou polling HTTP.
// =============================================================================
async function sendUrlViaDial(
  ip: string,
  url: string,
  dialPort: number,
): Promise<SendContentResult> {
  // Apps de browser registrados no servidor DIAL (por fabricante)
  const dialAppCandidates = [
    { app: "Browser", param: `url=${encodeURIComponent(url)}` },
    { app: "GoogleBrowser", param: `url=${encodeURIComponent(url)}` },
    // Samsung: pode usar launchApp via REST API interna
    { app: "SamsungBrowser", param: `url=${encodeURIComponent(url)}` },
    // LG WebOS
    {
      app: "com.webos.app.browser",
      param: `target=${encodeURIComponent(url)}`,
    },
  ];

  for (const { app, param } of dialAppCandidates) {
    try {
      const dialUrl = `http://${ip}:${dialPort}/apps/${encodeURIComponent(app)}`;

      const response = await fetch(dialUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          // Header DIAL obrigatório — identifica o cliente como DIAL-compatible
          ORIGIN: `http://${ip}:${dialPort}`,
        },
        body: param,
        signal: AbortSignal.timeout(5000), // timeout de 5 segundos
      });

      // DIAL retorna 201 para "app lançado com sucesso"
      if (response.status === 201 || response.status === 200) {
        return {
          success: true,
          protocol: "dial",
          message:
            `URL enviada com sucesso via DIAL. App '${app}' lançado na TV. ` +
            `O navegador da TV deve abrir: ${url}`,
          tvResponse: `DIAL app: ${app}, HTTP ${response.status}`,
        };
      }

      // 404 = app não encontrado nesta TV — tenta o próximo app
    } catch {
      continue;
    }
  }

  // DIAL não funcionou — retorna status detalhado para ajudar no diagnóstico
  return {
    success: false,
    protocol: "none",
    message:
      `Não foi possível enviar a URL via protocolo DIAL. ` +
      `Causas comuns: (1) TV não suporta DIAL nesta porta, ` +
      `(2) App browser não está registrado com nenhum dos nomes tentados, ` +
      `(3) Firewall bloqueando a porta ${dialPort}. ` +
      `Alternativa: crie um app HTML5 na TV que faça polling em um endpoint ` +
      `desta API — consultando GET /tv/devices/:id para receber o current_content.`,
  };
}

// =============================================================================
// FUNÇÃO PRIVADA: sendSoapAction
// =============================================================================
// O QUE FAZ:
//   Envia uma ação SOAP para um endpoint UPnP.
//   SOAP = XML sobre HTTP. O protocolo do AVTransport é exatamente isso.
//
// PARÂMETROS:
//   serviceType → URN do serviço UPnP (ex: "urn:schemas-upnp-org:service:AVTransport:1")
//   action      → Nome da action (ex: "SetAVTransportURI", "Play", "Pause")
//   body        → XML com os argumentos da action (vai dentro do elemento da action)
// =============================================================================
async function sendSoapAction(
  ip: string,
  port: number,
  controlPath: string,
  opts: { serviceType: string; action: string; body: string },
): Promise<string> {
  const { serviceType, action, body } = opts;

  // Envelope SOAP padrão (conforme especificação UPnP 1.1)
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
            s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${action} xmlns:u="${serviceType}">
      ${body.trim()}
    </u:${action}>
  </s:Body>
</s:Envelope>`;

  const response = await fetch(`http://${ip}:${port}${controlPath}`, {
    method: "POST",
    headers: {
      "Content-Type": 'text/xml; charset="utf-8"',
      // SOAPACTION é um header UPnP obrigatório — identifica qual action está sendo chamada
      SOAPACTION: `"${serviceType}#${action}"`,
      "User-Agent": "NodeJS-UPnP-Client/1.0",
    },
    body: soapEnvelope,
    signal: AbortSignal.timeout(5000),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `SOAP error ${response.status} em ${controlPath}: ${responseText.slice(0, 200)}`,
    );
  }

  return responseText;
}

// =============================================================================
// FUNÇÃO PRIVADA: escapeXml
// =============================================================================
// Garante que a URL não vai quebrar o XML SOAP se contiver &, <, >, ', "
// Ex: "http://server/video?a=1&b=2" → "http://server/video?a=1&amp;b=2"
// =============================================================================
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// =============================================================================
// FUNÇÃO PRIVADA: buildDlnaMetadata
// =============================================================================
// O QUE FAZ:
//   Gera o DIDL-Lite metadata mínimo que algumas TVs exigem no SetAVTransportURI.
//   DIDL-Lite = "Digital Item Declaration Language - Lite"
//   É um formato XML que descreve o tipo e título do conteúdo para o renderer.
//
// POR QUE PRECISA DISSO?
//   Alguns dispositivos DLNA (como Chromecast e alguns Samsung) ignoram
//   a URL se não vier com metadata indicando o tipo MIME do conteúdo.
// =============================================================================
function buildDlnaMetadata(url: string): string {
  // Detecta o tipo MIME baseado na extensão da URL
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  const mimeMap: Record<string, string> = {
    mp4: "video/mp4",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  const mimeType = mimeMap[ext] ?? "video/mp4"; // fallback para video

  const title =
    url.split("/").pop()?.split("?")[0] ?? "Digital Signage Content";

  return escapeXml(
    `<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" ` +
      `xmlns:dc="http://purl.org/dc/elements/1.1/" ` +
      `xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">` +
      `<item id="1" parentID="0" restricted="1">` +
      `<dc:title>${escapeXml(title)}</dc:title>` +
      `<upnp:class>object.item.videoItem</upnp:class>` +
      `<res protocolInfo="http-get:*:${mimeType}:*">${escapeXml(url)}</res>` +
      `</item>` +
      `</DIDL-Lite>`,
  );
}
