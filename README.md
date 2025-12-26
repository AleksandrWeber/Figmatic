<p align="center">
  <img src="assets/logo.png" width="200" alt="Figmatic Logo">
</p>

# Figmatic 🚀

[English](#english) | [Українська](#українська)

---

## English

### What is Figmatic?
**Figmatic** is the fusion of **Figma** and **Automatic**. It is an advanced AI-driven tool designed to bridge the gap between Figma designs and production-ready code. Unlike generic code generators, Figmatic acts as a "Senior Frontend Architect," interpreting design intent, planning component hierarchy, and generating maintainable React + SCSS code.

### Key Features ("Plushki") ✨
- **Global Design Tokens**: Automatically extracts colors and typography into a centralized `_variables.scss`.
- **Full-Page Orchestration**: Generates an entire landing page with a central `App.tsx` and modular component folders.
- **Mobile-First & Responsive**: Intelligent interpretation of Figma's "Hug", "Fill", and "Fixed" constraints to create fluid CSS.
- **Asset Management**: Automatically downloads images (PNG) and vector icons (SVG) directly from the Figma API.
- **Interactive Refinement**: A "Refine" mode where you can give natural language instructions (e.g., "Change the brand color to deep blue") to modify the generated code.

### Technical Setup 🛠️

#### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Figma Account & API Token](https://www.figma.com/developers/api#access)
- [Google Gemini API Key](https://ai.google.dev/)

#### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root:
   ```env
   FIGMA_TOKEN=your_figma_token_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

#### Usage
- **Standard Generation**:
  ```bash
  node --loader ts-node/esm src/index.ts
  ```
- **Interactive Mode (Refinement)**:
  ```bash
  node --loader ts-node/esm src/interactive-agent.ts
  ```

---

## Українська

### Що таке Figmatic?
**Figmatic** — це поєднання слів **Figma** та **Automatic** (автоматичний). Це просунутий інструмент на базі штучного інтелекту, створений для перетворення дизайнів Figma на готовий до продакшену код. Це не просто генератор, а "Senior Frontend Architect", який аналізує дизайн, планує архітектуру компонентів та створює чистий React + SCSS код.

### Основні "Плюшки" ✨
- **Глобальні Дизайн-Токени**: Автоматичне вилучення кольорів та типографіки у централізований файл `_variables.scss`.
- **Оркестрація сторінки**: Генерація всього лендінгу з головним файлом `App.tsx` та модульною структурою папок.
- **Адаптивна верстка (Mobile-First)**: Розумна інтерпретація обмежень Фігми ("Hug", "Fill", "Fixed") для створення гнучкого CSS.
- **Керування асетами**: Автоматичне завантаження зображень (PNG) та векторних іконок (SVG) безпосередньо з Figma API.
- **Інтерактивний діалог**: Режим "Refine", де можна давати текстові уточнення (наприклад, "зроби кнопку червоною"), щоб змінити вже згенерований код.

### Технічне налаштування 🛠️

#### Вимоги
- [Node.js](https://nodejs.org/) (v18+)
- Figma API Token
- Google Gemini API Key

#### Встановлення
1. Клонуйте репозиторій.
2. Встановіть залежності:
   ```bash
   npm install
   ```
3. Створіть файл `.env` у корені:
   ```env
   FIGMA_TOKEN=ваш_токен_фігми
   GEMINI_API_KEY=ваш_ключ_gemini
   ```

#### Використання
- **Стандартна генерація**:
  ```bash
  node --loader ts-node/esm src/index.ts
  ```
- **Інтерактивний режим**:
  ```bash
  node --loader ts-node/esm src/interactive-agent.ts
  ```

---

## License & Copyright
Copyright (c) 2024 Oleksandr Shvachko. All rights reserved.
Personal use is allowed; commercial use prohibited without permission. See [LICENSE](LICENSE) for details.
