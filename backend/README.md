# Brinks Backend

Servidor Node.js com TypeScript e Express.

## Instalação

```bash
npm install
```

### Dependências do Sistema (para Screenshots)

O sistema usa `puppeteer` para gerar screenshots, que **não requer instalação adicional** no sistema. O Puppeteer já vem com o Chromium embutido, então funciona automaticamente após `npm install`.

### Configuração da API OpenAI

Para usar o endpoint de análise de screenshots com IA, você precisa configurar a chave da API da OpenAI:

1. Crie um arquivo `.env` na raiz do projeto:
```bash
OPENAI_API_KEY=sua-chave-api-aqui
```

Você pode obter sua chave em: https://platform.openai.com/api-keys

## Desenvolvimento

Para rodar o servidor em modo de desenvolvimento (com nodemon para hot-reload):

```bash
npm run dev
```

O servidor estará disponível em `http://localhost:3000`

O nodemon monitora automaticamente mudanças nos arquivos `.ts` e reinicia o servidor automaticamente.

## Build

Para compilar o TypeScript:

```bash
npm run build
```

## Produção

Para rodar o servidor em produção (após o build):

```bash
npm start
```

## Scripts Disponíveis

- `npm run dev` - Inicia o servidor em modo desenvolvimento com nodemon (hot-reload automático)
- `npm run build` - Compila o TypeScript para JavaScript
- `npm start` - Inicia o servidor em produção
- `npm run type-check` - Verifica tipos sem compilar

## API Endpoints

### Upload de PDF
- **POST** `/api/pdf` - Faz upload de um arquivo PDF
  - Body: `multipart/form-data` com campos:
    - `pdf` (obrigatório): Arquivo PDF
    - `name` ou `title` (opcional): Nome customizado para o PDF
  - Limite: 10MB
  - Retorna: Informações do PDF salvo (id, filename, name, path, etc.)

### Listar PDFs
- **GET** `/api/pdfs` - Lista todos os PDFs cadastrados
  - Retorna: Array com todos os PDFs

### Buscar PDF por ID
- **GET** `/api/pdf/:id` - Busca um PDF específico pelo ID
  - Retorna: Informações do PDF

### Gerar Screenshot de Página
- **GET** `/api/pdf/:id/screenshot/:page` - Gera um screenshot de uma página específica do PDF
  - Parâmetros:
    - `id`: ID do PDF
    - `page`: Número da página (começando em 1)
  - Retorna: Informações do screenshot gerado (filename, path, url)

### Obter Número de Páginas
- **GET** `/api/pdf/:id/pages` - Retorna o número total de páginas do PDF
  - Retorna: Total de páginas do PDF

### Listar Screenshots
- **GET** `/api/screenshots` - Lista todos os screenshots cadastrados
  - Retorna: Array com todos os screenshots

### Listar Screenshots de um PDF
- **GET** `/api/pdf/:id/screenshots` - Lista todos os screenshots de um PDF específico
  - Retorna: Array com screenshots do PDF

### Buscar Screenshot por ID
- **GET** `/api/screenshot/:id` - Busca um screenshot específico pelo ID
  - Retorna: Informações do screenshot

### Analisar Screenshot com IA (OpenAI)
- **POST** `/api/screenshot/:id/analyze` - Analisa um screenshot usando a API da OpenAI
  - Parâmetros:
    - `id`: ID do screenshot
  - Body (JSON):
    - `prompt` (obrigatório): Pergunta ou instrução sobre a imagem
  - Retorna: Análise da imagem gerada pela IA

## Exemplo de Uso

### Upload de PDF (usando curl)
```bash
# Upload sem nome customizado
curl -X POST http://localhost:3000/api/pdf \
  -F "pdf=@/caminho/para/seu/arquivo.pdf"

# Upload com nome customizado
curl -X POST http://localhost:3000/api/pdf \
  -F "pdf=@/caminho/para/seu/arquivo.pdf" \
  -F "name=Meu Documento Importante"
```

### Upload de PDF (usando fetch no JavaScript)
```javascript
const formData = new FormData();
formData.append('pdf', fileInput.files[0]);
formData.append('name', 'Meu Documento Importante'); // Opcional

fetch('http://localhost:3000/api/pdf', {
  method: 'POST',
  body: formData
})
.then(res => res.json())
.then(data => console.log(data));
```

### Gerar Screenshot de Página (usando curl)
```bash
# Gerar screenshot da página 1 do PDF
curl http://localhost:3000/api/pdf/{id}/screenshot/1
```

### Obter Número de Páginas (usando curl)
```bash
curl http://localhost:3000/api/pdf/{id}/pages
```

### Analisar Screenshot com IA (usando curl)
```bash
curl -X POST http://localhost:3000/api/screenshot/{id}/analyze \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Descreva o conteúdo desta imagem em detalhes"}'
```

### Analisar Screenshot com IA (usando fetch no JavaScript)
```javascript
fetch('http://localhost:3000/api/screenshot/{id}/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: 'Descreva o conteúdo desta imagem em detalhes'
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

## Estrutura

```
backend/
├── src/
│   ├── index.ts           # Arquivo principal do servidor
│   ├── routes/
│   │   └── upload.ts      # Rotas de upload
│   ├── services/
│   │   └── database.ts    # Serviço de banco de dados JSON
│   └── types/
│       └── pdf.ts         # Tipos TypeScript
├── uploads/               # Pasta onde os PDFs são salvos
├── screenshots/           # Pasta onde os screenshots são salvos
├── database/
│   └── db.json           # Banco de dados simulado (JSON)
├── dist/                 # Arquivos compilados (gerado)
├── package.json
├── tsconfig.json
└── README.md
```

## Banco de Dados

O banco de dados é simulado usando um arquivo JSON (`database/db.json`). Cada PDF salvo contém:
- `id`: Identificador único
- `filename`: Nome do arquivo salvo no servidor
- `originalName`: Nome original do arquivo enviado
- `name`: Nome customizado fornecido pelo usuário (ou nome original se não fornecido)
- `path`: Caminho completo do arquivo
- `size`: Tamanho em bytes
- `mimeType`: Tipo MIME do arquivo
- `uploadedAt`: Data e hora do upload (ISO string)
