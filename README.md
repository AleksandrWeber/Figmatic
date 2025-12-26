# Figmatic 🚀 (VS Code Extension)

<p align="center">
  <img src="assets/logo.png" width="200" alt="Figmatic Logo">
</p>

[English](#english) | [Українська](#українська)

---

## English

### What is Figmatic?
**Figmatic** is the fusion of **Figma** and **Automatic**. It is an advanced AI-powered **VS Code Extension** designed to bridge the gap between Figma designs and production-ready code. Unlike generic code generators, Figmatic acts as a "Senior Frontend Architect," interpreting design intent, planning component hierarchy, and generating maintainable React + SCSS code directly into your workspace.

### Key Features ✨
- **Native VS Code Sidebar**: A dedicated sidebar UI to manage your Figma-to-Code workflow.
- **Global Design Tokens**: Automatically extracts colors and typography into `_variables.scss`.
- **Full-Page Orchestration**: Generates an entire landing page with modular components.
- **Asset Management**: Downloads images and icons directly from Figma to your project folder.
- **Interactive Refinement**: Give natural language instructions (e.g., "Make the title red") to modify generated code.

### Technical Setup 🛠️

#### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- Figma API Token & Google Gemini API Key

#### Installation & Development
1. Clone the repository and run `npm install`.
2. Create a `.env` file in the root:
   ```env
   FIGMA_TOKEN=your_figma_token_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
3. **Run in VS Code**:
   - Open this project in VS Code.
   - Press **F5** to start the "Extension Development Host".
   - In the new window, find the **Figmatic** icon in the Activity Bar (sidebar).
   - Enter your Figma File Key and optional instructions.
   - Click **🚀 Generate Architect Plan**.

---

## Українська

### Що таке Figmatic?
**Figmatic** — це поєднання **Figma** та **Automatic**. Це просунуте **розширення для VS Code** на базі ШІ, створене для перетворення дизайнів Figma на готовий до продакшену код прямо у вашому редакторі. Figmatic працює як "Senior Frontend Architect", плануючи архітектуру та створюючи чистий React + SCSS код.

### Основні можливості ✨
- **Нативна панель VS Code**: Спеціальний інтерфейс у бічній панелі для керування генерацією.
- **Глобальні токени**: Автоматичне вилучення кольорів та типографіки.
- **Оркестрація сторінки**: Створення структури всього лендінгу.
- **Керування асетами**: Завантаження картинок та іконок прямо з Figma.
- **Інтерактивні правки**: Можливість давати текстові уточнення для коригування коду.

### Технічне налаштування 🛠️

#### Встановлення та запуск
1. Клонуйте репозиторій та виконайте `npm install`.
2. Створіть файл `.env` у корені.
3. **Запуск у VS Code**:
   - Відкрийте цей проєкт у VS Code.
   - Натисніть **F5**, щоб запустити "Extension Development Host".
   - У новому вікні знайдіть іконку **Figmatic** у бічній панелі.
   - Введіть File Key та інструкції.
   - Натисніть **🚀 Generate Architect Plan**.

---

## License & Copyright
Copyright (c) 2024 Oleksandr Shvachko. All rights reserved.
Personal use is allowed; commercial use prohibited without permission. See [LICENSE](LICENSE) for details.
