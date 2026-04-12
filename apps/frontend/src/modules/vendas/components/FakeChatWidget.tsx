// =============================================================================
// src/modules/vendas/components/FakeChatWidget.tsx
// =============================================================================
// O QUE FAZ:
//   Widget de chat fixo no canto inferior direito da página de vendas.
//   Simula uma conversa com um atendente para tirar dúvidas e aumentar
//   a conversão. As respostas são pré-definidas em um JSON local.
//
// POR QUE "FAKE"?
//   Não há conexão com IA ou API de chat. As respostas são mapeadas
//   por palavras-chave. Para integrar com IA real, substitua o
//   objeto RESPOSTAS_JSON por uma chamada a /api/chat.
//
// COMO EDITAR AS RESPOSTAS:
//   Edite o objeto RESPOSTAS abaixo. Cada chave é um array de palavras-chave
//   que dispara aquela resposta.
// =============================================================================

"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot } from "lucide-react";
import type { MensagemChat } from "@/types/vendas.types";

// =============================================================================
// RESPOSTAS PRÉ-DEFINIDAS (edite aqui para personalizar)
// =============================================================================
// Estrutura: { palavrasChave: string[], resposta: string }[]
// A primeira resposta cujas palavras-chave aparecerem na mensagem será usada.
const RESPOSTAS = [
  {
    palavrasChave: ["frete", "entrega", "prazo", "envio"],
    resposta:
      "🚚 Trabalhamos com frete via Correios e transportadoras. O prazo de entrega varia de 3 a 8 dias úteis dependendo da sua região. Para calcular o frete, basta fechar o pedido pelo WhatsApp!",
  },
  {
    palavrasChave: ["pagamento", "pagar", "pix", "boleto", "cartão", "cartao"],
    resposta:
      "💳 Aceitamos PIX (à vista), cartão de crédito em até 12x e boleto bancário. Para parcelamento, finalize pelo WhatsApp e informe sua preferência!",
  },
  {
    palavrasChave: ["troca", "devolução", "devolver", "trocar", "garantia"],
    resposta:
      "✅ Temos política de troca e devolução em até 7 dias corridos após o recebimento. Basta entrar em contato pelo WhatsApp com o número do pedido.",
  },
  {
    palavrasChave: ["desconto", "promoção", "promocao", "cupom", "oferta"],
    resposta:
      "🏷️ Temos promoções especiais! Verifique a aba 'Promoções' no catálogo. Fale comigo pelo WhatsApp para saber sobre descontos exclusivos!",
  },
  {
    palavrasChave: ["disponível", "disponivel", "estoque", "tem", "possui"],
    resposta:
      "📦 Todos os produtos exibidos no catálogo estão disponíveis em estoque. Para confirmar a disponibilidade de algum item específico, me fale o nome pelo WhatsApp!",
  },
  {
    palavrasChave: [
      "olá",
      "ola",
      "oi",
      "bom dia",
      "boa tarde",
      "boa noite",
      "hello",
    ],
    resposta:
      "Olá! 😊 Seja bem-vindo(a)! Sou o assistente virtual desta loja. Como posso te ajudar hoje?",
  },
  {
    palavrasChave: ["obrigado", "obrigada", "valeu", "thanks"],
    resposta:
      "De nada! 😊 Fico feliz em ajudar. Se tiver mais dúvidas, é só perguntar. Boas compras!",
  },
];

// Resposta padrão quando nenhuma palavra-chave é encontrada
const RESPOSTA_PADRAO =
  "Entendi! Para uma resposta mais detalhada, clique em 'Falar no WhatsApp' e nosso atendimento te responderá rapidinho! 😊";

// Mensagem inicial do atendente (exibida ao abrir o chat)
const MENSAGEM_INICIAL: MensagemChat = {
  id: "inicial",
  autor: "atendente",
  texto:
    "Olá! 👋 Sou o assistente virtual. Posso te ajudar com dúvidas sobre entrega, pagamento, trocas e muito mais. O que você gostaria de saber?",
  timestamp: new Date(),
};

// =============================================================================
// COMPONENTE: FakeChatWidget
// =============================================================================
interface FakeChatWidgetProps {
  whatsappNumber: string;
}

export function FakeChatWidget({ whatsappNumber }: FakeChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mensagens, setMensagens] = useState<MensagemChat[]>([
    MENSAGEM_INICIAL,
  ]);
  const [textoDigitado, setTextoDigitado] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const mensagensEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    mensagensEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, isTyping]);

  // -------------------------------------------------------------------------
  // Processa a mensagem digitada e encontra a resposta adequada
  // -------------------------------------------------------------------------
  const encontrarResposta = (texto: string): string => {
    const textoLower = texto.toLowerCase();
    const match = RESPOSTAS.find((r) =>
      r.palavrasChave.some((palavra) => textoLower.includes(palavra)),
    );
    return match ? match.resposta : RESPOSTA_PADRAO;
  };

  // -------------------------------------------------------------------------
  // Envia a mensagem do visitante e gera resposta do atendente
  // -------------------------------------------------------------------------
  const enviarMensagem = () => {
    const texto = textoDigitado.trim();
    if (!texto) return;

    // Adiciona mensagem do visitante
    const novaMensagem: MensagemChat = {
      id: Date.now().toString(),
      autor: "visitante",
      texto,
      timestamp: new Date(),
    };

    setMensagens((prev) => [...prev, novaMensagem]);
    setTextoDigitado("");

    // Simula digitação do atendente (700ms de delay)
    setIsTyping(true);
    setTimeout(
      () => {
        const resposta = encontrarResposta(texto);
        const mensagemAtendente: MensagemChat = {
          id: `resp-${Date.now()}`,
          autor: "atendente",
          texto: resposta,
          timestamp: new Date(),
        };
        setMensagens((prev) => [...prev, mensagemAtendente]);
        setIsTyping(false);
      },
      700 + Math.random() * 500,
    ); // Delay variável para parecer mais natural
  };

  // Envia ao pressionar Enter (sem Shift)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  const linkWhatsApp = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Olá! Tenho uma dúvida sobre os produtos.")}`;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Janela do Chat */}
      {isOpen && (
        <div className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
          {/* Header do Chat */}
          <div className="flex items-center gap-3 bg-green-500 p-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">Atendimento</p>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
                <p className="text-green-100 text-xs">Online agora</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Fechar chat"
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Área de Mensagens */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-72 bg-gray-50">
            {mensagens.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.autor === "visitante" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.autor === "visitante"
                      ? "bg-green-500 text-white rounded-br-sm"
                      : "bg-white text-gray-800 shadow-sm rounded-bl-sm"
                  }`}
                >
                  {msg.texto}
                </div>
              </div>
            ))}

            {/* Indicador de "digitando..." */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={mensagensEndRef} />
          </div>

          {/* Input de Mensagem */}
          <div className="p-3 border-t border-gray-100 space-y-2 bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={textoDigitado}
                onChange={(e) => setTextoDigitado(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua dúvida..."
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
              />
              <button
                onClick={enviarMensagem}
                disabled={!textoDigitado.trim()}
                className="flex items-center justify-center w-9 h-9 bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded-xl transition-colors"
                aria-label="Enviar mensagem"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Link para WhatsApp real */}
            <a
              href={linkWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs text-green-600 hover:text-green-700 font-medium"
            >
              📱 Falar diretamente no WhatsApp
            </a>
          </div>
        </div>
      )}

      {/* Botão flutuante para abrir/fechar o chat */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={
          isOpen ? "Fechar chat de atendimento" : "Abrir chat de atendimento"
        }
        className="flex items-center justify-center w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>
    </div>
  );
}
