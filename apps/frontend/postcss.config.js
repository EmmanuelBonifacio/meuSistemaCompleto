// =============================================================================
// postcss.config.js
// =============================================================================
// O QUE FAZ:
//   O PostCSS é o processador de CSS que o Next.js usa por baixo dos panos.
//   Ele transforma nosso CSS moderno em CSS compatível com browsers mais antigos.
//   O Tailwind CSS funciona COMO um plugin do PostCSS.
//
// POR QUE AUTOPREFIXER?
//   Adiciona automaticamente prefixos de vendor (-webkit-, -moz-, etc.)
//   em propriedades CSS que ainda precisam deles para compatibilidade.
//   Ex: -webkit-flex para navegadores webkit antigos.
// =============================================================================

module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
