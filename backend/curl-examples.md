# Comandos cURL para Postman

## PDF ID: 1b310d9c-dd42-4a3d-9da5-7a10e353553f

### Obter informações do PDF
```bash
GET http://localhost:3000/api/pdf/1b310d9c-dd42-4a3d-9da5-7a10e353553f
```

### Obter número de páginas do PDF
```bash
GET http://localhost:3000/api/pdf/1b310d9c-dd42-4a3d-9da5-7a10e353553f/pages
```

### Gerar screenshot da página 1
```bash
GET http://localhost:3000/api/pdf/1b310d9c-dd42-4a3d-9da5-7a10e353553f/screenshot/1
```

### Gerar screenshot da página 2
```bash
GET http://localhost:3000/api/pdf/1b310d9c-dd42-4a3d-9da5-7a10e353553f/screenshot/2
```

### Gerar screenshot da página 3
```bash
GET http://localhost:3000/api/pdf/1b310d9c-dd42-4a3d-9da5-7a10e353553f/screenshot/3
```

---

## Como usar no Postman:

1. **Método:** GET
2. **URL:** Cole uma das URLs acima
3. **Headers:** Não é necessário adicionar headers
4. **Body:** Não é necessário

### Exemplo completo para Postman:

**Request Type:** GET  
**URL:** `http://localhost:3000/api/pdf/1b310d9c-dd42-4a3d-9da5-7a10e353553f/screenshot/1`

---

## Resposta esperada:

```json
{
  "message": "Screenshot gerado com sucesso!",
  "screenshot": {
    "pdfId": "1b310d9c-dd42-4a3d-9da5-7a10e353553f",
    "page": 1,
    "filename": "screenshot-1b310d9c-dd42-4a3d-9da5-7a10e353553f-page-1.1.png",
    "path": "C:\\Users\\iago_\\Desktop\\Projects\\Brinks\\backend\\screenshots\\screenshot-1b310d9c-dd42-4a3d-9da5-7a10e353553f-page-1.1.png",
    "url": "/screenshots/screenshot-1b310d9c-dd42-4a3d-9da5-7a10e353553f-page-1.1.png"
}
```

## Acessar a imagem gerada:

Após gerar o screenshot, acesse a imagem diretamente:
```
http://localhost:3000/screenshots/screenshot-1b310d9c-dd42-4a3d-9da5-7a10e353553f-page-1.1.png
```

---

## Analisar Screenshot com IA (OpenAI)

### Obter ID do screenshot primeiro
```bash
GET http://localhost:3000/api/pdf/1b310d9c-dd42-4a3d-9da5-7a10e353553f/screenshots
```

### Analisar screenshot com prompt
```bash
POST http://localhost:3000/api/screenshot/{screenshot-id}/analyze
Content-Type: application/json

{
  "prompt": "Descreva o conteúdo desta imagem em detalhes"
}
```

### Exemplo completo para Postman:

**Request Type:** POST  
**URL:** `http://localhost:3000/api/screenshot/03ec98f3-e025-483b-8ce5-41a5bfc22587/analyze`  
**Headers:**
- `Content-Type: application/json`

**Body (raw JSON):**
```json
{
  "prompt": "Descreva o conteúdo desta imagem em detalhes. O que você vê? Quais são os elementos principais?"
}
```

### Outros exemplos de prompts:

```json
{
  "prompt": "Extraia todo o texto visível nesta imagem"
}
```

```json
{
  "prompt": "Quais são os números e valores monetários presentes nesta imagem?"
}
```

```json
{
  "prompt": "Resuma o conteúdo desta página de documento"
}
```

### Resposta esperada:

```json
{
  "message": "Análise realizada com sucesso!",
  "screenshotId": "03ec98f3-e025-483b-8ce5-41a5bfc22587",
  "prompt": "Descreva o conteúdo desta imagem em detalhes",
  "analysis": "A imagem mostra um documento PDF com texto e elementos visuais..."
}
```
