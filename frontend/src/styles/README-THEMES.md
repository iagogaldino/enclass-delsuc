# Sistema de Temas - Documentação

## 📋 Visão Geral

Este projeto utiliza um sistema centralizado de temas que permite fácil mudança de cores e estilos em todo o frontend. Todas as cores estão definidas em arquivos centralizados, facilitando a criação de novos temas.

## 📁 Estrutura de Arquivos

```
frontend/src/styles/
├── _theme-variables.scss    # Variáveis SCSS de cores
├── _themes.scss             # Sistema de temas e mixins
└── README-THEMES.md         # Esta documentação
```

## 🎨 Arquivos de Tema

### `_theme-variables.scss`

Contém todas as variáveis de cores do projeto, organizadas por categoria:

- **Primary Colors**: Cores principais do tema (roxo por padrão)
- **Background Colors**: Cores de fundo
- **Text Colors**: Cores de texto
- **Border Colors**: Cores de bordas
- **Accent Colors**: Cores de destaque (sucesso, erro, aviso, info)
- **Gradient Colors**: Gradientes pré-definidos
- **Shadow Colors**: Cores de sombras
- **Overlay Colors**: Cores de sobreposição
- **Component Colors**: Cores específicas de componentes (navbar, subtitle, buttons, etc.)

### `_themes.scss`

Define o tema padrão e exporta variáveis CSS customizadas (`:root`), além de fornecer mixins úteis para facilitar o uso.

## 🚀 Como Usar

### 1. Importar as Variáveis

As variáveis já estão importadas no `styles.scss`. Para usar em qualquer componente SCSS:

```scss
@import 'styles/theme-variables';

.meu-componente {
  background: $bg-primary;
  color: $text-primary;
  border: 1px solid $border-light;
}
```

### 2. Usar Variáveis CSS

Você também pode usar as variáveis CSS diretamente:

```scss
.meu-componente {
  background: var(--bg-primary);
  color: var(--text-primary);
}
```

### 3. Usar Mixins

```scss
@import 'styles/themes';

.botao-primario {
  @include theme-primary-gradient;
  @include theme-shadow(primary);
  @include theme-border(primary);
  @include theme-text(light);
}
```

## 🎭 Criar um Novo Tema

Para criar um novo tema, você tem duas opções:

### Opção 1: Modificar Variáveis Existentes

Edite o arquivo `_theme-variables.scss` e altere os valores das variáveis:

```scss
// Tema Azul
$primary-color: #2196f3;
$primary-color-dark: #1976d2;
$primary-rgb: 33, 150, 243;
```

### Opção 2: Criar um Arquivo de Tema Separado

1. Crie um novo arquivo, por exemplo: `_theme-blue.scss`
2. Importe as variáveis base e sobrescreva:

```scss
@import 'theme-variables';

// Sobrescrever variáveis para tema azul
$primary-color: #2196f3;
$primary-color-dark: #1976d2;
$primary-rgb: 33, 150, 243;

// Importar o sistema de temas
@import 'themes';
```

3. No `styles.scss`, importe o novo tema em vez do padrão:

```scss
@import 'styles/theme-blue'; // em vez de theme-variables
```

## 📝 Variáveis Principais

### Cores Primárias
- `$primary-color`: Cor principal do tema
- `$primary-color-dark`: Versão escura
- `$primary-color-light`: Versão clara
- `$primary-rgb`: Valores RGB para uso em rgba()

### Cores de Fundo
- `$bg-primary`: Fundo principal (branco)
- `$bg-secondary`: Fundo secundário (cinza claro)
- `$bg-tertiary`: Fundo terciário
- `$bg-dark`: Fundo escuro
- `$bg-hover`: Fundo no hover

### Cores de Texto
- `$text-primary`: Texto principal (preto)
- `$text-secondary`: Texto secundário
- `$text-tertiary`: Texto terciário (cinza)
- `$text-light`: Texto claro (branco)

### Componentes Específicos
- `$navbar-bg`, `$navbar-text`, `$navbar-icon`: Cores do navbar
- `$subtitle-bg`, `$subtitle-text`: Cores das legendas
- `$button-primary-bg`, `$button-primary-text`: Cores dos botões

## 🔄 Migração de Cores Hardcoded

Para migrar cores hardcoded para o sistema de temas:

1. **Identifique a cor**: Encontre valores como `#9c27b0`, `#ffffff`, etc.
2. **Encontre a variável equivalente**: Consulte `_theme-variables.scss`
3. **Substitua**: Troque o valor hardcoded pela variável

**Antes:**
```scss
.botao {
  background: #9c27b0;
  color: #ffffff;
}
```

**Depois:**
```scss
.botao {
  background: $primary-color;
  color: $text-light;
}
```

## 💡 Dicas

1. **Sempre use variáveis**: Evite cores hardcoded no código
2. **Use mixins quando apropriado**: Para padrões comuns (gradientes, sombras)
3. **Documente temas customizados**: Se criar um novo tema, documente no README
4. **Teste a acessibilidade**: Garanta contraste adequado ao mudar temas

## 🐛 Troubleshooting

### Variáveis não funcionam
- Certifique-se de que `_theme-variables.scss` está importado
- Verifique se está usando `$` para variáveis SCSS ou `var()` para CSS

### Cores não mudam
- Limpe o cache do build
- Verifique se não há estilos inline sobrescrevendo

## 📚 Referências

- [Sass Variables](https://sass-lang.com/documentation/variables)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
